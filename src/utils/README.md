# Módulo: Utilidades del Sistema (src/utils)

Funciones auxiliares puras y deterministas.

## Archivos

- `crypto.js`: Generación de hashes SHA-256 de auditoría para payloads y archivos estáticos.
- `interpolacion.js`: Algoritmos de interpolación espacial bilineal sobre mallas regulares.
- `validator.js`: Compilación y validación de schemas JSON Draft 2020-12 mediante Ajv.
- `tiempo.js`: Manejo y alineación de marcas de tiempo en formato ISO 8601 UTC-6.

## Principio Rector

Todas las funciones son puras y deterministas. Misma entrada + misma versión = misma salida. Sin Math.random, sin Date.now() no parametrizado.