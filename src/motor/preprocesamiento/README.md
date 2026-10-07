# Submódulo: Preprocesamiento Estático (src/motor/preprocesamiento)

Implementa los algoritmos deterministas offline (§6.1) para generar los coeficientes territoriales permanentes.

## Archivos

- `gradiente-termico.js`: Cómputo del lapse rate regional ambiental (°C/100m) mediante regresión lineal sobre series históricas de ERA5-Land (Kelvin y Geopotencial).
- `factor-exposicion.js`: Cálculo de orientación de ladera (Horn 3x3) y factor multiplicador orográfico respecto al viento húmedo dominante del Golfo (67.5° ENE) a partir del DEM INEGI 30m.

## Principio Rector

Procesamiento puramente determinista y reproducible. Los resultados se validan contra `coeficientes_regionales.schema.json` y se versionan en `data/coeficientes/coeficientes_regionales.json`.