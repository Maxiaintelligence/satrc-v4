-- ============================================================
-- Tabla: evaluaciones
-- Verificación diferida (§8): pronóstico D vs observación D+1.
-- Matriz de confusión: VP, FP, VN, FN.
-- Decisión: sin FOREIGN KEYs explícitas.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.evaluaciones (
    id BIGSERIAL PRIMARY KEY,
    corrida_id VARCHAR(36) NOT NULL,
    fecha_pronostico DATE NOT NULL,
    fecha_observacion DATE NOT NULL,
    loc_id_global VARCHAR(64) NOT NULL,
    zona_id VARCHAR(10) NOT NULL,
    
    -- Comparativa de variables continuas
    lluvia_pronosticada_24h_mm NUMERIC(6, 2) NOT NULL,
    lluvia_observada_satelite_mm NUMERIC(6, 2) NOT NULL,
    error_absoluto_lluvia_mm NUMERIC(6, 2) NOT NULL,
    
    temperatura_min_pronosticada_c NUMERIC(5, 2) NOT NULL,
    temperatura_min_observada_c NUMERIC(5, 2) NOT NULL,
    error_absoluto_temp_c NUMERIC(5, 2) NOT NULL,
    
    -- Comparativa de niveles de alerta
    nivel_pronosticado SMALLINT NOT NULL CHECK (nivel_pronosticado BETWEEN 1 AND 4),
    nivel_observado_real SMALLINT NOT NULL CHECK (nivel_observado_real BETWEEN 1 AND 4),
    
    -- Matriz de confusión estándar
    categoria_confusion VARCHAR(2) NOT NULL CHECK (categoria_confusion IN ('VP', 'FP', 'VN', 'FN')),
    
    fuente_observacion VARCHAR(50) DEFAULT 'CHIRPS_IMERG_COMBINED' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_evaluacion_loc_dia UNIQUE (loc_id_global, fecha_pronostico, fecha_observacion)
);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_zona_fecha ON public.evaluaciones (zona_id, fecha_pronostico DESC);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_confusion ON public.evaluaciones (categoria_confusion);
CREATE INDEX IF NOT EXISTS idx_evaluaciones_corrida ON public.evaluaciones (corrida_id);