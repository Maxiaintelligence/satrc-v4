/**
 * @file tests/motor/pipeline/evaluacion.test.js
 * @description Pruebas unitarias deterministas para los 6 vectores de riesgo, combinaciones y función principal Paso 3.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aplicarFactorExposicion,
  evaluarVectorDeslave,
  evaluarVectorInundacion,
  evaluarVectorViento,
  evaluarVectorTemperatura,
  evaluarVectorNiebla,
  evaluarVectorAislamiento,
  calcularEsComunidadSerrana,
  resolverJerarquiaDesempate,
  ejecutarPaso3Evaluacion
} from "../../../src/motor/pipeline/evaluacion.js";
import { compilarValidador } from "../../../src/utils/validator.js";

const schemaEvaluacionInline = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: [
    "loc_id_global",
    "zona_id",
    "timestamp_evaluacion",
    "nivel_alerta",
    "color_alerta",
    "vector_dominante",
    "vectores",
    "metricas_clave",
    "impacto_sistemico"
  ],
  properties: {
    loc_id_global: { type: "string" },
    zona_id: { type: "string" },
    timestamp_evaluacion: { type: "string", format: "date-time" },
    nivel_alerta: { type: "integer", minimum: 1, maximum: 4 },
    color_alerta: { type: "string", enum: ["VERDE", "AMARILLO", "NARANJA", "ROJO"] },
    vector_dominante: { type: "string" },
    vectores: {
      type: "object",
      required: ["deslave", "inundacion", "viento", "temperatura", "niebla", "aislamiento_vial"],
      properties: {
        deslave: { type: "integer", minimum: 1, maximum: 4 },
        inundacion: { type: "integer", minimum: 1, maximum: 4 },
        viento: { type: "integer", minimum: 1, maximum: 4 },
        temperatura: { type: "integer", minimum: 1, maximum: 4 },
        niebla: { type: "integer", minimum: 1, maximum: 4 },
        aislamiento_vial: { type: "integer", minimum: 1, maximum: 4 }
      }
    },
    metricas_clave: {
      type: "object",
      required: [
        "lluvia_acumulada_24h_mm",
        "lluvia_horaria_max_mm",
        "hora_pico",
        "temperatura_min_c",
        "temperatura_max_c",
        "viento_max_kmh",
        "rafaga_max_kmh",
        "visibilidad_min_m",
        "api_7dias_mm",
        "saturacion_total_mm",
        "umbral_deslave_mm",
        "spread_max_mm"
      ]
    },
    impacto_sistemico: {
      type: "object",
      required: [
        "es_comunidad_serrana",
        "poblacion_afectada",
        "poblacion_aguas_arriba",
        "aislamiento_vial_posible"
      ]
    }
  }
};

function crearConsenso24hMock({ lluviaHora = 1.0, temp = 18.0, viento = 15.0, rafaga = 25.0, vis = 10000.0, rh = 70.0, spread = 2.0 } = {}) {
  const horas = [];
  for (let h = 0; h < 24; h++) {
    horas.push({
      loc_id_global: "LOC_HGO_ACT_1_619360b0",
      timestamp_utc6: `2026-03-29T${String(h).padStart(2, "0")}:00:00-06:00`,
      hora_relativa: 168 + h,
      lluvia_consenso_mm: lluviaHora,
      temperatura_consenso_c: temp,
      viento_max_kmh: viento,
      rafaga_max_kmh: rafaga,
      humedad_relativa_pct: rh,
      visibilidad_m: vis,
      spread_lluvia_mm: spread,
      confiabilidad: "ALTA"
    });
  }
  return horas;
}

describe("Paso 3: Evaluación Multivectorial (evaluacion.js)", () => {
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

  describe("6. Vector Niebla", () => {
    it("a) visibilidad 80m (<100), RH 96% (>=95), esSerrana=true -> Nivel 4", () => {
      const res = evaluarVectorNiebla({
        localidad: {},
        visibilidadMin: 80.0,
        rhMax: 96.0,
        esSerrana: true
      });
      assert.strictEqual(res.nivel, 4);
      assert.strictEqual(res.causaDominante, "NIEBLA");
    });

    it("b) visibilidad 80m, RH 96%, esSerrana=false -> Nivel 3 (no cumple N4 por relieve plano)", () => {
      const res = evaluarVectorNiebla({
        localidad: {},
        visibilidadMin: 80.0,
        rhMax: 96.0,
        esSerrana: false
      });
      assert.strictEqual(res.nivel, 3);
    });

    it("c) visibilidad 300m (<500), RH 92% (>=90) -> Nivel 3", () => {
      const res = evaluarVectorNiebla({
        localidad: {},
        visibilidadMin: 300.0,
        rhMax: 92.0,
        esSerrana: false
      });
      assert.strictEqual(res.nivel, 3);
    });

    it("d) visibilidad 800m (<1000), RH 88% (>=85) -> Nivel 2", () => {
      const res = evaluarVectorNiebla({
        localidad: {},
        visibilidadMin: 800.0,
        rhMax: 88.0,
        esSerrana: false
      });
      assert.strictEqual(res.nivel, 2);
    });

    it("e) visibilidad 2000m (>=1000) -> Nivel 1", () => {
      const res = evaluarVectorNiebla({
        localidad: {},
        visibilidadMin: 2000.0,
        rhMax: 80.0,
        esSerrana: false
      });
      assert.strictEqual(res.nivel, 1);
    });
  });

  describe("7. Vector Aislamiento Vial", () => {
    it("a) BRECHA + lluvia 55 mm (>=50) + dist hospital 30 km (>=25) -> Nivel 4", () => {
      const res = evaluarVectorAislamiento({
        localidad: { acceso_vial: "BRECHA", dist_hospital_km: 30.0 },
        lluvia24h: 55.0,
        nivelDeslave: 1
      });
      assert.strictEqual(res.nivel, 4);
      assert.strictEqual(res.causaDominante, "AISLAMIENTO_VIAL");
    });

    it("b) BRECHA + nivelDeslave 3 (>=3) + dist hospital 26 km (>=25) -> Nivel 4", () => {
      const res = evaluarVectorAislamiento({
        localidad: { acceso_vial: "BRECHA", dist_hospital_km: 26.0 },
        lluvia24h: 10.0,
        nivelDeslave: 3
      });
      assert.strictEqual(res.nivel, 4);
    });

    it("c) CAMINO_TERRACERIA + lluvia 35 mm (>=30) + dist hospital 20 km (>=15) -> Nivel 3", () => {
      const res = evaluarVectorAislamiento({
        localidad: { acceso_vial: "CAMINO_TERRACERIA", dist_hospital_km: 20.0 },
        lluvia24h: 35.0,
        nivelDeslave: 1
      });
      assert.strictEqual(res.nivel, 3);
    });

    it("d) CAMINO_TERRACERIA + nivelDeslave 2 (>=2) + dist hospital 18 km (>=15) -> Nivel 3", () => {
      const res = evaluarVectorAislamiento({
        localidad: { acceso_vial: "CAMINO_TERRACERIA", dist_hospital_km: 18.0 },
        lluvia24h: 5.0,
        nivelDeslave: 2
      });
      assert.strictEqual(res.nivel, 3);
    });

    it("e) CARRETERA_ESTATAL + lluvia 55 mm (>=50) -> Nivel 2", () => {
      const res = evaluarVectorAislamiento({
        localidad: { acceso_vial: "CARRETERA_ESTATAL", dist_hospital_km: 10.0 },
        lluvia24h: 55.0,
        nivelDeslave: 1
      });
      assert.strictEqual(res.nivel, 2);
    });

    it("f) CAMINO_TERRACERIA + lluvia 20 mm (>=15) -> Nivel 2", () => {
      const res = evaluarVectorAislamiento({
        localidad: { acceso_vial: "CAMINO_TERRACERIA", dist_hospital_km: 8.0 },
        lluvia24h: 20.0,
        nivelDeslave: 1
      });
      assert.strictEqual(res.nivel, 2);
    });

    it("g) CARRETERA_FEDERAL + lluvia 80 mm -> Nivel 1 (acceso pavimentado seguro)", () => {
      const res = evaluarVectorAislamiento({
        localidad: { acceso_vial: "CARRETERA_FEDERAL", dist_hospital_km: 5.0 },
        lluvia24h: 80.0,
        nivelDeslave: 1
      });
      assert.strictEqual(res.nivel, 1);
    });
  });

  describe("8. Comunidad Serrana", () => {
    it("a) altitud 2200, LADERA -> true", () => {
      assert.strictEqual(calcularEsComunidadSerrana({ localidad: { altitud_msnm: 2200, relieve_tipo: "LADERA" } }), true);
    });

    it("b) altitud 2200, MESETA, pendiente 15° (<20) -> false", () => {
      assert.strictEqual(calcularEsComunidadSerrana({ localidad: { altitud_msnm: 2200, relieve_tipo: "MESETA", pendiente_max_deg: 15.0 } }), false);
    });

    it("c) altitud 1000 (<1500), LADERA -> false", () => {
      assert.strictEqual(calcularEsComunidadSerrana({ localidad: { altitud_msnm: 1000, relieve_tipo: "LADERA" } }), false);
    });

    it("d) altitud 1600, MESETA, pendiente 25° (>=20) -> true", () => {
      assert.strictEqual(calcularEsComunidadSerrana({ localidad: { altitud_msnm: 1600, relieve_tipo: "MESETA", pendiente_max_deg: 25.0 } }), true);
    });

    it("e) altitud 2400, MESETA, pendiente 10° -> false", () => {
      assert.strictEqual(calcularEsComunidadSerrana({ localidad: { altitud_msnm: 2400, relieve_tipo: "MESETA", pendiente_max_deg: 10.0 } }), false);
    });
  });

  describe("9. Jerarquía de Desempate", () => {
    it("a) Empate Nivel 3 entre DESLAVE e INUNDACION -> Gana DESLAVE", () => {
      const res = resolverJerarquiaDesempate({
        nivelesPorVector: { deslave: 3, inundacion: 3, aislamiento: 1, temperatura: 1, viento: 1, niebla: 1 }
      });
      assert.strictEqual(res.vectorDominante, "DESLAVE");
    });

    it("b) Empate Nivel 3 entre VIENTO y NIEBLA -> Gana VIENTO", () => {
      const res = resolverJerarquiaDesempate({
        nivelesPorVector: { deslave: 1, inundacion: 1, aislamiento: 1, temperatura: 1, viento: 3, niebla: 3 }
      });
      assert.strictEqual(res.vectorDominante, "VIENTO");
    });

    it("c) Empate Nivel 4 entre TEMPERATURA y AISLAMIENTO -> Gana AISLAMIENTO_VIAL", () => {
      const res = resolverJerarquiaDesempate({
        nivelesPorVector: { deslave: 1, inundacion: 1, aislamiento: 4, temperatura: 4, viento: 1, niebla: 1 }
      });
      assert.strictEqual(res.vectorDominante, "AISLAMIENTO_VIAL");
    });

    it("d) Solo un vector en Nivel 4 -> Ese gana inequívocamente", () => {
      const res = resolverJerarquiaDesempate({
        nivelesPorVector: { deslave: 1, inundacion: 4, aislamiento: 2, temperatura: 1, viento: 2, niebla: 1 }
      });
      assert.strictEqual(res.vectorDominante, "INUNDACION");
    });
  });

  describe("10. ejecutarPaso3Evaluacion (Integración)", () => {
    const validador = compilarValidador(schemaEvaluacionInline);
    const timestampEval = "2026-03-29T18:00:00-06:00";

    const locAltiplano = {
      loc_id_global: "LOC_HGO_ACT_1_619360b0",
      zona_id: "ACT",
      altitud_msnm: 2007,
      relieve_tipo: "MESETA",
      pendiente_max_deg: 10.0,
      dist_cauce_km: 33.9,
      twi: 12.9,
      acceso_vial: "CARRETERA_FEDERAL",
      dist_hospital_km: 41.0,
      poblacion: 32276,
      poblacion_aguas_arriba: 134957
    };

    const locSerrana = {
      loc_id_global: "LOC_PUE_HUA_1_a1b2c3d4",
      zona_id: "HUA",
      altitud_msnm: 1740,
      relieve_tipo: "LADERA",
      pendiente_max_deg: 40.0,
      dist_cauce_km: 12.4,
      twi: 13.3,
      acceso_vial: "CAMINO_TERRACERIA",
      dist_hospital_km: 26.0,
      poblacion: 1748,
      poblacion_aguas_arriba: 152774
    };

    it("a) Caso simple: Altiplano sin amenazas meteorológicas -> Nivel 1 VERDE", () => {
      const consenso = crearConsenso24hMock({ lluviaHora: 0.1, temp: 16.0, viento: 10.0, rafaga: 20.0, vis: 10000.0 });
      const api7d = { api_7dias_mm: 5.0 };

      const res = ejecutarPaso3Evaluacion({
        localidad: locAltiplano,
        consenso24h: consenso,
        api7dias: api7d,
        factorExposicion: 1.0,
        timestamp_evaluacion: timestampEval,
        validadorSchema: validador
      });

      assert.strictEqual(res.nivel_alerta, 1);
      assert.strictEqual(res.color_alerta, "VERDE");
      assert.strictEqual(res.impacto_sistemico.es_comunidad_serrana, false);
      assert.strictEqual(res.impacto_sistemico.aislamiento_vial_posible, false);
    });

    it("b) Caso ladera con saturación alta -> Nivel 4 ROJO (cascada o deslave dominante)", () => {
      const consenso = crearConsenso24hMock({ lluviaHora: 2.0, temp: 15.0, viento: 15.0 });
      const api7d = { api_7dias_mm: 40.0 };

      const res = ejecutarPaso3Evaluacion({
        localidad: locSerrana,
        consenso24h: consenso,
        api7dias: api7d,
        factorExposicion: 1.0,
        timestamp_evaluacion: timestampEval,
        validadorSchema: validador
      });

      assert.strictEqual(res.nivel_alerta, 4);
      assert.strictEqual(res.color_alerta, "ROJO");
      assert.strictEqual(res.vectores.deslave, 4);
      assert.ok(res.vector_dominante === "DESLAVE" || res.vector_dominante === "COMBINADO_CASCADA");
    });

    it("c) Regla en Cascada: Deslave >= 3 + Aislamiento >= 3 -> Nivel 4 COMBINADO_CASCADA", () => {
      const consenso = crearConsenso24hMock({ lluviaHora: 10.0 / 24.0, temp: 15.0, viento: 10.0 });
      const api7d = { api_7dias_mm: 10.0 };

      const res = ejecutarPaso3Evaluacion({
        localidad: locSerrana,
        consenso24h: consenso,
        api7dias: api7d,
        factorExposicion: 1.0,
        timestamp_evaluacion: timestampEval,
        validadorSchema: validador
      });

      assert.strictEqual(res.vectores.deslave, 3);
      assert.strictEqual(res.vectores.aislamiento_vial, 4);
      assert.strictEqual(res.nivel_alerta, 4);
      assert.strictEqual(res.color_alerta, "ROJO");
      assert.strictEqual(res.vector_dominante, "COMBINADO_CASCADA");
      assert.strictEqual(res.impacto_sistemico.aislamiento_vial_posible, true);
    });

    it("d) Guardarraíl serrano por ráfaga: Nivel base 1 + ráfaga 60 km/h (>=40) en serrana -> Sube a Nivel 2 AMARILLO (VIENTO)", () => {
      const consenso = crearConsenso24hMock({ lluviaHora: 0.1, temp: 15.0, viento: 20.0, rafaga: 60.0 });
      const api7d = { api_7dias_mm: 2.0 };

      const res = ejecutarPaso3Evaluacion({
        localidad: locSerrana,
        consenso24h: consenso,
        api7dias: api7d,
        factorExposicion: 1.0,
        timestamp_evaluacion: timestampEval,
        validadorSchema: validador
      });

      assert.strictEqual(res.nivel_alerta, 2);
      assert.strictEqual(res.color_alerta, "AMARILLO");
      assert.strictEqual(res.vector_dominante, "VIENTO");
    });

    it("e) Guardarraíl serrano en ventana operativa [40..44.9 km/h]: ráfaga 42 km/h con viento base N1 -> Sube a Nivel 2 AMARILLO (VIENTO)", () => {
      const locSerranaPlana = {
        ...locSerrana,
        relieve_tipo: "LOMA",
        pendiente_max_deg: 20.0,
        dist_cauce_km: 10.0,
        twi: 5.0,
        dist_hospital_km: 5.0
      };
      const consenso = crearConsenso24hMock({ lluviaHora: 0.0, temp: 15.0, viento: 20.0, rafaga: 42.0 });
      const api7d = { api_7dias_mm: 0.0 };

      const res = ejecutarPaso3Evaluacion({
        localidad: locSerranaPlana,
        consenso24h: consenso,
        api7dias: api7d,
        factorExposicion: 1.0,
        timestamp_evaluacion: timestampEval,
        validadorSchema: validador
      });

      assert.strictEqual(res.nivel_alerta, 2);
      assert.strictEqual(res.color_alerta, "AMARILLO");
      assert.strictEqual(res.vector_dominante, "VIENTO");
    });

    it("f) Determinismo estricto: misma entrada produce idéntico objeto de evaluación", () => {
      const consenso = crearConsenso24hMock();
      const api7d = { api_7dias_mm: 10.0 };

      const r1 = ejecutarPaso3Evaluacion({
        localidad: locSerrana,
        consenso24h: consenso,
        api7dias: api7d,
        factorExposicion: 1.10,
        timestamp_evaluacion: timestampEval
      });

      const r2 = ejecutarPaso3Evaluacion({
        localidad: locSerrana,
        consenso24h: consenso,
        api7dias: api7d,
        factorExposicion: 1.10,
        timestamp_evaluacion: timestampEval
      });

      assert.deepStrictEqual(r1, r2);
    });

    it("g) Estructura de retorno valida rigurosamente contra JSON Schema", () => {
      const consenso = crearConsenso24hMock();
      const api7d = { api_7dias_mm: 15.0 };

      const res = ejecutarPaso3Evaluacion({
        localidad: locAltiplano,
        consenso24h: consenso,
        api7dias: api7d,
        factorExposicion: 1.0,
        timestamp_evaluacion: timestampEval,
        validadorSchema: validador
      });

      assert.strictEqual(typeof res.loc_id_global, "string");
      assert.strictEqual(typeof res.metricas_clave.umbral_deslave_mm, "number");
      assert.strictEqual(typeof res.impacto_sistemico.poblacion_afectada, "number");
    });
  });
});