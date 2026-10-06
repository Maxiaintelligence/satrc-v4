-- ============================================================
-- Tabla: bitacora
-- Eventos del sistema, admin, decisiones y calidad.
-- Frecuencia: ~30 eventos/día. Sin retención (crece lento).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bitacora (
    id BIGSERIAL PRIMARY KEY,
    timestamp_utc6 TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    categoria VARCHAR(20) NOT NULL CHECK (categoria IN (
        'SISTEMA', 'NARRATIVA', 'ADMIN', 'VERIFICACION', 'CALIDAD'
    )),
    tipo_evento VARCHAR(40) NOT NULL,
    severidad VARCHAR(10) NOT NULL CHECK (severidad IN ('info', 'warning', 'error', 'critical')),
    origen VARCHAR(20) NOT NULL CHECK (origen IN ('automatico', 'manual')),
    actor VARCHAR(100),
    motor_version VARCHAR(20),
    alcance VARCHAR(20) NOT NULL CHECK (alcance IN ('GLOBAL', 'ZONA', 'LOCALIDAD')),
    zona_id VARCHAR(10),
    loc_id_global VARCHAR(64),
    mensaje TEXT NOT NULL,
    contexto JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bitacora_timestamp ON public.bitacora (timestamp_utc6 DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_categoria ON public.bitacora (categoria, timestamp_utc6 DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_tipo ON public.bitacora (tipo_evento, timestamp_utc6 DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_severidad ON public.bitacora (severidad) WHERE severidad IN ('error', 'critical');
CREATE INDEX IF NOT EXISTS idx_bitacora_loc ON public.bitacora (loc_id_global, timestamp_utc6 DESC) WHERE loc_id_global IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bitacora_zona ON public.bitacora (zona_id, timestamp_utc6 DESC) WHERE zona_id IS NOT NULL;

-- ============================================================
-- Tabla: bitacora_pronosticos
-- Snapshot de cada corrida del pipeline por localidad.
-- Frecuencia: 405 locs x 8 corridas/dia = 3,240/dia.
-- Retencion recomendada: 90 dias activo (~290k registros ~ 60 MB).
-- Particionar cuando llegue a 5M filas.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bitacora_pronosticos (
    id BIGSERIAL PRIMARY KEY,
    corrida_id VARCHAR(36) NOT NULL,
    timestamp_corrida TIMESTAMPTZ NOT NULL,
    motor_version VARCHAR(20) NOT NULL,
    loc_id_global VARCHAR(64) NOT NULL,
    zona_id VARCHAR(10) NOT NULL,
    lluvia_24h_mm NUMERIC(7, 3) NOT NULL,
    lluvia_horaria_max_mm NUMERIC(6, 3) NOT NULL,
    hora_pico TIMESTAMPTZ,
    temperatura_min_c NUMERIC(5, 2) NOT NULL,
    temperatura_max_c NUMERIC(5, 2) NOT NULL,
    viento_max_kmh NUMERIC(6, 2) NOT NULL,
    rafaga_max_kmh NUMERIC(6, 2) NOT NULL,
    visibilidad_min_m NUMERIC(8, 1) NOT NULL,
    api_7dias_mm NUMERIC(7, 2) NOT NULL,
    saturacion_total_mm NUMERIC(7, 2) NOT NULL,
    confiabilidad VARCHAR(15) NOT NULL CHECK (confiabilidad IN ('ALTA', 'MODERADA', 'EN_DISPUTA')),
    spread_max_mm NUMERIC(6, 3) NOT NULL,
    nivel_alerta INTEGER NOT NULL CHECK (nivel_alerta BETWEEN 1 AND 4),
    color_alerta VARCHAR(10) NOT NULL,
    vector_dominante VARCHAR(20) NOT NULL,
    nivel_deslave INTEGER NOT NULL CHECK (nivel_deslave BETWEEN 1 AND 4),
    nivel_inundacion INTEGER NOT NULL CHECK (nivel_inundacion BETWEEN 1 AND 4),
    nivel_viento INTEGER NOT NULL CHECK (nivel_viento BETWEEN 1 AND 4),
    nivel_temperatura INTEGER NOT NULL CHECK (nivel_temperatura BETWEEN 1 AND 4),
    hashes_fuente JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_bitacora_prog_corrida_loc UNIQUE (corrida_id, loc_id_global)
);

CREATE INDEX IF NOT EXISTS idx_bitacora_prog_loc_time ON public.bitacora_pronosticos (loc_id_global, timestamp_corrida DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_prog_zona_time ON public.bitacora_pronosticos (zona_id, timestamp_corrida DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_prog_nivel_time ON public.bitacora_pronosticos (nivel_alerta, timestamp_corrida DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_prog_corrida ON public.bitacora_pronosticos (corrida_id);