# Submódulo: Pipeline Dinámico (src/motor/pipeline)

Implementa el flujo de cálculo determinista en tiempo de ejecución (§6.2), ejecutado de forma autónoma cada 3 horas por el cron.

## Archivos

- `ingesta.js`: Paso 0 — Ingesta, hashes SHA-256, interpolación bilineal y corrección de lapse-rate altimétrico.
- `consenso.js`: Paso 1 — Consenso multi-modelo (ECMWF, GFS, ICON) y filtro exhaustivo de ceros espurios.
- `memoria.js`: Paso 2 — Memoria hídrica API 7 días (0.85^k) con verificación satelital CHIRPS/IMERG.
- `evaluacion.js`: Paso 3 — Motor multivectorial (6 vectores de riesgo), reglas en cascada y envolvente asimétrica.
- `index.js`: Orquestador funcional puro que ejecuta secuencialmente los Pasos 0 → 1 → 2 → 3.

## Principio Rector

El motor de cálculo determinista decreta de forma inmutable los niveles numéricos de alerta y métricas físicas; la IA narrativa (Groq) jamás calcula ni altera estos valores.