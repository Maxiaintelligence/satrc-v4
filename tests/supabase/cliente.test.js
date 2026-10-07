/**
 * @file tests/supabase/cliente.test.js
 * @description Pruebas unitarias para la fábrica del cliente Supabase y verificación de conectividad.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { crearClienteSupabase, verificarConexion } from "../../src/supabase/cliente.js";

describe("Cliente Supabase (cliente.js)", () => {
  const dummyUrl = "https://satrc-test.supabase.co";
  const dummyKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_service_role_key";
  const noopFetch = async () => new Response(JSON.stringify([]), { status: 200 });

  it("a) crearClienteSupabase retorna un cliente Supabase con el método .from definido", () => {
    const client = crearClienteSupabase({
      url: dummyUrl,
      serviceRoleKey: dummyKey,
      fetchFn: noopFetch
    });

    assert.strictEqual(typeof client.from, "function");
    assert.strictEqual(typeof client.auth, "object");
  });

  it("b) Lanza error si la URL no comienza con https://", () => {
    assert.throws(
      () =>
        crearClienteSupabase({
          url: "http://inseguro.supabase.co",
          serviceRoleKey: dummyKey,
          fetchFn: noopFetch
        }),
      /inicie con 'https:\/\/'/
    );
  });

  it("c) Lanza error si serviceRoleKey está vacío", () => {
    assert.throws(
      () =>
        crearClienteSupabase({
          url: dummyUrl,
          serviceRoleKey: "   ",
          fetchFn: noopFetch
        }),
      /'serviceRoleKey' como cadena no vacía/
    );
  });

  it("d) Lanza error si fetchFn no es una función", () => {
    assert.throws(
      () =>
        crearClienteSupabase({
          url: dummyUrl,
          serviceRoleKey: dummyKey,
          fetchFn: null
        }),
      /función 'fetchFn'/
    );
  });

  it("e) verificarConexion retorna { ok: true } cuando la consulta responde con éxito", async () => {
    const mockClientOk = {
      from: () => ({
        select: () => ({
          limit: async () => ({ data: [{ loc_id_global: "LOC_1" }], error: null })
        })
      })
    };

    const res = await verificarConexion(mockClientOk);
    assert.strictEqual(res.ok, true);
    assert.match(res.mensaje, /exitosa/i);
  });

  it("f) verificarConexion retorna { ok: false } cuando PostgREST retorna error sin lanzar excepción", async () => {
    const mockClientError = {
      from: () => ({
        select: () => ({
          limit: async () => ({ data: null, error: { message: "Conexión rechazada por RLS" } })
        })
      })
    };

    const res = await verificarConexion(mockClientError);
    assert.strictEqual(res.ok, false);
    assert.match(res.mensaje, /Conexión rechazada por RLS/);
  });

  it("g) NO realiza fetch real: verifica que el fetch inyectado es invocado en llamadas", async () => {
    let fetchLlamado = false;
    const trackingFetch = async (url) => {
      fetchLlamado = true;
      assert(url.includes("satrc-test.supabase.co"));
      return new Response(JSON.stringify([{ loc_id_global: "LOC_TEST" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    };

    const client = crearClienteSupabase({
      url: dummyUrl,
      serviceRoleKey: dummyKey,
      fetchFn: trackingFetch
    });

    const res = await client.from("localidades_base").select("loc_id_global").limit(1);
    assert.strictEqual(fetchLlamado, true);
    assert.strictEqual(res.data.length, 1);
  });
});