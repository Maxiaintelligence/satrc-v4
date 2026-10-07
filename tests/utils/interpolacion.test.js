/**
 * @file tests/utils/interpolacion.test.js
 * @description Pruebas unitarias para interpolación espacial bilineal.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { interpolarBilineal } from "../../src/utils/interpolacion.js";

describe("Interpolación Bilineal (interpolacion.js)", () => {
  const celdasBase = [
    { lat: 20.0, lon: -99.0, valor: 10.0 },
    { lat: 20.0, lon: -98.0, valor: 20.0 },
    { lat: 21.0, lon: -99.0, valor: 30.0 },
    { lat: 21.0, lon: -98.0, valor: 40.0 }
  ];

  it("Interpola el punto medio exacto como el promedio de los 4 vértices", () => {
    const valor = interpolarBilineal(celdasBase, 20.5, -98.5);
    assert.strictEqual(valor, 25.0);
  });

  it("Pondera proporcionalmente hacia la esquina más cercana", () => {
    const valor = interpolarBilineal(celdasBase, 20.1, -98.9);
    assert.strictEqual(Math.round(valor * 100) / 100, 13.0);
  });

  it("Maneja casos degenerados cuando todas las celdas colapsan a un mismo punto", () => {
    const celdasDegeneradas = [
      { lat: 20.0, lon: -98.0, valor: 15.5 },
      { lat: 20.0, lon: -98.0, valor: 15.5 },
      { lat: 20.0, lon: -98.0, valor: 15.5 },
      { lat: 20.0, lon: -98.0, valor: 15.5 }
    ];
    const valor = interpolarBilineal(celdasDegeneradas, 20.0, -98.0);
    assert.strictEqual(valor, 15.5);
  });

  it("Interpola correctamente con valores negativos (temperaturas bajo cero)", () => {
    const celdasFrias = [
      { lat: 20.0, lon: -99.0, valor: -5.0 },
      { lat: 20.0, lon: -98.0, valor: -1.0 },
      { lat: 21.0, lon: -99.0, valor: -9.0 },
      { lat: 21.0, lon: -98.0, valor: -5.0 }
    ];
    const valor = interpolarBilineal(celdasFrias, 20.5, -98.5);
    assert.strictEqual(valor, -5.0);
  });

  it("Lanza error si no se proporcionan exactamente 4 celdas", () => {
    assert.throws(() => interpolarBilineal([], 20.0, -98.0), /exactamente 4 celdas/);
  });
});