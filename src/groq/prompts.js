/**
 * @file src/groq/prompts.js
 * @description Construcción determinista de prompts para la API de Groq y validación semántica de respuestas.
 */

/**
 * Lista inmutable de campos terminantemente prohibidos en la respuesta JSON de Groq.
 * Garantiza que la IA no altere ni sugiera niveles o colores decretados por el motor determinista.
 */
export const CAMPOS_PROHIBIDOS = Object.freeze(["nivel", "nivel_alerta", "color"]);

const CAMPOS_REQUERIDOS_LOCALIDAD = [
  "loc_id_global",
  "nombre",
  "nivel_decretado",
  "color_decretado",
  "vector_dominante",
  "metricas"
];

const METRICAS_REQUERIDAS = [
  "lluvia_24h_mm",
  "lluvia_max_hora_mm",
  "hora_pico",
  "saturacion_suelo_mm",
  "umbral_deslave_mm",
  "acceso_vial",
  "dist_hospital_km"
];

/**
 * Construye el payload del prompt de usuario para un lote zonal de localidades en alerta (Nivel >= 2).
 * @param {Object} params - Parámetros de entrada.
 * @param {string} params.zona_id - Identificador de zona pastoral (ej. 'SPP').
 * @param {string} params.zona_resguardo - Nombre institucional completo de la zona.
 * @param {Array<Object>} params.localidades_evaluadas - Localidades a redactar.
 * @returns {Object} Objeto JSON serializable listo para el mensaje de usuario.
 */
export function construirUserPromptBatchZonal({ zona_id, zona_resguardo, localidades_evaluadas }) {
  if (!zona_id || typeof zona_id !== "string" || zona_id.trim() === "") {
    throw new Error("construirUserPromptBatchZonal: Se requiere un 'zona_id' válido.");
  }
  if (!zona_resguardo || typeof zona_resguardo !== "string" || zona_resguardo.trim() === "") {
    throw new Error("construirUserPromptBatchZonal: Se requiere un 'zona_resguardo' válido.");
  }
  if (!Array.isArray(localidades_evaluadas) || localidades_evaluadas.length === 0) {
    throw new Error("construirUserPromptBatchZonal: 'localidades_evaluadas' debe ser un arreglo no vacío.");
  }

  for (let i = 0; i < localidades_evaluadas.length; i++) {
    const loc = localidades_evaluadas[i];
    for (const campo of CAMPOS_REQUERIDOS_LOCALIDAD) {
      if (loc[campo] === undefined || loc[campo] === null) {
        throw new Error(`construirUserPromptBatchZonal: Localidad en índice ${i} carece del campo requerido '${campo}'.`);
      }
    }

    const m = loc.metricas;
    if (typeof m !== "object" || m === null) {
      throw new Error(`construirUserPromptBatchZonal: 'metricas' en localidad ${loc.loc_id_global} debe ser un objeto.`);
    }

    for (const metrica of METRICAS_REQUERIDAS) {
      if (m[metrica] === undefined || m[metrica] === null) {
        throw new Error(`construirUserPromptBatchZonal: Falta la métrica '${metrica}' en localidad ${loc.loc_id_global}.`);
      }
    }
  }

  return {
    zona_id: zona_id.trim(),
    zona_resguardo: zona_resguardo.trim(),
    localidades_evaluadas
  };
}

/**
 * Realiza una validación semántica inline del objeto de respuesta entregado por Groq.
 * @param {unknown} respuestaJson - Objeto parseado de la respuesta del modelo.
 * @returns {{ valido: boolean, motivo: string|null }} Resultado de la validación.
 */
export function validarRespuestaGroq(respuestaJson) {
  if (!respuestaJson || typeof respuestaJson !== "object" || Array.isArray(respuestaJson)) {
    return { valido: false, motivo: "La respuesta debe ser un objeto JSON." };
  }

  const dictamenes = respuestaJson.dictamenes;
  if (!Array.isArray(dictamenes) || dictamenes.length === 0) {
    return { valido: false, motivo: "El campo 'dictamenes' debe ser un arreglo no vacío." };
  }

  for (let i = 0; i < dictamenes.length; i++) {
    const d = dictamenes[i];
    if (!d || typeof d !== "object" || Array.isArray(d)) {
      return { valido: false, motivo: `El dictamen en índice ${i} no es un objeto válido.` };
    }

    for (const campoProhibido of CAMPOS_PROHIBIDOS) {
      if (Object.prototype.hasOwnProperty.call(d, campoProhibido)) {
        return {
          valido: false,
          motivo: `El dictamen en índice ${i} contiene el campo prohibido '${campoProhibido}'.`
        };
      }
    }

    if (typeof d.loc_id_global !== "string" || d.loc_id_global.trim() === "") {
      return { valido: false, motivo: `Dictamen ${i}: 'loc_id_global' es requerido y debe ser string.` };
    }
    if (typeof d.titulo !== "string" || d.titulo.trim() === "" || d.titulo.length > 100) {
      return { valido: false, motivo: `Dictamen ${i}: 'titulo' inválido o excede 100 caracteres.` };
    }
    if (typeof d.causa !== "string" || d.causa.trim() === "" || d.causa.length > 300) {
      return { valido: false, motivo: `Dictamen ${i}: 'causa' inválida o excede 300 caracteres.` };
    }
    if (typeof d.contexto !== "string" || d.contexto.trim() === "" || d.contexto.length > 300) {
      return { valido: false, motivo: `Dictamen ${i}: 'contexto' inválido o excede 300 caracteres.` };
    }

    if (!Array.isArray(d.recomendaciones) || d.recomendaciones.length < 2 || d.recomendaciones.length > 5) {
      return {
        valido: false,
        motivo: `Dictamen ${i}: 'recomendaciones' debe ser un arreglo de entre 2 y 5 elementos.`
      };
    }

    for (let j = 0; j < d.recomendaciones.length; j++) {
      const rec = d.recomendaciones[j];
      if (typeof rec !== "string" || rec.trim() === "") {
        return { valido: false, motivo: `Dictamen ${i}, recomendación ${j}: debe ser una cadena no vacía.` };
      }
    }
  }

  return { valido: true, motivo: null };
}