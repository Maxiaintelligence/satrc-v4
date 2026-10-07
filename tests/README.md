# Suite de Pruebas Unitarias e Integración (tests)

Pruebas ejecutadas mediante el test runner nativo de Node.js 22 (`node --test`).

## Estructura

### tests/motor/

- `preprocesamiento/`: Validación de `gradiente-termico.js` y `factor-exposicion.js`.
- `pipeline/`: Validación de los Pasos 0-3 y del orquestador completo.

### tests/groq/

- `cliente.test.js`: Reintentos, timeout, backoff para 429.
- `fallback.test.js`: Generación determinista de dictámenes.
- `prompts.test.js`: Validación de templates y prohibición de campos de nivel.

### tests/utils/

- `crypto.test.js`: Hashes SHA-256 deterministas.
- `interpolacion.test.js`: Interpolación bilineal.
- `validator.test.js`: Validación de schemas con Ajv2020.

### tests/schemas/

- `schemas.test.js`: Verifica que todos los JSON Schemas cumplen Draft 2020-12.

### tests/config/

- `env.test.js`: Validación de variables de entorno requeridas.
- `constantes.test.js`: Inmutabilidad de constantes físicas y catálogos.

### tests/supabase/

- `cliente.test.js`: Instanciación correcta del cliente.
- `queries.test.js`: Estructuras esperadas (con mocks deterministas).

## Principio Rector

Todos los tests son deterministas y corren sin conexión externa (mocks de red). Misma entrada + misma versión = mismo resultado.