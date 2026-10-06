-- ============================================================
-- Tabla: condiciones_historico
-- Retención: 240 horas (~18 MB para 405 localidades)
-- Propósito: memoria hídrica (API 7d) + verificación diferida
-- ============================================================

CREATE TABLE IF NOT EXISTS public.condiciones_historico (
    id BIGSERIAL PRIMARY KEY,
    loc_id_global VARCHAR(64) NOT NULL,
    timestamp_utc6 TIMESTAMPTZ NOT NULL,
    lluvia_consenso_mm NUMERIC(6, 3) NOT NULL CHECK (lluvia_consenso_mm >= 0),
    temperatura_consenso_c NUMERIC(5, 2) NOT NULL,
    viento_max_kmh NUMERIC(5, 2) NOT NULL CHECK (viento_max_kmh >= 0),
    rafaga_max_kmh NUMERIC(5, 2) NOT NULL CHECK (rafaga_max_kmh >= 0),
    humedad_relativa_pct NUMERIC(4, 1) NOT NULL CHECK (humedad_relativa_pct BETWEEN 0 AND 100),
    visibilidad_m NUMERIC(6, 1) NOT NULL CHECK (visibilidad_m >= 0),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_historico_loc_hora UNIQUE (loc_id_global, timestamp_utc6)
);

-- Índice temporal para extracción acelerada de ventanas de 168h
CREATE INDEX IF NOT EXISTS idx_historico_loc_time
ON public.condiciones_historico (loc_id_global, timestamp_utc6 DESC);