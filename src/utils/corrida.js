/**
 * @file src/utils/corrida.js
 * @description Generador y validador de identificadores únicos universales (UUIDv4) para corridas del pipeline.
 *
 * NOTA DE DISEÑO (Excepción controlada al determinismo):
 * `generarCorridaId()` es la única función del sistema autorizada para generar valores aleatorios
 * criptográficamente seguros mediante `crypto.randomUUID()`. El ID resultante se propaga como
 * parámetro inmutable hacia todos los módulos del pipeline para garantizar trazabilidad.
 */

import { randomUUID } from "node:crypto";

const REGEX_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Genera un nuevo identificador único de corrida en formato UUIDv4 canónico.
 * @returns {string} UUIDv4 de 36 caracteres.
 */
export function generarCorridaId() {
  return randomUUID();
}

/**
 * Valida si una cadena cumple con la estructura y versión estricta de un UUIDv4.
 * @param {unknown} corridaId - Identificador a comprobar.
 * @returns {boolean} True si es un UUIDv4 válido.
 */
export function validarCorridaId(corridaId) {
  if (typeof corridaId !== "string") {
    return false;
  }
  return REGEX_UUID_V4.test(corridaId.trim());
}