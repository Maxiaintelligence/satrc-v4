/**
 * @file src/motor/pipeline/evaluacion.js
 * @description Implementación determinista del Paso 3 del pipeline: Evaluación de los 4 vectores
 * de riesgo base (Deslave, Inundación, Viento y Temperatura) y factor de exposición topográfica.
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
  WIND_CHILL_VIENTO_MIN_KMH
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