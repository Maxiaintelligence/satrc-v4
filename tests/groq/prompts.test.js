/**
 * @file tests/groq/prompts.test.js
 * @description Pruebas unitarias deterministas para construcción y validación de prompts de Groq.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CAMPOS_PROHIBIDOS,
  construirUserPromptBatchZonal,
  validarRespuestaGroq
} from "../../src/groq/prompts.js";

describe("Prompts Groq: Construcción y Validación (prompts.js)", () => {
  const localidadMock = {
    loc_id_global: "LOC_HGO_ACT_1_619360b0",
    nombre: "Actopan",
    nivel_decretado: 3,
    color_decretado: "NARANJA",
    vector_dominante: "DESLAVE",
    metricas: {
      lluvia_24h_mm: 45.0,
      lluvia_max_hora_mm: 18.0,
      hora_pico: "2026-03-29T18:00:00-06:00",
      saturacion_suelo_mm: 65.0,
      umbral_deslave_mm: 35.0,
      acceso_vial: "CARRETERA_FEDERAL",
      dist_hospital_km: 41.0
    }
  };

  it("a) construirUserPromptBatchZonal retorna estructura correcta con datos válidos", () => {
    const prompt = construirUserPromptBatchZonal({
      zona_id: "ACT",
      zona_resguardo: "Altiplano Tula–Actopan",
      localidades_evaluadas: [localidadMock]
    });

    assert.strictEqual(prompt.zona_id, "ACT");
    assert.strictEqual(prompt.zona_resguardo, "Altiplano Tula–Actopan");
    assert.strictEqual(prompt.localidades_evaluadas.length, 1);
    assert.strictEqual(prompt.localidades_evaluadas[0].loc_id_global, "LOC_HGO_ACT_1_619360b0");
  });

  it("b) Lanza error si localidades_evaluadas está vacío o no es un arreglo", () => {
    assert.throws(
      () =>
        construirUserPromptBatchZonal({
          zona_id: "ACT",
          zona_resguardo: "Altiplano",
          localidades_evaluadas: []
        }),
      /arreglo no vacío/
    );
  });

  it("c) Lanza error si falta un campo requerido en una localidad", () => {
    const locIncompleta = { ...localidadMock };
    delete locIncompleta.vector_dominante;

    assert.throws(
      () =>
        construirUserPromptBatchZonal({
          zona_id: "ACT",
          zona_resguardo: "Altiplano",
          localidades_evaluadas: [locIncompleta]
        }),
      /carece del campo requerido 'vector_dominante'/
    );
  });

  it("d) validarRespuestaGroq acepta una respuesta sintáctica y semánticamente correcta", () => {
    const respuestaValida = {
      dictamenes: [
        {
          loc_id_global: "LOC_HGO_ACT_1_619360b0",
          titulo: "ALERTA NARANJA POR DESLAVE EN ACTOPAN",
          causa: "Saturación de suelo de 65 mm superando umbral crítico de 35 mm.",
          recomendaciones: [
            "Activar monitoreo de laderas con comités comunitarios.",
            "Despejar cunetas y pasos de agua prioritarios."
          ],
          contexto: "Pronóstico operativo para las próximas 24 horas."
        }
      ]
    };

    const res = validarRespuestaGroq(respuestaValida);
    assert.strictEqual(res.valido, true);
    assert.strictEqual(res.motivo, null);
  });

  it("e) validarRespuestaGroq rechaza si falta el campo 'dictamenes'", () => {
    const res = validarRespuestaGroq({ resultado: [] });
    assert.strictEqual(res.valido, false);
    assert.match(res.motivo, /'dictamenes' debe ser un arreglo no vacío/);
  });

  it("f) validarRespuestaGroq rechaza si un dictamen contiene campos prohibidos (nivel, nivel_alerta, color)", () => {
    for (const campo of CAMPOS_PROHIBIDOS) {
      const respuestaContaminada = {
        dictamenes: [
          {
            loc_id_global: "LOC_HGO_ACT_1_619360b0",
            titulo: "ALERTA",
            causa: "Lluvia intensa",
            [campo]: 3,
            recomendaciones: ["Rec 1", "Rec 2"],
            contexto: "Contexto"
          }
        ]
      };

      const res = validarRespuestaGroq(respuestaContaminada);
      assert.strictEqual(res.valido, false);
      assert.match(res.motivo, new RegExp(`campo prohibido '${campo}'`));
    }
  });

  it("g) validarRespuestaGroq rechaza si recomendaciones tiene menos de 2 elementos", () => {
    const res = validarRespuestaGroq({
      dictamenes: [
        {
          loc_id_global: "LOC_HGO_ACT_1_619360b0",
          titulo: "ALERTA",
          causa: "Causa",
          recomendaciones: ["Solo una recomendación"],
          contexto: "Contexto"
        }
      ]
    });
    assert.strictEqual(res.valido, false);
    assert.match(res.motivo, /entre 2 y 5 elementos/);
  });

  it("h) validarRespuestaGroq rechaza si recomendaciones tiene más de 5 elementos", () => {
    const res = validarRespuestaGroq({
      dictamenes: [
        {
          loc_id_global: "LOC_HGO_ACT_1_619360b0",
          titulo: "ALERTA",
          causa: "Causa",
          recomendaciones: ["R1", "R2", "R3", "R4", "R5", "R6"],
          contexto: "Contexto"
        }
      ]
    });
    assert.strictEqual(res.valido, false);
    assert.match(res.motivo, /entre 2 y 5 elementos/);
  });

  it("i) validarRespuestaGroq rechaza si el título excede 100 caracteres", () => {
    const res = validarRespuestaGroq({
      dictamenes: [
        {
          loc_id_global: "LOC_HGO_ACT_1_619360b0",
          titulo: "A".repeat(101),
          causa: "Causa",
          recomendaciones: ["R1", "R2"],
          contexto: "Contexto"
        }
      ]
    });
    assert.strictEqual(res.valido, false);
    assert.match(res.motivo, /excede 100 caracteres/);
  });
});