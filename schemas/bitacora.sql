-- ============================================================
-- Tablas de auditoría:
--   - bitacora: eventos del sistema, admin, calidad, narrativa
--   - bitacora_pronosticos: snapshots cada 3h por localidad
-- DROP + CREATE porque las tablas preexistentes estaban vacías
-- pero con estructura incompatible.
-- Decisión arquitectónica: sin FOREIGN KEYs explícitas (evitar
-- contención transaccional en ejecuciones serverless).
-- ============================================================

-- 1. Eliminación segura (tablas vacías, sin riesgo)
DROP TABLE IF EXISTS public.bitacora_pronosticos CASCADE;
DROP TABLE IF EXISTS public.bitacora CASCADE;

-- 2. Creación bitacora
CREATE TABLE public.bitacora (
    id BIGSERIAL PRIMARY KEY,
    timestamp_utc6 TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    categoria VARCHAR(20) NOT NULL CHECK (categoria IN ('SISTEMA', 'NARRATIVA', 'ADMIN', 'VERIFICACION', 'CALIDAD')),
    tipo_evento VARCHAR(50) NOT NULL,
    severidad VARCHAR(15) NOT NULL CHECK (severidad IN ('info', 'advertencia', 'error', 'critico')),
    origen VARCHAR(20) NOT NULL CHECK (origen IN ('automatico', 'manual', 'fallback')),
    actor VARCHAR(50) DEFAULT 'SARA_PIPELINE' NOT NULL,
    motor_version VARCHAR(20) DEFAULT 'v4.0' NOT NULL,
    alcance VARCHAR(20) NOT NULL CHECK (alcance IN ('GLOBAL', 'ZONA', 'LOCALIDAD')),
    zona_id VARCHAR(10) NULL,
    loc_id_global VARCHAR(64) NULL,
    mensaje TEXT NOT NULL,
    contexto JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_bitacora_tiempo ON public.bitacora (timestamp_utc6 DESC);
CREATE INDEX idx_bitacora_categoria ON public.bitacora (categoria, severidad);
CREATE INDEX idx_bitacora_loc ON public.bitacora (loc_id_global) WHERE loc_id_global IS NOT NULL;

-- 3. Creación bitacora_pronosticos
CREATE TABLE public.bitacora_pronosticos (
    id BIGSERIAL PRIMARY KEY,
    corrida_id VARCHAR(36) NOT NULL,
    timestamp_utc6 TIMESTAMPTZ NOT NULL,
    loc_id_global VARCHAR(64) NOT NULL,
    zona_id VARCHAR(10) NOT NULL,
    motor_version VARCHAR(20) DEFAULT 'v4.0' NOT NULL,
    
    -- Resultados de la envolvente y vector dominante
    nivel_alerta SMALLINT NOT NULL CHECK (nivel_alerta BETWEEN 1 AND 4),
    color_alerta VARCHAR(10) NOT NULL CHECK (color_alerta IN ('VERDE', 'AMARILLO', 'NARANJA', 'ROJO')),
    vector_dominante VARCHAR(30) NOT NULL CHECK (vector_dominante IN (
        'DESLAVE', 'INUNDACION', 'VIENTO', 'TEMPERATURA', 'NIEBLA', 'AISLAMIENTO_VIAL', 'COMBINADO_CASCADA'
    )),
    
    -- Desglose vectorial (1..4)
    nivel_deslave SMALLINT NOT NULL CHECK (nivel_deslave BETWEEN 1 AND 4),
    nivel_inundacion SMALLINT NOT NULL CHECK (nivel_inundacion BETWEEN 1 AND 4),
    nivel_viento SMALLINT NOT NULL CHECK (nivel_viento BETWEEN 1 AND 4),
    nivel_temperatura SMALLINT NOT NULL CHECK (nivel_temperatura BETWEEN 1 AND 4),
    nivel_niebla SMALLINT NOT NULL CHECK (nivel_niebla BETWEEN 1 AND 4),
    nivel_aislamiento SMALLINT NOT NULL CHECK (nivel_aislamiento BETWEEN 1 AND 4),
    
    -- Métricas clave de la ventana 24h
    lluvia_acumulada_24h_mm NUMERIC(6, 2) NOT NULL,
    lluvia_horaria_max_mm NUMERIC(6, 2) NOT NULL,
    hora_pico TIMESTAMPTZ NOT NULL,
    temperatura_min_c NUMERIC(5, 2) NOT NULL,
    temperatura_max_c NUMERIC(5, 2) NOT NULL,
    viento_max_kmh NUMERIC(5, 2) NOT NULL,
    rafaga_max_kmh NUMERIC(5, 2) NOT NULL,
    visibilidad_min_m NUMERIC(6, 1) NOT NULL,
    api_7dias_mm NUMERIC(6, 2) NOT NULL,
    saturacion_total_mm NUMERIC(6, 2) NOT NULL,
    umbral_deslave_mm NUMERIC(6, 2) NOT NULL,
    spread_max_mm NUMERIC(6, 2) NOT NULL,
    
    -- Auditoría y narrativa
    hashes_fuente JSONB NOT NULL,
    dictamen_narrativo JSONB NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    CONSTRAINT uq_pronostico_corrida_loc UNIQUE (corrida_id, loc_id_global)
);

CREATE INDEX idx_pronosticos_corrida ON public.bitacora_pronosticos (corrida_id);
CREATE INDEX idx_pronosticos_loc_fecha ON public.bitacora_pronosticos (loc_id_global, timestamp_utc6 DESC);
CREATE INDEX idx_pronosticos_alerta ON public.bitacora_pronosticos (nivel_alerta, timestamp_utc6 DESC);