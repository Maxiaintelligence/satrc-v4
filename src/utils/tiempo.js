/**
 * @file src/utils/tiempo.js
 * @description Manejo determinista de marcas de tiempo en zona horaria UTC-6 (America/Mexico_City).
 */

const OFFSET_UTC6_MS = -6 * 60 * 60 * 1000;

/**
 * Convierte una fecha a formato estándar ISO 8601 con offset explícito -06:00.
 * @param {Date|string|number} fecha - Instancia de Date, string ISO o timestamp UNIX en ms.
 * @returns {string} Fecha formateada "YYYY-MM-DDTHH:mm:ss-06:00".
 */
export function convertirAUtc6(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError("Fecha inválida provista para conversión a UTC-6.");
  }

  const fechaLocalMs = d.getTime() + OFFSET_UTC6_MS;
  const fechaUtcAjustada = new Date(fechaLocalMs);

  const anio = fechaUtcAjustada.getUTCFullYear();
  const mes = String(fechaUtcAjustada.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fechaUtcAjustada.getUTCDate()).padStart(2, "0");
  const horas = String(fechaUtcAjustada.getUTCHours()).padStart(2, "0");
  const minutos = String(fechaUtcAjustada.getUTCMinutes()).padStart(2, "0");
  const segundos = String(fechaUtcAjustada.getUTCSeconds()).padStart(2, "0");

  return `${anio}-${mes}-${dia}T${horas}:${minutos}:${segundos}-06:00`;
}

/**
 * Alias estricto para formatear a ISO 8601 UTC-6 sin milisegundos ("YYYY-MM-DDTHH:mm:ss-06:00").
 * @param {Date|string|number} fecha - Fecha a formatear.
 * @returns {string} Cadena en formato "YYYY-MM-DDTHH:mm:ss-06:00".
 */
export function formatearIsoUtc6(fecha) {
  return convertirAUtc6(fecha);
}

/**
 * Obtiene la marca de tiempo actual del sistema serializada en UTC-6.
 * @returns {string} Timestamp actual en "YYYY-MM-DDTHH:mm:ss-06:00".
 */
export function horaActualUtc6() {
  return convertirAUtc6(new Date());
}