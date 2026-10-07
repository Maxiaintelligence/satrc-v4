/**
 * @file src/groq/index.js
 * @description Barrel Export del módulo de integración con la API de Groq, prompts y fallback determinista.
 */

export {
  CAMPOS_PROHIBIDOS,
  construirUserPromptBatchZonal,
  validarRespuestaGroq
} from "./prompts.js";

export {
  llamarGroq,
  ErrorGroqTimeout,
  ErrorGroqRed,
  ErrorGroqHttp4xx,
  ErrorGroqHttp5xx,
  ErrorGroqRateLimit,
  ErrorGroqJsonInvalido,
  ErrorGroqSchemaInvalido,
  ErrorGroqNivelProhibido
} from "./cliente.js";

export {
  generarDictamenFallbackZonal
} from "./fallback.js";