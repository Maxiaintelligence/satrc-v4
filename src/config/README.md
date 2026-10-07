# Módulo: Configuración y Catálogos (src/config)

Constantes inmutables y catálogos institucionales del sistema SatRC v4.0.

## Archivos

- `constantes.js`: Umbrales de cálculo, factores de relieve, constantes físicas (g0, lapse-rate fallback).
- `zonas.js`: Mapeo oficial de las 14 zonas diocesanas de resguardo.
- `env.js`: Validación y tipado de variables de entorno del sistema.

## Principio Rector

Todos los valores son inmutables en runtime. Cambios requieren actualización de motor_version y despliegue explícito.