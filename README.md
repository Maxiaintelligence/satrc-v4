# SatRC v4.0 — Sistema de Alerta Temprana Arquidiocesano

Sistema autónomo de alerta temprana ante amenazas hidrometeorológicas y climáticas para las 405 localidades de la Arquidiócesis de Tulancingo (Hidalgo, Puebla y Veracruz), implementado con un motor determinista multivectorial y capa narrativa supervisada.

## Stack Técnico

- **Runtime**: Node.js 22 LTS (JavaScript ESM nativo).
- **Base de Datos**: Supabase (PostgreSQL 15+ con extensión pgcrypto).
- **Orquestación**: GitHub Actions (cron autónomo cada 3h con offset :20 UTC) + Vercel Serverless.
- **Capa Narrativa**: Groq API (llama-3.3-70b-versatile) con fallback determinista.
- **Fuentes Meteorológicas**: Open-Meteo API (ECMWF AIFS, NCEP NBM, ICON Seamless) + verificación satelital CHIRPS/IMERG.

## Estructura del Proyecto

    satrc-v4/
    ├── .github/              # Workflows de GitHub Actions (cron + keepalive)
    ├── api/                  # Endpoints serverless de Vercel (api/sara.js)
    ├── data/                 # Dataset diocesano (CSV crudo y limpio, coeficientes)
    ├── docs/                 # Documentación técnica, sesiones y prompts
    ├── schemas/              # DDLs PostgreSQL y JSON Schemas Draft 2020-12
    ├── scripts/              # Scripts de validación y ejecución local
    ├── src/
    │   ├── config/           # Constantes físicas, catálogos zonales
    │   ├── groq/             # Cliente Groq, prompts, fallback
    │   ├── logger/           # Logging estructurado con Pino
    │   ├── motor/            # Motor determinista (preprocesamiento + pipeline)
    │   ├── supabase/         # Cliente y queries
    │   └── utils/            # Hashing, interpolación, validación
    ├── tests/                # Pruebas unitarias e integración (node:test)
    ├── package.json
    └── vercel.json

## Requisitos

- Node.js 22.x LTS instalado.
- npm 10.x o superior.

## Instalación y Configuración

1. Clonar el repositorio:

       git clone https://github.com/Maxiaintelligence/satrc-v4.git
       cd satrc-v4

2. Instalar dependencias exactas:

       npm install

3. Configurar variables de entorno:

   Linux / macOS:

       cp .env.example .env.local

   Windows PowerShell:

       Copy-Item .env.example .env.local

   Windows CMD:

       copy .env.example .env.local

   Editar `.env.local` con las credenciales correspondientes.

## Scripts Disponibles

- `npm test`: Ejecuta la suite de pruebas con el test runner nativo de Node.js (`node --test`).
- `npm run lint`: Ejecuta el análisis estático con ESLint.
- `npm run validate-schemas`: Valida los schemas JSON contra el meta-schema Draft 2020-12.
- `npm run dev`: Inicia el servicio localmente con variables de entorno.
- `npm run pipeline`: Ejecuta una corrida determinista completa en local.

## Documentación de Sesiones de Diseño

El registro de decisiones y especificaciones técnicas se encuentra en:

- `docs/sesiones/sesion-01-preprocesamiento.md`: Preprocesamiento estático y coeficientes.
- `docs/sesiones/sesion-02-pipeline.md`: Pipeline determinista y memoria hídrica.
- `docs/sesiones/sesion-03-motor-groq.md`: Motor multivectorial, DDLs e integración Groq.

## Guía de Desarrollo

Para configurar el entorno local paso a paso, ver `docs/setup/development.md`.