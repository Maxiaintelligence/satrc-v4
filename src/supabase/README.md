# Módulo: Integración con Supabase (src/supabase)

Capa de acceso a datos para las 6 tablas del sistema.

## Tablas

- `localidades_base`: Metadatos territoriales de las 405 localidades.
- `condiciones_historico`: Serie temporal de 168h de consenso para memoria hídrica.
- `bitacora`: Registro de eventos del sistema, calidad, narrativa y auditoría.
- `bitacora_pronosticos`: Snapshots históricos cada 3h por localidad.
- `condiciones_actuales`: Estado vivo de las 405 localidades para el frontend.
- `evaluaciones`: Verificación diferida post-evento (D vs D+1).

## Archivos

- `cliente.js`: Instancia de `@supabase/supabase-js` con service_role key.
- `queries.js`: Funciones de lectura y escritura tipadas.

## Principio Rector

Ninguna query se ejecuta desde el frontend con `service_role`. El cliente público usa solo `anon` + RLS.