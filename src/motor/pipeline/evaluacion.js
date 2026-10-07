/**
 * @file src/motor/pipeline/evaluacion.js
 * @description Implementación determinista del Paso 3 del pipeline: Evaluación multivectorial
 * (6 vectores de riesgo), regla en cascada, guardarraíl serrano, jerarquía de desempate y envolvente asimétrica.
 */

import {
  DESLAVE_CONSTANTE_BASE,
  DESLAVE_FACTOR_PENDIENTE,
  DESLAVE_PISO_UMBRAL_MM,
  FACTOR_RELIEVE_LADERA,
  FACTOR_RELIEVE_LOMA,
  FACTOR_RELIEVE_DEFAULT,
  DESLAVE_FACTOR_N4,
  DESLAVE_FACTOR_N2,
  DESLAVE_FACTOR_MODULADOR,
  SPREAD_MODULADOR_FRONTERA_MM,
  OVERRIDE_PENDIENTE_CRITICA_DEG,
  OVERRIDE_SATURACION_N4_MM,
  OVERRIDE_LLUVIA_N3_MM,
  INUNDACION_DIST_CAUCE_N4_KM,
  INUNDACION_TWI_N4_MIN,
  INUNDACION_LLUVIA_N4_MM,
  INUNDACION_DIST_CAUCE_N3_KM,
  INUNDACION_TWI_N3_MIN,
  INUNDACION_LLUVIA_N3_MM,
  INUNDACION_LLUVIA_N2_MM,
  INUNDACION_SATURACION_N2_MM,
  VIENTO_RAFAGA_N4_KMH,
  VIENTO_SOSTENIDO_N4_KMH,
  VIENTO_RAFAGA_N3_KMH,
  VIENTO_SOSTENIDO_N3_KMH,
  VIENTO_RAFAGA_N2_KMH,
  TEMPERATURA_ALTITUD_ALTA_MSNM,
  TEMPERATURA_ALTITUD_MEDIA_MSNM,
  HELADA_NEGRA_HUMEDAD_MAX_PCT,
  TEMPERATURA_N4_MIN_C,
  WIND_CHILL_N4_MIN_C,
  TEMPERATURA_N3_MIN_C,
  WIND_CHILL_N3_MIN_C,
  TEMPERATURA_N2_MIN_C,
  WIND_CHILL_N2_MIN_C,
  WIND_CHILL_TEMP_CORTE_C,
  WIND_CHILL_VIENTO_MIN_KMH,
  NIEBLA_VISIBILIDAD_N4_M,
  NIEBLA_HUMEDAD_N4_MIN_PCT,
  NIEBLA_VISIBILIDAD_N3_M,
  NIEBLA_HUMEDAD_N3_MIN_PCT,
  NIEBLA_VISIBILIDAD_N2_M,
  NIEBLA_HUMEDAD_N2_MIN_PCT,
  AISLAMIENTO_DIST_HOSPITAL_N4_KM,
  AISLAMIENTO_LLUVIA_N4_MM,
  AISLAMIENTO_DIST_HOSPITAL_N3_KM,
  AISLAMIENTO_LLUVIA_N3_MM,
  AISLAMIENTO_LLUVIA_ESTATAL_N2_MM,
  AISLAMIENTO_LLUVIA_TERRACERIA_N2_MM,
  SERRANA_ALTITUD_MIN_MSNM,
  SERRANA_PENDIENTE_MIN_DEG,
  SERRANA_GUARDA_RAFAGA_KMH,
  JERARQUIA_VECTORES,
  MAPA_NIVELES_COLORES
} from "../../config/constantes.js";

/**
 * Aplica el factor de exposición permanente (barlovento / sotavento / mixto) a la lluvia acumulada de 24h.
 * @param {Object} params - Parámetros de entrada.
 * @param {number} params.lluvia24hBase - Lluvia sinóptica consensuada en 24h (mm).
 * @param {number} params.factorExposicion - Coeficiente estático [0.85 .. 1.20].
 * @returns {number} Lluvia acumulada ajustada por orografía (mm).
 */
export function aplicarFactorExposicion({ lluvia24hBase, factorExposicion }) {
  if (typeof lluvia24hBase !== "number" || Number.isNaN(lluvia24hBase)) {
    throw new Error("aplicarFactorExposicion: lluvia24hBase debe ser un número válido.");
  }
  if (typeof factorExposicion !== "number" || Number.isNaN(factorExposicion) || factorExposicion <= 0) {
    throw new Error("aplicarFactorExposicion: factorExposicion debe ser un número positivo válido.");
  }

  return Number((lluvia24hBase * factorExposicion).toFixed(2));
}

/**
 * Evalúa el Vector 1: Deslave y movimientos de ladera mediante fórmula dinámica,
 * modulación precautoria por spread y guardarraíles de pendiente crítica (>= 45°).
 *
 * @param {Object} params - Parámetros de evaluación.
 * @param {Object} params.localidad - Metadatos de la localidad (pendiente_max_deg, relieve_tipo).
 * @param {number} params.saturacionTotal - Saturación antecedente + lluvia prevista 24h (mm).
 * @param {number} params.lluvia24h - Lluvia acumulada en 24h (mm).
 * @param {number} params.spreadMax - Spread máximo de precipitación entre los 3 modelos (mm).
 * @param {Object} [params.logger] - Logger estructurado.
 * @returns {{ nivel: number, umbralCalculado: number, causaDominante: string }} Nivel y diagnóstico del vector.
 */
export function evaluarVectorDeslave({ localidad, saturacionTotal, lluvia24h, spreadMax, logger }) {
  if (!localidad || typeof localidad.pendiente_max_deg !== "number") {
    throw new Error("evaluarVectorDeslave: Localidad inválida o sin pendiente_max_deg.");
  }

  let factorRelieve = FACTOR_RELIEVE_DEFAULT;
  if (localidad.relieve_tipo === "LADERA") {
    factorRelieve = FACTOR_RELIEVE_LADERA;
  } else if (localidad.relieve_tipo === "LOMA") {
    factorRelieve = FACTOR_RELIEVE_LOMA;
  }

  const umbralCalculado = Math.max(
    DESLAVE_PISO_UMBRAL_MM,
    DESLAVE_CONSTANTE_BASE - (localidad.pendiente_max_deg * DESLAVE_FACTOR_PENDIENTE) - factorRelieve
  );

  let nivel = 1;
  if (saturacionTotal >= (umbralCalculado * DESLAVE_FACTOR_N4)) {
    nivel = 4;
  } else if (saturacionTotal >= umbralCalculado) {
    nivel = 3;
  } else if (saturacionTotal >= (umbralCalculado * DESLAVE_FACTOR_N2)) {
    nivel = 2;
  }

  if (
    spreadMax > SPREAD_MODULADOR_FRONTERA_MM &&
    saturacionTotal >= (umbralCalculado * DESLAVE_FACTOR_MODULADOR) &&
    nivel < 4
  ) {
    if (logger && typeof logger.debug === "function") {
      logger.debug({
        evento: "DESLAVE_MODULADOR_SPREAD_ACTIVADO",
        loc_id_global: localidad.loc_id_global,
        spreadMax,
        saturacionTotal,
        umbralCalculado,
        nivelPrevio: nivel,
        nivelAjustado: nivel + 1
      });
    }
    nivel += 1;
  }

  if (localidad.pendiente_max_deg >= OVERRIDE_PENDIENTE_CRITICA_DEG) {
    if (saturacionTotal >= OVERRIDE_SATURACION_N4_MM) {
      nivel = 4;
    } else if (lluvia24h >= OVERRIDE_LLUVIA_N3_MM) {
      nivel = Math.max(nivel, 3);
    }
  }

  return {
    nivel,
    umbralCalculado: Number(umbralCalculado.toFixed(2)),
    causaDominante: "DESLAVE"
  };
}

/**
 * Evalúa el Vector 2: Inundaciones y crecidas repentinas en función de TWI, distancia al cauce y lluvia.
 *
 * @param {Object} params - Parámetros de evaluación.
 * @param {Object} params.localidad - Metadatos de la localidad (dist_cauce_km, twi).
 * @param {number} params.lluvia24h - Lluvia acumulada prevista en 24h (mm).
 * @param {number} params.saturacionTotal - Saturación acumulada total (mm).
 * @returns {{ nivel: number, causaDominante: string }} Nivel y causa.
 */
export function evaluarVectorInundacion({ localidad, lluvia24h, saturacionTotal }) {
  if (!localidad || typeof localidad.dist_cauce_km !== "number" || typeof localidad.twi !== "number") {
    throw new Error("evaluarVectorInundacion: Localidad inválida o sin dist_cauce_km / twi.");
  }

  let nivel = 1;

  if (
    localidad.dist_cauce_km <= INUNDACION_DIST_CAUCE_N4_KM &&
    localidad.twi >= INUNDACION_TWI_N4_MIN &&
    lluvia24h >= INUNDACION_LLUVIA_N4_MM
  ) {
    nivel = 4;
  } else if (
    localidad.dist_cauce_km <= INUNDACION_DIST_CAUCE_N3_KM &&
    localidad.twi >= INUNDACION_TWI_N3_MIN &&
    lluvia24h >= INUNDACION_LLUVIA_N3_MM
  ) {
    nivel = 3;
  } else if (
    lluvia24h >= INUNDACION_LLUVIA_N2_MM ||
    saturacionTotal >= INUNDACION_SATURACION_N2_MM
  ) {
    nivel = 2;
  }

  return {
    nivel,
    causaDominante: "INUNDACION"
  };
}

/**
 * Evalúa el Vector 3: Viento sostenido y ráfagas turbulentas.
 *
 * @param {Object} params - Parámetros de evaluación.
 * @param {number} params.vientoMax - Velocidad máxima sostenida de viento (km/h).
 * @param {number} params.rafagaMax - Ráfaga máxima de viento (km/h).
 * @returns {{ nivel: number, causaDominante: string }} Nivel y causa.
 */
export function evaluarVectorViento({ vientoMax, rafagaMax }) {
  if (typeof vientoMax !== "number" || typeof rafagaMax !== "number") {
    throw new Error("evaluarVectorViento: vientoMax y rafagaMax deben ser números.");
  }

  let nivel = 1;

  if (rafagaMax >= VIENTO_RAFAGA_N4_KMH || vientoMax >= VIENTO_SOSTENIDO_N4_KMH) {
    nivel = 4;
  } else if (rafagaMax >= VIENTO_RAFAGA_N3_KMH || vientoMax >= VIENTO_SOSTENIDO_N3_KMH) {
    nivel = 3;
  } else if (rafagaMax >= VIENTO_RAFAGA_N2_KMH) {
    nivel = 2;
  }

  return {
    nivel,
    causaDominante: "VIENTO"
  };
}

/**
 * Evalúa el Vector 4: Temperatura mínima, Heladas (Blanca y Negra) y Sensación Térmica (Wind Chill JAG/TI).
 *
 * @param {Object} params - Parámetros de evaluación.
 * @param {Object} params.localidad - Metadatos de la localidad (altitud_msnm).
 * @param {number} params.tempMin - Temperatura mínima prevista (°C).
 * @param {number} params.vientoMax - Velocidad de viento concomitante (km/h).
 * @param {number} params.rhMin - Humedad relativa mínima prevista (%).
 * @returns {{ nivel: number, causaDominante: string, tipoEvento: string, windChill: number }} Nivel, diagnóstico y sensación.
 */
export function evaluarVectorTemperatura({ localidad, tempMin, vientoMax, rhMin }) {
  if (!localidad || typeof localidad.altitud_msnm !== "number") {
    throw new Error("evaluarVectorTemperatura: Localidad inválida o sin altitud_msnm.");
  }
  if (typeof tempMin !== "number" || typeof vientoMax !== "number" || typeof rhMin !== "number") {
    throw new Error("evaluarVectorTemperatura: tempMin, vientoMax y rhMin deben ser numéricos.");
  }

  let wc = tempMin;
  if (tempMin <= WIND_CHILL_TEMP_CORTE_C && vientoMax >= WIND_CHILL_VIENTO_MIN_KMH) {
    const vPow = Math.pow(vientoMax, 0.16);
    wc = 13.12 + (0.6215 * tempMin) - (11.37 * vPow) + (0.3965 * tempMin * vPow);
  }

  const esHeladaNegra = (tempMin <= 0.0) &&
    (rhMin < HELADA_NEGRA_HUMEDAD_MAX_PCT) &&
    (localidad.altitud_msnm >= TEMPERATURA_ALTITUD_ALTA_MSNM);

  let nivel = 1;
  let tipoEvento = "NINGUNO";

  if (esHeladaNegra || wc <= WIND_CHILL_N4_MIN_C || tempMin <= TEMPERATURA_N4_MIN_C) {
    nivel = 4;
    tipoEvento = esHeladaNegra ? "HELADA_NEGRA" : "WIND_CHILL_EXTREMO";
  } else if (
    tempMin <= TEMPERATURA_N3_MIN_C ||
    (wc <= WIND_CHILL_N3_MIN_C && localidad.altitud_msnm >= TEMPERATURA_ALTITUD_ALTA_MSNM)
  ) {
    nivel = 3;
    tipoEvento = "HELADA_BLANCA";
  } else if (
    tempMin <= TEMPERATURA_N2_MIN_C ||
    (wc <= WIND_CHILL_N2_MIN_C && localidad.altitud_msnm >= TEMPERATURA_ALTITUD_MEDIA_MSNM)
  ) {
    nivel = 2;
    tipoEvento = "FRIO_MODERADO";
  }

  return {
    nivel,
    causaDominante: "TEMPERATURA",
    tipoEvento,
    windChill: Number(wc.toFixed(2))
  };
}

/**
 * Evalúa el Vector 5: Niebla Orográfica en función de visibilidad, humedad relativa y relieve serrano.
 *
 * @param {Object} params - Parámetros de evaluación.
 * @param {Object} params.localidad - Metadatos de la localidad.
 * @param {number} params.visibilidadMin - Visibilidad mínima prevista en 24h (metros).
 * @param {number} params.rhMax - Humedad relativa máxima prevista (%).
 * @param {boolean} params.esSerrana - Bandera de comunidad serrana.
 * @returns {{ nivel: number, causaDominante: string }} Nivel y causa.
 */
export function evaluarVectorNiebla({ localidad: _loc, visibilidadMin, rhMax, esSerrana }) {
  if (typeof visibilidadMin !== "number" || typeof rhMax !== "number") {
    throw new Error("evaluarVectorNiebla: visibilidadMin y rhMax deben ser numéricos.");
  }

  let nivel = 1;

  if (
    visibilidadMin < NIEBLA_VISIBILIDAD_N4_M &&
    rhMax >= NIEBLA_HUMEDAD_N4_MIN_PCT &&
    esSerrana === true
  ) {
    nivel = 4;
  } else if (
    visibilidadMin < NIEBLA_VISIBILIDAD_N3_M &&
    rhMax >= NIEBLA_HUMEDAD_N3_MIN_PCT
  ) {
    nivel = 3;
  } else if (
    visibilidadMin < NIEBLA_VISIBILIDAD_N2_M &&
    rhMax >= NIEBLA_HUMEDAD_N2_MIN_PCT
  ) {
    nivel = 2;
  }

  return {
    nivel,
    causaDominante: "NIEBLA"
  };
}

/**
 * Evalúa el Vector 6: Aislamiento Vial y Vulnerabilidad de Red de Caminos.
 *
 * @param {Object} params - Parámetros de evaluación.
 * @param {Object} params.localidad - Metadatos (acceso_vial, dist_hospital_km).
 * @param {number} params.lluvia24h - Lluvia acumulada en 24h (mm).
 * @param {number} params.nivelDeslave - Nivel de alerta calculado por deslave (1..4).
 * @returns {{ nivel: number, causaDominante: string }} Nivel y causa.
 */
export function evaluarVectorAislamiento({ localidad, lluvia24h, nivelDeslave }) {
  if (!localidad || typeof localidad.acceso_vial !== "string" || typeof localidad.dist_hospital_km !== "number") {
    throw new Error("evaluarVectorAislamiento: Localidad inválida o sin acceso_vial / dist_hospital_km.");
  }
  if (typeof lluvia24h !== "number" || typeof nivelDeslave !== "number") {
    throw new Error("evaluarVectorAislamiento: lluvia24h y nivelDeslave deben ser numéricos.");
  }

  const esAccesoPrecario = localidad.acceso_vial === "BRECHA" || localidad.acceso_vial === "CAMINO_TERRACERIA";
  let nivel = 1;

  if (
    esAccesoPrecario &&
    (lluvia24h >= AISLAMIENTO_LLUVIA_N4_MM || nivelDeslave >= 3) &&
    localidad.dist_hospital_km >= AISLAMIENTO_DIST_HOSPITAL_N4_KM
  ) {
    nivel = 4;
  } else if (
    esAccesoPrecario &&
    (lluvia24h >= AISLAMIENTO_LLUVIA_N3_MM || nivelDeslave >= 2) &&
    localidad.dist_hospital_km >= AISLAMIENTO_DIST_HOSPITAL_N3_KM
  ) {
    nivel = 3;
  } else if (
    (localidad.acceso_vial === "CARRETERA_ESTATAL" && lluvia24h >= AISLAMIENTO_LLUVIA_ESTATAL_N2_MM) ||
    (localidad.acceso_vial === "CAMINO_TERRACERIA" && lluvia24h >= AISLAMIENTO_LLUVIA_TERRACERIA_N2_MM)
  ) {
    nivel = 2;
  }

  return {
    nivel,
    causaDominante: "AISLAMIENTO_VIAL"
  };
}

/**
 * Determina deterministamente si un asentamiento humano clasifica como comunidad serrana.
 * @param {Object} params - Parámetros.
 * @param {Object} params.localidad - Metadatos (altitud_msnm, relieve_tipo, pendiente_max_deg).
 * @returns {boolean} True si es comunidad serrana.
 */
export function calcularEsComunidadSerrana({ localidad }) {
  if (!localidad || typeof localidad.altitud_msnm !== "number") {
    throw new Error("calcularEsComunidadSerrana: Localidad inválida o sin altitud_msnm.");
  }

  const esRelieveSerrano = localidad.relieve_tipo === "LADERA" || localidad.relieve_tipo === "LOMA";
  const esPendienteAbrupta = (localidad.pendiente_max_deg || 0) >= SERRANA_PENDIENTE_MIN_DEG;

  return (
    localidad.altitud_msnm >= SERRANA_ALTITUD_MIN_MSNM &&
    (esRelieveSerrano || esPendienteAbrupta)
  );
}

/**
 * Resuelve deterministamente el vector dominante en caso de empate según la jerarquía inmutable de severidad.
 * @param {Object} params - Parámetros.
 * @param {Object} params.nivelesPorVector - Niveles individuales de los 6 vectores { deslave, inundacion, ... }.
 * @returns {{ vectorDominante: string }} Causa dominante ganadora.
 */
export function resolverJerarquiaDesempate({ nivelesPorVector }) {
  if (!nivelesPorVector) {
    throw new Error("resolverJerarquiaDesempate: Se requiere el objeto nivelesPorVector.");
  }

  const mapeoNiveles = {
    DESLAVE: nivelesPorVector.deslave,
    INUNDACION: nivelesPorVector.inundacion,
    AISLAMIENTO_VIAL: nivelesPorVector.aislamiento,
    TEMPERATURA: nivelesPorVector.temperatura,
    VIENTO: nivelesPorVector.viento,
    NIEBLA: nivelesPorVector.niebla
  };

  const nivelMax = Math.max(...Object.values(mapeoNiveles));

  for (const vector of JERARQUIA_VECTORES) {
    if (mapeoNiveles[vector] === nivelMax) {
      return { vectorDominante: vector };
    }
  }

  return { vectorDominante: "DESLAVE" };
}

/**
 * Ejecuta el Paso 3 de Evaluación Multivectorial Completa para una localidad.
 * Función pura con inyección total de dependencias y determinismo estricto.
 *
 * @param {Object} params - Parámetros de ejecución.
 * @param {Object} params.localidad - Metadatos estáticos de la localidad.
 * @param {Array<Object>} params.consenso24h - 24 registros horarios de consenso (ventana 168..191).
 * @param {Object} params.api7dias - Objeto de salida del Paso 2 (memoria hídrica).
 * @param {number} params.factorExposicion - Coeficiente orográfico estático [0.85 .. 1.20].
 * @param {string} params.timestamp_evaluacion - Timestamp ISO 8601 UTC-6 de la corrida.
 * @param {Object} [params.logger] - Logger estructurado.
 * @param {function(unknown): {valido: boolean, errores: Array<{ruta: string, mensaje: string}>}} [params.validadorSchema] - Validador de schema.
 * @returns {Object} Objeto completo de evaluación conforme a evaluacion_localidad.schema.json.
 */
export function ejecutarPaso3Evaluacion({
  localidad,
  consenso24h,
  api7dias,
  factorExposicion,
  timestamp_evaluacion,
  logger,
  validadorSchema
}) {
  if (!localidad || !localidad.loc_id_global || !localidad.zona_id) {
    throw new Error("Paso 3 Evaluación: Metadatos de localidad incompletos.");
  }
  if (!Array.isArray(consenso24h) || consenso24h.length !== 24) {
    throw new Error(`Paso 3 Evaluación: consenso24h debe tener exactamente 24 registros horarios en ${localidad.loc_id_global}.`);
  }
  if (!api7dias || typeof api7dias.api_7dias_mm !== "number") {
    throw new Error(`Paso 3 Evaluación: api7dias inválido en localidad ${localidad.loc_id_global}.`);
  }
  if (!timestamp_evaluacion || typeof timestamp_evaluacion !== "string") {
    throw new Error("Paso 3 Evaluación: Se requiere timestamp_evaluacion.");
  }

  let lluvia24hBase = 0.0;
  let lluviaHorariaMax = 0.0;
  let horaPico = consenso24h[0].timestamp_utc6;
  let tempMin = Infinity;
  let tempMax = -Infinity;
  let vientoMax = 0.0;
  let rafagaMax = 0.0;
  let rhMin = Infinity;
  let rhMax = -Infinity;
  let visibilidadMin = Infinity;
  let spreadMax = 0.0;

  for (const h of consenso24h) {
    const p = h.lluvia_consenso_mm || 0.0;
    lluvia24hBase += p;

    if (p > lluviaHorariaMax) {
      lluviaHorariaMax = p;
      horaPico = h.timestamp_utc6;
    }

    if (h.temperatura_consenso_c < tempMin) tempMin = h.temperatura_consenso_c;
    if (h.temperatura_consenso_c > tempMax) tempMax = h.temperatura_consenso_c;
    if (h.viento_max_kmh > vientoMax) vientoMax = h.viento_max_kmh;
    if (h.rafaga_max_kmh > rafagaMax) rafagaMax = h.rafaga_max_kmh;
    if (h.humedad_relativa_pct < rhMin) rhMin = h.humedad_relativa_pct;
    if (h.humedad_relativa_pct > rhMax) rhMax = h.humedad_relativa_pct;
    if (h.visibilidad_m < visibilidadMin) visibilidadMin = h.visibilidad_m;
    if (h.spread_lluvia_mm > spreadMax) spreadMax = h.spread_lluvia_mm;
  }

  const lluvia24h = aplicarFactorExposicion({ lluvia24hBase, factorExposicion });
  const saturacionTotal = Number((api7dias.api_7dias_mm + lluvia24h).toFixed(2));
  const esSerrana = calcularEsComunidadSerrana({ localidad });

  const vecDeslave = evaluarVectorDeslave({
    localidad,
    saturacionTotal,
    lluvia24h,
    spreadMax,
    logger
  });

  const vecInundacion = evaluarVectorInundacion({
    localidad,
    lluvia24h,
    saturacionTotal
  });

  const vecViento = evaluarVectorViento({
    vientoMax,
    rafagaMax
  });

  const vecTemperatura = evaluarVectorTemperatura({
    localidad,
    tempMin,
    vientoMax,
    rhMin
  });

  const vecNiebla = evaluarVectorNiebla({
    localidad,
    visibilidadMin,
    rhMax,
    esSerrana
  });

  const vecAislamiento = evaluarVectorAislamiento({
    localidad,
    lluvia24h,
    nivelDeslave: vecDeslave.nivel
  });

  const nivelesPorVector = {
    deslave: vecDeslave.nivel,
    inundacion: vecInundacion.nivel,
    aislamiento: vecAislamiento.nivel,
    temperatura: vecTemperatura.nivel,
    viento: vecViento.nivel,
    niebla: vecNiebla.nivel
  };

  let nivelFinal = 1;
  let vectorDominante = "DESLAVE";

  if (vecDeslave.nivel >= 3 && vecAislamiento.nivel >= 3) {
    nivelFinal = 4;
    vectorDominante = "COMBINADO_CASCADA";
  } else {
    nivelFinal = Math.max(...Object.values(nivelesPorVector));
    const resJerarquia = resolverJerarquiaDesempate({ nivelesPorVector });
    vectorDominante = resJerarquia.vectorDominante;
  }

  if (esSerrana && nivelFinal === 1 && rafagaMax >= SERRANA_GUARDA_RAFAGA_KMH) {
    nivelFinal = 2;
    vectorDominante = "VIENTO";
  }

  const colorAlerta = MAPA_NIVELES_COLORES[nivelFinal];

  const resultado = {
    loc_id_global: localidad.loc_id_global,
    zona_id: localidad.zona_id,
    timestamp_evaluacion,
    nivel_alerta: nivelFinal,
    color_alerta: colorAlerta,
    vector_dominante: vectorDominante,
    vectores: {
      deslave: vecDeslave.nivel,
      inundacion: vecInundacion.nivel,
      viento: vecViento.nivel,
      temperatura: vecTemperatura.nivel,
      niebla: vecNiebla.nivel,
      aislamiento_vial: vecAislamiento.nivel
    },
    metricas_clave: {
      lluvia_acumulada_24h_mm: Number(lluvia24h.toFixed(2)),
      lluvia_horaria_max_mm: Number(lluviaHorariaMax.toFixed(2)),
      hora_pico: horaPico,
      temperatura_min_c: Number(tempMin.toFixed(2)),
      temperatura_max_c: Number(tempMax.toFixed(2)),
      viento_max_kmh: Number(vientoMax.toFixed(2)),
      rafaga_max_kmh: Number(rafagaMax.toFixed(2)),
      visibilidad_min_m: Number(visibilidadMin.toFixed(1)),
      api_7dias_mm: Number(api7dias.api_7dias_mm.toFixed(2)),
      saturacion_total_mm: Number(saturacionTotal.toFixed(2)),
      umbral_deslave_mm: Number(vecDeslave.umbralCalculado.toFixed(2)),
      spread_max_mm: Number(spreadMax.toFixed(2))
    },
    impacto_sistemico: {
      es_comunidad_serrana: esSerrana,
      poblacion_afectada: localidad.poblacion || 0,
      poblacion_aguas_arriba: localidad.poblacion_aguas_arriba || 0,
      aislamiento_vial_posible: vecAislamiento.nivel >= 3
    }
  };

  if (typeof validadorSchema === "function") {
    const resVal = validadorSchema(resultado);
    if (!resVal.valido) {
      throw new Error(
        `Paso 3 Evaluación: Objeto generado no cumple schema en ${localidad.loc_id_global}: ` +
        JSON.stringify(resVal.errores)
      );
    }
  }

  return resultado;
}