/**
 * @file tests/supabase/queries.test.js
 * @description Pruebas unitarias para las operaciones de base de datos con cliente Supabase mockeado.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  leerLocalidades,
  leerHistorial168h,
  escribirBitacora,
  mapearEvaluacionABitacora,
  escribirEvaluaciones,
  actualizarDictamenesEnEvaluaciones,
  actualizarCondicionesActuales,
  leerUltimoTimestampHistorico
} from "../../src/supabase/queries.js";

/**
 * Crea un fake builder encadenable de PostgREST para Supabase.
 */
function crearFakeClient(configuraciones = {}) {
  const llamadas = [];

  const crearBuilder = (tabla) => {
    const estado = {
      tabla,
      operacion: "select",
      payload: null,
      filtros: {},
      opciones: {}
    };

    const builder = {
      select(campos) {
        estado.campos = campos;
        return builder;
      },
      order(campo, opts) {
        estado.orden = { campo, opts };
        return builder;
      },
      limit(n) {
        estado.limite = n;
        return builder;
      },
      eq(campo, valor) {
        estado.filtros[campo] = valor;
        return builder;
      },
      single() {
        estado.single = true;
        return builder;
      },
      insert(filas) {
        estado.operacion = "insert";
        estado.payload = filas;
        return builder;
      },
      upsert(filas, opts) {
        estado.operacion = "upsert";
        estado.payload = filas;
        estado.opciones = opts;
        return builder;
      },
      update(cambios) {
        estado.operacion = "update";
        estado.payload = cambios;
        return builder;
      },
      then(resolve) {
        llamadas.push(estado);
        const respuesta = configuraciones[tabla]
          ? (typeof configuraciones[tabla] === "function" ? configuraciones[tabla](estado) : configuraciones[tabla])
          : { data: [], error: null };
        return resolve(respuesta);
      }
    };

    return builder;
  };

  return {
    from: (tabla) => crearBuilder(tabla),
    _llamadas: llamadas
  };
}

describe("Queries Supabase (queries.js)", () => {
  const corridaIdMock = "c4b1a8d0-8f9a-4c8d-b3e1-2f7a9d0c3e5a";
  const timestampMock = "2026-03-29T18:00:00-06:00";

  const evaluacionMock = {
    loc_id_global: "LOC_HGO_ACT_1_619360b0",
    zona_id: "ACT",
    nivel_alerta: 3,
    color_alerta: "NARANJA",
    vector_dominante: "DESLAVE",
    vectores: {
      deslave: 3,
      inundacion: 1,
      viento: 2,
      temperatura: 1,
      niebla: 1,
      aislamiento_vial: 1
    },
    metricas_clave: {
      lluvia_acumulada_24h_mm: 45.0,
      lluvia_horaria_max_mm: 18.0,
      hora_pico: "2026-03-29T18:00:00-06:00",
      temperatura_min_c: 12.0,
      temperatura_max_c: 22.0,
      viento_max_kmh: 20.0,
      rafaga_max_kmh: 35.0,
      visibilidad_min_m: 8000.0,
      api_7dias_mm: 25.0,
      saturacion_total_mm: 70.0,
      umbral_deslave_mm: 35.0,
      spread_max_mm: 3.5
    }
  };

  it("a) leerLocalidades retorna arreglo con localidades del catálogo", async () => {
    const fakeData = [{ id: 1, loc_id_global: "LOC_1" }, { id: 2, loc_id_global: "LOC_2" }];
    const client = crearFakeClient({ localidades_base: { data: fakeData, error: null } });

    const resultado = await leerLocalidades(client);
    assert.strictEqual(resultado.length, 2);
    assert.strictEqual(resultado[0].loc_id_global, "LOC_1");
  });

  it("b) leerLocalidades lanza error si PostgREST retorna error", async () => {
    const client = crearFakeClient({
      localidades_base: { data: null, error: { message: "Error de lectura de tabla" } }
    });

    await assert.rejects(() => leerLocalidades(client), /Error de lectura de tabla/);
  });

  it("c) leerHistorial168h retorna array de hasta 168 registros ordenados cronológicamente", async () => {
    const fakeHistorial = [
      { timestamp_utc6: "2026-03-29T17:00:00-06:00", lluvia_consenso_mm: 2.5 },
      { timestamp_utc6: "2026-03-29T16:00:00-06:00", lluvia_consenso_mm: 1.0 }
    ];
    const client = crearFakeClient({ condiciones_historico: { data: fakeHistorial, error: null } });

    const hist = await leerHistorial168h(client, "LOC_HGO_ACT_1_619360b0");
    assert.strictEqual(hist.length, 2);
    assert.strictEqual(hist[0].lluvia_consenso_mm, 2.5);
    assert.strictEqual(client._llamadas[0].filtros.loc_id_global, "LOC_HGO_ACT_1_619360b0");
  });

  it("d) escribirBitacora inserta evento correctamente y retorna { ok: true, id: N }", async () => {
    const client = crearFakeClient({ bitacora: { data: { id: 42 }, error: null } });

    const res = await escribirBitacora(client, {
      categoria: "SISTEMA",
      tipo_evento: "PIPELINE_EJECUTADO",
      severidad: "info",
      mensaje: "Ejecución correcta"
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.id, 42);
    assert.strictEqual(client._llamadas[0].operacion, "insert");
  });

  it("e) mapearEvaluacionABitacora retorna los 28 campos exactos sin mutaciones", () => {
    const fila = mapearEvaluacionABitacora(evaluacionMock, corridaIdMock, timestampMock, { ecmwf: "hash123" });

    assert.strictEqual(fila.corrida_id, corridaIdMock);
    assert.strictEqual(fila.timestamp_utc6, timestampMock);
    assert.strictEqual(fila.loc_id_global, "LOC_HGO_ACT_1_619360b0");
    assert.strictEqual(fila.nivel_alerta, 3);
    assert.strictEqual(fila.color_alerta, "NARANJA");
    assert.strictEqual(fila.vector_dominante, "DESLAVE");
    assert.strictEqual(fila.nivel_deslave, 3);
    assert.strictEqual(fila.nivel_inundacion, 1);
    assert.strictEqual(fila.lluvia_acumulada_24h_mm, 45.0);
    assert.strictEqual(fila.saturacion_total_mm, 70.0);
    assert.strictEqual(fila.hashes_fuente.ecmwf, "hash123");
    assert.strictEqual(fila.dictamen_narrativo, null);
    assert.strictEqual(Object.keys(fila).length, 28);
  });

  it("f) mapearEvaluacionABitacora con evaluación incompleta lanza error descriptivo", () => {
    assert.throws(
      () => mapearEvaluacionABitacora({}, corridaIdMock, timestampMock),
      /Objeto de evaluación incompleto/
    );
  });

  it("g) escribirEvaluaciones realiza UPSERT masivo con onConflict corrida_id,loc_id_global", async () => {
    const client = crearFakeClient({
      bitacora_pronosticos: { data: [{ id: 101 }, { id: 102 }], error: null }
    });

    const res = await escribirEvaluaciones(client, [evaluacionMock, evaluacionMock], corridaIdMock, timestampMock);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.filas, 2);
    assert.strictEqual(client._llamadas[0].operacion, "upsert");
    assert.strictEqual(client._llamadas[0].opciones.onConflict, "corrida_id,loc_id_global");
  });

  it("h) escribirEvaluaciones con arreglo vacío retorna { ok: true, filas: 0 } sin invocar cliente", async () => {
    const client = crearFakeClient();
    const res = await escribirEvaluaciones(client, [], corridaIdMock, timestampMock);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.filas, 0);
    assert.strictEqual(client._llamadas.length, 0);
  });

  it("i) actualizarDictamenesEnEvaluaciones ejecuta updates específicos por localidad", async () => {
    const client = crearFakeClient({ bitacora_pronosticos: { data: null, error: null } });
    const dictamenes = {
      "LOC_HGO_ACT_1_619360b0": { titulo: "ALERTA", causa: "Causa" }
    };

    const res = await actualizarDictamenesEnEvaluaciones(client, corridaIdMock, dictamenes);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.actualizadas, 1);
    assert.strictEqual(client._llamadas[0].operacion, "update");
    assert.strictEqual(client._llamadas[0].filtros.corrida_id, corridaIdMock);
    assert.strictEqual(client._llamadas[0].filtros.loc_id_global, "LOC_HGO_ACT_1_619360b0");
  });

  it("j) actualizarCondicionesActuales hace UPSERT sobre tabla viva con PK loc_id_global", async () => {
    const client = crearFakeClient({
      condiciones_actuales: { data: [{ loc_id_global: "LOC_HGO_ACT_1_619360b0" }], error: null }
    });

    const res = await actualizarCondicionesActuales(client, [evaluacionMock], corridaIdMock, timestampMock);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.filas, 1);
    assert.strictEqual(client._llamadas[0].operacion, "upsert");
    assert.strictEqual(client._llamadas[0].opciones.onConflict, "loc_id_global");
  });

  it("k) leerUltimoTimestampHistorico retorna la marca de tiempo más reciente de la tabla", async () => {
    const client = crearFakeClient({
      condiciones_historico: { data: [{ timestamp_utc6: "2026-03-29T18:00:00-06:00" }], error: null }
    });

    const ts = await leerUltimoTimestampHistorico(client);
    assert.strictEqual(ts, "2026-03-29T18:00:00-06:00");
  });

  it("l) leerUltimoTimestampHistorico retorna null si la tabla está vacía", async () => {
    const client = crearFakeClient({
      condiciones_historico: { data: [], error: null }
    });

    const ts = await leerUltimoTimestampHistorico(client);
    assert.strictEqual(ts, null);
  });

  it("m) Determinismo: mapearEvaluacionABitacora produce idéntico resultado con la misma entrada", () => {
    const f1 = mapearEvaluacionABitacora(evaluacionMock, corridaIdMock, timestampMock);
    const f2 = mapearEvaluacionABitacora(evaluacionMock, corridaIdMock, timestampMock);

    assert.deepStrictEqual(f1, f2);
  });
});