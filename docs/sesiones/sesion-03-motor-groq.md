# Sesión 03 — Motor de Evaluación + Integración Groq

**Fecha inicio**: 2026-10-05
**Fecha cierre**: 2026-10-06
**Estado**: CERRADA
**Auditor externo**: MaxIA
**Iteraciones**: 5 (respuesta inicial + 4 correcciones)

---

## 1. Tarea enviada a Gemini

Diseño del motor multivectorial completo + integración con Groq.
8 entregables:

1. Ratificación del DDL existente (bitacora, bitacora_pronosticos).
2. Reglas faltantes del motor: vector niebla orográfica, vector
   aislamiento vial, reglas de combinación multivectorial, jerarquía
   de desempate.
3. Pseudocódigo completo del motor (6 vectores).
4. Integración Groq (system prompt + user prompt + JSON Schema +
   fallback).
5. Contrato del endpoint serverless api/sara.js.
6. DDL condiciones_actuales.
7. DDL evaluaciones.
8. Diagrama Mermaid del flujo completo.

Contexto: Supabase operativo. 4 tablas existentes (localidades_base,
condiciones_historico, bitacora, bitacora_pronosticos). Groq API
configurada. Sesiones 1-2 cerradas.

---

## 2. Respuesta de Gemini (iteración 1)

Entregó los 8 bloques:

- Ratificación del DDL con correcciones (vocabularios, columnas).
- Vector Niebla (visibilidad + humedad + serrano).
- Vector Aislamiento Vial (acceso + lluvia + dist hospital).
- Regla Cascada: Deslave>=3 + Aislamiento>=3 -> Nivel 4.
- Jerarquía de desempate: DESLAVE > INUNDACION > AISLAMIENTO >
  TEMPERATURA > VIENTO > NIEBLA.
- Motor completo con 6 vectores.
- System prompt Groq (prohíbe campo "nivel").
- Endpoint api/sara.js con lotes zonales (14 llamadas max).
- DDL condiciones_actuales y evaluaciones.
- Diagrama Mermaid.

Detectadas 11 observaciones (4 críticas, 7 menores).

---

## 3. Correcciones del auditor (iteración 1 -> 2)

11 observaciones enviadas:

Críticas:
1. Falta diagrama Mermaid (falso positivo, sí estaba).
2. corrida_id eliminado de bitacora_pronosticos.
3. condiciones_actuales incompleta.
4. hora_pico sin especificar serialización.

Menores:
1. timestamp_utc6 default incoherente.
2. Vocabulario severidad/origen cambiado sin justificar.
3. IF NOT EXISTS con CHECK nuevos.
4. es_falsa_alarma_degradada nombre incorrecto.
5. Falta matriz de confusión completa.
6. origen_dictamen duplica información.
7. Cubierto por C2.

---

## 4. Respuesta de Gemini (iteración 2)

Resolvió las 10 observaciones reales (retirada la #1 por falso
positivo del auditor).

Detectadas 7 observaciones nuevas al verificar contra estado real
de Supabase.

---

## 5. Correcciones del auditor (iteración 2 -> 3)

7 observaciones enviadas:

Críticas:
1. localidades_base NO tiene loc_id_global.
2. bitacora y bitacora_pronosticos ya existían con estructura vieja.
3. IF NOT EXISTS no resuelve.

Menores:
1. Redundancia matriz de confusión.
2. dictamen_narrativo NOT NULL sin fallback definido.
3. evaluaciones sin corrida_id.
4. Sin FKs explícitas (ratificar).

---

## 6. Respuesta de Gemini (iteración 3)

Entregó:

- ALTER localidades_base + pgcrypto + UPDATE determinista.
- DROP + CREATE bitacora y bitacora_pronosticos.
- CREATE condiciones_actuales y evaluaciones.
- Orden exacto de ejecución.

Detectadas 3 observaciones menores.

---

## 7. Correcciones del auditor (iteración 3 -> 4)

3 observaciones:

1. Cambio de slug ENT (HGO vs HID).
2. pgcrypto: public vs extensions.
3. JSON fallback no cumple minItems:2.

---

## 8. Respuesta de Gemini (iteración 4)

Ratificó:

- Slug INEGI: HGO, PUE, VER.
- pgcrypto WITH SCHEMA extensions + SET search_path.
- JSON fallback con 2 recomendaciones.

---

## 9. Veredicto del auditor

SELLO DE CIERRE — SESIÓN 3

Estado: CERRADA
Iteraciones: 4 (respuesta inicial + 3 correcciones reales)

Entregables aprobados:

1. DDLs finales (6 tablas en Supabase):
   - localidades_base (con loc_id_global)
   - condiciones_historico
   - bitacora (14 cols)
   - bitacora_pronosticos (30 cols)
   - condiciones_actuales (29 cols)
   - evaluaciones (17 cols)

2. Migración localidades_base:
   - loc_id_global VARCHAR(64) UNIQUE NOT NULL
   - Formato LOC_[HGO|PUE|VER]_[MUN_3]_[LOC]_[HASH8]
   - Verificado: 405 filas, 405 únicos

3. Motor multivectorial completo:
   - 6 vectores con umbrales definidos
   - Regla Cascada Deslave>=3 + Aislamiento>=3 -> Nivel 4
   - Jerarquía de desempate fijada

4. Integración Groq:
   - System prompt documentado
   - JSON Schema estricto de salida
   - Fallback a plantilla determinista
   - Lotes zonales (14 llamadas max por corrida)

5. Contrato api/sara.js:
   - POST con Bearer CRON_SECRET
   - Idempotencia por (corrida_id, loc_id_global)
   - Manejo de errores

Decisiones fijadas:

- Slug ENT: HGO, PUE, VER (INEGI)
- pgcrypto en schema extensions
- Sin FKs explícitas (decisión declarada)
- Fallback dictamen con minItems:2
- corrida_id UUIDv4 por ejecución
- Bitácora oficial del cron: 8 snapshots/día
- Retención bitacora_pronosticos: 90 días
- Migrar a particionado al llegar a 5M filas

Observaciones pendientes: NINGUNA

Próxima sesión: Sesión 4 — Orquestación (GitHub Actions + Vercel)

---

## 10. Pendientes ejecutados post-cierre

Todos ejecutados y verificados:

1. Migración localidades_base en Supabase.
2. DROP + CREATE bitacora y bitacora_pronosticos.
3. CREATE condiciones_actuales y evaluaciones.
4. Verificación consolidada (6 tablas, conteos correctos).
5. Guardar 4 DDLs en schemas/.
6. Guardar system prompt Groq + JSON Schema dictamen.
7. Documentar Sesión 3 (este archivo).

---

## 11. Lecciones aprendidas

1. CREATE TABLE IF NOT EXISTS NO aplica CHECK nuevos. Si la tabla
   existe, hay que DROP + CREATE (con backup) o ALTER.

2. Verificar SIEMPRE el estado real de Supabase antes de asumir la
   estructura del DDL. Cambios previos pueden haber creado columnas
   faltantes o vocabularios distintos.

3. loc_id_global como identificador canónico requiere ser columna
   física, no solo conceptual.

4. pgcrypto en Supabase vive en schema "extensions", no "public".

5. Los placeholders vacíos confunden. Mejor no crearlos o borrarlos
   de inmediato.

6. Bloques markdown anidados rompen el copy-paste. Evitar fences
   dentro de fences en instrucciones para el usuario.

---

## 12. Archivos relacionados

- Migración: schemas/migracion_loc_id_global.sql
- DDLs Sesión 3: schemas/bitacora.sql, condiciones_actuales.sql,
  evaluaciones.sql
- System prompt Groq: docs/prompts/system_prompt_groq.md
- JSON Schema dictamen: schemas/dictamen_narrativo.schema.json
- Sesiones previas: docs/sesiones/sesion-01-preprocesamiento.md,
  docs/sesiones/sesion-02-pipeline.md