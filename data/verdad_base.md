# Verdad base del dataset SatRC v4.0

**Archivo fuente**: `data/raw/localidades_crudo.csv`
**Fecha de verificación**: 2026-10-05
**Verificado por**: Auditoría cruzada (Gemini + auditor externo)

## Conteos globales

- **Total de localidades**: 405
- **Total de columnas**: 31

## Conteo por entidad federativa

| NOM_ENT | Conteo |
|---|---|
| Hidalgo | 273 |
| Puebla | 119 |
| Veracruz de Ignacio de la Llave | 13 |
| **Total** | **405** |

## Conteo por zona pastoral

| ZONA_ID | ZONA_RESGUARDO | Conteo |
|---|---|---|
| ACT | Altiplano Tula–Actopan | 67 |
| APN | Apan y Llanos Altos | 18 |
| ATG | Atotonilco–Sierra de Amajac | 16 |
| CHG | Chignahuapan | 17 |
| HUA | Huauchinango y Cuenca del Necaxa | 31 |
| HYC | Huayacocotla y Sierra de Vinazco | 13 |
| PMN | Pachuca Metropolitana Norte | 13 |
| PMS | Pachuca Metropolitana Sur | 38 |
| SPP | Sierra de Pahuatlán y Otomí-Tepehua | 43 |
| TIZ | Tizayuca y Corredor Industrial Sur | 26 |
| TUL | Valle de Tulancingo | 54 |
| XIC | Xicotepec y Cañón de San Marcos | 17 |
| ZAC | Zacatlán y Cañadas Orientales | 36 |
| ZAH | Zacualtipán y Sierra Alta Hidalguense | 7 |
| **Total** | | **405** |

## Filas de control

| Posición | NOM_ENT | NOM_MUN | NOM_LOC | ZONA_ID | LOC |
|---|---|---|---|---|---|
| Fila 1 | Hidalgo | Actopan | Actopan | ACT | 1 |
| Fila 203 | Hidalgo | Mineral de la Reforma | Rinconadas de San Francisco | PMS | 130 |
| Fila 405 | Hidalgo | Zacualtipán de Ángeles | Zacualtipán | ZAH | 1 |

## Regla de auditoría

Cualquier cifra que Gemini reporte y no coincida con este documento → RECHAZAR.