/**
 * @file tests/utils/validator.test.js
 * @description Pruebas unitarias para el compilador y validador de esquemas JSON Ajv Draft 2020-12.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compilarValidador } from "../../src/utils/validator.js";

describe("Validador JSON Schema Draft 2020-12 (validator.js)", () => {
  const schemaPrueba = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    required: ["loc_id_global", "lluvia_mm", "fecha_utc6"],
    properties: {
      loc_id_global: { type: "string" },
      lluvia_mm: { type: "number", minimum: 0 },
      fecha_utc6: { type: "string", format: "date-time" }
    },
    additionalProperties: false
  };

  it("Valida datos correctos retornando { valido: true, errores: [] }", () => {
    const validar = compilarValidador(schemaPrueba);
    const datosValidos = {
      loc_id_global: "LOC_HGO_ACT_1_a1b2c3d4",
      lluvia_mm: 24.5,
      fecha_utc6: "2026-03-29T12:00:00-06:00"
    };

    const resultado = validar(datosValidos);
    assert.strictEqual(resultado.valido, true);
    assert.deepStrictEqual(resultado.errores, []);
  });

  it("Detecta violaciones de schema retornando { valido: false, errores: [...] }", () => {
    const validar = compilarValidador(schemaPrueba);
    const datosInvalidos = {
      loc_id_global: "LOC_HGO_ACT_1_a1b2c3d4",
      lluvia_mm: -5.0,
      campo_extra_no_permitido: true
    };

    const resultado = validar(datosInvalidos);
    assert.strictEqual(resultado.valido, false);
    assert.strictEqual(resultado.errores.length >= 2, true);
  });

  it("Lanza error si el schema tiene referencias $ref no resolubles", () => {
    const schemaCorrupto = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        campo: { $ref: "#/$defs/definicionInexistente" }
      }
    };

    assert.throws(
      () => compilarValidador(schemaCorrupto),
      /Error de compilación en JSON Schema/
    );
  });
});