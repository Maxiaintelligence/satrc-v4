/**
 * @file src/motor/pipeline/ingesta.js
 * @description Implementación determinista del Paso 0 del pipeline: Ingesta, hashing SHA-256,
 * interpolación bilineal espacial y corrección de Lapse-Rate altimétrico.
 */

import { calcularSha256 } from "../../utils/crypto.js";
import { convertirAUtc6 } from "../../utils/tiempo.js";
import { interpolarBilineal } from "../../utils/interpolacion.js";
import {
  HORAS_HORIZONTE_INGESTA,
  GRADIENTE_TERMICO_FALLBACK,
  GRADIENTE_TERMICO_MIN,
  GRADIENTE_TERMICO_MAX
} from "../../config/constantes.js";

/**
 * @typedef {Object} CeldaPunto
 * @property {number} lat - Latitud de la celda de malla.
 * @property {number} lon - Longitud de la celda de malla.
 * @property {number} elevation - Elevación media de la celda en metros (z_malla).
 * @property {number[]} precipitation - Serie horaria de precipitación (mm).
 * @property {number[]} temperature_2m - Serie horaria de temperatura (°C).
 * @property {number[]} wind_speed_10m - Serie horaria de velocidad de viento (km/h).
 * @property {number[]} wind_gusts_10m - Serie horaria de ráfagas de viento (km/h).
 * @property {number[]} relative_humidity_2m - Serie horaria de humedad relativa (%).
 * @property {number[]} visibility - Serie horaria de visibilidad (m).
 */

/**
 * @typedef {Object} PayloadModelo
 * @property {string} rawJson - Payload crudo serializado para cálculo de hash SHA-256.
 * @property {function(number, number): CeldaPunto[]} obtener4Celdas - Función extractora de 4 vértices para (lat, lon).
 */

/**
 * @typedef {Object} PayloadsModelosEntrada
 * @property {PayloadModelo} ecmwf_aifs025 - Modelo ECMWF AIFS 0.25°.
 * @property {PayloadModelo} ncep_nbm - Modelo NCEP NBM / GFS.
 * @property {PayloadModelo} icon_seamless - Modelo DWD ICON Seamless.
 */

/**
 * @typedef {Object} LocalidadBaseItem
 * @property {string} loc_id_global - Identificador único canónico (LOC_[ENT]_[MUN]_[LOC]_[HASH8]).
 * @property {string} zona_id - Identificador de zona pastoral (ej. 'SPP', 'TUL').
 * @property {number} lat - Latitud decimal en WGS84.
 * @property {number} lon - Longitud decimal en WGS84.
 * @property {number} altitud_msnm - Altitud del asentamiento humano en msnm.
 */

/**
 * @typedef {Object} CoeficientesRegionalesData
 * @property {Object} gradiente_termico_C_por_100m
 * @property {number} gradiente_termico_C_por_100m.global
 * @property {Record<string, number>} gradiente_termico_C_por_100m.por_zona
 */

const SERIES_OBLIGATORIAS = [
  "precipitation",
  "temperature_2m",
  "wind_speed_10m",
  "wind_gusts_10m",
  "relative_humidity_2m",
  "visibility"
];

/**
 * Ejecuta el Paso 0 de Ingesta y Normalización del pipeline meteorológico.
 * Función pura con inyección total de dependencias.
 *
 * @param {Object} params - Parámetros de ejecución.
 * @param {PayloadsModelosEntrada} params.payloadsModelos - Mallas meteorológicas y payloads crudos de los 3 modelos.
 * @param {LocalidadBaseItem[]} params.localidades - Catálogo de localidades a procesar.
 * @param {CoeficientesRegionalesData} params.coeficientes - Coeficientes regionales de gradiente térmico.
 * @param {string|Date|number} params.timestampBase - Marca de tiempo base de inicio de la corrida (hora 0).
 * @param {Object} [params.logger] - Instancia de logger estructurado.
 * @param {function(unknown): {valido: boolean, errores: Array<{ruta: string, mensaje: string}>}} [params.validadorSchema] - Validador JSON Schema opcional.
 * @returns {Array<Object>} Array de registros normalizados listos para consenso.
 */
export function ejecutarPaso0Ingesta({
  payloadsModelos,
  localidades,
  coeficientes,
  timestampBase,
  logger,
  validadorSchema
}) {
  const clavesModelos = ["ecmwf_aifs025", "ncep_nbm", "icon_seamless"];

  if (!payloadsModelos) {
    throw new Error("Paso 0 Ingesta: Se requiere el objeto payloadsModelos.");
  }

  for (const k of clavesModelos) {
    if (!payloadsModelos[k]) {
      throw new Error(`Paso 0 Ingesta: Falta el modelo meteorológico obligatorio '${k}'.`);
    }
    if (typeof payloadsModelos[k].obtener4Celdas !== "function") {
      throw new Error(`Paso 0 Ingesta: El modelo '${k}' no implementa la función 'obtener4Celdas'.`);
    }
  }

  if (!Array.isArray(localidades) || localidades.length === 0) {
    throw new Error("Paso 0 Ingesta: El catálogo de localidades debe ser un arreglo no vacío.");
  }

  if (!coeficientes || !coeficientes.gradiente_termico_C_por_100m || !coeficientes.gradiente_termico_C_por_100m.por_zona) {
    throw new Error("Paso 0 Ingesta: Objeto de coeficientes regionales inválido o incompleto.");
  }

  const hashesFuente = {
    ecmwf: calcularSha256(payloadsModelos.ecmwf_aifs025.rawJson || ""),
    gfs: calcularSha256(payloadsModelos.ncep_nbm.rawJson || ""),
    icon: calcularSha256(payloadsModelos.icon_seamless.rawJson || "")
  };

  const fechaBaseMs = new Date(timestampBase).getTime();
  if (Number.isNaN(fechaBaseMs)) {
    throw new RangeError("Paso 0 Ingesta: timestampBase no es una fecha válida.");
  }

  const registrosSalida = [];

  for (const loc of localidades) {
    if (typeof loc.altitud_msnm !== "number" || Number.isNaN(loc.altitud_msnm)) {
      throw new Error(`Paso 0 Ingesta: La localidad '${loc.loc_id_global || "desconocida"}' tiene una altitud_msnm inválida.`);
    }
    if (typeof loc.lat !== "number" || typeof loc.lon !== "number" || Number.isNaN(loc.lat) || Number.isNaN(loc.lon)) {
      throw new Error(`Paso 0 Ingesta: Coordenadas geográficas inválidas en localidad '${loc.loc_id_global}'.`);
    }

    const gradZona = coeficientes.gradiente_termico_C_por_100m.por_zona[loc.zona_id];
    let gradOperativo = gradZona;

    if (typeof gradZona !== "number" || gradZona >= GRADIENTE_TERMICO_MAX || gradZona < GRADIENTE_TERMICO_MIN) {
      gradOperativo = GRADIENTE_TERMICO_FALLBACK;
      if (logger && typeof logger.warn === "function") {
        logger.warn({
          mensaje: "Paso 0 Ingesta: Gradiente térmico zonal no físico. Aplicando fallback determinista.",
          zona_id: loc.zona_id,
          loc_id_global: loc.loc_id_global,
          grad_recibido: gradZona,
          grad_aplicado: GRADIENTE_TERMICO_FALLBACK
        });
      }
    }

    const celdasPorModelo = {
      ecmwf_aifs025: payloadsModelos.ecmwf_aifs025.obtener4Celdas(loc.lat, loc.lon),
      ncep_nbm: payloadsModelos.ncep_nbm.obtener4Celdas(loc.lat, loc.lon),
      icon_seamless: payloadsModelos.icon_seamless.obtener4Celdas(loc.lat, loc.lon)
    };

    for (const k of clavesModelos) {
      const celdas = celdasPorModelo[k];
      if (!Array.isArray(celdas) || celdas.length !== 4) {
        throw new Error(`Paso 0 Ingesta: El modelo ${k} no retornó exactamente 4 celdas para la localidad ${loc.loc_id_global}.`);
      }

      for (let i = 0; i < 4; i++) {
        const celda = celdas[i];
        if (typeof celda.elevation !== "number" || Number.isNaN(celda.elevation)) {
          throw new Error(`Paso 0 Ingesta: Celda ${i} del modelo ${k} en loc ${loc.loc_id_global} carece de elevación válida.`);
        }
        for (const variable of SERIES_OBLIGATORIAS) {
          if (!Array.isArray(celda[variable]) || celda[variable].length < HORAS_HORIZONTE_INGESTA) {
            throw new Error(
              `Paso 0 Ingesta: Serie horaria incompleta para '${variable}' en modelo ${k} ` +
              `(longitud: ${celda[variable] ? celda[variable].length : 0}, requerida: ${HORAS_HORIZONTE_INGESTA}).`
            );
          }
        }
      }
    }

    for (let t = 0; t < HORAS_HORIZONTE_INGESTA; t++) {
      const timestampHoraUtc6 = convertirAUtc6(new Date(fechaBaseMs + t * 3600 * 1000));
      const datosModelosHora = {};

      for (const nombreModelo of clavesModelos) {
        const celdas = celdasPorModelo[nombreModelo];

        const cPrecip = celdas.map(c => ({ lat: c.lat, lon: c.lon, valor: c.precipitation[t] }));
        const cTemp = celdas.map(c => ({ lat: c.lat, lon: c.lon, valor: c.temperature_2m[t] }));
        const cViento = celdas.map(c => ({ lat: c.lat, lon: c.lon, valor: c.wind_speed_10m[t] }));
        const cRafaga = celdas.map(c => ({ lat: c.lat, lon: c.lon, valor: c.wind_gusts_10m[t] }));
        const cRh = celdas.map(c => ({ lat: c.lat, lon: c.lon, valor: c.relative_humidity_2m[t] }));
        const cVis = celdas.map(c => ({ lat: c.lat, lon: c.lon, valor: c.visibility[t] }));
        const cElev = celdas.map(c => ({ lat: c.lat, lon: c.lon, valor: c.elevation }));

        const lluviaInterp = interpolarBilineal(cPrecip, loc.lat, loc.lon);
        const tempInterp = interpolarBilineal(cTemp, loc.lat, loc.lon);
        const vientoInterp = interpolarBilineal(cViento, loc.lat, loc.lon);
        const rafagaInterp = interpolarBilineal(cRafaga, loc.lat, loc.lon);
        const rhInterp = interpolarBilineal(cRh, loc.lat, loc.lon);
        const visInterp = interpolarBilineal(cVis, loc.lat, loc.lon);
        const zMalla = interpolarBilineal(cElev, loc.lat, loc.lon);

        const deltaZ = loc.altitud_msnm - zMalla;
        const tempAjustada = tempInterp + (gradOperativo * deltaZ) / 100.0;

        datosModelosHora[nombreModelo] = {
          lluvia_mm: Math.max(0.0, Number(lluviaInterp.toFixed(3))),
          temperatura_c: Number(tempAjustada.toFixed(2)),
          viento_max_kmh: Math.max(0.0, Number(vientoInterp.toFixed(2))),
          rafaga_max_kmh: Math.max(0.0, Number(rafagaInterp.toFixed(2))),
          humedad_relativa_pct: Math.min(100.0, Math.max(0.0, Number(rhInterp.toFixed(1)))),
          visibilidad_m: Math.max(0.0, Number(visInterp.toFixed(1)))
        };
      }

      const registroHora = {
        loc_id_global: loc.loc_id_global,
        timestamp_utc6: timestampHoraUtc6,
        hora_relativa: t,
        modelos: datosModelosHora,
        hashes_fuente: hashesFuente
      };

      if (typeof validadorSchema === "function" && (t === 0 || t === HORAS_HORIZONTE_INGESTA - 1)) {
        const resultadoVal = validadorSchema(registroHora);
        if (!resultadoVal.valido) {
          throw new Error(
            `Paso 0 Ingesta: Registro inválido contra schema en loc ${loc.loc_id_global}, hora ${t}: ` +
            JSON.stringify(resultadoVal.errores)
          );
        }
      }

      registrosSalida.push(registroHora);
    }
  }

  return registrosSalida;
}