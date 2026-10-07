/**
 * @file tests/motor/pipeline/evaluacion.test.js
 * @description Pruebas unitarias deterministas para los 4 vectores de riesgo base y factor de exposición.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aplicarFactorExposicion,
  evaluarVectorDeslave,
  evaluarVectorInundacion,
  evaluarVectorViento,
  evaluarVectorTemperatura
} from "../../../src/motor/pipeline/evaluacion.js";

describe("Paso 3: Evaluación de Vectores Base (evaluacion.js)", () => {
  describe("1. Factor de Exposición Topográfica", () => {
    it("x) Aplica factor barlovento (1.15): lluvia 30 * 1.15 = 34.50 mm", () => {
      const res = aplicarFactorExposicion({ lluvia24hBase: 30.0, factorExposicion: 1.15 });
      assert.strictEqual(res, 34.50);
    });

    it("y) Aplica factor sotavento (0.85): lluvia 30 * 0.85 = 25.50 mm", () => {
      const res = aplicarFactorExposicion({ lluvia24hBase: 30.0, factorExposicion: 0.85 });
      assert.strictEqual(res, 25.50);
    });
  });

  describe("2. Vector Deslave", () => {
    const locLadera30 = {
      loc_id_global: "LOC_HGO_TEST_1_a1",
      relieve_tipo: "LADERA",
      pendiente_max_deg: 30.0
    };

    it("a) LADERA 30° y saturación baja (10 mm < 0.70 * 24.5 = 17.15 mm) -> Nivel 1", () => {
      const res = evaluarVectorDeslave({
        localidad: locLadera30,
        saturacionTotal: 10.0,
        lluvia24h: 5.0,
        spreadMax: 2.0
      });
      assert.strictEqual(res.umbralCalculado, 24.50);
      assert.strictEqual(res.nivel, 1);
    });

    it("b) LADERA 30° y saturación sobre umbral (25 mm >= 24.50 mm) -> Nivel 3", () => {
      const res = evaluarVectorDeslave({
        localidad: locLadera30,
        saturacionTotal: 25.0,
        lluvia24h: 10.0,
        spreadMax: 2.0
      });
      assert.strictEqual(res.nivel, 3);
    });

    it("c) LADERA 30° y saturación 1.5x umbral (37.0 mm >= 36.75 mm) -> Nivel 4", () => {
      const res = evaluarVectorDeslave({
        localidad: locLadera30,
        saturacionTotal: 37.0,
        lluvia24h: 15.0,
        spreadMax: 2.0
      });
      assert.strictEqual(res.nivel, 4);
    });

    it("d) LOMA con pendiente 30°: factor 8 -> umbral = 65 - 25.5 - 8 = 31.50 mm", () => {
      const locLoma30 = {
        loc_id_global: "LOC_HGO_TEST_2_b2",
        relieve_tipo: "LOMA",
        pendiente_max_deg: 30.0
      };
      const res = evaluarVectorDeslave({
        localidad: locLoma30,
        saturacionTotal: 25.0,
        lluvia24h: 10.0,
        spreadMax: 2.0
      });
      assert.strictEqual(res.umbralCalculado, 31.50);
      assert.strictEqual(res.nivel, 2);
    });

    it("e) Override crítico: pendiente 50°, saturación >= 40 mm -> Nivel 4 directo", () => {
      const locCritica = {
        loc_id_global: "LOC_HGO_TEST_3_c3",
        relieve_tipo: "LADERA",
        pendiente_max_deg: 50.0
      };
      const res = evaluarVectorDeslave({
        localidad: locCritica,
        saturacionTotal: 40.0,
        lluvia24h: 10.0,
        spreadMax: 2.0
      });
      assert.strictEqual(res.nivel, 4);
    });

    it("f) Override crítico: pendiente 50°, lluvia 15 mm (>= 12 mm) y saturación 10 mm (N2 base) -> Nivel 3 mínimo por override", () => {
      const locCritica = {
        loc_id_global: "LOC_HGO_TEST_3_c3",
        relieve_tipo: "LADERA",
        pendiente_max_deg: 50.0
      };
      const res = evaluarVectorDeslave({
        localidad: locCritica,
        saturacionTotal: 10.0,
        lluvia24h: 15.0,
        spreadMax: 2.0
      });
      assert.strictEqual(res.nivel, 3);
    });

    it("g) Modulador por spread: spread 20 mm (> 15) y saturación en frontera (0.60 * 24.5 = 14.7 mm) -> Sube de N1 a N2", () => {
      const res = evaluarVectorDeslave({
        localidad: locLadera30,
        saturacionTotal: 15.0,
        lluvia24h: 5.0,
        spreadMax: 20.0
      });
      assert.strictEqual(res.nivel, 2);
    });

    it("h) Piso universal: pendiente 45° LADERA -> 65 - 38.25 - 15 = 11.75 -> Piso = 12.0 mm", () => {
      const locLadera45 = {
        loc_id_global: "LOC_HGO_TEST_4_d4",
        relieve_tipo: "LADERA",
        pendiente_max_deg: 45.0
      };
      const res = evaluarVectorDeslave({
        localidad: locLadera45,
        saturacionTotal: 5.0,
        lluvia24h: 2.0,
        spreadMax: 1.0
      });
      assert.strictEqual(res.umbralCalculado, 12.0);
    });
  });

  describe("3. Vector Inundación", () => {
    it("i) Ribera N4: dist 0.5 km (<=0.8), twi 13.0 (>=12), lluvia 40 mm (>=35) -> Nivel 4", () => {
      const res = evaluarVectorInundacion({
        localidad: { dist_cauce_km: 0.5, twi: 13.0 },
        lluvia24h: 40.0,
        saturacionTotal: 50.0
      });
      assert.strictEqual(res.nivel, 4);
    });

    it("j) Ribera N3: dist 1.2 km (<=1.5), twi 10.5 (>=10), lluvia 30 mm (>=25) -> Nivel 3", () => {
      const res = evaluarVectorInundacion({
        localidad: { dist_cauce_km: 1.2, twi: 10.5 },
        lluvia24h: 30.0,
        saturacionTotal: 30.0
      });
      assert.strictEqual(res.nivel, 3);
    });

    it("k) N2 por lluvia acumulada: lluvia 10 mm (>=8), dist 5.0 km, twi 8.0 -> Nivel 2", () => {
      const res = evaluarVectorInundacion({
        localidad: { dist_cauce_km: 5.0, twi: 8.0 },
        lluvia24h: 10.0,
        saturacionTotal: 15.0
      });
      assert.strictEqual(res.nivel, 2);
    });

    it("l) N2 por saturación total: saturación 40 mm (>=35), lluvia 2 mm -> Nivel 2", () => {
      const res = evaluarVectorInundacion({
        localidad: { dist_cauce_km: 5.0, twi: 8.0 },
        lluvia24h: 2.0,
        saturacionTotal: 40.0
      });
      assert.strictEqual(res.nivel, 2);
    });

    it("m) N1: variables por debajo de todo umbral -> Nivel 1", () => {
      const res = evaluarVectorInundacion({
        localidad: { dist_cauce_km: 5.0, twi: 8.0 },
        lluvia24h: 3.0,
        saturacionTotal: 10.0
      });
      assert.strictEqual(res.nivel, 1);
    });
  });

  describe("4. Vector Viento", () => {
    it("n) Ráfaga 90 km/h (>=85) -> Nivel 4", () => {
      const res = evaluarVectorViento({ vientoMax: 30.0, rafagaMax: 90.0 });
      assert.strictEqual(res.nivel, 4);
    });

    it("o) Viento sostenido 70 km/h (>=65) con ráfaga 80 km/h -> Nivel 4", () => {
      const res = evaluarVectorViento({ vientoMax: 70.0, rafagaMax: 80.0 });
      assert.strictEqual(res.nivel, 4);
    });

    it("p) Ráfaga 70 km/h (>=65) y viento sostenido 40 km/h -> Nivel 3", () => {
      const res = evaluarVectorViento({ vientoMax: 40.0, rafagaMax: 70.0 });
      assert.strictEqual(res.nivel, 3);
    });

    it("q) Ráfaga 50 km/h (>=45) y viento sostenido 25 km/h -> Nivel 2", () => {
      const res = evaluarVectorViento({ vientoMax: 25.0, rafagaMax: 50.0 });
      assert.strictEqual(res.nivel, 2);
    });

    it("r) Sin viento relevante: ráfaga 30 km/h, sostenido 15 km/h -> Nivel 1", () => {
      const res = evaluarVectorViento({ vientoMax: 15.0, rafagaMax: 30.0 });
      assert.strictEqual(res.nivel, 1);
    });
  });

  describe("5. Vector Temperatura", () => {
    it("s) Helada Negra: T=-1.0°C (<=0), RH=55% (<60), alt=2200 msnm (>=2100) -> Nivel 4 HELADA_NEGRA", () => {
      const res = evaluarVectorTemperatura({
        localidad: { altitud_msnm: 2200 },
        tempMin: -1.0,
        vientoMax: 10.0,
        rhMin: 55.0
      });
      assert.strictEqual(res.nivel, 4);
      assert.strictEqual(res.tipoEvento, "HELADA_NEGRA");
    });

    it("t) Wind Chill extremo: T=-2.0°C, viento 30 km/h -> wc = -9.08°C (<=-5) -> Nivel 4 WIND_CHILL_EXTREMO", () => {
      const res = evaluarVectorTemperatura({
        localidad: { altitud_msnm: 1800 },
        tempMin: -2.0,
        vientoMax: 30.0,
        rhMin: 70.0
      });
      assert.strictEqual(res.nivel, 4);
      assert.strictEqual(res.tipoEvento, "WIND_CHILL_EXTREMO");
      assert.strictEqual(res.windChill, -9.08);
    });

    it("u) T=-2.0°C con RH=80% (>=60) y viento moderado -> Nivel 3 HELADA_BLANCA", () => {
      const res = evaluarVectorTemperatura({
        localidad: { altitud_msnm: 2200 },
        tempMin: -2.0,
        vientoMax: 5.0,
        rhMin: 80.0
      });
      assert.strictEqual(res.nivel, 3);
      assert.strictEqual(res.tipoEvento, "HELADA_BLANCA");
    });

    it("v) T=3.0°C (<=4.0) en montaña (altitud 2500 msnm) con viento 10 km/h (wc = 0.27°C > 0) -> Nivel 2 FRIO_MODERADO", () => {
      const res = evaluarVectorTemperatura({
        localidad: { altitud_msnm: 2500 },
        tempMin: 3.0,
        vientoMax: 10.0,
        rhMin: 75.0
      });
      assert.strictEqual(res.nivel, 2);
      assert.strictEqual(res.tipoEvento, "FRIO_MODERADO");
    });

    it("w) T=15.0°C en clima cálido -> Nivel 1 NINGUNO", () => {
      const res = evaluarVectorTemperatura({
        localidad: { altitud_msnm: 500 },
        tempMin: 15.0,
        vientoMax: 10.0,
        rhMin: 60.0
      });
      assert.strictEqual(res.nivel, 1);
      assert.strictEqual(res.tipoEvento, "NINGUNO");
      assert.strictEqual(res.windChill, 15.0);
    });
  });
});