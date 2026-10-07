# Endpoint Serverless Vercel (api)

Punto de entrada serverless para orquestación y contingencia.

## Archivos

- `sara.js`: Controlador HTTP POST protegido por `CRON_SECRET` que ejecuta el pipeline completo o responde a eventos de supervisión.

## Principio Rector

El endpoint no contiene lógica de negocio. Solo orquesta llamadas al módulo `src/motor/` y persiste resultados vía `src/supabase/`.