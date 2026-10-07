/**
 * @file tests/motor/pipeline/ingesta.test.js
 * @description Pruebas unitarias deterministas para el Paso 0 (Ingesta y Normalización).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ejecutarPaso0Ingesta } from "../../../src/motor/pipeline/ingesta.js";
import { compilarValidador } from "../../../src/utils/validator.js";

const schemaIngestaInline = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["loc_id_global", "timestamp_utc6", "hora_relativa", "modelos", "hashes_fuente"],
  properties: {
    loc_id_global: { type: "string" },
    timestamp_utc6: { type: "string", format: "date-time" },
    hora_relativa: { type: "integer", minimum: 0, maximum: 191 },
    modelos: {
      type: "object",
      required: ["ecmwf_aifs025", "ncep_nbm", "icon_seamless"],
      properties: {
        ecmwf_aifs025: { $ref: "#/$defs/MetVars" },
        ncep_nbm: { $ref: "#/$defs/MetVars" },
        icon_seamless: { $ref: "#/$defs/MetVars" }
      }
    },
    hashes_fuente: {
      type: "object",
      required: ["ecmwf", "gfs", "icon"],
      properties: {
        ecmwf: { type: "string", pattern: "^[a-f0-9]{64}$" },
        gfs: { type: "string", pattern: "^[a-f0-9]{64}$" },
        icon: { type: "string", pattern: "^[a-f0-9]{64}$" }
      }
    }
  },
  $defs: {
    MetVars: {
      type: "object",
      required: [
        "lluvia_mm",
        "temperatura_c",
        "viento_max_kmh",
        "rafaga_max_kmh",
        "humedad_relativa_pct",
        "visibilidad_m"
      ],
      properties: {
        lluvia_mm: { type: "number", minimum: 0 },
        temperatura_c: { type: "number" },
        viento_max_kmh: { type: "number", minimum: 0 },
        rafaga_max_kmh: { type: "number", minimum: 0 },
        humedad_relativa_pct: { type: "number", minimum: 0, maximum: 100 },
        visibilidad_m: { type: "number", minimum: 0 }
      }
    }
  }
};

function crearMockCelda(lat, lon, elev, valTemp = 20.0, valLluvia = 1.0, len = 192) {
  return {
    lat,
    lon,
    elevation: elev,
    precipitation: new Array(len).fill(valLluvia),
    temperature_2m: new Array(len).fill(valTemp),
    wind_speed_10m: new Array(len).fill(15.0),
    wind_gusts_10m: new Array(len).fill(25.0),
    relative_humidity_2m: new Array(len).fill(75.0),
    visibility: new Array(len).fill(10000.0)
  };
}

function crearPayloadsModelosMock(fnGenerarCeldas) {
  return {
    ecmwf_aifs025: {
      rawJson: JSON.stringify({ model: "ecmwf", version: "aifs025" }),
      obtener4Celdas: fnGenerarCeldas
    },
    ncep_nbm: {
      rawJson: JSON.stringify({ model: "ncep", version: "nbm" }),
      obtener4Celdas: fnGenerarCeldas
    },
    icon_seamless: {
      rawJson: JSON.stringify({ model: "icon", version: "seamless" }),
      obtener4Celdas: fnGenerarCeldas
    }
  };
}

describe("Paso 0: Ingesta y Normalización (ingesta.js)", () => {
  const coeficientesMock = {
    gradiente_termico_C_por_100m: {
      global: -0.65,
      por_zona: {
        ACT: -0.62,
        SPP: -0.70,
        ZONA_ANOMALA: 0.15
      }
    }
  };

  const localidadActopan = {
    loc_id_global: "LOC_HGO_ACT_1_619360b0",
    zona_id: "ACT",
    lat: 20.269,
    lon: -98.943,
    altitud_msnm: 2007
  };

  it("a) Procesa correctamente estructura, hashes e interpolación bilineal", () => {
    const fnCeldas = () => [
      crearMockCelda(20.0, -99.0, 2000, 10.0, 2.0),
      crearMockCelda(20.0, -98.0, 2000, 20.0, 2.0),
      crearMockCelda(21.0, -99.0, 2000, 30.0, 2.0),
      crearMockCelda(21.0, -98.0, 2000, 40.0, 2.0)
    ];

    const validador = compilarValidador(schemaIngestaInline);
    const resultado = ejecutarPaso0Ingesta({
      payloadsModelos: crearPayloadsModelosMock(fnCeldas),
      localidades: [localidadActopan],
      coeficientes: coeficientesMock,
      timestampBase: "2026-03-29T00:00:00.000Z",
      validadorSchema: validador
    });

    assert.strictEqual(resultado.length, 192);

    const reg0 = resultado[0];
    assert.strictEqual(reg0.loc_id_global, "LOC_HGO_ACT_1_619360b0");
    assert.strictEqual(reg0.hora_relativa, 0);
    assert.strictEqual(reg0.timestamp_utc6, "2026-03-28T18:00:00-06:00");

    assert.strictEqual(reg0.hashes_fuente.ecmwf.length, 64);
    assert.strictEqual(reg0.hashes_fuente.gfs.length, 64);
    assert.strictEqual(reg0.hashes_fuente.icon.length, 64);

    const ecmwfData = reg0.modelos.ecmwf_aifs025;
    assert.strictEqual(ecmwfData.lluvia_mm, 2.0);
    assert.strictEqual(typeof ecmwfData.temperatura_c, "number");
    assert.strictEqual(ecmwfData.viento_max_kmh, 15.0);
    assert.strictEqual(ecmwfData.rafaga_max_kmh, 25.0);
    assert.strictEqual(ecmwfData.humedad_relativa_pct, 75.0);
    assert.strictEqual(ecmwfData.visibilidad_m, 10000.0);
  });

  it("b) Aplica Lapse-Rate correctamente (altitud > z_malla, altitud < z_malla y fallback)", () => {
    const locAlta = {
      loc_id_global: "LOC_HGO_ALTA_1_a1b2c3d4",
      zona_id: "SPP",
      lat: 20.5,
      lon: -98.5,
      altitud_msnm: 2500
    };

    const fnCeldas2000m = () => [
      crearMockCelda(20.0, -99.0, 2000, 20.0),
      crearMockCelda(20.0, -98.0, 2000, 20.0),
      crearMockCelda(21.0, -99.0, 2000, 20.0),
      crearMockCelda(21.0, -98.0, 2000, 20.0)
    ];

    const resAlta = ejecutarPaso0Ingesta({
      payloadsModelos: crearPayloadsModelosMock(fnCeldas2000m),
      localidades: [locAlta],
      coeficientes: coeficientesMock,
      timestampBase: "2026-03-29T00:00:00.000Z"
    });
    assert.strictEqual(resAlta[0].modelos.ecmwf_aifs025.temperatura_c, 16.50);

    const locBaja = {
      loc_id_global: "LOC_HGO_BAJA_1_e5f6a7b8",
      zona_id: "SPP",
      lat: 20.5,
      lon: -98.5,
      altitud_msnm: 1500
    };

    const resBaja = ejecutarPaso0Ingesta({
      payloadsModelos: crearPayloadsModelosMock(fnCeldas2000m),
      localidades: [locBaja],
      coeficientes: coeficientesMock,
      timestampBase: "2026-03-29T00:00:00.000Z"
    });
    assert.strictEqual(resBaja[0].modelos.ecmwf_aifs025.temperatura_c, 23.50);

    const locAnomala = {
      loc_id_global: "LOC_HGO_ANOM_1_c9d0e1f2",
      zona_id: "ZONA_ANOMALA",
      lat: 20.5,
      lon: -98.5,
      altitud_msnm: 2500
    };

    const resAnomala = ejecutarPaso0Ingesta({
      payloadsModelos: crearPayloadsModelosMock(fnCeldas2000m),
      localidades: [locAnomala],
      coeficientes: coeficientesMock,
      timestampBase: "2026-03-29T00:00:00.000Z"
    });
    assert.strictEqual(resAnomala[0].modelos.ecmwf_aifs025.temperatura_c, 16.75);
  });

  it("c) Genera exactamente 192 horas (0..191) con marcas UTC-6 consecutivas", () => {
    const fnCeldas = () => [
      crearMockCelda(20.0, -99.0, 2000),
      crearMockCelda(20.0, -98.0, 2000),
      crearMockCelda(21.0, -99.0, 2000),
      crearMockCelda(21.0, -98.0, 2000)
    ];

    const resultado = ejecutarPaso0Ingesta({
      payloadsModelos: crearPayloadsModelosMock(fnCeldas),
      localidades: [localidadActopan],
      coeficientes: coeficientesMock,
      timestampBase: "2026-03-29T06:00:00.000Z"
    });

    assert.strictEqual(resultado.length, 192);
    assert.strictEqual(resultado[0].hora_relativa, 0);
    assert.strictEqual(resultado[0].timestamp_utc6, "2026-03-29T00:00:00-06:00");
    assert.strictEqual(resultado[191].hora_relativa, 191);
    assert.strictEqual(resultado[191].timestamp_utc6, "2026-04-05T23:00:00-06:00");
  });

  it("d) Determinismo estricto: misma entrada produce idéntica salida", () => {
    const fnCeldas = () => [
      crearMockCelda(20.0, -99.0, 2000, 15.2, 0.5),
      crearMockCelda(20.0, -98.0, 2000, 18.4, 1.2),
      crearMockCelda(21.0, -99.0, 2000, 22.1, 0.0),
      crearMockCelda(21.0, -98.0, 2000, 25.0, 3.4)
    ];

    const corrida1 = ejecutarPaso0Ingesta({
      payloadsModelos: crearPayloadsModelosMock(fnCeldas),
      localidades: [localidadActopan],
      coeficientes: coeficientesMock,
      timestampBase: "2026-03-29T00:00:00.000Z"
    });

    const corrida2 = ejecutarPaso0Ingesta({
      payloadsModelos: crearPayloadsModelosMock(fnCeldas),
      localidades: [localidadActopan],
      coeficientes: coeficientesMock,
      timestampBase: "2026-03-29T00:00:00.000Z"
    });

    assert.deepStrictEqual(corrida1, corrida2);
  });

  it("e) Guardarraíles de validación: falla ante datos corruptos o incompletos", () => {
    const fnCeldas = () => [
      crearMockCelda(20.0, -99.0, 2000),
      crearMockCelda(20.0, -98.0, 2000),
      crearMockCelda(21.0, -99.0, 2000),
      crearMockCelda(21.0, -98.0, 2000)
    ];

    assert.throws(
      () =>
        ejecutarPaso0Ingesta({
          payloadsModelos: crearPayloadsModelosMock(fnCeldas),
          localidades: [{ ...localidadActopan, altitud_msnm: NaN }],
          coeficientes: coeficientesMock,
          timestampBase: "2026-03-29T00:00:00.000Z"
        }),
      /altitud_msnm inválida/
    );

    assert.throws(
      () =>
        ejecutarPaso0Ingesta({
          payloadsModelos: {
            ecmwf_aifs025: { rawJson: "{}" },
            ncep_nbm: { rawJson: "{}", obtener4Celdas: fnCeldas },
            icon_seamless: { rawJson: "{}", obtener4Celdas: fnCeldas }
          },
          localidades: [localidadActopan],
          coeficientes: coeficientesMock,
          timestampBase: "2026-03-29T00:00:00.000Z"
        }),
      /no implementa la función 'obtener4Celdas'/
    );

    const fnCeldasCortas = () => [
      crearMockCelda(20.0, -99.0, 2000, 20.0, 1.0, 100),
      crearMockCelda(20.0, -98.0, 2000, 20.0, 1.0, 100),
      crearMockCelda(21.0, -99.0, 2000, 20.0, 1.0, 100),
      crearMockCelda(21.0, -98.0, 2000, 20.0, 1.0, 100)
    ];

    assert.throws(
      () =>
        ejecutarPaso0Ingesta({
          payloadsModelos: crearPayloadsModelosMock(fnCeldasCortas),
          localidades: [localidadActopan],
          coeficientes: coeficientesMock,
          timestampBase: "2026-03-29T00:00:00.000Z"
        }),
      /Serie horaria incompleta/
    );
  });
});