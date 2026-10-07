# Módulo: Logging Estructurado (src/logger)

Configuración centralizada de Pino para emitir logs estructurados en JSON en producción y coloreados en desarrollo local.

## Archivos

- `index.js`: Instancia única del logger con niveles configurables vía `LOG_LEVEL`.

## Principio Rector

El logger nunca escribe directamente en Supabase. La persistencia de eventos va por el módulo `src/supabase/` a la tabla `bitacora`.