/**
 * @file src/groq/cliente.js
 * @description Cliente HTTP determinista y resiliente para la API de Groq con tipado de errores,
 * reintentos exponenciales/backoff y salvaguardas de inmutabilidad de niveles de alerta.
 */

import {
  GROQ_TIMEOUT_MS,
  GROQ_BACKOFF_429_MS,
  GROQ_MAX_REINTENTOS
} from "../config/constantes.js";
import { CAMPOS_PROHIBIDOS, validarRespuestaGroq } from "./prompts.js";

export class ErrorGroqTimeout extends Error {
  constructor(mensaje = "Timeout al conectar con la API de Groq.") {
    super(mensaje);
    this.name = "ErrorGroqTimeout";
    this.tipo = "timeout";
    this.reintentable = true;
  }
}

export class ErrorGroqRed extends Error {
  constructor(mensaje = "Fallo de red o transporte al comunicar con Groq.") {
    super(mensaje);
    this.name = "ErrorGroqRed";
    this.tipo = "network";
    this.reintentable = true;
  }
}

export class ErrorGroqHttp4xx extends Error {
  constructor(status, mensaje = `Error de cliente HTTP ${status} desde Groq.`) {
    super(mensaje);
    this.name = "ErrorGroqHttp4xx";
    this.status = status;
    this.tipo = "http_4xx";
    this.reintentable = false;
  }
}

export class ErrorGroqHttp5xx extends Error {
  constructor(status, mensaje = `Error del servidor Groq (HTTP ${status}).`) {
    super(mensaje);
    this.name = "ErrorGroqHttp5xx";
    this.status = status;
    this.tipo = "http_5xx";
    this.reintentable = true;
  }
}

export class ErrorGroqRateLimit extends Error {
  constructor(mensaje = "Límite de tasa (HTTP 429) excedido en API de Groq.") {
    super(mensaje);
    this.name = "ErrorGroqRateLimit";
    this.tipo = "rate_limit";
    this.reintentable = true;
  }
}

export class ErrorGroqJsonInvalido extends Error {
  constructor(mensaje = "El cuerpo de respuesta de Groq no es un JSON válido.") {
    super(mensaje);
    this.name = "ErrorGroqJsonInvalido";
    this.tipo = "ParseError";
    this.reintentable = false;
  }
}

export class ErrorGroqSchemaInvalido extends Error {
  constructor(mensaje = "El JSON de Groq no cumple con el schema dictamen_narrativo.") {
    super(mensaje);
    this.name = "ErrorGroqSchemaInvalido";
    this.tipo = "SchemaInvalido";
    this.reintentable = false;
  }
}

export class ErrorGroqNivelProhibido extends Error {
  constructor(mensaje = "Groq incluyó campos de nivel o color prohibidos en el dictamen.") {
    super(mensaje);
    this.name = "ErrorGroqNivelProhibido";
    this.tipo = "ValidacionFallida";
    this.reintentable = false;
  }
}

const sleepNativo = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Invoca el endpoint de Chat Completions de Groq para generar la narrativa técnica de alertas.
 * Función pura con inyección de dependencias (fetchFn, sleepFn, validadores).
 *
 * @param {Object} params - Parámetros de ejecución.
 * @param {string} params.systemPrompt - Prompt de sistema inmutable.
 * @param {Object} params.userPrompt - Objeto serializable generado por construirUserPromptBatchZonal.
 * @param {string} params.apiKey - Clave de autenticación Groq.
 * @param {string} params.baseUrl - URL base de la API de Groq.
 * @param {string} params.model - Nombre del modelo.
 * @param {typeof fetch} params.fetchFn - Función fetch inyectable.
 * @param {number} [params.timeoutMs=GROQ_TIMEOUT_MS] - Timeout por intento en ms.
 * @param {number} [params.maxRetries=GROQ_MAX_REINTENTOS] - Límite de reintentos totales.
 * @param {number} [params.backoff429Ms=GROQ_BACKOFF_429_MS] - Tiempo de espera ante error HTTP 429.
 * @param {function(number): Promise<void>} [params.sleepFn=sleepNativo] - Función de sleep inyectable.
 * @param {Object} [params.logger] - Logger estructurado.
 * @param {function(unknown): {valido: boolean, errores: Array<{ruta: string, mensaje: string}>}} [params.validadorSchema] - Validador Ajv.
 * @returns {Promise<{ exito: boolean, dictamenes: Array<Object>, intentos: number }>} Dictámenes narrativos parseados.
 */
export async function llamarGroq({
  systemPrompt,
  userPrompt,
  apiKey,
  baseUrl,
  model,
  fetchFn,
  timeoutMs = GROQ_TIMEOUT_MS,
  maxRetries = GROQ_MAX_REINTENTOS,
  backoff429Ms = GROQ_BACKOFF_429_MS,
  sleepFn = sleepNativo,
  logger,
  validadorSchema
}) {
  if (!systemPrompt || typeof systemPrompt !== "string") {
    throw new Error("llamarGroq: Se requiere systemPrompt como cadena no vacía.");
  }
  if (!userPrompt || typeof userPrompt !== "object") {
    throw new Error("llamarGroq: Se requiere userPrompt como objeto serializable.");
  }
  if (!apiKey || typeof apiKey !== "string") {
    throw new Error("llamarGroq: Se requiere apiKey de Groq.");
  }
  if (!baseUrl || typeof baseUrl !== "string") {
    throw new Error("llamarGroq: Se requiere baseUrl de Groq.");
  }
  if (!model || typeof model !== "string") {
    throw new Error("llamarGroq: Se requiere model de Groq.");
  }
  if (typeof fetchFn !== "function") {
    throw new Error("llamarGroq: Se requiere una función fetchFn compatible con fetch().");
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const bodyPayload = JSON.stringify({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(userPrompt) }
    ],
    temperature: 0.1,
    max_tokens: 450,
    response_format: { type: "json_object" }
  });

  let intento = 0;
  let ultimoError = null;

  while (intento < maxRetries) {
    intento++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (logger && typeof logger.debug === "function") {
      logger.debug({
        evento: "GROQ_INTENTO_INICIADO",
        intento,
        maxRetries,
        zona_id: userPrompt.zona_id || "GLOBAL"
      });
    }

    try {
      let respuesta;
      try {
        respuesta = await fetchFn(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: bodyPayload,
          signal: controller.signal
        });
      } catch (errFetch) {
        if (errFetch.name === "AbortError" || controller.signal.aborted) {
          throw new ErrorGroqTimeout(`Timeout (${timeoutMs} ms) excedido en llamada a Groq (intento ${intento}).`);
        }
        throw new ErrorGroqRed(`Fallo de conexión de red al conectar con Groq: ${errFetch.message}`);
      } finally {
        clearTimeout(timeoutId);
      }

      if (respuesta.status === 200) {
        const ct = respuesta.headers?.get ? (respuesta.headers.get("content-type") || "") : (respuesta.headers?.["content-type"] || "");
        if (ct && !ct.toLowerCase().includes("application/json")) {
          throw new ErrorGroqJsonInvalido(`Content-Type inesperado: '${ct}'. Se esperaba 'application/json'.`);
        }

        const cuerpoTexto = await respuesta.text();
        let jsonRespuesta;
        try {
          jsonRespuesta = JSON.parse(cuerpoTexto);
        } catch (errJson) {
          throw new ErrorGroqJsonInvalido(`Respuesta HTTP 200 de Groq no es JSON válido: ${errJson.message}`);
        }

        const contenidoMensaje = jsonRespuesta.choices?.[0]?.message?.content;
        if (!contenidoMensaje || typeof contenidoMensaje !== "string") {
          throw new ErrorGroqJsonInvalido("La respuesta de Groq carece de choices[0].message.content.");
        }

        let dictamenesObj;
        try {
          dictamenesObj = JSON.parse(contenidoMensaje);
        } catch (errParseContent) {
          throw new ErrorGroqJsonInvalido(`El contenido narrativo no es un JSON parseable: ${errParseContent.message}`);
        }

        for (const dictamen of dictamenesObj.dictamenes || []) {
          for (const campo of CAMPOS_PROHIBIDOS) {
            if (Object.prototype.hasOwnProperty.call(dictamen, campo)) {
              throw new ErrorGroqNivelProhibido(
                `Campo prohibido '${campo}' detectado en dictamen de ${dictamen.loc_id_global || "desconocido"}.`
              );
            }
          }
        }

        const resValidacionInline = validarRespuestaGroq(dictamenesObj);
        if (!resValidacionInline.valido) {
          throw new ErrorGroqSchemaInvalido(`Validación semántica falló: ${resValidacionInline.motivo}`);
        }

        if (typeof validadorSchema === "function") {
          const resValAjv = validadorSchema(dictamenesObj);
          if (!resValAjv.valido) {
            throw new ErrorGroqSchemaInvalido(
              `Schema Ajv no cumplido: ${JSON.stringify(resValAjv.errores)}`
            );
          }
        }

        return {
          exito: true,
          dictamenes: dictamenesObj.dictamenes,
          intentos: intento
        };
      }

      if (respuesta.status === 429) {
        if (logger && typeof logger.warn === "function") {
          logger.warn({
            evento: "GROQ_RATE_LIMIT",
            intento,
            mensaje: `HTTP 429 Rate Limit. Esperando backoff de ${backoff429Ms} ms.`
          });
        }
        await sleepFn(backoff429Ms);
        ultimoError = new ErrorGroqRateLimit();
        continue;
      }

      if (respuesta.status >= 500 && respuesta.status <= 599) {
        if (logger && typeof logger.warn === "function") {
          logger.warn({
            evento: "GROQ_HTTP_5XX",
            status: respuesta.status,
            intento,
            mensaje: `Error de servidor HTTP ${respuesta.status} en Groq.`
          });
        }
        ultimoError = new ErrorGroqHttp5xx(respuesta.status);
        continue;
      }

      const errTexto = await respuesta.text();
      throw new ErrorGroqHttp4xx(respuesta.status, `Error HTTP ${respuesta.status} desde Groq: ${errTexto}`);
    } catch (errCapturado) {
      ultimoError = errCapturado;

      if (errCapturado.reintentable === false) {
        if (logger && typeof logger.error === "function") {
          logger.error({
            evento: "GROQ_ERROR_FATAL_NO_REINTENTABLE",
            tipo: errCapturado.tipo,
            mensaje: errCapturado.message
          });
        }
        throw errCapturado;
      }

      if (logger && typeof logger.warn === "function") {
        logger.warn({
          evento: "GROQ_REINTENTO_PROGRAMADO",
          intento,
          error: errCapturado.message
        });
      }
    }
  }

  if (ultimoError && ultimoError.reintentable) {
    ultimoError.reintentable = false;
  }

  throw ultimoError || new ErrorGroqRed("Se agotaron los reintentos hacia la API de Groq.");
}