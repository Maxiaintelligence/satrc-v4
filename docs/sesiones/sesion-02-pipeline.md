# Sesión 02 — Pipeline §6.2

**Fecha inicio**: 2026-10-05
**Fecha cierre**: 2026-10-05
**Estado**: CERRADA
**Auditor externo**: MaxIA
**Iteraciones**: 3 (respuesta inicial + 2 correcciones)

---

## 1. Tarea enviada a Gemini

Diseño del pipeline §6.2 con 5 entregables:

1. Paso 0 — Ingesta y normalización (JSON Schema ingesta_horaria).
2. Paso 1 — Consenso multi-modelo (JSON Schema consenso_horario).
3. Paso 2 — Memoria hídrica API 7d (JSON Schema api_7dias).
4. Paso 3 — Evaluación por localidad (JSON Schema evaluacion_localidad).
5. Diagrama Mermaid del pipeline completo.

Contexto: Supabase operativo con tabla localidades_base (405 filas).
Decisiones de Sesión 1 cerradas (no reabrir).

---

## 2. Respuesta de Gemini (iteración 1)

Entregó los 5 elementos con:

- Paso 0: interpolación bilineal + lapse-rate. Horizonte 240h.
- Paso 1: filtro de ceros con ponderación 50/25/25 cuando ICON disidente.
- Paso 2: API 7d con decaimiento 0.85^k. Ajuste CHIRPS/IMERG.
- Paso 3: evaluación por localidad con envolvente asimétrica.
- Diagrama Mermaid del pipeline.

Detectadas 8 observaciones (4 críticas, 4 menores).

---

## 3. Correcciones del auditor (iteración 1 -> 2)

8 observaciones enviadas:

1. Horizonte de ingesta 240h sin justificar -> reducir a 192h.
2. Falta test de signo del gradiente (debe ser negativo).
3. Filtro de ceros: casos 3, 1, 0, 2-sin-ICON, 2-solo-ECMWF-GFS no cubiertos.
4. "Reduce proporcionalmente": interpretación de 50/25/25 no ratificada.
5. Tabla condiciones_historico no existe: falta DDL.
6. Umbrales de inundación cambiados sin avisar.
7. Umbrales de viento cambiados sin avisar.
8. Helada perdió criterio de altitud y wind chill.

Respuestas:

- No hay matriz diocesana cerrada para inundación/viento/temperatura.
- Ratificar umbrales de Sesión 1 salvo justificación numérica.

---

## 4. Respuesta de Gemini (iteración 2)

Resolvió las 8 observaciones:

- Horizonte ajustado a 192h (168h historial + 24h pronóstico).
- Guarda determinista del gradiente con fallback -0.65.
- 5 casos exhaustivos del filtro de ceros.
- Ratificada ponderación 50/25/25 (ICON resuelve orografía).
- DDL condiciones_historico con retención 240h (~18 MB).
- Umbrales de inundación: restaurados los originales de Sesión 1.
- Umbrales de viento: ratificados con ráfagas (montaña).
- Helada: restaurado wind chill JAG/TI + helada negra.

Detectadas 3 observaciones menores.

---

## 5. Correcciones del auditor (iteración 2 -> 3)

3 observaciones enviadas:

A. Nomenclatura inconsistente: viento_kmh vs viento_max_kmh.
B. Falta visibilidad_m en condiciones_historico.
C. Documentar caso borde del filtro de ceros (0.1-0.49 mm).

---

## 6. Respuesta de Gemini (iteración 3)

Resolvió las 3 observaciones:

- Nomenclatura unificada: viento_max_kmh y rafaga_max_kmh en todos los schemas.
- DDL actualizado con visibilidad_m y rafaga_max_kmh.
- Caso 5 documentado como MIXTO determinista.
- hora_relativa max ajustado a 191 en los 2 schemas.

---

## 7. Veredicto del auditor

    ═════════════════════════════════════════════════
    SELLO DE CIERRE — SESIÓN 2
    ═════════════════════════════════════════════════
    Estado: CERRADA
    Iteraciones: 3

    Entregables aprobados:
      1. Paso 0 — Ingesta con interpolación bilineal + lapse-rate
      2. Paso 1 — Consenso con 5 casos de filtro de ceros
      3. Paso 2 — API 7d con decaimiento 0.85^k
      4. Paso 3 — Evaluación multivectorial con envolvente asimétrica
      5. DDL condiciones_historico con retención 240h
      6. Diagrama Mermaid

    Decisiones fijadas:
      - Horizonte: 192h (168 historial + 24 pronóstico)
      - Filtro ceros: 5 casos exhaustivos
      - Ponderación ICON disidente: 50/25/25
      - Wind Chill: JAG/TI
      - Helada negra: T<=0 + RH<60% + altitud>=2100
      - Umbrales inundación: originales Sesión 1
      - Umbrales viento: con ráfagas
      - Nomenclatura: viento_max_kmh, rafaga_max_kmh

    Observaciones pendientes: NINGUNA
    Próxima sesión: Sesión 3 — Motor + Groq
    ═════════════════════════════════════════════════

---

## 8. Lecciones aprendidas

1. Gemini propone cambios de umbrales sin avisar. Las 8 observaciones incluyeron 3 de este tipo. La Regla 6 del system prompt es indispensable.

2. Gemini justifica bien cuando se le pide. Las ratificaciones de inundación (mantener original por Tc<3h en cuencas de montaña) y viento (adoptar ráfagas por turbulencia en montaña) fueron sólidas.

3. El horizonte de ingesta debe justificarse. Gemini propuso 240h sin razón; al pedir justificación, bajó a 192h.

4. DDL debe incluir TODAS las variables que se usan. Visibilidad faltaba en condiciones_historico pero se usaba en Paso 3.

5. Nomenclatura unificada desde el inicio. viento_kmh vs viento_max_kmh causó un ciclo de corrección innecesario.

6. 3 iteraciones es aceptable cuando hay 8 observaciones. El patrón iterativo funciona.

---

## 9. Archivos relacionados

- Dataset: data/raw/localidades_crudo.csv
- Verdad base: data/verdad_base.md
- Schemas del pipeline: schemas/ingesta_horaria.schema.json,
  schemas/consenso_horario.schema.json,
  schemas/api_7dias.schema.json,
  schemas/evaluacion_localidad.schema.json
- DDL histórico: schemas/condiciones_historico.sql
- Sesión 1: docs/sesiones/sesion-01-preprocesamiento.md