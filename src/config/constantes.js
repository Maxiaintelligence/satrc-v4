/**
 * @file src/config/constantes.js
 * @description Catálogo inmutable de constantes físicas, umbrales de riesgo y parámetros operativos del motor SatRC v4.0.
 */

// ==============================================================================
// 1. CONSTANTES FÍSICAS Y TERMODINÁMICAS
// ==============================================================================

// [Sesión 1] Aceleración de la gravedad estándar (m/s²) para conversión geopotencial
export const G0_ESTANDAR = 9.80665;

// [Sesión 1] Cero absoluto en grados Celsius para conversión Kelvin
export const K_KELVIN = 273.15;

// [Sesión 1] Gradiente térmico vertical por defecto / fallback (°C / 100m)
export const GRADIENTE_TERMICO_FALLBACK = -0.65;

// [Sesión 1] Límite inferior de validez física para gradiente térmico (°C / 100m)
export const GRADIENTE_TERMICO_MIN = -1.50;

// [Sesión 1] Límite superior de validez física para gradiente térmico (°C / 100m)
export const GRADIENTE_TERMICO_MAX = 0.00;

// [Sesión 1] Dirección azimutal fija del flujo húmedo dominante del Golfo de México (grados ENE)
export const AZIMUT_VIENTO_GOLFO_DEG = 67.5;

// ==============================================================================
// 2. PARÁMETROS DE INGESTA Y CONSENSO
// ==============================================================================

// [Sesión 2] Horizonte total de ingesta horaria (168h historial + 24h pronóstico)
export const HORAS_HORIZONTE_INGESTA = 192;

// [Sesión 2] Cantidad de horas históricas para cálculo de memoria hídrica antecedente
export const HORAS_HISTORIAL_API = 168;

// [Sesión 2] Inicio de la ventana operativa de pronóstico activo (hora relativa)
export const VENTANA_PRONOSTICO_INICIO = 168;

// [Sesión 2] Fin de la ventana operativa de pronóstico activo (hora relativa inclusiva)
export const VENTANA_PRONOSTICO_FIN = 191;

// [Sesión 2] Descuento exponencial diario para la memoria hídrica (0.85^k)
export const FACTOR_DECAIMIENTO_API = 0.85;

// [Sesión 2] Piso precautorio de memoria hídrica ante historial incompleto (mm)
export const PISO_MEMORIA_HIDRICA_MM = 15.0;

// [Sesión 2] Umbral de discrepancia máxima con satélite CHIRPS/IMERG antes de absorción (mm)
export const UMBRAL_DISCREPANCIA_SATELITAL_MM = 20.0;

// [Sesión 2] Umbral superior de spread de precipitación para confiabilidad ALTA (mm)
export const SPREAD_ALTA_MAX_MM = 5.0;

// [Sesión 2] Umbral superior de spread de precipitación para confiabilidad MODERADA (mm)
export const SPREAD_MODERADA_MAX_MM = 15.0;

// [Sesión 2] Umbral de spread que activa el modulador precautorio (subir nivel en frontera por precaución asimétrica)
export const SPREAD_MODULADOR_FRONTERA_MM = 15.0;

// ==============================================================================
// 3. VECTOR 1: DESLAVE (MOVIMIENTOS DE LADERA)
// ==============================================================================

// [Sesión 1] Constante base en fórmula dinámica de deslave (mm)
export const DESLAVE_CONSTANTE_BASE = 65.0;

// [Sesión 1] Factor multiplicador de pendiente máxima en fórmula de deslave
export const DESLAVE_FACTOR_PENDIENTE = 0.85;

// [Sesión 1] Cota inferior universal (piso) para el umbral de deslave (mm)
export const DESLAVE_PISO_UMBRAL_MM = 12.0;

// [Sesión 1] Factor de relieve para geoforma LADERA (mm)
export const FACTOR_RELIEVE_LADERA = 15.0;

// [Sesión 1] Factor de relieve para geoforma LOMA (mm)
export const FACTOR_RELIEVE_LOMA = 8.0;

// [Sesión 1] Factor de relieve para MESETA, VALLE y LLANURA (mm)
export const FACTOR_RELIEVE_DEFAULT = 0.0;

// [Sesión 3] Factor multiplicador del umbral para disparo Nivel 4 por saturación
export const DESLAVE_FACTOR_N4 = 1.5;

// [Sesión 3] Factor multiplicador del umbral para detección Nivel 2 por saturación
export const DESLAVE_FACTOR_N2 = 0.70;

// [Sesión 3] Factor multiplicador del umbral para activación del modulador por spread
export const DESLAVE_FACTOR_MODULADOR = 0.60;

// [Sesión 1] Pendiente umbral para disparador de override crítico (grados)
export const OVERRIDE_PENDIENTE_CRITICA_DEG = 45.0;

// [Sesión 1] Saturación total para disparo a Nivel 4 en pendiente crítica (mm)
export const OVERRIDE_SATURACION_N4_MM = 40.0;

// [Sesión 1] Lluvia en 24h para disparo a Nivel 3 en pendiente crítica (mm)
export const OVERRIDE_LLUVIA_N3_MM = 12.0;

// ==============================================================================
// 4. VECTOR 2: INUNDACIÓN Y CRECIDAS REPENTINAS
// ==============================================================================

// [Sesión 1] Distancia máxima al cauce para riesgo Nivel 4 (km)
export const INUNDACION_DIST_CAUCE_N4_KM = 0.8;

// [Sesión 1] Topographic Wetness Index mínimo para riesgo Nivel 4
export const INUNDACION_TWI_N4_MIN = 12.0;

// [Sesión 1] Precipitación acumulada en 24h para riesgo Nivel 4 (mm)
export const INUNDACION_LLUVIA_N4_MM = 35.0;

// [Sesión 1] Distancia máxima al cauce para riesgo Nivel 3 (km)
export const INUNDACION_DIST_CAUCE_N3_KM = 1.5;

// [Sesión 1] Topographic Wetness Index mínimo para riesgo Nivel 3
export const INUNDACION_TWI_N3_MIN = 10.0;

// [Sesión 1] Precipitación acumulada en 24h para riesgo Nivel 3 (mm)
export const INUNDACION_LLUVIA_N3_MM = 25.0;

// [Sesión 1] Precipitación acumulada en 24h para riesgo Nivel 2 (mm)
export const INUNDACION_LLUVIA_N2_MM = 8.0;

// [Sesión 1] Saturación total antecedente para riesgo Nivel 2 (mm)
export const INUNDACION_SATURACION_N2_MM = 35.0;

// ==============================================================================
// 5. VECTOR 3: VIENTO Y RÁFAGAS
// ==============================================================================

// [Sesión 2] Ráfaga máxima para Alerta Nivel 4 (km/h)
export const VIENTO_RAFAGA_N4_KMH = 85.0;

// [Sesión 2] Viento sostenido máximo para Alerta Nivel 4 (km/h)
export const VIENTO_SOSTENIDO_N4_KMH = 65.0;

// [Sesión 2] Ráfaga máxima para Alerta Nivel 3 (km/h)
export const VIENTO_RAFAGA_N3_KMH = 65.0;

// [Sesión 2] Viento sostenido máximo para Alerta Nivel 3 (km/h)
export const VIENTO_SOSTENIDO_N3_KMH = 45.0;

// [Sesión 2] Ráfaga máxima para Alerta Nivel 2 (km/h)
export const VIENTO_RAFAGA_N2_KMH = 45.0;

// ==============================================================================
// 6. VECTOR 4: TEMPERATURA, HELADAS Y SENSACIÓN TÉRMICA (WIND CHILL)
// ==============================================================================

// [Sesión 2] Cota altitudinal para helada negra y sensación extrema en montaña (msnm)
export const TEMPERATURA_ALTITUD_ALTA_MSNM = 2100;

// [Sesión 2] Cota altitudinal para frío moderado serrano (msnm)
export const TEMPERATURA_ALTITUD_MEDIA_MSNM = 1500;

// [Sesión 2] Humedad relativa máxima para clasificar evento de Helada Negra (%)
export const HELADA_NEGRA_HUMEDAD_MAX_PCT = 60.0;

// [Sesión 2] Temperatura mínima absoluta para Alerta Nivel 4 (°C)
export const TEMPERATURA_N4_MIN_C = -3.0;

// [Sesión 2] Sensación térmica Wind Chill para Alerta Nivel 4 (°C)
export const WIND_CHILL_N4_MIN_C = -5.0;

// [Sesión 2] Temperatura mínima para Alerta Nivel 3 (°C)
export const TEMPERATURA_N3_MIN_C = 0.0;

// [Sesión 2] Sensación térmica Wind Chill para Alerta Nivel 3 (°C)
export const WIND_CHILL_N3_MIN_C = 0.0;

// [Sesión 2] Temperatura mínima para Alerta Nivel 2 (°C)
export const TEMPERATURA_N2_MIN_C = 4.0;

// [Sesión 2] Sensación térmica Wind Chill para Alerta Nivel 2 (°C)
export const WIND_CHILL_N2_MIN_C = 4.0;

// [Sesión 2] Temperatura límite superior para activar fórmula Wind Chill JAG/TI (°C)
export const WIND_CHILL_TEMP_CORTE_C = 10.0;

// [Sesión 2] Velocidad de viento mínima para fórmula Wind Chill JAG/TI (km/h)
export const WIND_CHILL_VIENTO_MIN_KMH = 4.8;

// ==============================================================================
// 7. VECTOR 5: NIEBLA OROGRÁFICA
// ==============================================================================

// [Sesión 3] Visibilidad para Niebla Nivel 4 (metros)
export const NIEBLA_VISIBILIDAD_N4_M = 100.0;

// [Sesión 3] Humedad relativa requerida para Niebla Nivel 4 (%)
export const NIEBLA_HUMEDAD_N4_MIN_PCT = 95.0;

// [Sesión 3] Visibilidad para Niebla Nivel 3 (metros)
export const NIEBLA_VISIBILIDAD_N3_M = 500.0;

// [Sesión 3] Humedad relativa requerida para Niebla Nivel 3 (%)
export const NIEBLA_HUMEDAD_N3_MIN_PCT = 90.0;

// [Sesión 3] Visibilidad para Niebla Nivel 2 (metros)
export const NIEBLA_VISIBILIDAD_N2_M = 1000.0;

// [Sesión 3] Humedad relativa requerida para Niebla Nivel 2 (%)
export const NIEBLA_HUMEDAD_N2_MIN_PCT = 85.0;

// ==============================================================================
// 8. VECTOR 6: AISLAMIENTO VIAL
// ==============================================================================

// [Sesión 3] Distancia a hospital para aislamiento Nivel 4 (km)
export const AISLAMIENTO_DIST_HOSPITAL_N4_KM = 25.0;

// [Sesión 3] Lluvia en 24h para aislamiento Nivel 4 en brecha/terracería (mm)
export const AISLAMIENTO_LLUVIA_N4_MM = 50.0;

// [Sesión 3] Distancia a hospital para aislamiento Nivel 3 (km)
export const AISLAMIENTO_DIST_HOSPITAL_N3_KM = 15.0;

// [Sesión 3] Lluvia en 24h para aislamiento Nivel 3 en brecha/terracería (mm)
export const AISLAMIENTO_LLUVIA_N3_MM = 30.0;

// [Sesión 3] Lluvia en 24h para aislamiento Nivel 2 en carretera estatal (mm)
export const AISLAMIENTO_LLUVIA_ESTATAL_N2_MM = 50.0;

// [Sesión 3] Lluvia en 24h para aislamiento Nivel 2 en terracería (mm)
export const AISLAMIENTO_LLUVIA_TERRACERIA_N2_MM = 15.0;

// ==============================================================================
// 9. GUARDARRAÍLES Y CRITERIOS TERRITORIALES
// ==============================================================================

// [Sesión 1] Altitud mínima para clasificar como comunidad serrana (msnm)
export const SERRANA_ALTITUD_MIN_MSNM = 1500;

// [Sesión 1] Pendiente máxima mínima para clasificar como comunidad serrana (grados)
export const SERRANA_PENDIENTE_MIN_DEG = 20.0;

// [Sesión 4B.5b] Ráfaga para disparo precautorio de Nivel 2 en comunidad serrana (km/h)
export const SERRANA_GUARDA_RAFAGA_KMH = 40.0;

// ==============================================================================
// 10. JERARQUÍA Y ORQUESTACIÓN OPERATIVA
// ==============================================================================

// [Sesión 3] Jerarquía fija para desempate de vector dominante
export const JERARQUIA_VECTORES = Object.freeze([
  "DESLAVE",
  "INUNDACION",
  "AISLAMIENTO_VIAL",
  "TEMPERATURA",
  "VIENTO",
  "NIEBLA"
]);

// [Sesión 3] Mapeo oficial de códigos numéricos de alerta a colores institucionales
export const MAPA_NIVELES_COLORES = Object.freeze({
  1: "VERDE",
  2: "AMARILLO",
  3: "NARANJA",
  4: "ROJO"
});

// [Sesión 4A] Timeout de petición por lote a la API de Groq (milisegundos)
export const GROQ_TIMEOUT_MS = 8000;

// [Sesión 4A] Backoff obligatorio ante respuesta HTTP 429 de Groq (milisegundos)
export const GROQ_BACKOFF_429_MS = 10000;

// [Sesión 4A] Límite máximo de reintentos por lote hacia Groq
export const GROQ_MAX_REINTENTOS = 2;

// [Sesión 2] Retención histórica en condiciones_historico (horas / 10 días)
export const RETENCION_HISTORICO_HORAS = 240;

// [Sesión 3] Retención histórica en bitacora_pronosticos (días / 90 días)
export const RETENCION_PRONOSTICOS_DIAS = 90;