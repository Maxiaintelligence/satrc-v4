# Workflows de GitHub Actions (.github/workflows)

Contiene las definiciones de automatización y orquestación del sistema.

## Archivos

- `pipeline.yml`: Cron autónomo ejecutado cada 3 horas con offset de 20 minutos (`20 0,3,6,9,12,15,18,21 * * *` UTC) para invocar el endpoint serverless o ejecutar el runner local.
- `keepalive.yml`: Tarea programada mensual para evitar la suspensión de workflows por inactividad en repositorios de GitHub.

## Principio Rector

Ningún workflow accede a secretos hardcodeados. Todas las credenciales viven en GitHub Secrets y se inyectan como variables de entorno en runtime.