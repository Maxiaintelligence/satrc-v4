/**
 * @file src/supabase/queries.js
 * @description Operaciones deterministas de lectura y persistencia de datos sobre PostgreSQL/Supabase.
 */

import { HORAS_HISTORIAL_API } from "../config/constantes.js";

/**
 * Lee el catálogo de localidades estáticas desde la tabla localidades_base.
 * @param {import('@supabase/supabase-js').SupabaseClient} client - Cliente Supabase.
 * @returns {Promise<Array<Object>>} Lista de 405 localidades con sus variables territoriales.
 */
export async function leerLocalidades(client) {
  if (!client || typeof client.from !== "function") {
    throw new Error("leerLocalidades: Cliente Supabase inválido.");
  }

  const { data, error } = await client
    .from("localidades_base")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`leerLocalidades [PostgREST]: ${error.message}`);
  }

  return data || [];
}

/**
 * Obtiene la serie temporal histórica de hasta 168 horas para una localidad desde condiciones_historico.
 * @param {import('@supabase/supabase-js').SupabaseClient} client - Cliente Supabase.
 * @param {string} locIdGlobal - Identificador canónico de la localidad.
 * @returns {Promise<Array<{ timestamp_utc6: string, lluvia_consenso_mm: number }>>} Registros ordenados del más reciente al más antiguo.
 */
export async function leerHistorial168h(client, locIdGlobal) {
  if (!client || typeof client.from !== "function") {
    throw new Error("leerHistorial168h: Cliente Supabase inválido.");
  }
  if (!locIdGlobal || typeof locIdGlobal !== "string") {
    throw new Error("leerHistorial168h: Se requiere locIdGlobal válido.");
  }

  const { data, error } = await client
    .from("condiciones_historico")
    .select("timestamp_utc6, lluvia_consenso_mm")
    .eq("loc_id_global", locIdGlobal)
    .order("timestamp_utc6", { ascending: false })
    .limit(HORAS_HISTORIAL_API);

  if (error) {
    throw new Error(`leerHistorial168h [PostgREST] en ${locIdGlobal}: ${error.message}`);
  }

  return (data || []).map(r => ({
    timestamp_utc6: r.timestamp_utc6,
    lluvia_consenso_mm: Number(r.lluvia_consenso_mm)
  }));
}

/**
 * Inserta un evento estructurado de auditoría en la tabla bitacora.
 * @param {import('@supabase/supabase-js').SupabaseClient} client - Cliente Supabase.
 * @param {Object} evento - Payload del evento según bitacora.sql.
 * @returns {Promise<{ ok: boolean, id: number|null }>} Estado y clave primaria generada.
 */
export async function escribirBitacora(client, evento) {
  if (!client || typeof client.from !== "function") {
    throw new Error("escribirBitacora: Cliente Supabase inválido.");
  }
  if (!evento || typeof evento !== "object") {
    throw new Error("escribirBitacora: Se requiere objeto evento.");
  }

  const fila = {
    categoria: evento.categoria,
    tipo_evento: evento.tipo_evento,
    severidad: evento.severidad,
    origen: evento.origen || "automatico",
    actor: evento.actor || "SARA_PIPELINE",
    motor_version: evento.motor_version || "v4.0",
    alcance: evento.alcance || "GLOBAL",
    zona_id: evento.zona_id || null,
    loc_id_global: evento.loc_id_global || null,
    mensaje: evento.mensaje,
    contexto: evento.contexto || {}
  };

  const { data, error } = await client
    .from("bitacora")
    .insert([fila])
    .select("id")
    .single();

  if (error) {
    throw new Error(`escribirBitacora [PostgREST]: ${error.message}`);
  }

  return { ok: true, id: data ? data.id : null };
}

/**
 * Transforma puramente un objeto de evaluación del motor al esquema relacional de bitacora_pronosticos.
 * @param {Object} evaluacion - Objeto de evaluación del Paso 3.
 * @param {string} corridaId - UUID de la corrida.
 * @param {string} timestampUtc6 - Timestamp ISO de la evaluación.
 * @param {Object} [hashesFuente={}] - Hashes SHA-256 auditables de los modelos.
 * @returns {Object} Fila mapeada con los 28 campos exactos de bitacora_pronosticos.
 */
export function mapearEvaluacionABitacora(evaluacion, corridaId, timestampUtc6, hashesFuente = {}) {
  if (!evaluacion || !evaluacion.loc_id_global || !evaluacion.zona_id || !evaluacion.vectores || !evaluacion.metricas_clave) {
    throw new Error("mapearEvaluacionABitacora: Objeto de evaluación incompleto o inválido.");
  }
  if (!corridaId || typeof corridaId !== "string") {
    throw new Error("mapearEvaluacionABitacora: Se requiere corridaId válido.");
  }
  if (!timestampUtc6 || typeof timestampUtc6 !== "string") {
    throw new Error("mapearEvaluacionABitacora: Se requiere timestampUtc6 válido.");
  }

  const v = evaluacion.vectores;
  const m = evaluacion.metricas_clave;

  return {
    corrida_id: corridaId,
    timestamp_utc6: timestampUtc6,
    loc_id_global: evaluacion.loc_id_global,
    zona_id: evaluacion.zona_id,
    motor_version: "v4.0",
    nivel_alerta: evaluacion.nivel_alerta,
    color_alerta: evaluacion.color_alerta,
    vector_dominante: evaluacion.vector_dominante,
    nivel_deslave: v.deslave,
    nivel_inundacion: v.inundacion,
    nivel_viento: v.viento,
    nivel_temperatura: v.temperatura,
    nivel_niebla: v.niebla,
    nivel_aislamiento: v.aislamiento_vial,
    lluvia_acumulada_24h_mm: m.lluvia_acumulada_24h_mm,
    lluvia_horaria_max_mm: m.lluvia_horaria_max_mm,
    hora_pico: m.hora_pico,
    temperatura_min_c: m.temperatura_min_c,
    temperatura_max_c: m.temperatura_max_c,
    viento_max_kmh: m.viento_max_kmh,
    rafaga_max_kmh: m.rafaga_max_kmh,
    visibilidad_min_m: m.visibilidad_min_m,
    api_7dias_mm: m.api_7dias_mm,
    saturacion_total_mm: m.saturacion_total_mm,
    umbral_deslave_mm: m.umbral_deslave_mm,
    spread_max_mm: m.spread_max_mm,
    hashes_fuente: hashesFuente || {},
    dictamen_narrativo: null
  };
}

/**
 * Inserta masivamente las evaluaciones en la tabla bitacora_pronosticos.
 * @param {import('@supabase/supabase-js').SupabaseClient} client - Cliente Supabase.
 * @param {Array<Object>} evaluaciones - Evaluaciones generadas por el motor.
 * @param {string} corridaId - Identificador único de corrida.
 * @param {string} timestampUtc6 - Marca temporal de evaluación.
 * @param {Object} [hashesFuente={}] - Hashes SHA-256 de las fuentes meteorológicas.
 * @returns {Promise<{ ok: boolean, filas: number }>}
 */
export async function escribirEvaluaciones(client, evaluaciones, corridaId, timestampUtc6, hashesFuente = {}) {
  if (!client || typeof client.from !== "function") {
    throw new Error("escribirEvaluaciones: Cliente Supabase inválido.");
  }
  if (!Array.isArray(evaluaciones) || evaluaciones.length === 0) {
    return { ok: true, filas: 0 };
  }

  const filas = evaluaciones.map(ev => mapearEvaluacionABitacora(ev, corridaId, timestampUtc6, hashesFuente));

  const { data, error } = await client
    .from("bitacora_pronosticos")
    .upsert(filas, { onConflict: "corrida_id,loc_id_global" })
    .select("id");

  if (error) {
    throw new Error(`escribirEvaluaciones [PostgREST]: ${error.message}`);
  }

  return { ok: true, filas: data ? data.length : filas.length };
}

/**
 * Actualiza el dictamen narrativo para las localidades correspondientes en bitacora_pronosticos.
 * @param {import('@supabase/supabase-js').SupabaseClient} client - Cliente Supabase.
 * @param {string} corridaId - Identificador de corrida.
 * @param {Record<string, Object>|Map<string, Object>} dictamenesPorLoc - Diccionario { [loc_id_global]: dictamen }.
 * @returns {Promise<{ ok: boolean, actualizadas: number }>}
 */
export async function actualizarDictamenesEnEvaluaciones(client, corridaId, dictamenesPorLoc) {
  if (!client || typeof client.from !== "function") {
    throw new Error("actualizarDictamenesEnEvaluaciones: Cliente Supabase inválido.");
  }
  if (!corridaId) {
    throw new Error("actualizarDictamenesEnEvaluaciones: Se requiere corridaId.");
  }

  const entradas = dictamenesPorLoc instanceof Map
    ? Array.from(dictamenesPorLoc.entries())
    : Object.entries(dictamenesPorLoc || {});

  if (entradas.length === 0) {
    return { ok: true, actualizadas: 0 };
  }

  let actualizadas = 0;
  for (const [locIdGlobal, dictamen] of entradas) {
    const { error } = await client
      .from("bitacora_pronosticos")
      .update({ dictamen_narrativo: dictamen })
      .eq("corrida_id", corridaId)
      .eq("loc_id_global", locIdGlobal);

    if (error) {
      throw new Error(`actualizarDictamenesEnEvaluaciones [PostgREST] en ${locIdGlobal}: ${error.message}`);
    }
    actualizadas++;
  }

  return { ok: true, actualizadas };
}

/**
 * Realiza un UPSERT masivo sobre la tabla viva condiciones_actuales (PK: loc_id_global).
 * @param {import('@supabase/supabase-js').SupabaseClient} client - Cliente Supabase.
 * @param {Array<Object>} evaluaciones - Evaluaciones del motor.
 * @param {string} corridaId - Identificador de corrida.
 * @param {string} timestampUtc6 - Timestamp de la corrida.
 * @param {Record<string, Object>|Map<string, Object>} [dictamenesPorLoc={}] - Dictámenes generados.
 * @param {Object} [hashesFuente={}] - Hashes SHA-256 de auditoría.
 * @returns {Promise<{ ok: boolean, filas: number }>}
 */
export async function actualizarCondicionesActuales(
  client,
  evaluaciones,
  corridaId,
  timestampUtc6,
  dictamenesPorLoc = {},
  hashesFuente = {}
) {
  if (!client || typeof client.from !== "function") {
    throw new Error("actualizarCondicionesActuales: Cliente Supabase inválido.");
  }
  if (!Array.isArray(evaluaciones) || evaluaciones.length === 0) {
    return { ok: true, filas: 0 };
  }

  const mapaDictamenes = dictamenesPorLoc instanceof Map
    ? dictamenesPorLoc
    : new Map(Object.entries(dictamenesPorLoc || {}));

  const dictamenDefault = {
    titulo: "INFORMACIÓN METEOROLÓGICA",
    causa: "Condiciones estables sin alertamiento activo.",
    recomendaciones: [
      "Mantener comunicación con la brigada parroquial.",
      "Consultar actualizaciones periódicas del sistema."
    ],
    contexto: "SatRC v4.0 - Monitoreo diocesano continuo."
  };

  const filas = evaluaciones.map(ev => {
    const v = ev.vectores;
    const m = ev.metricas_clave;
    const dictamen = mapaDictamenes.get(ev.loc_id_global) || dictamenDefault;

    return {
      loc_id_global: ev.loc_id_global,
      corrida_id: corridaId,
      zona_id: ev.zona_id,
      timestamp_utc6: timestampUtc6,
      motor_version: "v4.0",
      nivel_alerta: ev.nivel_alerta,
      color_alerta: ev.color_alerta,
      vector_dominante: ev.vector_dominante,
      nivel_deslave: v.deslave,
      nivel_inundacion: v.inundacion,
      nivel_viento: v.viento,
      nivel_temperatura: v.temperatura,
      nivel_niebla: v.niebla,
      nivel_aislamiento: v.aislamiento_vial,
      lluvia_acumulada_24h_mm: m.lluvia_acumulada_24h_mm,
      lluvia_horaria_max_mm: m.lluvia_horaria_max_mm,
      hora_pico: m.hora_pico,
      temperatura_min_c: m.temperatura_min_c,
      temperatura_max_c: m.temperatura_max_c,
      viento_max_kmh: m.viento_max_kmh,
      rafaga_max_kmh: m.rafaga_max_kmh,
      visibilidad_min_m: m.visibilidad_min_m,
      api_7dias_mm: m.api_7dias_mm,
      saturacion_total_mm: m.saturacion_total_mm,
      umbral_deslave_mm: m.umbral_deslave_mm,
      spread_max_mm: m.spread_max_mm,
      hashes_fuente: hashesFuente || {},
      dictamen_narrativo: dictamen
    };
  });

  const { data, error } = await client
    .from("condiciones_actuales")
    .upsert(filas, { onConflict: "loc_id_global" })
    .select("loc_id_global");

  if (error) {
    throw new Error(`actualizarCondicionesActuales [PostgREST]: ${error.message}`);
  }

  return { ok: true, filas: data ? data.length : filas.length };
}

/**
 * Obtiene la marca de tiempo más reciente registrada en la tabla condiciones_historico.
 * @param {import('@supabase/supabase-js').SupabaseClient} client - Cliente Supabase.
 * @returns {Promise<string|null>} Timestamp ISO UTC o null si la tabla está vacía.
 */
export async function leerUltimoTimestampHistorico(client) {
  if (!client || typeof client.from !== "function") {
    throw new Error("leerUltimoTimestampHistorico: Cliente Supabase inválido.");
  }

  const { data, error } = await client
    .from("condiciones_historico")
    .select("timestamp_utc6")
    .order("timestamp_utc6", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`leerUltimoTimestampHistorico [PostgREST]: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0].timestamp_utc6;
}