/**
 * @file src/utils/crypto.js
 * @description Utilidades criptográficas puras para hashing SHA-256 de auditoría.
 */

import { createHash } from "node:crypto";

/**
 * Calcula el hash SHA-256 en formato hexadecimal de 64 caracteres para una cadena de texto.
 * @param {string} texto - Cadena de entrada UTF-8.
 * @returns {string} Digest SHA-256 en minúsculas.
 */
export function calcularSha256(texto) {
  if (typeof texto !== "string") {
    throw new TypeError("El parámetro de entrada para calcularSha256 debe ser una cadena de texto.");
  }
  return createHash("sha256").update(texto, "utf8").digest("hex");
}