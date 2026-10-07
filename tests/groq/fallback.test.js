/**
 * @file tests/groq/fallback.test.js
 * @description Pruebas unitarias deterministas para el generador de dictámenes narrativos de respaldo (fallback).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generarDictamenFallbackZonal } from "../../src/groq/fallback.js";
import { validarRespuestaGroq } from "../../src/groq/prompts.js";

describe("Fallback Determinista Groq (fallback.js)", () => {
  const mockLocDeslave = {
    loc_id_global: "LOC_HGO_ACT_1_619360b0",
    nombre: "Actopan",
    nivel_decretado: 3,
    color_decretado: "NARANJA",
    vector_dominante: "DESLAVE",
    metricas: {
      saturacion_suelo_mm: 65.4,
      umbral_deslave_mm: 35.0,
      hora_pico: "2026-03-29T18:00:00-06:00",
      lluvia_24h_mm: 45.0,
      lluvia_max_hora_mm: 18.0,
      acceso_vial: "CARRETERA_FEDERAL",
      dist_hospital_km: 41.0
    }
  };

  const mockLocCascada = {
    loc_id_global: "LOC_PUE_HUA_1_a1b2c3d4",
    nombre: "Huauchinango",
    nivel_decretado: 4,
    color_decretado: "ROJO",
    vector_dominante: "COMBINADO_CASCADA",
    metricas: {
      saturacion_suelo_mm: 95.0,
      umbral_deslave_mm: 30.0,
      hora_pico: "2026-03-29T20:00:00-06:00",
      lluvia_24h_mm: 75.0,
      lluvia_max_hora_mm: 30.0,
      acceso_vial: "CAMINO_TERRACERIA",
      dist_hospital_km: 28.5
    }
  };

  const mockLocInundacion = {
    loc_id_global: "LOC_HGO_SPP_1_e5f6a7b8",
    nombre: "San Bartolo Tutotepec",
    nivel_decretado: 3,
    color_decretado: "NARANJA",
    vector_dominante: "INUNDACION",
    metricas: {
      lluvia_24h_mm: 55.0,
      lluvia_max_hora_mm: 22.0,
      hora_pico: "2026-03-29T19:00:00-06:00",
      saturacion_suelo_mm: 60.0,
      umbral_deslave_mm: 40.0,
      acceso_vial: "CARRETERA_ESTATAL",
      dist_hospital_km: 12.0
    }
  };

  it("a) Caso básico: 1 localidad con vector DESLAVE retorna estructura y título correctos", () => {
    const res = generarDictamenFallbackZonal({
      zona_id: "ACT",
      zona_resguardo: "Altiplano Tula–Actopan",
      localidades_evaluadas: [mockLocDeslave]
    });

    assert.strictEqual(res.dictamenes.length, 1);
    const d = res.dictamenes[0];
    assert.strictEqual(d.loc_id_global, "LOC_HGO_ACT_1_619360b0");
    assert.strictEqual(d.titulo, "ALERTA NARANJA POR DESLAVE EN Actopan");
    assert.match(d.causa, /Saturación hídrica de 65.4 mm frente a un umbral de 35 mm/);
    assert.strictEqual(d.recomendaciones.length, 3);
  });

  it("b) 3 localidades con vectores distintos generan causas personalizadas", () => {
    const res = generarDictamenFallbackZonal({
      zona_id: "SPP",
      zona_resguardo: "Sierra de Pahuatlán y Otomí-Tepehua",
      localidades_evaluadas: [mockLocDeslave, mockLocCascada, mockLocInundacion]
    });

    assert.strictEqual(res.dictamenes.length, 3);
    assert.match(res.dictamenes[0].causa, /Saturación hídrica/);
    assert.match(res.dictamenes[1].causa, /Riesgo concurrente/);
    assert.match(res.dictamenes[2].causa, /Lluvia prevista de 55 mm/);
  });

  it("c) Vector COMBINADO_CASCADA menciona 'concurrente', tipo de acceso y distancia hospitalaria", () => {
    const res = generarDictamenFallbackZonal({
      zona_id: "HUA",
      zona_resguardo: "Huauchinango",
      localidades_evaluadas: [mockLocCascada]
    });

    const d = res.dictamenes[0];
    assert.match(d.causa, /Riesgo concurrente de desprendimientos/);
    assert.match(d.causa, /acceso tipo CAMINO_TERRACERIA/);
    assert.match(d.causa, /a 28.5 km del centro médico/);
  });

  it("d) Vector desconocido o no listado aplica la causa genérica por defecto", () => {
    const locDesconocida = {
      ...mockLocDeslave,
      vector_dominante: "GRANIZO_EXTRAORDINARIO"
    };

    const res = generarDictamenFallbackZonal({
      zona_id: "ACT",
      zona_resguardo: "Altiplano",
      localidades_evaluadas: [locDesconocida]
    });

    assert.match(res.dictamenes[0].causa, /Evento meteorológico adverso previsto/);
  });

  it("e) Lanza error descriptivo si falta algún campo obligatorio en una localidad", () => {
    const locIncompleta = { ...mockLocDeslave };
    delete locIncompleta.color_decretado;

    assert.throws(
      () =>
        generarDictamenFallbackZonal({
          zona_id: "ACT",
          zona_resguardo: "Altiplano",
          localidades_evaluadas: [locIncompleta]
        }),
      /Falta 'color_decretado' en localidad 'LOC_HGO_ACT_1_619360b0'/
    );
  });

  it("f) Lista de localidades vacía retorna { dictamenes: [] } sin lanzar error", () => {
    const res = generarDictamenFallbackZonal({
      zona_id: "ACT",
      zona_resguardo: "Altiplano",
      localidades_evaluadas: []
    });

    assert.deepStrictEqual(res, { dictamenes: [] });
  });

  it("g) La salida generada pasa exitosamente la validación de prompts.validarRespuestaGroq", () => {
    const res = generarDictamenFallbackZonal({
      zona_id: "SPP",
      zona_resguardo: "Sierra de Pahuatlán y Otomí-Tepehua",
      localidades_evaluadas: [mockLocDeslave, mockLocCascada]
    });

    const val = validarRespuestaGroq(res);
    assert.strictEqual(val.valido, true);
    assert.strictEqual(val.motivo, null);
  });

  it("h) Determinismo estricto: misma entrada produce idéntica salida byte a byte", () => {
    const params = {
      zona_id: "HUA",
      zona_resguardo: "Huauchinango",
      localidades_evaluadas: [mockLocDeslave, mockLocCascada]
    };

    const r1 = generarDictamenFallbackZonal(params);
    const r2 = generarDictamenFallbackZonal(params);

    assert.deepStrictEqual(r1, r2);
  });

  it("i) Truncamiento de seguridad: nombre muy largo (150 chars) no excede 100 chars en el título", () => {
    const locNombreLargo = {
      ...mockLocDeslave,
      nombre: "X".repeat(150)
    };

    const res = generarDictamenFallbackZonal({
      zona_id: "ACT",
      zona_resguardo: "Altiplano",
      localidades_evaluadas: [locNombreLargo]
    });

    const titulo = res.dictamenes[0].titulo;
    assert.strictEqual(titulo.length <= 100, true);
    assert.strictEqual(titulo.length, 100);
  });

  it("j) Dictámenes generados no contienen campos prohibidos ('nivel', 'nivel_alerta', 'color')", () => {
    const res = generarDictamenFallbackZonal({
      zona_id: "ACT",
      zona_resguardo: "Altiplano",
      localidades_evaluadas: [mockLocDeslave, mockLocCascada]
    });

    for (const d of res.dictamenes) {
      assert.strictEqual(Object.prototype.hasOwnProperty.call(d, "nivel"), false);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(d, "nivel_alerta"), false);
      assert.strictEqual(Object.prototype.hasOwnProperty.call(d, "color"), false);
    }
  });
});