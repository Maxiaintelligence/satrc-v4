# Módulo: Motor de Cálculo (src/motor)

Contiene la lógica determinista del sistema SatRC v4.0, organizada según el ciclo de vida de los datos.

## 1. Preprocesamiento Estático (src/motor/preprocesamiento/)

Procesamiento offline que genera `data/coeficientes/coeficientes_regionales.json`:

- `gradiente-termico.js`: Cómputo del lapse rate regional a partir de mallas históricas ERA5-Land.
- `factor-exposicion.js`: Derivación topográfica de barlovento/sotavento desde DEM INEGI 30m.

## 2. Pipeline Dinámico (src/motor/pipeline/)

Procesamiento online autónomo ejecutado cada 3 horas por el cron:

- `ingesta.js`: Paso 0 — Ingesta, interpolación bilineal y ajuste altimétrico.
- `consenso.js`: Paso 1 — Consenso multi-modelo y filtro de ceros espurios.
- `memoria.js`: Paso 2 — Cálculo de API 7 días (0.85^k) con verificación satelital.
- `evaluacion.js`: Paso 3 — Evaluación de los 6 vectores de riesgo, reglas en cascada y envolvente asimétrica.
- `index.js`: Orquestador secuencial del flujo de datos dinámico.

## Interfaces Públicas

El barrel export `src/motor/index.js` reexporta:

- `ejecutarPipeline()` desde `./pipeline/index.js`
- `ejecutarPaso0Ingesta()`, `ejecutarPaso1Consenso()`, `ejecutarPaso2Memoria()`, `ejecutarPaso3Evaluacion()`
- `calcularGradienteTermico()` desde `./preprocesamiento/gradiente-termico.js`
- `calcularFactorExposicion()` desde `./preprocesamiento/factor-exposicion.js`