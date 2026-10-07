/**
 * @file tests/utils/tiempo.test.js
 * @description Pruebas unitarias para utilidades de manejo y formateo de tiempo UTC-6.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { convertirAUtc6, formatearIsoUtc6, horaActualUtc6 } from "../../src/utils/tiempo.js";

describe("Utilidades de Tiempo UTC-6 (tiempo.js)", () => {
  it("Convierte correctamente una fecha fija UTC a UTC-6 con offset explícito", () => {
    const fechaUtc = new Date("2026-03-29T18:00:00.000Z");
    const resultado = convertirAUtc6(fechaUtc);

    assert.strictEqual(resultado, "2026-03-29T12:00:00-06:00");
  });

  it("Maneja el cruce de medianoche UTC a día anterior local", () => {
    const fechaUtc = new Date("2026-03-30T02:30:00.000Z");
    const resultado = formatearIsoUtc6(fechaUtc);

    assert.strictEqual(resultado, "2026-03-29T20:30:00-06:00");
  });

  it("horaActualUtc6 retorna una cadena ISO válida con terminación -06:00", () => {
    const ahora = horaActualUtc6();
    assert.strictEqual(typeof ahora, "string");
    assert.match(ahora, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-06:00$/);
  });

  it("Lanza RangeError si la fecha provista es inválida", () => {
    assert.throws(() => convertirAUtc6("fecha-invalida-xyz"), RangeError);
  });
});