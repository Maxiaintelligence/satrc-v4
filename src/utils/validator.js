/**
 * @file src/utils/validator.js
 * @description Compilador y validador de esquemas JSON Draft 2020-12 mediante instancia singleton de Ajv.
 */

import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

/** @type {Ajv2020} */
const ajvInstance = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: true
});

addFormats(ajvInstance);

/**
 * Lee y parsea un archivo JSON desde el sistema de archivos de forma síncrona.
 * @param {string|URL} rutaArchivo - Ruta absoluta o relativa al archivo JSON.
 * @returns {Record<string, unknown>} Objeto JSON parseado.
 */
export function cargarSchemaDesdeArchivo(rutaArchivo) {
  try {
    const contenido = readFileSync(rutaArchivo, "utf8");
    return JSON.parse(contenido);
  } catch (err) {
    throw new Error(`Error al cargar archivo de esquema JSON desde ${rutaArchivo}: ${err.message}`);
  }
}

/**
 * Compila un esquema JSON Draft 2020-12 y retorna una función validadora determinista.
 * @param {Record<string, unknown>} schemaObject - Objeto de esquema JSON.
 * @returns {(datos: unknown) => { valido: boolean, errores: Array<{ ruta: string, mensaje: string }> }} Función validadora.
 */
export function compilarValidador(schemaObject) {
  let validate;
  try {
    validate = ajvInstance.compile(schemaObject);
  } catch (err) {
    throw new Error(`Error de compilación en JSON Schema: ${err.message}`);
  }

  return function validar(datos) {
    const valido = Boolean(validate(datos));
    if (valido) {
      return { valido: true, errores: [] };
    }

    const errores = (validate.errors || []).map(e => ({
      ruta: e.instancePath || "#",
      mensaje: e.message || "Error de validación desconocido"
    }));

    return { valido: false, errores };
  };
}