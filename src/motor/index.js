/**
 * @file src/motor/index.js
 * @description Fachada principal (Barrel Export) del motor de cálculo determinista SatRC v4.0.
 * Expone de forma unificada las funciones de orquestación, consenso, memoria hídrica y evaluación.
 */

// 1. Orquestación del Pipeline Dinámico
export {
  ejecutarPipeline,
  obtenerVentanaPronostico
} from "./pipeline/index.js";

// 2. Paso 0: Ingesta y Normalización
export {
  ejecutarPaso0Ingesta
} from "./pipeline/ingesta.js";

// 3. Paso 1: Consenso Multi-Modelo y Filtro de Ceros
export {
  ejecutarPaso1Consenso,
  calcularConsensoLluvia
} from "./pipeline/consenso.js";

// 4. Paso 2: Memoria Hídrica API 7 días
export {
  ejecutarPaso2Memoria
} from "./pipeline/memoria.js";

// 5. Paso 3: Evaluación Multivectorial y Envolvente Asimétrica
export {
  ejecutarPaso3Evaluacion,
  aplicarFactorExposicion,
  evaluarVectorDeslave,
  evaluarVectorInundacion,
  evaluarVectorViento,
  evaluarVectorTemperatura,
  evaluarVectorNiebla,
  evaluarVectorAislamiento,
  calcularEsComunidadSerrana,
  resolverJerarquiaDesempate
} from "./pipeline/evaluacion.js";