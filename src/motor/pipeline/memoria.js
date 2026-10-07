/**
 * @file src/motor/pipeline/memoria.js
 * @description Implementación determinista del Paso 2 del pipeline: Cálculo de Antecedente
 * de Precipitación Índice (API 7 días con decaimiento 0.85^k) y verificación satelital.
 */

import {
  FACTOR_DECAIMIENTO_API,
  PISO_MEMORIA_HIDRICA_MM,
  UMBRAL_DISCREPANCIA_SATELITAL_MM,
  HORAS_HISTORIAL_API
} from "../../config/constantes.js";

/**
 * @typedef {Object} RegistroHorarioHistorico
 * @property {string} timestamp_utc6 - Marca temporal de la hora histórica.
 * @property {number} lluvia_consenso_mm - Precipitación consolidada (mm).
 */

/**
 * @typedef {Object} SalidaMemoriaHidrica
 * @property {string} loc_id_global - Identificador canónico de localidad.
 * @property {string} timestamp_calculo - Marca temporal ISO UTC-6 de la corrida.
 * @property {number} api_7dias_mm - Memoria hídrica consolidada final (mm).
 * @property {number} api_modelo_crudo_mm - Memoria hídrica calculada del modelo base (mm).
 * @property {number} api_satelite_mm - Valor observado satelital provisto o 0.0 si es nulo (convención de ausencia).
 * @property {number} diferencia_satelite_mm - Discrepancia absoluta calculada (mm).
 * @property {"COMPLETO"|"INCOMPLETO_CON_PISO"} estado_historial - Estado de la ventana temporal.
 * @property {boolean} ajuste_satelital_aplicado - Bandera de precaución asimétrica por satélite.
 */

/**
 * Ejecuta el Paso 2 de Memoria Hídrica para una localidad individual.
 * Función pura con inyección de dependencias.
 *
 * NOTA DE CONVENCIÓN DE ESQUEMA:
 * Ante `observado_satelite = null`, el campo `api_satelite_mm` reporta deterministamente `0.0`
 * como convención de ausencia de dato para satisfacer el tipo numérico estricto del JSON Schema.
 *
 * @param {Object} params - Parámetros de ejecución.
 * @param {string} params.loc_id_global - ID único de la localidad.
 * @param {RegistroHorarioHistorico[]} params.historial_168h - Registros horarios ordenados del más reciente al más antiguo.
 * @param {number|null} [params.observado_satelite=null] - Precipitación acumulada satelital de 7 días (CHIRPS/IMERG).
 * @param {string} params.timestamp_calculo - Marca temporal ISO 8601 UTC-6 de inicio de la corrida.
 * @param {Object} [params.logger] - Logger estructurado.
 * @param {function(unknown): {valido: boolean, errores: Array<{ruta: string, mensaje: string}>}} [params.validadorSchema] - Validador JSON Schema opcional.
 * @returns {SalidaMemoriaHidrica} Objeto estructurado de memoria hídrica.
 */
export function ejecutarPaso2Memoria({
  loc_id_global,
  historial_168h,
  observado_satelite = null,
  timestamp_calculo,
  logger,
  validadorSchema
}) {
  if (!loc_id_global || typeof loc_id_global !== "string") {
    throw new Error("Paso 2 Memoria: Se requiere un loc_id_global válido.");
  }

  if (!Array.isArray(historial_168h)) {
    throw new Error(`Paso 2 Memoria: historial_168h debe ser un arreglo en localidad ${loc_id_global}.`);
  }

  if (!timestamp_calculo || typeof timestamp_calculo !== "string") {
    throw new Error("Paso 2 Memoria: Se requiere timestamp_calculo en formato ISO UTC-6.");
  }

  const horasDisponibles = historial_168h.length;
  let apiCalculado = 0.0;
  let estadoHistorial = "COMPLETO";

  if (horasDisponibles < HORAS_HISTORIAL_API) {
    const bloquesDias = Math.ceil(horasDisponibles / 24.0);

    for (let d = 1; d <= bloquesDias; d++) {
      const inicio = (d - 1) * 24;
      const fin = Math.min(d * 24, horasDisponibles);
      let lluviaBloque = 0.0;

      for (let h = inicio; h < fin; h++) {
        lluviaBloque += Number(historial_168h[h].lluvia_consenso_mm || 0.0);
      }

      apiCalculado += lluviaBloque * Math.pow(FACTOR_DECAIMIENTO_API, d);
    }

    apiCalculado = Math.max(apiCalculado, PISO_MEMORIA_HIDRICA_MM);
    estadoHistorial = "INCOMPLETO_CON_PISO";
  } else {
    for (let d = 1; d <= 7; d++) {
      const inicio = (d - 1) * 24;
      const fin = d * 24;
      let lluviaDia = 0.0;

      for (let h = inicio; h < fin; h++) {
        lluviaDia += Number(historial_168h[h].lluvia_consenso_mm || 0.0);
      }

      apiCalculado += lluviaDia * Math.pow(FACTOR_DECAIMIENTO_API, d);
    }
  }

  let apiFinal = apiCalculado;
  let diferenciaSatelite = 0.0;
  let ajusteAplicado = false;
  const valorSatelite = typeof observado_satelite === "number" && !Number.isNaN(observado_satelite)
    ? Math.max(0.0, observado_satelite)
    : null;

  if (valorSatelite !== null) {
    diferenciaSatelite = Math.abs(apiCalculado - valorSatelite);

    if (diferenciaSatelite > UMBRAL_DISCREPANCIA_SATELITAL_MM) {
      apiFinal = Math.max(apiCalculado, valorSatelite);
      ajusteAplicado = true;

      if (logger && typeof logger.warn === "function") {
        logger.warn({
          evento: "MEMORIA_AJUSTE_SATELITAL_APLICADO",
          loc_id_global,
          api_modelo: Number(apiCalculado.toFixed(2)),
          api_satelite: Number(valorSatelite.toFixed(2)),
          diferencia_mm: Number(diferenciaSatelite.toFixed(2)),
          api_final_adoptado: Number(apiFinal.toFixed(2))
        });
      }
    }
  }

  const salida = {
    loc_id_global,
    timestamp_calculo,
    api_7dias_mm: Number(apiFinal.toFixed(2)),
    api_modelo_crudo_mm: Number(apiCalculado.toFixed(2)),
    api_satelite_mm: valorSatelite !== null ? Number(valorSatelite.toFixed(2)) : 0.0,
    diferencia_satelite_mm: Number(diferenciaSatelite.toFixed(2)),
    estado_historial: estadoHistorial,
    ajuste_satelital_aplicado: ajusteAplicado
  };

  if (typeof validadorSchema === "function") {
    const resVal = validadorSchema(salida);
    if (!resVal.valido) {
      throw new Error(
        `Paso 2 Memoria: Objeto generado no cumple schema en loc ${loc_id_global}: ` +
        JSON.stringify(resVal.errores)
      );
    }
  }

  return salida;
}