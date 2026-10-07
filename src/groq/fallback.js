/**
 * @file src/groq/fallback.js
 * @description Generador determinista de dictámenes narrativos de respaldo (fallback institucional)
 * cuando la API de Groq no se encuentra disponible o produce respuestas inválidas.
 */

/**
 * Trunca una cadena de texto a un límite máximo de caracteres de forma segura.
 * @param {string} str - Cadena de entrada.
 * @param {number} maxLen - Longitud máxima permitida.
 * @returns {string} Cadena truncada.
 */
function truncarSeguro(str, maxLen) {
  if (typeof str !== "string") return "";
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

/**
 * Genera el cuerpo de la causa técnica personalizada en función del vector dominante.
 * @param {string} vector - Vector dominante de riesgo.
 * @param {Object} [metricas={}] - Métricas hidrometeorológicas y territoriales.
 * @returns {string} Texto explicativo de la causa (máximo 300 caracteres).
 */
function construirCausaVector(vector, metricas = {}) {
  const m = metricas || {};

  switch (vector) {
    case "DESLAVE":
      return `Saturación hídrica de ${m.saturacion_suelo_mm ?? "N/D"} mm frente a un umbral de ${m.umbral_deslave_mm ?? "N/D"} mm. Hora estimada de mayor intensidad: ${m.hora_pico ?? "N/D"}.`;

    case "INUNDACION":
      return `Lluvia prevista de ${m.lluvia_24h_mm ?? "N/D"} mm en 24h con pico horario de ${m.lluvia_max_hora_mm ?? "N/D"} mm.`;

    case "COMBINADO_CASCADA":
      return `Riesgo concurrente de desprendimientos de ladera e interrupción vial en acceso tipo ${m.acceso_vial ?? "N/D"} a ${m.dist_hospital_km ?? "N/D"} km del centro médico.`;

    case "VIENTO":
      return "Ráfagas y vientos previstos. Consultar el panel de condiciones actuales para detalles.";

    case "TEMPERATURA":
      return "Descenso térmico severo previsto con riesgo de helada. Consultar panel de condiciones actuales.";

    case "NIEBLA":
      return "Niebla orográfica densa prevista reduciendo visibilidad en tramos montañosos.";

    case "AISLAMIENTO_VIAL":
      return `Vía principal de acceso (${m.acceso_vial ?? "N/D"}) comprometida a ${m.dist_hospital_km ?? "N/D"} km de asistencia hospitalaria.`;

    default:
      return "Evento meteorológico adverso previsto. Consultar panel de condiciones actuales.";
  }
}

/**
 * Genera un lote de dictámenes técnicos deterministas de respaldo para una zona pastoral.
 * Función pura con inyección de dependencias.
 *
 * @param {Object} params - Parámetros de entrada.
 * @param {string} params.zona_id - Identificador de zona pastoral (ej. 'SPP').
 * @param {string} params.zona_resguardo - Nombre institucional completo de la zona.
 * @param {Array<Object>} params.localidades_evaluadas - Localidades en alerta que requieren dictamen.
 * @returns {{ dictamenes: Array<{ loc_id_global: string, titulo: string, causa: string, recomendaciones: string[], contexto: string }> }} Objeto conforme al schema dictamen_narrativo.
 */
export function generarDictamenFallbackZonal({
  zona_id,
  zona_resguardo,
  localidades_evaluadas
}) {
  if (!zona_id || typeof zona_id !== "string" || zona_id.trim() === "") {
    throw new Error("generarDictamenFallbackZonal: Se requiere 'zona_id' como cadena no vacía.");
  }
  if (!zona_resguardo || typeof zona_resguardo !== "string" || zona_resguardo.trim() === "") {
    throw new Error("generarDictamenFallbackZonal: Se requiere 'zona_resguardo' como cadena no vacía.");
  }
  if (!Array.isArray(localidades_evaluadas)) {
    throw new Error("generarDictamenFallbackZonal: 'localidades_evaluadas' debe ser un arreglo.");
  }

  if (localidades_evaluadas.length === 0) {
    return { dictamenes: [] };
  }

  const zonaIdLimpio = zona_id.trim();
  const dictamenes = [];

  for (let i = 0; i < localidades_evaluadas.length; i++) {
    const loc = localidades_evaluadas[i];

    if (!loc || typeof loc !== "object") {
      throw new Error(`generarDictamenFallbackZonal: Localidad inválida en índice ${i}.`);
    }
    if (!loc.loc_id_global || typeof loc.loc_id_global !== "string") {
      throw new Error(`generarDictamenFallbackZonal: Falta 'loc_id_global' en localidad de índice ${i}.`);
    }
    if (!loc.nombre || typeof loc.nombre !== "string") {
      throw new Error(`generarDictamenFallbackZonal: Falta 'nombre' en localidad '${loc.loc_id_global}'.`);
    }
    if (!loc.color_decretado || typeof loc.color_decretado !== "string") {
      throw new Error(`generarDictamenFallbackZonal: Falta 'color_decretado' en localidad '${loc.loc_id_global}'.`);
    }
    if (!loc.vector_dominante || typeof loc.vector_dominante !== "string") {
      throw new Error(`generarDictamenFallbackZonal: Falta 'vector_dominante' en localidad '${loc.loc_id_global}'.`);
    }

    const nombreLimpio = loc.nombre.trim();
    const colorLimpio = loc.color_decretado.trim().toUpperCase();
    const vectorLimpio = loc.vector_dominante.trim().toUpperCase();

    const tituloRaw = `ALERTA ${colorLimpio} POR ${vectorLimpio} EN ${nombreLimpio}`;
    const titulo = truncarSeguro(tituloRaw, 100);

    const causaRaw = construirCausaVector(vectorLimpio, loc.metricas);
    const causa = truncarSeguro(causaRaw, 300);

    const recomendaciones = [
      `Activar monitoreo preventivo con el comité parroquial de ${nombreLimpio}.`,
      "Mantener despejadas canaletas, cunetas y pasos de agua prioritarios.",
      `Reportar afectaciones viales o grietas al centro de resguardo de zona ${zonaIdLimpio}.`
    ];

    const contextoRaw = `Emitido en modo de respaldo determinista por SatRC v4.0 para ${nombreLimpio} (${zonaIdLimpio}).`;
    const contexto = truncarSeguro(contextoRaw, 300);

    dictamenes.push({
      loc_id_global: loc.loc_id_global,
      titulo,
      causa,
      recomendaciones,
      contexto
    });
  }

  return { dictamenes };
}