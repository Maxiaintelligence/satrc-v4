# Guía de Entorno de Desarrollo (SatRC v4.0)

Esta guía detalla el procedimiento para configurar un entorno local de desarrollo homogéneo y reproducible.

## 1. Clonación del Repositorio

    git clone https://github.com/Maxiaintelligence/satrc-v4.git
    cd satrc-v4

## 2. Instalación de Node.js 22 LTS

Se requiere Node.js 22 LTS. Si utilizas nvm (Node Version Manager):

    nvm install 22
    nvm use 22
    node -v    # Debe mostrar v22.x.x

## 3. Instalación de Dependencias

Instalar las dependencias fijas del proyecto:

    npm install

## 4. Configuración del Archivo .env.local

Copia la plantilla `.env.example` a `.env.local`:

Linux / macOS / Bash:

    cp .env.example .env.local

Windows (PowerShell):

    Copy-Item .env.example .env.local

Windows (CMD):

    copy .env.example .env.local

### Obtención de Credenciales

**Supabase:**

1. Ingresa al dashboard de tu proyecto Supabase (satrc-v4).
2. Navega a Project Settings -> API.
3. Copia la Project URL en `SUPABASE_URL`.
4. Copia la clave anon / public en `SUPABASE_ANON_KEY`.
5. Copia la clave service_role (secreta) en `SUPABASE_SERVICE_ROLE_KEY`.

**Groq API:**

1. Ingresa a Groq Console.
2. Genera una nueva API Key y asígnala a `GROQ_API_KEY`.
3. Verifica que `GROQ_MODEL` sea `llama-3.3-70b-versatile`.

**Cron Secret:**

Define una cadena aleatoria segura en `CRON_SECRET` para autorizar peticiones al endpoint `/api/sara`.

## 5. Validación de Schemas JSON

Para comprobar que los esquemas JSON cumplen con el estándar Draft 2020-12:

    npm run validate-schemas

## 6. Ejecución de Pruebas Unitarias

    npm test

## 7. Ejecución Local del Pipeline

Para disparar una ejecución determinista completa en tu entorno local leyendo desde Supabase y Open-Meteo:

    npm run pipeline

## 8. Troubleshooting Común

| Problema | Causa Probable | Solución |
|---|---|---|
| ERR_INVALID_MODULE_SPECIFIER | Importación sin extensión `.js` | En ESM nativo todas las importaciones locales deben terminar en `.js` (ej. `./utils/crypto.js`). |
| Supabase Error: JWT expired / invalid | `SUPABASE_SERVICE_ROLE_KEY` incorrecta | Revisa que no hayas invertido la `anon_key` con la `service_role_key` en `.env.local`. |
| Groq Error 401 Unauthorized | API Key de Groq inválida | Genera una nueva key en console.groq.com y actualiza `.env.local`. |
| Ajv: schema is invalid | Incompatibilidad con Draft 2020-12 | Asegura instanciar Ajv con `new Ajv2020()` desde `ajv/dist/2020.js`. |

## 9. Riesgos Aceptados de Dependencias (npm audit)

**Fecha de auditoría**: 2026-10-06
**Comando ejecutado**: `npm audit`
**Resultado**: 5 vulnerabilidades (4 low, 1 moderate)

| Paquete | Severidad | GHSA | Decisión |
|---|---|---|---|
| @eslint/plugin-kit | LOW | GHSA-xffm-g5w8-qvg7 | Aceptado |
| @supabase/auth-js | LOW | GHSA-8r88-6cj9-9fh5 | Aceptado |
| ajv | MODERATE | GHSA-2g4f-4pwh-qvx6 | Aceptado |
| eslint (transitiva) | LOW | Misma que plugin-kit | Aceptado |
| @eslint/plugin-kit (transitiva) | LOW | Misma que plugin-kit | Aceptado |

**Justificación de la aceptación**:

1. Las 2 vulnerabilidades LOW de @eslint/plugin-kit y eslint afectan solo la **devDependency** de linting. No corren en producción.
2. La vulnerabilidad LOW de @supabase/auth-js solo se explota al pasar UUIDs malformados a métodos de auth de usuarios finales. SatRC no usa autenticación de usuarios vía Supabase Auth.
3. La vulnerabilidad MODERATE de ajv solo se explota si se activa la opción `$data: true` en la compilación de schemas. SatRC no usa `$data`.

**Ninguna de las 5 vulnerabilidades es explotable en la arquitectura de SatRC v4.0.**

**Fix disponible**: `npm audit fix --force` forzaría saltos a versiones mayores (eslint 9.39.5, @supabase/supabase-js 2.117.2, ajv 8.20.0) fuera del rango declarado. Esto rompería la compatibilidad con los tests y el motor. No se aplica.

**Re-auditoría programada**: cada vez que se actualice alguna dependencia del `package.json`.