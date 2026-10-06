# Sesión 01 — Preprocesamiento estático (§6.1)

**Fecha inicio**: 2026-10-05
**Fecha cierre**: 2026-10-05
**Estado**: CERRADA
**Auditor externo**: MaxIA
**Repo**: https://github.com/Maxiaintelligence/satrc-v4
**Commits**: d70397a (estructura inicial) -> bac3eec (registro sesión 1) -> [pendiente] (cierre sesión 1)
**Iteraciones**: 2 (respuesta inicial + correcciones)

---

## 1. Tarea enviada a Gemini

DECISIONES TOMADAS. Procede con la Sesión 1.

DECISIÓN 1 — VOCABULARIO DE COLUMNAS.
Arquitectura: Supabase conserva los nombres del CSV en la tabla
localidades_base. El motor usa nombres cortos. El mapeo es único y
ocurre en la capa de ingesta del pipeline. Entrega la tabla de mapeo
obligatoria:

  | Nombre en CSV | Nombre en motor | Tipo |
  | pendiente_maxima_grados | pendiente_max_deg | float |
  | pendiente_promedio_grados | pendiente_prom_deg | float |
  | distancia_al_cauce_principal_km | dist_cauce_km | float |
  | indice_humedad_topografica | twi | float |
  | tiempo_concentracion_horas | tc_horas | float |
  | tipo_acceso_vial | acceso_vial | string |
  | grado_marginacion | marginacion | string |
  | distancia_hospital_km | dist_hospital_km | float |
  | poblacion_total_aguas_arriba | poblacion_aguas_arriba | int |
  | tipo_relieve | relieve_tipo | string |
  | tipo_clima_koppen | koppen | string |

Completa la tabla con TODAS las columnas del CSV que el motor use.

DECISIÓN 2 — UMBRAL DE DESLAVE.
Se mantiene la FÓRMULA DINÁMICA de mi spec original:
  umbral = max(12, 65 − pendiente_max_deg × 0.85 − factor_relieve)
  factor_relieve: LADERA=+15, LOMA=+8, resto=0.
  Pendiente en grados.
  Piso 12 mm.
El spread de lluvia entre los 3 modelos (max−min) se usa como
modulador: si spread > 15 mm Y el nivel calculado está en frontera
de subir, sube nivel por precaución asimétrica.

DECISIÓN 3 — ARQUITECTURA DE COMBINACIÓN.
Envolvente asimétrica. La matriz da nivel base. El motor
multivectorial modula SOLO hacia arriba. Nunca baja nivel.

TAREA — Sesión 1: Preprocesamiento estático (§6.1)
ENTREGABLES: (1) tabla de mapeo, (2) 4 ambigüedades resueltas,
(3) JSON Schema coeficientes_regionales.json, (4) pseudocódigo
gradiente térmico, (5) pseudocódigo factor de exposición,
(6) test de validación ERA5-Land.
REGLAS: sin código real, marcar [SUPUESTO] y [PROPUESTO],
cerrar con (a)(b)(c)(d).

---

## 2. Respuesta de Gemini (primera iteración)

### 2.1 Tabla de mapeo de columnas

Mapeo completo de 31 columnas CSV -> motor (ver respuesta original del modelo en el chat de Gemini).

### 2.2 Respuestas a las 4 ambigüedades

A — Fórmula confirmada. A 45° LADERA: max(12, 11.75) = 12 mm. Override necesario por regla externa.

B — lluvia_efectiva_24h ≡ lluvia_acumulada_24h hasta tener tabla CN. [FALTA: Tabla de Curva Número].

C — [PROPUESTO] Comunidad serrana: (altitud >= 1500) AND (relieve IN {LADERA, LOMA} OR pendiente_max >= 20°).

D — [PROPUESTO] Aspecto desde DEM Horn 3×3 + azimut Golfo 67.5° ENE. Moduladores Barlovento/Sotavento.

### 2.3 JSON Schema (versión 1)

Rango de valor en [0.5, 2.0]. Cardinalidad sin restricción. (Luego corregido en iteración 2.)

### 2.4 Pseudocódigo gradiente

Unidades en °C y m. (Luego corregido a Kelvin y m²/s² en iteración 2.)

### 2.5 Pseudocódigo factor exposición

Con moduladores definidos. Barlovento [1.00, 1.20], Sotavento [0.85, 1.00].

### 2.6 Test de validación

3 puntos: Jopala (652 msnm, HUA), Tulancingo (2168 msnm, TUL), San José Corral Blanco (2863 msnm, CHG). MAE ≤ 1.20 °C, RMSE ≤ 1.60 °C.

### 2.7 Cierre (a)(b)(c)(d)

2 preguntas abiertas sobre viento del Golfo y override ≥45°.

---

## 3. Correcciones del auditor (iteración 1 -> 2)

6 observaciones enviadas:

1. Rango del factor de exposición inconsistente (schema [0.5, 2.0] vs pseudocódigo [0.85, 1.20]).
2. loc_id global NO DEFINIDO (LOC no es único globalmente).
3. Unidades crudas de ERA5-Land (t2m en Kelvin, z en m²/s²).
4. Signo del gradiente térmico (test determinista + fallback).
5. Cardinalidad de 405 en factor_exposicion (minProperties/maxProperties).
6. Override para pendientes >=45° formalizado como regla externa.

Respuestas a preguntas abiertas:

1. Viento fijo en 67.5° ENE (no dinámico).
2. Override >=45° sí formalizado, sin modificar fórmula original.

---

## 4. Respuesta final de Gemini (iteración 2)

### 4.1 JSON Schema corregido (Obs 1 y Obs 5)

{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://caritas-tulancingo.org/schemas/coeficientes_regionales.json",
  "title": "CoeficientesRegionales",
  "type": "object",
  "required": [
    "version", "fecha_calculo", "fuente_dem", "fuente_era5",
    "gradiente_termico_C_por_100m", "factor_exposicion"
  ],
  "properties": {
    "version": { "type": "string" },
    "fecha_calculo": { "type": "string", "format": "date-time" },
    "fuente_dem": { "type": "string", "const": "INEGI 3.0 30m" },
    "fuente_era5": { "type": "string", "const": "ERA5-Land 9km" },
    "gradiente_termico_C_por_100m": {
      "type": "object",
      "required": ["global", "por_zona"],
      "properties": {
        "global": {
          "type": "number",
          "maximum": 0.0,
          "description": "Gradiente medio ambiental lapse rate (negativo, ej. -0.65 C/100m)"
        },
        "por_zona": {
          "type": "object",
          "required": ["ACT","APN","ATG","CHG","HUA","HYC","PMN","PMS","SPP","TIZ","TUL","XIC","ZAC","ZAH"],
          "additionalProperties": { "type": "number", "maximum": 0.0 }
        }
      },
      "additionalProperties": false
    },
    "factor_exposicion": {
      "type": "object",
      "minProperties": 405,
      "maxProperties": 405,
      "description": "Mapeo indexado por loc_id_global unívoco (405 registros exactos)",
      "additionalProperties": {
        "type": "object",
        "required": ["tipo", "valor", "metodo"],
        "properties": {
          "tipo": { "type": "string", "enum": ["BARLOVENTO", "SOTAVENTO", "MIXTO"] },
          "valor": { "type": "number", "minimum": 0.85, "maximum": 1.20 },
          "metodo": { "type": "string" },
          "aspecto_grados": {
            "type": "number",
            "minimum": -1.0,
            "maximum": 360.0,
            "description": "Ángulo azimutal de orientación (-1.0 para terreno plano)"
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}

### 4.2 loc_id_global definido (Obs 2)

Formato elegido: Opción D — Slug Canónico + Hash SHA-256 Truncado.

Estructura: LOC_[ENT_SLUG]_[MUN_SLUG]_[LOC_ID]_[HASH8]

Ejemplo: LOC_HGO_ACT_1_a3f9e2b1

Justificación:

1. Cero colisiones + reproducibilidad estricta (hash SHA-256 determinista del triplete NOM_ENT, NOM_MUN, LOC).
2. Legibilidad humana + trazabilidad geográfica.
3. Robusto ante reordenamiento del CSV.

Fila adicional en tabla de mapeo:

| Nombre en CSV | Nombre en Motor | Tipo | Descripción |
|---|---|---|---|
| [GENERADO_EN_INGESTA] | loc_id_global | string | ID determinista único global |
| LOC | loc_id_mun | integer | Clave municipal INEGI de la localidad |

### 4.3 Pseudocódigo gradiente corregido (Obs 3 y Obs 4)

ALGORITMO CalcularGradienteTermicoLocal
ENTRADAS:
    series_era5: Colección de celdas ERA5-Land con:
                 - t2m_k: Temperatura a 2m horaria cruda (Kelvin)
                 - z_geopotencial: Geopotencial superficial crudo (m²/s²)
    localidades: Colección de 405 localidades con (zona_id, altitud_msnm, lat, lon)
    g_estandar:  Constante gravitacional = 9.80665 m/s²
    k_kelvin:    Constante offset térmico = 273.15
    gradiente_fallback: Constante = -0.65  // °C / 100m regional de respaldo
SALIDAS:
    gradiente_global: Número float (°C / 100m, siempre negativo)
    gradientes_zona:  Diccionario [zona_id -> float]

INICIO:
    PARA CADA celda EN series_era5:
        T_celsius_serie = celda.t2m_k_serie - k_kelvin
        T_media_c[celda.id] = PROMEDIO(T_celsius_serie)
        altitud_m[celda.id] = celda.z_geopotencial / g_estandar
    FIN PARA

    (beta_0_global, beta_1_global) = REGRESION_LINEAL(X = altitud_m, Y = T_media_c)
    grad_calc_global = beta_1_global * 100.0

    SI grad_calc_global >= 0.0 O grad_calc_global < -1.50 ENTONCES:
        REGISTRAR_BITACORA("ADVERTENCIA: Gradiente global ERA5 anómalo o positivo. Usando fallback.", grad_calc_global)
        gradiente_global = gradiente_fallback
    SINO:
        gradiente_global = REDONDEAR(grad_calc_global, 4)
    FIN SI

    LISTA_ZONAS = ["ACT","APN","ATG","CHG","HUA","HYC","PMN","PMS","SPP","TIZ","TUL","XIC","ZAC","ZAH"]
    PARA CADA zona EN LISTA_ZONAS:
        celdas_zona = OBTENER_CELDAS_ERA5_INTERSECAN_ZONA(zona)
        SI LONGITUD(celdas_zona) >= 3 ENTONCES:
            (beta_0_z, beta_1_z) = REGRESION_LINEAL(X = altitud_m[celdas_zona], Y = T_media_c[celdas_zona])
            grad_calc_zona = beta_1_z * 100.0
            SI grad_calc_zona < 0.0 Y grad_calc_zona >= -1.50 ENTONCES:
                gradientes_zona[zona] = REDONDEAR(grad_calc_zona, 4)
            SINO:
                REGISTRAR_BITACORA("ADVERTENCIA: Gradiente zonal anómalo en zona " + zona + ". Heredando global.", grad_calc_zona)
                gradientes_zona[zona] = gradiente_global
            FIN SI
        SINO:
            gradientes_zona[zona] = gradiente_global
        FIN SI
    FIN PARA

    RETORNAR (gradiente_global, gradientes_zona)
FIN ALGORITMO

### 4.4 Regla override >=45° (Obs 6)

REGLA OverridePendienteCritica:
ENTRADAS:
    pendiente_max_deg:     Float
    saturacion_total:      Float (mm)
    lluvia_acumulada_24h:  Float (mm)
    nivel_deslave_base:    Entero [1..4]
SALIDAS:
    nivel_deslave_final:   Entero [1..4]

INICIO:
    nivel_override = nivel_deslave_base
    SI pendiente_max_deg >= 45.0 ENTONCES:
        SI saturacion_total >= 40.0 ENTONCES:
            nivel_override = 4
        SINO SI lluvia_acumulada_24h >= 12.0 ENTONCES:
            nivel_override = MAX(nivel_override, 3)
        FIN SI
    FIN SI
    nivel_deslave_final = MAX(nivel_deslave_base, nivel_override)
    RETORNAR nivel_deslave_final
FIN REGLA

### 4.5 Cierre (a)(b)(c)(d) de Gemini

(a) Resumen: correcciones aplicadas a JSON Schema (rango + cardinalidad), loc_id_global definido, pseudocódigo corregido con unidades ERA5, regla override formalizada.

(b) Supuestos: g_0 = 9.80665 m/s², fallback gradiente -0.65 °C/100m.

(c) Propuestas: estructura LOC_[ENT_SLUG]_[MUN_SLUG]_[LOC_ID]_[HASH8], rango de validez física ERA5 [-1.50, 0.00] °C/100m.

(d) Preguntas abiertas: ninguna.

---

## 5. Veredicto del auditor

    ═════════════════════════════════════════════════
    SELLO DE CIERRE — SESIÓN 1
    ═════════════════════════════════════════════════
    Estado: CERRADA
    Iteraciones: 2

    Verificación de las 6 observaciones:

      1. Rango del factor de exposición        OK Corregido [0.85, 1.20]
      2. loc_id_global (Opción D)              OK Definido y justificado
      3. Unidades crudas ERA5-Land             OK Kelvin + m²/s²
      4. Signo gradiente + fallback            OK Con bitácora
      5. Cardinalidad 405 en factor_exposicion OK minProperties/maxProperties
      6. Override >=45° (envolvente asimétrica) OK Formalizado

    Coherencia cruzada:

      - Con CSV (405 localidades, 14 zonas)    OK
      - Con spec original (§6.1)               OK
      - Con Decisión 3 (envolvente asimétrica) OK
      - Sin alucinaciones                      OK
      - Sin desviaciones silenciosas           OK

    Decisiones fijadas:

      - Fórmula deslave: max(12, 65 - pendiente*0.85 - factor_relieve)
      - Factor relieve: LADERA=+15, LOMA=+8, resto=0
      - loc_id_global: LOC_[ENT_SLUG]_[MUN_SLUG]_[LOC]_[HASH8]
      - Comunidad serrana: altitud >=1500 AND (LADERA/LOMA OR pendiente_max >=20°)
      - Viento del Golfo: 67.5° ENE (fijo)
      - Rango gradiente: [-1.50, 0.00] °C/100m (validez técnica)
      - Override >=45°: saturación >=40 -> Nivel 4; lluvia >=12 -> Nivel 3
      - Override aplica envolvente: MAX(base, override)

    Observaciones pendientes: NINGUNA
    ═════════════════════════════════════════════════

---

## 6. Lecciones aprendidas

1. Gemini trunca archivos largos en silencio. La regla 13 (lectura completa con primera/mitad/última fila) resolvió el problema de conteo parcial (165 -> 405).

2. Gemini reescribe umbrales sin avisar. La regla 6 (marcar [CAMBIO PROPUESTO] con justificación numérica) fue clave para detectar el intento de reemplazar la fórmula dinámica por escalera discreta.

3. Gemini introduce variables inventadas. Las marca correctamente como [PROPUESTO] cuando se le exige. Sin la regla, las mezclaría con las reales.

4. La distinción [SUPUESTO] vs [PROPUESTO] funciona. Gemini respeta la diferencia: [SUPUESTO] = asunción operativa, [PROPUESTO] = decisión de diseño pendiente de ratificación.

5. La envolvente asimétrica debe explicitarse. Sin la Decisión 3, Gemini habría intentado que la matriz pudiera degradar niveles. Al fijarla, la aplicó correctamente en el override >=45° (nivel_final = MAX(base, override)).

6. El patrón de 2 iteraciones funciona. Iteración 1: ejecuta tarea. Iteración 2: corrige observaciones. Sin más iteraciones salvo bloqueos reales.

---

## 7. Archivos relacionados

- Dataset fuente: data/raw/localidades_crudo.csv
- Verdad base: data/verdad_base.md
- Schema objetivo: schemas/coeficientes_regionales.schema.json
- JSON objetivo: data/coeficientes/coeficientes_regionales.json
- System prompt vigente: docs/prompts/system-prompt-v3.md

