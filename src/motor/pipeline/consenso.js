/**
 * @file src/motor/pipeline/consenso.js
 * @description Implementación determinista del Paso 1 del pipeline: Consenso multi-modelo,
 * filtro exhaustivo de ceros espurios y clasificación de confiabilidad por spread.
 */

import {
  SPREAD_ALTA_MAX_MM,
  SPREAD_MODERADA_MAX_MM
} from "../../config/constantes.js";

/**
 * Calcula la mediana estadística de un arreglo de números.
 * @param {number[]} valores - Arreglo numérico (típicamente 3 elementos).
 * @returns {number} Valor mediano.
 */
function calcularMediana(valores) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 0) {
    return (ordenados[mitad - 1] + ordenados[mitad]) / 2;
  }
  return ordenados[mitad];
}

/**
 * Ejecuta el filtro de ceros espurios y consenso de precipitación en 5 casos deterministas.
 * @param {number} pEcmwf - Precipitación ECMWF (mm).
 * @param {number} pGfs - Precipitación NCEP NBM (mm).
 * @param {number} pIcon - Precipitación ICON Seamless (mm).
 * @param {Object} [logger] - Instancia de logging estructurado.
 * @param {string} [locId] - Identificador de localidad para auditoría.
 * @param {number} [horaRelativa] - Hora analizada.
 * @returns {number} Precipitación de consenso final (mm).
 */
export function calcularConsensoLluvia(pEcmwf, pGfs, pIcon, logger, locId = "N/A", horaRelativa = 0) {
  const lluvias = [pEcmwf, pGfs, pIcon];
  const conteoLluvia = lluvias.filter(p => p >= 0.5).length;
  const conteoCero = lluvias.filter(p => p < 0.1).length;

  if (conteoLluvia === 3) {
    return calcularMediana(lluvias);
  }

  if (conteoLluvia === 0) {
    return calcularMediana(lluvias);
  }

  if (conteoLluvia === 1) {
    if (pIcon >= 0.5) {
      if (logger && typeof logger.debug === "function") {
        logger.debug({
          evento: "CONSENSO_CASO_3A_ICON_UNICO",
          loc_id_global: locId,
          hora: horaRelativa,
          p_icon: pIcon,
          p_ecmwf: pEcmwf,
          p_gfs: pGfs
        });
      }
      return pIcon * 0.50;
    }
    return calcularMediana(lluvias);
  }

  if (conteoLluvia === 2 && conteoCero >= 1) {
    if (pIcon < 0.1) {
      if (logger && typeof logger.debug === "function") {
        logger.debug({
          evento: "CONSENSO_CASO_4A_ICON_DISIDENTE",
          loc_id_global: locId,
          hora: horaRelativa,
          p_icon: pIcon,
          p_ecmwf: pEcmwf,
          p_gfs: pGfs
        });
      }
      return (pEcmwf * 0.25) + (pGfs * 0.25) + (pIcon * 0.50);
    }
    if (pEcmwf < 0.1) {
      return (pGfs + pIcon) / 2.0;
    }
    if (pGfs < 0.1) {
      return (pEcmwf + pIcon) / 2.0;
    }
  }

  return calcularMediana(lluvias);
}

/**
 * Ejecuta el Paso 1 de Consenso Multi-Modelo sobre los registros de ingesta.
 * Función pura con inyección total de dependencias.
 *
 * @param {Object} params - Parámetros de ejecución.
 * @param {Array<Object>} params.registrosIngesta - Arreglo de registros generados en el Paso 0.
 * @param {Object} [params.logger] - Logger estructurado.
 * @param {function(unknown): {valido: boolean, errores: Array<{ruta: string, mensaje: string}>}} [params.validadorSchema] - Validador JSON Schema opcional.
 * @returns {Array<Object>} Arreglo de registros horarios de consenso.
 */
export function ejecutarPaso1Consenso({ registrosIngesta, logger, validadorSchema }) {
  if (!Array.isArray(registrosIngesta) || registrosIngesta.length === 0) {
    throw new Error("Paso 1 Consenso: registrosIngesta debe ser un arreglo no vacío.");
  }

  const registrosConsenso = [];

  for (let i = 0; i < registrosIngesta.length; i++) {
    const reg = registrosIngesta[i];
    const m = reg.modelos;

    if (!m || !m.ecmwf_aifs025 || !m.ncep_nbm || !m.icon_seamless) {
      throw new Error(`Paso 1 Consenso: Registro incompleto en índice ${i} (loc: ${reg.loc_id_global || "desconocida"}).`);
    }

    const pEcmwf = m.ecmwf_aifs025.lluvia_mm;
    const pGfs = m.ncep_nbm.lluvia_mm;
    const pIcon = m.icon_seamless.lluvia_mm;

    const lluviaFinal = calcularConsensoLluvia(
      pEcmwf,
      pGfs,
      pIcon,
      logger,
      reg.loc_id_global,
      reg.hora_relativa
    );

    const tempFinal = calcularMediana([
      m.ecmwf_aifs025.temperatura_c,
      m.ncep_nbm.temperatura_c,
      m.icon_seamless.temperatura_c
    ]);

    const vientoFinal = calcularMediana([
      m.ecmwf_aifs025.viento_max_kmh,
      m.ncep_nbm.viento_max_kmh,
      m.icon_seamless.viento_max_kmh
    ]);

    const rhFinal = calcularMediana([
      m.ecmwf_aifs025.humedad_relativa_pct,
      m.ncep_nbm.humedad_relativa_pct,
      m.icon_seamless.humedad_relativa_pct
    ]);

    const visFinal = calcularMediana([
      m.ecmwf_aifs025.visibilidad_m,
      m.ncep_nbm.visibilidad_m,
      m.icon_seamless.visibilidad_m
    ]);

    const rafagaFinal = Math.max(
      m.ecmwf_aifs025.rafaga_max_kmh,
      m.ncep_nbm.rafaga_max_kmh,
      m.icon_seamless.rafaga_max_kmh
    );

    const lluvias = [pEcmwf, pGfs, pIcon];
    const spreadLluvia = Math.max(...lluvias) - Math.min(...lluvias);

    let confiabilidad = "EN_DISPUTA";
    if (spreadLluvia <= SPREAD_ALTA_MAX_MM) {
      confiabilidad = "ALTA";
    } else if (spreadLluvia <= SPREAD_MODERADA_MAX_MM) {
      confiabilidad = "MODERADA";
    }

    const registroSalida = {
      loc_id_global: reg.loc_id_global,
      timestamp_utc6: reg.timestamp_utc6,
      hora_relativa: reg.hora_relativa,
      lluvia_consenso_mm: Math.max(0.0, Number(lluviaFinal.toFixed(3))),
      temperatura_consenso_c: Number(tempFinal.toFixed(2)),
      viento_max_kmh: Math.max(0.0, Number(vientoFinal.toFixed(2))),
      rafaga_max_kmh: Math.max(0.0, Number(rafagaFinal.toFixed(2))),
      humedad_relativa_pct: Math.min(100.0, Math.max(0.0, Number(rhFinal.toFixed(1)))),
      visibilidad_m: Math.max(0.0, Number(visFinal.toFixed(1))),
      spread_lluvia_mm: Math.max(0.0, Number(spreadLluvia.toFixed(3))),
      confiabilidad
    };

    if (typeof validadorSchema === "function" && (i === 0 || i === registrosIngesta.length - 1)) {
      const resVal = validadorSchema(registroSalida);
      if (!resVal.valido) {
        throw new Error(
          `Paso 1 Consenso: Registro generado no cumple schema en loc ${reg.loc_id_global}, hora ${reg.hora_relativa}: ` +
          JSON.stringify(resVal.errores)
        );
      }
    }

    registrosConsenso.push(registroSalida);
  }

  return registrosConsenso;
}