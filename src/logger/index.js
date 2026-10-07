/**
 * @file src/logger/index.js
 * @description Instancia singleton de Pino configurada para logging estructurado JSON / legible en desarrollo.
 */

import pino from "pino";

const nodeEnv = process.env.NODE_ENV || "development";
const logLevel = process.env.LOG_LEVEL || "info";

let transport;

// [Sesión 4A] Formato legible con pino-pretty solo en desarrollo local
if (nodeEnv === "development" && process.env.NODE_ENV !== "test") {
  transport = pino.transport({
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
      ignore: "pid,hostname"
    }
  });
}

/** @type {import('pino').Logger} */
export const logger = transport 
  ? pino({ level: logLevel }, transport) 
  : pino({ 
      level: nodeEnv === "test" ? "silent" : logLevel,
      base: { env: nodeEnv, motor: "v4.0" },
      timestamp: pino.stdTimeFunctions.isoTime
    });

export default logger;