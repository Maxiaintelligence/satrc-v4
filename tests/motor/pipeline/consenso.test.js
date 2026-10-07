/**
 * @file tests/motor/pipeline/consenso.test.js
 * @description Pruebas unitarias deterministas para el Paso 1 (Consenso Multi-Modelo y Filtro de Ceros).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ejecutarPaso1Consenso, calcularConsensoLluvia } from "../../../src/motor/pipeline/consenso.js";
import { compilarValidador } from "../../../src/utils/validator.js";

const schemaConsensoInline = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: [
    "loc_id_global",
    "timestamp_utc6",
    "hora_relativa",
    "lluvia_consenso_mm",
    "temperatura_consenso_c",
    "viento_max_kmh",
    "rafaga_max_kmh",
    "humedad_relativa_pct",
    "visibilidad_m",
    "spread_lluvia_mm",
    "confiabilidad"
  ],
  properties: {
    loc_id_global: { type: "string" },
    timestamp_utc6: { type: "string", format: "date-time" },
    hora_relativa: { type: "integer", minimum: 0, maximum: 191 },
    lluvia_consenso_mm: { type: "number", minimum: 0 },
    temperatura_consenso_c: { type: "number" },
    viento_max_kmh: { type: "number", minimum: 0 },
    rafaga_max_kmh: { type: "number", minimum: 0 },
    humedad_relativa_pct: { type: "number", minimum: 0, maximum: 100 },
    visibilidad_m: { type: "number", minimum: 0 },
    spread_lluvia_mm: { type: "number", minimum: 0 },
    confiabilidad: { type: "string", enum: ["ALTA", "MODERADA", "EN_DISPUTA"] }
  }
};

function crearRegistroIngestaMock(pEcmwf, pGfs, pIcon, rEcmwf = 20.0, rGfs = 30.0, rIcon = 45.0) {
  return {
    loc_id_global: "LOC_HGO_ACT_1_619360b0",
    timestamp_utc6: "2026-03-29T12:00:00-06:00",
    hora_relativa: 12,
    modelos: {
      ecmwf_aifs025: {
        lluvia_mm: pEcmwf,
        temperatura_c: 18.0,
        viento_max_kmh: 15.0,
        rafaga_max_kmh: rEcmwf,
        humedad_relativa_pct: 70.0,
        visibilidad_m: 10000.0
      },
      ncep_nbm: {
        lluvia_mm: pGfs,
        temperatura_c: 20.0,
        viento_max_kmh: 22.0,
        rafaga_max_kmh: rGfs,
        humedad_relativa_pct: 65.0,
        visibilidad_m: 9000.0
      },
      icon_seamless: {
        lluvia_mm: pIcon,
        temperatura_c: 19.0,
        viento_max_kmh: 18.0,
        rafaga_max_kmh: rIcon,
        humedad_relativa_pct: 75.0,
        visibilidad_m: 12000.0
      }
    },
    hashes_fuente: {
      ecmwf: "a".repeat(64),
      gfs: "b".repeat(64),
      icon: "c".repeat(64)
    }
  };
}

describe("Paso 1: Consenso Multi-Modelo (consenso.js)", () => {
  it("a) CASO 1: Los 3 modelos prevén lluvia >= 0.5 mm -> Mediana estadística", () => {
    const lluvia = calcularConsensoLluvia(10.0, 30.0, 15.0);
    assert.strictEqual(lluvia, 15.0);
  });

  it("b) CASO 2: Los 3 modelos prevén seco (< 0.1 mm) -> Mediana (0.0)", () => {
    const lluvia = calcularConsensoLluvia(0.0, 0.05, 0.0);
    assert.strictEqual(lluvia, 0.0);
  });

  it("c) CASO 3a: Solo ICON prevé lluvia (>= 0.5 mm) -> p_icon * 0.50", () => {
    const lluvia = calcularConsensoLluvia(0.0, 0.05, 20.0);
    assert.strictEqual(lluvia, 10.0);
  });

  it("d) CASO 3b: Solo ECMWF prevé lluvia (>= 0.5 mm) -> Mediana (gana el seco)", () => {
    const lluvia = calcularConsensoLluvia(20.0, 0.0, 0.0);
    assert.strictEqual(lluvia, 0.0);
  });

  it("e) CASO 4a: ICON disidente (< 0.1 mm) y 2 con lluvia -> Ponderación 50% ICON / 25% ECMWF / 25% GFS", () => {
    const lluvia = calcularConsensoLluvia(12.0, 16.0, 0.0);
    assert.strictEqual(lluvia, 7.0);
  });

  it("f) CASO 4b: ECMWF disidente (< 0.1 mm) y GFS+ICON con lluvia -> Promedio de los 2 con lluvia", () => {
    const lluvia = calcularConsensoLluvia(0.0, 10.0, 20.0);
    assert.strictEqual(lluvia, 15.0);
  });

  it("g) CASO 5: Valores mixtos (2 con lluvia >= 0.5mm, 1 en frontera [0.1..0.49mm]) -> Mediana", () => {
    const lluvia = calcularConsensoLluvia(10.0, 20.0, 0.3);
    assert.strictEqual(lluvia, 10.0);
  });

  it("h) Spread y Confiabilidad: Clasificación exacta en ALTA, MODERADA y EN_DISPUTA", () => {
    const validador = compilarValidador(schemaConsensoInline);

    const [resAlta] = ejecutarPaso1Consenso({
      registrosIngesta: [crearRegistroIngestaMock(10.0, 12.0, 14.0)],
      validadorSchema: validador
    });
    assert.strictEqual(resAlta.spread_lluvia_mm, 4.0);
    assert.strictEqual(resAlta.confiabilidad, "ALTA");

    const [resMod] = ejecutarPaso1Consenso({
      registrosIngesta: [crearRegistroIngestaMock(10.0, 15.0, 20.0)],
      validadorSchema: validador
    });
    assert.strictEqual(resMod.spread_lluvia_mm, 10.0);
    assert.strictEqual(resMod.confiabilidad, "MODERADA");

    const [resDisp] = ejecutarPaso1Consenso({
      registrosIngesta: [crearRegistroIngestaMock(5.0, 10.0, 30.0)],
      validadorSchema: validador
    });
    assert.strictEqual(resDisp.spread_lluvia_mm, 25.0);
    assert.strictEqual(resDisp.confiabilidad, "EN_DISPUTA");
  });

  it("i) Ráfaga máxima toma el MÁXIMO absoluto y temperatura toma la MEDIANA", () => {
    const [resultado] = ejecutarPaso1Consenso({
      registrosIngesta: [crearRegistroIngestaMock(5.0, 5.0, 5.0, 25.0, 40.0, 65.0)]
    });

    assert.strictEqual(resultado.rafaga_max_kmh, 65.0);
    assert.strictEqual(resultado.temperatura_consenso_c, 19.0);
    assert.strictEqual(resultado.viento_max_kmh, 18.0);
  });

  it("j) Determinismo estricto: misma entrada produce idéntica salida", () => {
    const reg = crearRegistroIngestaMock(10.0, 15.0, 20.0);
    const c1 = ejecutarPaso1Consenso({ registrosIngesta: [reg] });
    const c2 = ejecutarPaso1Consenso({ registrosIngesta: [reg] });

    assert.deepStrictEqual(c1, c2);
  });
});