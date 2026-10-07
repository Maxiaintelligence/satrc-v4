/**
 * @file tests/motor/pipeline/memoria.test.js
 * @description Pruebas unitarias deterministas para el Paso 2 (Memoria Hídrica API 7 días).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ejecutarPaso2Memoria } from "../../../src/motor/pipeline/memoria.js";
import { compilarValidador } from "../../../src/utils/validator.js";

const schemaApiInline = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: [
    "loc_id_global",
    "timestamp_calculo",
    "api_7dias_mm",
    "api_modelo_crudo_mm",
    "api_satelite_mm",
    "diferencia_satelite_mm",
    "estado_historial",
    "ajuste_satelital_aplicado"
  ],
  properties: {
    loc_id_global: { type: "string" },
    timestamp_calculo: { type: "string", format: "date-time" },
    api_7dias_mm: { type: "number", minimum: 0 },
    api_modelo_crudo_mm: { type: "number", minimum: 0 },
    api_satelite_mm: { type: "number", minimum: 0 },
    diferencia_satelite_mm: { type: "number", minimum: 0 },
    estado_historial: { type: "string", enum: ["COMPLETO", "INCOMPLETO_CON_PISO"] },
    ajuste_satelital_aplicado: { type: "boolean" }
  }
};

function generarHistorial168h(lluviasPorDia = [10, 0, 0, 0, 0, 0, 0]) {
  const registros = [];
  for (let d = 1; d <= 7; d++) {
    const lluviaDiaria = lluviasPorDia[d - 1] ?? 0.0;
    const lluviaPorHora = lluviaDiaria / 24.0;
    for (let h = 0; h < 24; h++) {
      registros.push({
        timestamp_utc6: `2026-03-${29 - d}T${String(h).padStart(2, "0")}:00:00-06:00`,
        lluvia_consenso_mm: lluviaPorHora
      });
    }
  }
  return registros;
}

describe("Paso 2: Memoria Hídrica API 7 Días (memoria.js)", () => {
  const locId = "LOC_HGO_ACT_1_619360b0";
  const timestampCalculo = "2026-03-29T12:00:00-06:00";
  const validador = compilarValidador(schemaApiInline);

  it("a) Historial completo 168h: Cómputo exacto con lluvia solo en el día 1 (últimas 24h)", () => {
    const historial = generarHistorial168h([10, 0, 0, 0, 0, 0, 0]);

    const resultado = ejecutarPaso2Memoria({
      loc_id_global: locId,
      historial_168h: historial,
      timestamp_calculo: timestampCalculo,
      validadorSchema: validador
    });

    assert.strictEqual(resultado.api_7dias_mm, 8.50);
    assert.strictEqual(resultado.api_modelo_crudo_mm, 8.50);
    assert.strictEqual(resultado.estado_historial, "COMPLETO");
    assert.strictEqual(resultado.ajuste_satelital_aplicado, false);
  });

  it("b) Historial completo con ponderación decreciente (el día más reciente pesa más)", () => {
    const histD1 = generarHistorial168h([10, 0, 0, 0, 0, 0, 0]);
    const histD7 = generarHistorial168h([0, 0, 0, 0, 0, 0, 10]);

    const resD1 = ejecutarPaso2Memoria({ loc_id_global: locId, historial_168h: histD1, timestamp_calculo: timestampCalculo });
    const resD7 = ejecutarPaso2Memoria({ loc_id_global: locId, historial_168h: histD7, timestamp_calculo: timestampCalculo });

    assert.strictEqual(resD1.api_7dias_mm, 8.50);
    assert.strictEqual(resD7.api_7dias_mm, 3.21);
    assert.strictEqual(resD1.api_7dias_mm > resD7.api_7dias_mm, true);
  });

  it("c) Historial incompleto (< 168h) aplica piso precautorio de 15.0 mm", () => {
    const historialCorto = [
      { timestamp_utc6: "2026-03-29T11:00:00-06:00", lluvia_consenso_mm: 1.0 },
      { timestamp_utc6: "2026-03-29T10:00:00-06:00", lluvia_consenso_mm: 1.0 }
    ];

    const resultado = ejecutarPaso2Memoria({
      loc_id_global: locId,
      historial_168h: historialCorto,
      timestamp_calculo: timestampCalculo,
      validadorSchema: validador
    });

    assert.strictEqual(resultado.api_7dias_mm, 15.0);
    assert.strictEqual(resultado.estado_historial, "INCOMPLETO_CON_PISO");
  });

  it("d) Verificación satelital: Discrepancia <= 20.0 mm no altera el API calculado", () => {
    const historial = generarHistorial168h([10, 0, 0, 0, 0, 0, 0]);

    const resultado = ejecutarPaso2Memoria({
      loc_id_global: locId,
      historial_168h: historial,
      observado_satelite: 25.0,
      timestamp_calculo: timestampCalculo,
      validadorSchema: validador
    });

    assert.strictEqual(resultado.api_7dias_mm, 8.50);
    assert.strictEqual(resultado.diferencia_satelite_mm, 16.50);
    assert.strictEqual(resultado.ajuste_satelital_aplicado, false);
  });

  it("e) Verificación satelital: Discrepancia > 20.0 mm activa precaución asimétrica y adopta MAX", () => {
    const historial = generarHistorial168h([10, 0, 0, 0, 0, 0, 0]);

    const resultado = ejecutarPaso2Memoria({
      loc_id_global: locId,
      historial_168h: historial,
      observado_satelite: 35.0,
      timestamp_calculo: timestampCalculo,
      validadorSchema: validador
    });

    assert.strictEqual(resultado.api_7dias_mm, 35.0);
    assert.strictEqual(resultado.api_modelo_crudo_mm, 8.50);
    assert.strictEqual(resultado.api_satelite_mm, 35.0);
    assert.strictEqual(resultado.diferencia_satelite_mm, 26.50);
    assert.strictEqual(resultado.ajuste_satelital_aplicado, true);
  });

  it("f) Satélite nulo o ausente no produce ajuste y opera normalmente", () => {
    const historial = generarHistorial168h([10, 0, 0, 0, 0, 0, 0]);

    const resultado = ejecutarPaso2Memoria({
      loc_id_global: locId,
      historial_168h: historial,
      observado_satelite: null,
      timestamp_calculo: timestampCalculo
    });

    assert.strictEqual(resultado.api_7dias_mm, 8.50);
    assert.strictEqual(resultado.api_satelite_mm, 0.0);
    assert.strictEqual(resultado.diferencia_satelite_mm, 0.0);
    assert.strictEqual(resultado.ajuste_satelital_aplicado, false);
  });

  it("g) Determinismo estricto: misma entrada produce idéntica salida", () => {
    const hist = generarHistorial168h([10, 5, 2, 0, 0, 0, 0]);
    const r1 = ejecutarPaso2Memoria({ loc_id_global: locId, historial_168h: hist, timestamp_calculo: timestampCalculo });
    const r2 = ejecutarPaso2Memoria({ loc_id_global: locId, historial_168h: hist, timestamp_calculo: timestampCalculo });

    assert.deepStrictEqual(r1, r2);
  });
});