/**
 * @file tests/motor/pipeline/pipeline-completo.test.js
 * @description Pruebas de integración E2E del pipeline completo de cálculo determinista (Pasos 0 a 3).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ejecutarPipeline, obtenerVentanaPronostico } from "../../../src/motor/pipeline/index.js";
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

function crearMockCelda(lat, lon, elev, valTemp = 18.0, valLluvia = 0.1, valViento = 15.0, valRafaga = 20.0) {
  const len = 192;
  return {
    lat,
    lon,
    elevation: elev,
    precipitation: new Array(len).fill(valLluvia),
    temperature_2m: new Array(len).fill(valTemp),
    wind_speed_10m: new Array(len).fill(valViento),
    wind_gusts_10m: new Array(len).fill(valRafaga),
    relative_humidity_2m: new Array(len).fill(70.0),
    visibility: new Array(len).fill(10000.0)
  };
}

function crearHistorial168hMock(lluviaHora = 0.0) {
  const hist = [];
  for (let h = 0; h < 168; h++) {
    hist.push({
      timestamp_utc6: "2026-03-22T00:00:00-06:00",
      lluvia_consenso_mm: lluviaHora
    });
  }
  return hist;
}

describe("E2E: Pipeline Completo del Motor (index.js)", () => {
  const validador = compilarValidador(schemaEvaluacionInline);
  const timestampBase = "2026-03-29T06:00:00.000Z";

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
    lat: 20.269,
    lon: -98.943,
    poblacion: 32276,
    poblacion_aguas_arriba: 134957
  };

  const locLaderaSerrana = {
    loc_id_global: "LOC_PUE_HUA_1_a1b2c3d4",
    zona_id: "HUA",
    altitud_msnm: 1740,
    relieve_tipo: "LADERA",
    pendiente_max_deg: 40.0,
    dist_cauce_km: 12.4,
    twi: 13.3,
    acceso_vial: "CAMINO_TERRACERIA",
    dist_hospital_km: 26.0,
    lat: 20.174,
    lon: -98.051,
    poblacion: 1748,
    poblacion_aguas_arriba: 152774
  };

  const locRiberaInundable = {
    loc_id_global: "LOC_HGO_SPP_1_e5f6a7b8",
    zona_id: "SPP",
    altitud_msnm: 1200,
    relieve_tipo: "VALLE",
    pendiente_max_deg: 5.0,
    dist_cauce_km: 0.4,
    twi: 13.5,
    acceso_vial: "CARRETERA_ESTATAL",
    dist_hospital_km: 10.0,
    lat: 20.399,
    lon: -98.202,
    poblacion: 2764,
    poblacion_aguas_arriba: 33394
  };

  const localidadesFixture = [locAltiplano, locLaderaSerrana, locRiberaInundable];

  const coeficientesFixture = {
    gradiente_termico_C_por_100m: {
      global: -0.65,
      por_zona: {
        ACT: -0.62,
        HUA: -0.70,
        SPP: -0.68
      }
    }
  };

  const factoresExposicionFixture = {
    "LOC_HGO_ACT_1_619360b0": 1.00,
    "LOC_PUE_HUA_1_a1b2c3d4": 1.15,
    "LOC_HGO_SPP_1_e5f6a7b8": 1.05
  };

  const payloadsModelosFixture = {
    ecmwf_aifs025: {
      rawJson: JSON.stringify({ model: "ecmwf", version: "aifs025" }),
      obtener4Celdas: (_lat, _lon) => [
        crearMockCelda(20.0, -99.0, 1500, 18.0, 1.5, 15.0, 20.0),
        crearMockCelda(20.0, -98.0, 1500, 18.0, 1.5, 15.0, 20.0),
        crearMockCelda(21.0, -99.0, 1500, 18.0, 1.5, 15.0, 20.0),
        crearMockCelda(21.0, -98.0, 1500, 18.0, 1.5, 15.0, 20.0)
      ]
    },
    ncep_nbm: {
      rawJson: JSON.stringify({ model: "ncep", version: "nbm" }),
      obtener4Celdas: (_lat, _lon) => [
        crearMockCelda(20.0, -99.0, 1500, 19.0, 1.5, 16.0, 22.0),
        crearMockCelda(20.0, -98.0, 1500, 19.0, 1.5, 16.0, 22.0),
        crearMockCelda(21.0, -99.0, 1500, 19.0, 1.5, 16.0, 22.0),
        crearMockCelda(21.0, -98.0, 1500, 19.0, 1.5, 16.0, 22.0)
      ]
    },
    icon_seamless: {
      rawJson: JSON.stringify({ model: "icon", version: "seamless" }),
      obtener4Celdas: (_lat, _lon) => [
        crearMockCelda(20.0, -99.0, 1500, 17.5, 1.5, 14.0, 21.0),
        crearMockCelda(20.0, -98.0, 1500, 17.5, 1.5, 14.0, 21.0),
        crearMockCelda(21.0, -99.0, 1500, 17.5, 1.5, 14.0, 21.0),
        crearMockCelda(21.0, -98.0, 1500, 17.5, 1.5, 14.0, 21.0)
      ]
    }
  };

  const historialFixture = {
    "LOC_HGO_ACT_1_619360b0": crearHistorial168hMock(0.1),
    "LOC_PUE_HUA_1_a1b2c3d4": crearHistorial168hMock(1.0),
    "LOC_HGO_SPP_1_e5f6a7b8": crearHistorial168hMock(0.2)
  };

  const observadosSateliteFixture = {
    "LOC_HGO_ACT_1_619360b0": null,
    "LOC_PUE_HUA_1_a1b2c3d4": 30.0,
    "LOC_HGO_SPP_1_e5f6a7b8": null
  };

  it("a) Ejecuta el pipeline completo sin errores y retorna exactamente 3 evaluaciones estructuradas", () => {
    const evaluaciones = ejecutarPipeline({
      payloadsModelos: payloadsModelosFixture,
      localidades: localidadesFixture,
      coeficientes: coeficientesFixture,
      factoresExposicion: factoresExposicionFixture,
      historialPorLocalidad: historialFixture,
      observadosSatelite: observadosSateliteFixture,
      timestampBase
    });

    assert.strictEqual(evaluaciones.length, 3);
    assert.strictEqual(evaluaciones[0].loc_id_global, "LOC_HGO_ACT_1_619360b0");
    assert.strictEqual(evaluaciones[1].loc_id_global, "LOC_PUE_HUA_1_a1b2c3d4");
    assert.strictEqual(evaluaciones[2].loc_id_global, "LOC_HGO_SPP_1_e5f6a7b8");
  });

  it("b) Cada evaluación generada cumple estrictamente el JSON Schema evaluacion_localidad", () => {
    const evaluaciones = ejecutarPipeline({
      payloadsModelos: payloadsModelosFixture,
      localidades: localidadesFixture,
      coeficientes: coeficientesFixture,
      factoresExposicion: factoresExposicionFixture,
      historialPorLocalidad: historialFixture,
      observadosSatelite: observadosSateliteFixture,
      timestampBase,
      validadores: { validadorEvaluacion: validador }
    });

    for (const ev of evaluaciones) {
      const resVal = validador(ev);
      assert.strictEqual(resVal.valido, true, JSON.stringify(resVal.errores));
    }
  });

  it("c) Determinismo estricto: misma entrada produce idéntico resultado byte a byte", () => {
    const params = {
      payloadsModelos: payloadsModelosFixture,
      localidades: localidadesFixture,
      coeficientes: coeficientesFixture,
      factoresExposicion: factoresExposicionFixture,
      historialPorLocalidad: historialFixture,
      observadosSatelite: observadosSateliteFixture,
      timestampBase
    };

    const corrida1 = ejecutarPipeline(params);
    const corrida2 = ejecutarPipeline(params);

    assert.deepStrictEqual(corrida1, corrida2);
  });

  it("d) obtenerVentanaPronostico retorna exactamente 24 registros de horas 168 a 191", () => {
    const consensoMock = [];
    for (let h = 0; h < 192; h++) {
      consensoMock.push({
        loc_id_global: "LOC_HGO_ACT_1_619360b0",
        hora_relativa: h,
        lluvia_consenso_mm: 1.0
      });
    }

    const ventana = obtenerVentanaPronostico(consensoMock, "LOC_HGO_ACT_1_619360b0");
    assert.strictEqual(ventana.length, 24);
    assert.strictEqual(ventana[0].hora_relativa, 168);
    assert.strictEqual(ventana[23].hora_relativa, 191);
  });

  it("e) Lanza error descriptivo si falta el factor de exposición de alguna localidad", () => {
    const factoresIncompletos = {
      "LOC_HGO_ACT_1_619360b0": 1.00
    };

    assert.throws(
      () =>
        ejecutarPipeline({
          payloadsModelos: payloadsModelosFixture,
          localidades: localidadesFixture,
          coeficientes: coeficientesFixture,
          factoresExposicion: factoresIncompletos,
          historialPorLocalidad: historialFixture,
          timestampBase
        }),
      /Falta factor de exposición para la localidad 'LOC_PUE_HUA_1_a1b2c3d4'/
    );
  });

  it("f) Acepta historial vacío aplicando el piso precautorio de 15.0 mm en Paso 2", () => {
    const historialVacio = {
      "LOC_HGO_ACT_1_619360b0": [],
      "LOC_PUE_HUA_1_a1b2c3d4": [],
      "LOC_HGO_SPP_1_e5f6a7b8": []
    };

    const evaluaciones = ejecutarPipeline({
      payloadsModelos: payloadsModelosFixture,
      localidades: localidadesFixture,
      coeficientes: coeficientesFixture,
      factoresExposicion: factoresExposicionFixture,
      historialPorLocalidad: historialVacio,
      timestampBase
    });

    assert.strictEqual(evaluaciones[0].metricas_clave.api_7dias_mm, 15.0);
    assert.strictEqual(evaluaciones[1].metricas_clave.api_7dias_mm, 15.0);
    assert.strictEqual(evaluaciones[2].metricas_clave.api_7dias_mm, 15.0);
  });

  it("g) Performance Sanity: el pipeline con 3 localidades corre en menos de 2000 ms", () => {
    const tInicio = performance.now();

    ejecutarPipeline({
      payloadsModelos: payloadsModelosFixture,
      localidades: localidadesFixture,
      coeficientes: coeficientesFixture,
      factoresExposicion: factoresExposicionFixture,
      historialPorLocalidad: historialFixture,
      timestampBase
    });

    const tDuracion = performance.now() - tInicio;
    assert.strictEqual(tDuracion < 2000, true, `La ejecución tomó ${tDuracion} ms (límite: 2000 ms).`);
  });

  it("i) Si una localidad falla en Paso 3, detiene el pipeline con error descriptivo", () => {
    const localidadesCorruptas = [
      locAltiplano,
      { ...locLaderaSerrana, twi: undefined }
    ];

    assert.throws(
      () =>
        ejecutarPipeline({
          payloadsModelos: payloadsModelosFixture,
          localidades: localidadesCorruptas,
          coeficientes: coeficientesFixture,
          factoresExposicion: factoresExposicionFixture,
          historialPorLocalidad: historialFixture,
          timestampBase
        }),
      /ejecutarPipeline \[Paso 3 Evaluación\] en LOC_PUE_HUA_1_a1b2c3d4/
    );
  });
});