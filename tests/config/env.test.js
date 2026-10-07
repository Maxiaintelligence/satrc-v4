/**
 * @file tests/config/env.test.js
 * @description Pruebas unitarias deterministas para el validador de variables de entorno.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validarVariablesEntorno } from "../../src/config/env.js";

describe("Validador de Variables de Entorno (env.js)", () => {
  it("Falla con error estructurado si faltan variables obligatorias", () => {
    const mockEnvVacio = {};

    assert.throws(
      () => validarVariablesEntorno(mockEnvVacio),
      (err) => {
        assert(err instanceof Error);
        assert(err.message.includes("Faltan las variables obligatorias: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY"));
        assert(err.message.includes("Cree su archivo .env.local a partir de .env.example"));
        return true;
      }
    );
  });

  it("Falla si solo falta una de las variables obligatorias", () => {
    const mockEnvParcial = {
      SUPABASE_URL: "https://mi-proyecto.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "secret-key"
      // falta GROQ_API_KEY
    };

    assert.throws(
      () => validarVariablesEntorno(mockEnvParcial),
      /Faltan las variables obligatorias: GROQ_API_KEY/
    );
  });

  it("Retorna objeto de configuración inmutable con valores por defecto válidos", () => {
    const mockEnvCompleto = {
      SUPABASE_URL: "https://satrc.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "servicio-secreto",
      GROQ_API_KEY: "gsk_12345"
    };

    const config = validarVariablesEntorno(mockEnvCompleto);

    assert.strictEqual(config.SUPABASE_URL, "https://satrc.supabase.co");
    assert.strictEqual(config.SUPABASE_SERVICE_ROLE_KEY, "servicio-secreto");
    assert.strictEqual(config.GROQ_API_KEY, "gsk_12345");
    assert.strictEqual(config.NODE_ENV, "development");
    assert.strictEqual(config.TZ, "America/Mexico_City");
    assert.strictEqual(config.LOG_LEVEL, "info");
    assert.strictEqual(config.GROQ_MODEL, "llama-3.3-70b-versatile");
    assert.strictEqual(Object.isFrozen(config), true);
  });
});