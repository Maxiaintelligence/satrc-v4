/**
 * @file src/supabase/cliente.js
 * @description Fábrica de cliente Supabase con inyección de dependencias y función de verificación de conectividad.
 */

import { createClient } from "@supabase/supabase-js";

/**
 * Instancia un cliente Supabase oficial configurado para backend/pipeline serverless.
 * @param {Object} params - Parámetros de configuración.
 * @param {string} params.url - URL del proyecto Supabase (debe iniciar con https://).
 * @param {string} params.serviceRoleKey - Clave JWT service_role para bypass administrativo de RLS.
 * @param {typeof fetch} params.fetchFn - Función fetch inyectable para aislamiento de red.
 * @param {Object} [params.logger] - Logger estructurado opcional.
 * @returns {import('@supabase/supabase-js').SupabaseClient} Instancia del cliente.
 */
export function crearClienteSupabase({ url, serviceRoleKey, fetchFn, logger }) {
  if (!url || typeof url !== "string" || !url.startsWith("https://")) {
    throw new Error("crearClienteSupabase: Se requiere 'url' válida que inicie con 'https://'.");
  }
  if (!serviceRoleKey || typeof serviceRoleKey !== "string" || serviceRoleKey.trim() === "") {
    throw new Error("crearClienteSupabase: Se requiere 'serviceRoleKey' como cadena no vacía.");
  }
  if (typeof fetchFn !== "function") {
    throw new Error("crearClienteSupabase: Se requiere una función 'fetchFn' compatible con fetch.");
  }

  if (logger && typeof logger.debug === "function") {
    logger.debug({
      evento: "SUPABASE_CLIENTE_CREADO",
      url: url.trim()
    });
  }

  return createClient(url.trim(), serviceRoleKey.trim(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      fetch: fetchFn
    }
  });
}

/**
 * Verifica la conectividad básica con la base de datos Supabase ejecutando una consulta trivial.
 * @param {import('@supabase/supabase-js').SupabaseClient} client - Cliente Supabase instanciado.
 * @returns {Promise<{ ok: boolean, mensaje: string }>} Estado de la conexión sin lanzar excepciones.
 */
export async function verificarConexion(client) {
  if (!client || typeof client.from !== "function") {
    return { ok: false, mensaje: "Cliente Supabase inválido o no instanciado." };
  }

  try {
    const { error } = await client.from("localidades_base").select("loc_id_global").limit(1);
    if (error) {
      return { ok: false, mensaje: `Error PostgREST: ${error.message}` };
    }
    return { ok: true, mensaje: "Conexión exitosa con Supabase." };
  } catch (err) {
    return { ok: false, mensaje: `Excepción de red al conectar con Supabase: ${err.message}` };
  }
}