# Verdad base del dataset SatRC v4.0

**Archivo fuente**: data/raw/localidades_crudo.csv
**Fecha de verificación**: 2026-10-06
**Fuente de verdad**: Supabase (tabla `localidades_base`)
**Estado**: VERIFICADO

---

## Conteos globales

- Total de localidades: 405
- Total de columnas: 31

---

## Conteo por entidad federativa

| nom_ent | Conteo |
|---|---|
| Hidalgo | 274 |
| Puebla | 118 |
| Veracruz de Ignacio de la Llave | 13 |
| **Total** | **405** |

---

## Conteo por zona pastoral

| zona_id | ZONA_RESGUARDO | Conteo |
|---|---|---|
| ACT | Altiplano Tula–Actopan | 67 |
| APN | Apan y Llanos Altos | 18 |
| ATG | Atotonilco–Sierra de Amajac | 16 |
| CHG | Chignahuapan | 17 |
| HUA | Huauchinango y Cuenca del Necaxa | 32 |
| HYC | Huayacocotla y Sierra de Vinazco | 13 |
| PMN | Pachuca Metropolitana Norte | 13 |
| PMS | Pachuca Metropolitana Sur | 48 |
| SPP | Sierra de Pahuatlán y Otomí-Tepehua | 43 |
| TIZ | Tizayuca y Corredor Industrial Sur | 26 |
| TUL | Valle de Tulancingo | 54 |
| XIC | Xicotepec y Cañón de San Marcos | 15 |
| ZAC | Zacatlán y Cañadas Orientales | 36 |
| ZAH | Zacualtipán y Sierra Alta Hidalguense | 7 |
| **Total** | | **405** |

---

## Filas de control

| Posición | NOM_ENT | NOM_MUN | NOM_LOC | ZONA_ID | LOC |
|---|---|---|---|---|---|
| Fila 1 | Hidalgo | Actopan | Actopan | ACT | 1 |
| Fila 203 | Hidalgo | Mineral de la Reforma | Rinconadas de San Francisco | PMS | 130 |
| Fila 405 | Hidalgo | Zacualtipán de Ángeles | Zacualtipán | ZAH | 1 |

---

## Regla de auditoría

Cualquier cifra que Gemini reporte y no coincida con Supabase → RECHAZAR. Verificar contra Supabase, no contra este documento.

**Nota**: este documento se actualizó en Sesión 4B.1 para corregir 6 conteos que estaban desactualizados desde Sesión 0 (Hidalgo, Puebla, HUA, PMS, XIC).