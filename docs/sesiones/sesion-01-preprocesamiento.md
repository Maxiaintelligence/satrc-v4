# Sesión 01 — Preprocesamiento estático (§6.1)

**Fecha inicio**: 2026-10-05
**Fecha cierre**: pendiente
**Estado**: en curso — esperando respuesta de Gemini al mensaje de correcciones
**Auditor externo**: MaxIA
**Repo**: https://github.com/Maxiaintelligence/satrc-v4
**Commit base**: `d70397a` (chore: estructura inicial del repo satrc-v4)

---

## 1. Tarea enviada a Gemini

```
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
de subir (ej. saturación justo por debajo del umbral), sube nivel
por precaución asimétrica. Esto se documenta como regla explícita.

DECISIÓN 3 — ARQUITECTURA DE COMBINACIÓN.
Envolvente asimétrica. La matriz da nivel base. El motor
multivectorial modula SOLO hacia arriba. Nunca baja nivel. Si la
matriz dice Nivel 1 y el motor dice Nivel 4, gana Nivel 4. Si la
matriz dice Nivel 4 y el motor dice Nivel 1, gana Nivel 4 (no
se degrada).

─────────────────────────────────────────────────
TAREA DE ESTA SESIÓN — Sesión 1: Preprocesamiento estático (§6.1)

ENTREGABLES EN ESTE ORDEN. Sin código real. Pseudocódigo solamente.

1. TABLA DE MAPEO DE COLUMNAS (Decisión 1).
   Todas las columnas del CSV que el motor va a usar, con su nombre
   corto en el motor y su tipo.

2. RESPUESTAS A LAS 4 AMBIGÜEDADES PENDIENTES:

   AMBIGÜEDAD A — Fórmula de deslave.
   Confirma: pendiente_max_deg en grados, factor_relieve LADERA=+15
   LOMA=+8 resto=0, piso 12 mm. ¿El piso 12 aplica también a
   pendientes ≥45° o hay override a Nivel 4 directo?

   AMBIGÜEDAD B — lluvia_efectiva_24h vs lluvia_acumulada_24h.
   ¿Son sinónimos o hay coeficiente de escorrentía (CN, cobertura,
   uso de suelo)? Si no te consta, dilo.

   AMBIGÜEDAD C — Comunidad serrana.
   Mi spec usa "comunidad serrana" para el principio precautorio.
   Propón un criterio operativo a partir de las columnas del CSV
   (altitud_msnm, tipo_relieve, pendiente_maxima_grados). Marca
   [PROPUESTO] y justifica.

   AMBIGÜEDAD D — Factor de exposición barlovento/sotavento.
   El CSV no tiene columna de dirección de ladera. Propón cómo
   derivarlo de DEM INEGI 30m + viento predominante del Golfo.
   Marca [PROPUESTO]. Justifica con las columnas disponibles.

3. JSON SCHEMA de coeficientes_regionales.json (draft 2020-12).
   Estructura mínima:
   {
     "version": "string",
     "fecha_calculo": "ISO8601",
     "fuente_dem": "INEGI 3.0 30m",
     "fuente_era5": "ERA5-Land 9km",
     "gradiente_termico_C_por_100m": {
       "global": number,
       "por_zona": { "<zona_id>": number }
     },
     "factor_exposicion": {
       "<loc_id>": {
         "tipo": "BARLOVENTO|SOTAVENTO|MIXTO",
         "valor": number,
         "metodo": "string"
       }
     }
   }
   Si propones campos adicionales, márcalos [PROPUESTO].

4. PSEUDOCÓDIGO del cálculo de gradiente térmico local (°C/100m)
   a partir de ERA5-Land. Determinista. Sin código real.

5. PSEUDOCÓDIGO del cálculo de factor de exposición
   barlovento/sotavento a partir de DEM INEGI 30m + viento
   predominante del Golfo. Determinista.

6. ESPECIFICACIÓN DEL TEST DE VALIDACIÓN contra ERA5-Land:
   - 3 puntos de control (dime cuáles y por qué).
   - Métrica de aceptación (RMSE, MAE, o el que justifiques).
   - Umbral de aceptación numérico.

REGLAS DE ESTA RESPUESTA:
- NO escribas código real todavía.
- NO propongas agenda de otras secciones.
- NO resumas el contexto.
- Marca [SUPUESTO] y [PROPUESTO] donde corresponda.
- Si algo contradice el CSV o mi spec, DETENTE y avisa.
- Cierra con (a) resumen, (b) supuestos, (c) propuestas, (d) preguntas.
```

---

## 2. Respuesta de Gemini (primera iteración)

### 2.1 Tabla de mapeo de columnas (Decisión 1)

Mapeo formal y unívoco entre las cabeceras de `localidades_crudo.csv` (almacenadas en PostgreSQL/Supabase en `localidades_base`) y las variables normalizadas para la capa de procesamiento del motor:

| Nombre en CSV (`localidades_base`) | Nombre en Motor | Tipo de Dato | Descripción / Unidad |
|---|---|---|---|
| `NOM_ENT` | `entidad` | `string` | Nombre de la entidad federativa |
| `NOM_MUN` | `municipio` | `string` | Nombre del municipio |
| `NOM_LOC` | `localidad` | `string` | Nombre oficial de la localidad |
| `ZONA_ID` | `zona_id` | `string` | Clave pastoral (ej. `ACT`, `SPP`, `TUL`) |
| `ZONA_RESGUARDO` | `zona_resguardo` | `string` | Denominación de la zona diocesana |
| `LOC` | `loc_id` | `integer` | Identificador de localidad dentro del municipio |
| `pobtot` | `poblacion` | `integer` | Población total censal (habitantes) |
| `lat_dd` | `lat` | `float` | Latitud en grados decimales (WGS84) |
| `lon_dd` | `lon` | `float` | Longitud en grados decimales (WGS84) |
| `CVE_SUBCUE` | `cve_subcuenca` | `string` | Clave hidrológica de la subcuenca |
| `SUBCUENCA` | `subcuenca` | `string` | Nombre de la subcuenca hidrológica |
| `AREA` | `area_subcuenca_km2` | `float` | Área de subcuenca (numérico sin `" km²"`) |
| `altitud_msnm` | `altitud_msnm` | `integer` | Altitud sobre el nivel del mar (m) |
| `pendiente_promedio_grados` | `pendiente_prom_deg` | `float` | Pendiente media del polígono (grados) |
| `pendiente_maxima_grados` | `pendiente_max_deg` | `float` | Pendiente máxima local (grados) |
| `tipo_relieve` | `relieve_tipo` | `string` | `LADERA`, `LOMA`, `MESETA`, `VALLE`, `LLANURA_COSTERA` |
| `distancia_al_cauce_principal_km` | `dist_cauce_km` | `float` | Distancia euclidiana al cauce principal (km) |
| `posicion_hidrologica` | `pos_hidrologica` | `string` | `CABECERA`, `MEDIA`, `BAJA` |
| `tiempo_concentracion_horas` | `tc_horas` | `float` | Tiempo de concentración hidrológica (h) |
| `indice_humedad_topografica` | `twi` | `float` | Topographic Wetness Index (ln(a / tan β)) |
| `tipo_clima_koppen` | `koppen` | `string` | Clasificación climática (`Cwb`, `C(w)`, `Aw`) |
| `precipitacion_media_anual_mm` | `precip_anual_mm` | `float` | Precipitación normal anual (mm) |
| `temperatura_media_anual_c` | `temp_anual_c` | `float` | Temperatura media anual (°C) |
| `heladas_historicas_promedio` | `heladas_anuales` | `float` | Frecuencia anual de heladas |
| `uso_suelo_dominante` | `uso_suelo` | `string` | Cobertura (`AGRICULTURA_TEMPORAL`, `PASTIZAL`, `URBANO`, etc.) |
| `indice_combustibilidad` | `combustibilidad` | `integer` | Índice de combustibilidad forestal |
| `grado_marginacion` | `marginacion` | `string` | Nivel de marginación socioeconómica (`ALTO`) |
| `distancia_carretera_km` | `dist_carretera_km` | `float` | Distancia a vía principal (km) |
| `distancia_hospital_km` | `dist_hospital_km` | `float` | Distancia al centro hospitalario más cercano (km) |
| `tipo_acceso_vial` | `acceso_vial` | `string` | Tipo de red (`CARRETERA_FEDERAL`, `ESTATAL`, `TERRACERIA`, `BRECHA`) |
| `poblacion_total_aguas_arriba` | `poblacion_aguas_arriba` | `integer` | Censo acumulado en cuenca tributaria |

### 2.2 Respuestas a las 4 ambigüedades

**AMBIGÜEDAD A — Fórmula de deslave y pendientes ≥45°**

- Confirmación técnica: La fórmula opera con `pendiente_max_deg` en grados y `factor_relieve ∈ {15, 8, 0}`.
- `umbral = max(12, 65 − (pendiente_max_deg × 0.85) − factor_relieve)`
- Comportamiento en ≥45°: `[SUPUESTO]` El piso numérico de 12 mm es la cota inferior estricta calculada por la fórmula. Si la especificación requiere que para pendientes ≥45° exista un override estructural (disparo directo a Nivel 4 cuando lluvia ≥12 mm o saturación antecedente sin esperar modulaciones), este override se debe declarar como regla booleana externa a la fórmula del umbral.
- Matemáticamente, a 45° con LADERA: `65 − (45 × 0.85) − 15 = 11.75 ⇒ max(12, 11.75) = 12 mm`. Por lo tanto, la fórmula por sí sola colapsa al piso de 12 mm para cualquier pendiente ≥45° en ladera.

**AMBIGÜEDAD B — lluvia_efectiva_24h vs lluvia_acumulada_24h**

- Declaración: En los datos suministrados no consta un hidrograma de escorrentía, número de curva (CN) formalizado ni coeficientes de infiltración validados por celda.
- `[SUPUESTO]` Hasta que no se entregue una tabla explícita de Curva Número (CN) indexada por `uso_suelo`, el motor asume: `lluvia_acumulada_24h ≡ lluvia_efectiva_24h`. Se marca formalmente como `[FALTA: Tabla de Curva Número / Coeficientes de Infiltración por uso_suelo]`.

**AMBIGÜEDAD C — Criterio Operativo de "Comunidad Serrana"**

- `[PROPUESTO]` Se define una localidad como comunidad serrana (`es_comunidad_serrana = true`) si cumple:
  `(altitud_msnm ≥ 1500) ∧ (relieve_tipo ∈ {'LADERA', 'LOMA'} ∨ pendiente_max_deg ≥ 20.0)`
- Justificación:
  1. En el CSV diocesano, las zonas de la Sierra Norte de Puebla (HUA, SPP, ZAC) y Sierra Alta Hidalguense (ATG, HYC, ZAH) concentran su topografía abrupta por encima de los 1500 msnm combinada con morfología de laderas/lomas o pendientes superiores al ángulo de reposo de suelos no consolidados (≥20°).
  2. Localidades en valles o mesetas altas (ej. Altiplano en PMN/PMS a 2300 msnm) quedan excluidas al no tener relieve de ladera/loma ni pendientes críticas.

**AMBIGÜEDAD D — Derivación de Factor Barlovento / Sotavento**

- `[PROPUESTO]` Derivación geométrica determinista a partir del DEM INEGI 30m:
  1. En el DEM 30m se calcula el aspecto (orientación de la pendiente en grados azimutales θ ∈ [0°, 360°]) en una ventana focal de 3×3 celdas centrada en la coordenada (lat, lon).
  2. `[EXTERNO: Circulación atmosférica regional SMN/NOAA]` Los vientos húmedos dominantes del Golfo de México ingresan en el cuadrante Noreste–Este (45° ≤ θ_viento ≤ 90°).
  3. Si la orientación de la ladera (θ_ladera) enfrenta el flujo (Δθ = |θ_ladera − 67.5°| ≤ 45°), se clasifica como BARLOVENTO (factor orográfico multiplicador > 1.0).
  4. Si Δθ > 135° (orientación Oeste/Suroeste, sombra orográfica), se clasifica como SOTAVENTO (factor < 1.0).
  5. En cualquier otro caso o pendientes planas (pendiente < 3°), se clasifica como MIXTO (factor = 1.0).

### 2.3 JSON Schema de coeficientes_regionales.json (Draft 2020-12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://caritas-tulancingo.org/schemas/coeficientes_regionales.json",
  "title": "CoeficientesRegionales",
  "type": "object",
  "required": [
    "version",
    "fecha_calculo",
    "fuente_dem",
    "fuente_era5",
    "gradiente_termico_C_por_100m",
    "factor_exposicion"
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
        "global": { "type": "number", "maximum": 0.0 },
        "por_zona": {
          "type": "object",
          "required": [
            "ACT", "APN", "ATG", "CHG", "HUA", "HYC",
            "PMN", "PMS", "SPP", "TIZ", "TUL", "XIC", "ZAC", "ZAH"
          ],
          "additionalProperties": { "type": "number", "maximum": 0.0 }
        }
      },
      "additionalProperties": false
    },
    "factor_exposicion": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["tipo", "valor", "metodo"],
        "properties": {
          "tipo": { "type": "string", "enum": ["BARLOVENTO", "SOTAVENTO", "MIXTO"] },
          "valor": { "type": "number", "minimum": 0.5, "maximum": 2.0 },
          "metodo": { "type": "string" },
          "aspecto_grados": { "type": "number", "minimum": 0, "maximum": 360 }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

### 2.4 Pseudocódigo: Gradiente Térmico Local (°C/100m) desde ERA5-Land

```
ALGORITMO CalcularGradienteTermicoLocal
ENTRADAS:
    series_era5: Colección de puntos de malla ERA5-Land (t2m en °C, geopotential_height en m)
    localidades: Colección de 405 localidades con (zona_id, altitud_msnm, lat, lon)
SALIDAS:
    gradiente_global: Número float (°C / 100m)
    gradientes_zona: Diccionario [zona_id -> float]

INICIO:
    // 1. Filtrar período estático de 5 años y calcular T media por celda ERA5
    PARA CADA celda EN series_era5:
        T_media[celda.id] = PROMEDIO(celda.temperaturas_horarias_5anos)
        Z_geo[celda.id]   = celda.altitud_geopotencial_m
    FIN PARA

    // 2. Cálculo de gradiente térmico por regresión lineal determinista
    // Modelo: T = beta_0 + (beta_1 * Z) -> Gradiente = beta_1 * 100

    // 2.1 Gradiente Global
    (beta_0_global, beta_1_global) = REGRESION_LINEAL(X = Z_geo, Y = T_media)
    gradiente_global = beta_1_global * 100.0

    // 2.2 Gradiente por cada una de las 14 ZONA_ID
    PARA CADA zona EN ["ACT", "APN", "ATG", "CHG", "HUA", "HYC", "PMN", "PMS", "SPP", "TIZ", "TUL", "XIC", "ZAC", "ZAH"]:
        celdas_zona = OBTENER_CELDAS_ERA5_INTERSECAN_POLIGONO_ZONA(zona)

        SI LONGITUD(celdas_zona) >= 3 ENTONCES:
            (beta_0_z, beta_1_z) = REGRESION_LINEAL(X = Z_geo[celdas_zona], Y = T_media[celdas_zona])
            gradientes_zona[zona] = beta_1_z * 100.0
        SINO:
            gradientes_zona[zona] = gradiente_global
        FIN SI
    FIN PARA

    RETORNAR (gradiente_global, gradientes_zona)
FIN ALGORITMO
```

### 2.5 Pseudocódigo: Factor de Exposición Barlovento/Sotavento

```
ALGORITMO CalcularFactorExposicion
ENTRADAS:
    dem_raster: Raster DEM INEGI 3.0 (30m resolución)
    localidades: Lista de 405 localidades con (id, lat, lon, pendiente_prom_deg)
    vector_viento_golfo_azimut: Constante = 67.5  // [PROPUESTO] ENE
SALIDAS:
    factores_exposicion: Diccionario [loc_id -> {tipo, valor, metodo, aspecto_grados}]

INICIO:
    PARA CADA loc EN localidades:
        ventana_dem = EXTRAER_VENTANA(dem_raster, loc.lat, loc.lon, radio_celdas = 1)

        dz_dx = ((z_NE + 2*z_E + z_SE) - (z_NW + 2*z_W + z_SW)) / (8 * 30.0)
        dz_dy = ((z_N  + 2*z_NE + z_NW) - (z_S  + 2*z_SE + z_SW)) / (8 * 30.0)

        SI dz_dx == 0 Y dz_dy == 0 ENTONCES:
            aspecto = -1.0
        SINO:
            aspecto = ATAN2_GRADOS(dz_dy, -dz_dx)
            SI aspecto < 0 ENTONCES aspecto = aspecto + 360.0
        FIN SI

        SI aspecto == -1.0 O loc.pendiente_prom_deg < 3.0 ENTONCES:
            tipo = "MIXTO"
            valor = 1.00
        SINO:
            diferencia_angular = ABS(aspecto - vector_viento_golfo_azimut)
            SI diferencia_angular > 180.0 ENTONCES
                diferencia_angular = 360.0 - diferencia_angular
            FIN SI

            SI diferencia_angular <= 45.0 ENTONCES:
                tipo = "BARLOVENTO"
                valor = 1.00 + (COS_RAD(diferencia_angular) * 0.20)
            SINO SI diferencia_angular >= 135.0 ENTONCES:
                tipo = "SOTAVENTO"
                valor = 1.00 - (COS_RAD(180.0 - diferencia_angular) * 0.15)
            SINO:
                tipo = "MIXTO"
                valor = 1.00
            FIN SI
        FIN SI

        factores_exposicion[loc.id] = {
            "tipo": tipo,
            "valor": REDONDEAR(valor, 4),
            "metodo": "Horn_3x3_vs_Golfo_67.5deg",
            "aspecto_grados": REDONDEAR(aspecto, 2)
        }
    FIN PARA

    RETORNAR factores_exposicion
FIN ALGORITMO
```

### 2.6 Especificación del Test de Validación contra ERA5-Land

**3 Puntos de Control Estratégicos**

| # | Localidad | ZONA_ID | Altitud (msnm) | relieve_tipo | Justificación |
|---|---|---|---|---|---|
| **P1** | Jopala (Puebla, LOC 1) | HUA | 652 | LADERA | Punto de baja altitud en vertiente orográfica oriental húmeda directa hacia el Golfo de México. |
| **P2** | Tulancingo (Hidalgo, LOC 1) | TUL | 2168 | MESETA | Centro de cuenca intermontana alta, representativa del régimen templado subhúmedo del Altiplano. |
| **P3** | San José Corral Blanco (Puebla, LOC 13) | CHG | 2863 | MESETA | Punto de máxima cota altitudinal de la base diocesana, control crítico para gradientes de heladas. |

**Métrica de Aceptación**

- Métrica principal: MAE (Mean Absolute Error).
- Métrica secundaria: RMSE (Root Mean Square Error) para penalizar desviaciones extremas en meses de invierno.

**Umbral Numérico**

- MAE ≤ 1.20 °C en temperatura media anual interpolada y ajustada.
- RMSE ≤ 1.60 °C en los 3 puntos de control.
- Si MAE > 1.20 °C → bandera de discrepancia orográfica y el pipeline fuerza el gradiente de precaución asimétrica.

### 2.7 Cierre (a)(b)(c)(d) de Gemini

**(a) Resumen**

1. Construcción de la tabla exhaustiva de mapeo de 31 columnas de base a motor.
2. Definición formal de las respuestas a las 4 ambigüedades técnicas.
3. Estructuración del JSON Schema (Draft 2020-12) para `coeficientes_regionales.json`.
4. Elaboración del pseudocódigo determinista para gradiente térmico regional y factor de exposición topográfica.
5. Definición del protocolo de test de validación con 3 puntos de control.

**(b) Supuestos declarados**

- `[SUPUESTO]` A falta de tablas de Curva Número (CN) o infiltración por celda, `lluvia_acumulada_24h` y `lluvia_efectiva_24h` se tratan como magnitudes idénticas.
- `[SUPUESTO]` El piso numérico de 12 mm en la fórmula de deslave opera como límite inferior universal; si se requiere override a Nivel 4 en pendientes ≥45°, debe evaluarse por regla lógica externa.

**(c) Variables o reglas propuestas**

- `[PROPUESTO]` Criterio booleano comunidad serrana: `(altitud_msnm ≥ 1500) ∧ (relieve_tipo ∈ {'LADERA', 'LOMA'} ∨ pendiente_max_deg ≥ 20.0)`.
- `[PROPUESTO]` Dirección de viento dominante del Golfo fijada en 67.5° (ENE).
- `[PROPUESTO]` Moduladores orográficos numéricos: Barlovento ∈ [1.00, 1.20], Sotavento ∈ [0.85, 1.00], Mixto/Plano = 1.00.

**(d) Preguntas abiertas**

1. ¿Confirmas la dirección azimutal de 67.5° (ENE) para los vientos del Golfo o se parametrizará dinámicamente según la estación del año?
2. Para pendientes ≥45°, ¿se formaliza una regla booleana externa que dispare Alerta Nivel 4 independientemente del valor del umbral dinámico?

---

## 3. Correcciones del auditor (mensaje 6)

```
SESIÓN 1 — APROBADA CON 6 OBSERVACIONES OBLIGATORIAS.

Tu respuesta cumple la mayoría de lo pedido. Antes de cerrar la
sesión, hay 6 correcciones y 2 respuestas a tus preguntas.

═══════════════════════════════════════════════════
OBSERVACIONES
═══════════════════════════════════════════════════

OBSERVACIÓN 1 — Rango del factor de exposición inconsistente.
Tu pseudocódigo produce valores en [0.85, 1.20] (Barlovento máx
1.20 con diferencia_angular=0°, Sotavento mín 0.85 con
diferencia_angular=180°). Pero tu JSON Schema permite [0.5, 2.0].
Corrige el JSON Schema para reflejar el rango real del pseudocódigo:
  "valor": { "type": "number", "minimum": 0.85, "maximum": 1.20 }
O justifica numéricamente por qué el schema debe ser más laxo.

OBSERVACIÓN 2 — loc_id global NO DEFINIDO.
En la tabla de mapeo pusiste LOC → loc_id como integer. Pero LOC
NO es único globalmente (cada municipio reinicia en 1). En el
pseudocódigo usas loc.id pero ese campo no existe en el CSV.
Define el formato exacto del loc_id_global. Opciones:
  A) Concatenación ent_mun_loc (ej. "Hidalgo_Actopan_1")
  B) Slug + hash corto
  C) Índice secuencial "LOC-0001" a "LOC-0405"
  D) UUID determinista: hash SHA-256 de ent_mun_loc truncado
Elige UNA, justifícala en 3 líneas, y añádela a la tabla de mapeo
con su tipo correcto.

OBSERVACIÓN 3 — Unidades crudas de ERA5-Land.
Tu pseudocódigo dice "t2m en °C, geopotential_height en m".
INCORRECTO. ERA5-Land entrega:
  - t2m en Kelvin
  - z (geopotencial) en m²/s²
Las conversiones son:
  T_celsius = t2m_kelvin − 273.15
  altitud_m = z_geopotencial / 9.80665
Corrige el pseudocódigo con las unidades crudas y las conversiones
explícitas.

OBSERVACIÓN 4 — Signo del gradiente térmico.
El gradiente debe ser NEGATIVO (típico −0.65 °C/100m, rango natural
[−0.98, −0.50]). Añade al pseudocódigo un test determinista:
  SI gradiente_global > 0 ENTONCES ERROR
Y define qué hacer si la regresión da positivo (fallback: usar
−0.65 como constante regional, registrar discrepancia en bitácora).

OBSERVACIÓN 5 — Validación de cardinalidad en factor_exposicion.
El JSON Schema de factor_exposicion no valida cardinalidad.
Añade:
  "minProperties": 405,
  "maxProperties": 405
O valida contra una lista cerrada de loc_id permitidos (extraída
de localidades_base).

OBSERVACIÓN 6 — Override para pendientes ≥45°.
Formaliza la regla booleana externa. Propuesta:
  SI pendiente_max_deg >= 45 Y saturacion_total >= 40 ENTONCES
      nivel_deslave = 4
  SINO SI pendiente_max_deg >= 45 Y lluvia_24h >= 12 ENTONCES
      nivel_deslave = 3
  FIN SI
Esto NO modifica la fórmula original. Es un guardarraíl adicional.
Ratifica o corrige.

═══════════════════════════════════════════════════
RESPUESTAS A TUS PREGUNTAS ABIERTAS
═══════════════════════════════════════════════════

RESPUESTA 1 — Dirección de viento dominante.
Se fija en 67.5° (ENE) para el preprocesamiento estático.
Justificación: el factor de exposición es un COEFICIENTE REGIONAL
PERMANENTE, no varía cada 3 horas. La variabilidad estacional del
viento se maneja en el pipeline dinámico (viento previsto en las
próximas 24h), no en el coeficiente estático.

RESPUESTA 2 — Override para pendientes ≥45°.
Sí, se formaliza como regla booleana externa (ver Observación 6).
La fórmula original max(12, 65 − pendiente×0.85 − factor_relieve)
NO se modifica.

═══════════════════════════════════════════════════
ENTREGABLE DE ESTA RESPUESTA
═══════════════════════════════════════════════════

En este orden:
1. JSON Schema corregido (Obs 1 y Obs 5).
2. Tabla de mapeo actualizada con loc_id_global (Obs 2).
3. Pseudocódigo del gradiente corregido (Obs 3 y Obs 4).
4. Regla booleana ≥45° formalizada (Obs 6).
5. Cierre final de la Sesión 1 con secciones (a)(b)(c)(d).

REGLAS:
- NO propongas agenda.
- NO escribas código real.
- Marca [SUPUESTO] y [PROPUESTO] donde corresponda.
- Si algo contradice el CSV o mi spec, DETENTE y avisa.
```

---

## 4. Respuesta final de Gemini a las correcciones

_pendiente — pendiente de pegar cuando Gemini responda_

---

## 5. Veredicto del auditor

_pendiente_

---

## 6. Lecciones aprendidas

_pendiente_

---

## 7. Archivos relacionados

- Dataset fuente: `data/raw/localidades_crudo.csv`
- Verdad base: `data/verdad_base.md`
- Schema objetivo: `schemas/coeficientes_regionales.schema.json`
- JSON objetivo: `data/coeficientes/coeficientes_regionales.json`
- System prompt vigente: `docs/prompts/system-prompt-v3.md`