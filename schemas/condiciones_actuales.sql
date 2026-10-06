-- ============================================================
-- Tabla: condiciones_actuales
-- Espejo del último snapshot por localidad (405 registros vivos).
-- Estado vigente para consumo rápido del frontend / PWA.
-- Actualización: UPSERT por loc_id_global en cada corrida.
-- Decisión: sin FOREIGN KEYs explícitas.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.condiciones_actuales (
    loc_id_global VARCHAR(64) PRIMARY KEY,
    corrida_id VARCHAR(36) NOT NULL,
    zona_id VARCHAR(10) NOT NULL,
    timestamp_utc6 TIMESTAMPTZ NOT NULL,
    motor_version VARCHAR(20) DEFAULT 'v4.0' NOT NULL,
    
    -- Resultados del estado vigente
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
    
    -- Métricas meteorológicas e hidrológicas
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
    
    -- Auditoría y narrativa con fallback validado
    hashes_fuente JSONB NOT NULL,
    dictamen_narrativo JSONB DEFAULT '{
        "titulo": "PENDIENTE",
        "causa": "Narrativa en proceso de generacion",
        "recomendaciones": [
            "Mantener comunicacion con brigada parroquial",
            "Reportar cambios en el terreno"
        ],
        "contexto": "Sistema reintentara generacion"
    }'::jsonb NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_actuales_zona_alerta ON public.condiciones_actuales (zona_id, nivel_alerta DESC);
CREATE INDEX IF NOT EXISTS idx_actuales_corrida ON public.condiciones_actuales (corrida_id);