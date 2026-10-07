# Módulo: Capa Narrativa Groq (src/groq)

Gestiona la generación de dictámenes técnicos para brigadas parroquiales.

## Archivos

- `cliente.js`: Peticiones HTTP a `llama-3.3-70b-versatile` con control de timeout (8s) y backoff (10s para HTTP 429).
- `prompts.js`: Templates con prohibición estricta de alteración o emisión de niveles de alerta.
- `fallback.js`: Generador determinista de dictámenes narrativos individualizados en caso de contingencia.

## Principio Rector

La IA narrativa jamás calcula ni altera niveles. Si Groq devuelve un campo "nivel", el payload se rechaza automáticamente.