/**
 * @file src/motor/pipeline/index.js
 * @description Orquestador funcional y determinista del pipeline meteorológico (Pasos 0 -> 1 -> 2 -> 3).
 * Encadena la ingesta espacial, consenso multi-modelo, memoria hídrica y evaluación multivectorial.
 */

import { ejecutarPaso0Ingesta } from "./ingesta.js";
import { ejecutarPaso1Consenso } from "./consenso.js";
import { ejecutarPaso2Memoria } from "./memoria.js";
import { ejecutarPaso3Evaluacion } from "./evaluacion.js";
import {
  VENTANA_PRONOSTICO_INICIO,
  VENTANA_PRONOSTICO_FIN
} from "../../config/constantes.js";

/**
 * Extrae la ventana de pronóstico operativo (horas relativas 168 a 191) para una localidad.
 * @param {Array<Object>} registrosConsenso - Arreglo global de consenso de todas las localidades.
 * @param {string} locIdGlobal - Identificador canónico de la localidad.
 * @returns {Array<Object>} Arreglo de exactamente 24 registros horarios de pronóstico.
 */
export function obtenerVentanaPronostico(registrosConsenso, locIdGlobal) {
  if (!Array.isArray(registrosConsenso)) {
    throw new Error("obtenerVentanaPronostico: registrosConsenso debe ser un arreglo.");
  }

  const ventana = registrosConsenso.filter(
    r => r.loc_id_global === locIdGlobal &&
         r.hora_relativa >= VENTANA_PRONOSTICO_INICIO &&
         r.hora_relativa <= VENTANA_PRONOSTICO_FIN
  );

  if (ventana.length !== 24) {
    throw new Error(
      `obtenerVentanaPronostico: Se esperaban 24 horas de pronóstico para ${locIdGlobal}, se obtuvieron ${ventana.length}.`
    );
  }

  return ventana.sort((a, b) => a.hora_relativa - b.hora_relativa);
}

/**
 * Ejecuta el pipeline completo de cálculo determinista para el conjunto de localidades.
 * Función pura con inyección de dependencias.
 *
 * @param {Object} params - Parámetros de ejecución.
 * @param {Object} params.payloadsModelos - Payloads crudos y extractores de celdas (ecmwf, gfs, icon).
 * @param {Array<Object>} params.localidades - Catálogo de localidades a procesar.
 * @param {Object} params.coeficientes - Coeficientes regionales de gradiente térmico.
 * @param {Record<string, number>} params.factoresExposicion - Mapeo { [loc_id_global]: factor }.
 * @param {Record<string, Array<Object>>} params.historialPorLocalidad - Mapeo { [loc_id_global]: historial168h }.
 * @param {Record<string, number|null>} [params.observadosSatelite={}] - Mapeo { [loc_id_global]: mmSatelite }.
 * @param {string|Date} params.timestampBase - Timestamp ISO 8601 de inicio de la corrida (hora 0).
 * @param {Object} [params.logger] - Logger estructurado.
 * @param {Object} [params.validadores] - Validadores opcionales de esquemas JSON.
 * @returns {Array<Object>} Arreglo de evaluaciones consolidadas por localidad.
 */
export function ejecutarPipeline({
  payloadsModelos,
  localidades,
  coeficientes,
  factoresExposicion,
  historialPorLocalidad,
  observadosSatelite = {},
  timestampBase,
  logger,
  validadores = {}
}) {
  if (!payloadsModelos) {
    throw new Error("ejecutarPipeline: Se requiere el objeto payloadsModelos.");
  }
  if (!Array.isArray(localidades) || localidades.length === 0) {
    throw new Error("ejecutarPipeline: El arreglo de localidades no puede estar vacío.");
  }
  if (!coeficientes || !coeficientes.gradiente_termico_C_por_100m || !coeficientes.gradiente_termico_C_por_100m.por_zona) {
    throw new Error("ejecutarPipeline: Objeto de coeficientes regionales incompleto o inválido.");
  }
  if (!factoresExposicion || typeof factoresExposicion !== "object") {
    throw new Error("ejecutarPipeline: Se requiere el objeto factoresExposicion.");
  }
  if (!historialPorLocalidad || typeof historialPorLocalidad !== "object") {
    throw new Error("ejecutarPipeline: Se requiere el objeto historialPorLocalidad.");
  }
  if (!timestampBase || Number.isNaN(new Date(timestampBase).getTime())) {
    throw new Error("ejecutarPipeline: Se requiere un timestampBase válido en formato ISO 8601.");
  }

  for (const loc of localidades) {
    if (typeof factoresExposicion[loc.loc_id_global] !== "number") {
      throw new Error(`ejecutarPipeline: Falta factor de exposición para la localidad '${loc.loc_id_global}'.`);
    }
  }

  let registrosIngesta;
  try {
    registrosIngesta = ejecutarPaso0Ingesta({
      payloadsModelos,
      localidades,
      coeficientes,
      timestampBase,
      logger,
      validadorSchema: validadores.validadorIngesta
    });
  } catch (err) {
    throw new Error(`ejecutarPipeline [Paso 0 Ingesta]: ${err.message}`);
  }

  let registrosConsenso;
  try {
    registrosConsenso = ejecutarPaso1Consenso({
      registrosIngesta,
      logger,
      validadorSchema: validadores.validadorConsenso
    });
  } catch (err) {
    throw new Error(`ejecutarPipeline [Paso 1 Consenso]: ${err.message}`);
  }

  if (logger && typeof logger.info === "function") {
    logger.info({
      evento: "PIPELINE_PASOS_0_1_COMPLETADOS",
      total_localidades: localidades.length,
      total_registros_consenso: registrosConsenso.length
    });
  }

  const consensoPorLoc = new Map();
  for (const reg of registrosConsenso) {
    let arr = consensoPorLoc.get(reg.loc_id_global);
    if (!arr) {
      arr = [];
      consensoPorLoc.set(reg.loc_id_global, arr);
    }
    arr.push(reg);
  }

  const evaluaciones = [];

  for (const loc of localidades) {
    const locId = loc.loc_id_global;

    const registrosLoc = consensoPorLoc.get(locId) || [];
    const ventana24h = registrosLoc
      .filter(r => r.hora_relativa >= VENTANA_PRONOSTICO_INICIO && r.hora_relativa <= VENTANA_PRONOSTICO_FIN)
      .sort((a, b) => a.hora_relativa - b.hora_relativa);

    if (ventana24h.length !== 24) {
      throw new Error(
        `ejecutarPipeline [Extracción Ventana]: Ventana incompleta para ${locId} (${ventana24h.length}/24 horas).`
      );
    }

    let api7dias;
    try {
      const historial = historialPorLocalidad[locId] || [];
      const sateliteObs = Object.prototype.hasOwnProperty.call(observadosSatelite, locId)
        ? observadosSatelite[locId]
        : null;

      api7dias = ejecutarPaso2Memoria({
        loc_id_global: locId,
        historial_168h: historial,
        observado_satelite: sateliteObs,
        timestamp_calculo: String(timestampBase),
        logger,
        validadorSchema: validadores.validadorApi
      });
    } catch (err) {
      throw new Error(`ejecutarPipeline [Paso 2 Memoria] en ${locId}: ${err.message}`);
    }

    let evaluacionLoc;
    try {
      const factorExp = factoresExposicion[locId];

      evaluacionLoc = ejecutarPaso3Evaluacion({
        localidad: loc,
        consenso24h: ventana24h,
        api7dias,
        factorExposicion: factorExp,
        timestamp_evaluacion: String(timestampBase),
        logger,
        validadorSchema: validadores.validadorEvaluacion
      });
    } catch (err) {
      throw new Error(`ejecutarPipeline [Paso 3 Evaluación] en ${locId}: ${err.message}`);
    }

    evaluaciones.push(evaluacionLoc);
  }

  if (logger && typeof logger.info === "function") {
    logger.info({
      evento: "PIPELINE_COMPLETADO",
      total_evaluaciones: evaluaciones.length
    });
  }

  return evaluaciones;
}