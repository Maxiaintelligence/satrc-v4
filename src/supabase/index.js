/**
 * @file src/supabase/index.js
 * @description Barrel Export del módulo de integración con Supabase (cliente y operaciones de base de datos).
 */

export {
  crearClienteSupabase,
  verificarConexion
} from "./cliente.js";

export {
  leerLocalidades,
  leerHistorial168h,
  escribirBitacora,
  mapearEvaluacionABitacora,
  escribirEvaluaciones,
  actualizarDictamenesEnEvaluaciones,
  actualizarCondicionesActuales,
  leerUltimoTimestampHistorico
} from "./queries.js";