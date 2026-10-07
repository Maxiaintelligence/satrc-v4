/**
 * @file src/config/env.js
 * @description Validador y cargador inmutable de variables de entorno del sistema SatRC v4.0.
 */

const VARIABLES_REQUERIDAS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GROQ_API_KEY"
];

/**
 * Valida la existencia y formato de las variables de entorno requeridas.
 * @param {NodeJS.ProcessEnv} [fuenteEnv=process.env] - Objeto de variables a validar.
 * @returns {Readonly<{
 *   NODE_ENV: string,
 *   TZ: string,
 *   LOG_LEVEL: string,
 *   SUPABASE_URL: string,
 *   SUPABASE_ANON_KEY: string,
 *   SUPABASE_SERVICE_ROLE_KEY: string,
 *   GROQ_API_KEY: string,
 *   GROQ_BASE_URL: string,
 *   GROQ_MODEL: string,
 *   CRON_SECRET: string
 * }>}
 */
export function validarVariablesEntorno(fuenteEnv = process.env) {
  const faltantes = [];

  for (const variable of VARIABLES_REQUERIDAS) {
    const valor = fuenteEnv[variable];
    if (!valor || typeof valor !== "string" || valor.trim() === "") {
      faltantes.push(variable);
    }
  }

  if (faltantes.length > 0) {
    throw new Error(
      `Error de configuración: Faltan las variables obligatorias: ${faltantes.join(", ")}.\n` +
      "Cree su archivo .env.local a partir de .env.example"
    );
  }

  const configuracion = {
    NODE_ENV: fuenteEnv.NODE_ENV || "development",
    TZ: fuenteEnv.TZ || "America/Mexico_City",
    LOG_LEVEL: fuenteEnv.LOG_LEVEL || "info",
    SUPABASE_URL: fuenteEnv.SUPABASE_URL.trim(),
    SUPABASE_ANON_KEY: fuenteEnv.SUPABASE_ANON_KEY ? fuenteEnv.SUPABASE_ANON_KEY.trim() : "",
    SUPABASE_SERVICE_ROLE_KEY: fuenteEnv.SUPABASE_SERVICE_ROLE_KEY.trim(),
    GROQ_API_KEY: fuenteEnv.GROQ_API_KEY.trim(),
    GROQ_BASE_URL: fuenteEnv.GROQ_BASE_URL ? fuenteEnv.GROQ_BASE_URL.trim() : "https://api.groq.com/openai/v1",
    GROQ_MODEL: fuenteEnv.GROQ_MODEL ? fuenteEnv.GROQ_MODEL.trim() : "llama-3.3-70b-versatile",
    CRON_SECRET: fuenteEnv.CRON_SECRET ? fuenteEnv.CRON_SECRET.trim() : ""
  };

  return Object.freeze(configuracion);
}

// Exportación singleton de las variables de entorno de la instancia en ejecución
export const env = (() => {
  if (process.env.NODE_ENV === "test" && !process.env.SUPABASE_URL) {
    return Object.freeze({
      NODE_ENV: "test",
      TZ: "America/Mexico_City",
      LOG_LEVEL: "silent",
      SUPABASE_URL: "https://mock.supabase.co",
      SUPABASE_ANON_KEY: "mock-anon",
      SUPABASE_SERVICE_ROLE_KEY: "mock-service-role",
      GROQ_API_KEY: "mock-groq-key",
      GROQ_BASE_URL: "https://api.groq.com/openai/v1",
      GROQ_MODEL: "llama-3.3-70b-versatile",
      CRON_SECRET: "mock-cron-secret"
    });
  }

  return validarVariablesEntorno(process.env);
})();

export default env;