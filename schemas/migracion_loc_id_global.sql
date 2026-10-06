-- ============================================================
-- Migración: localidades_base
-- Agrega loc_id_global con formato LOC_[ENT]_[MUN]_[LOC]_[HASH8]
-- Formato ENT: HGO, PUE, VER (abreviaturas INEGI)
-- Requiere: pgcrypto en schema extensions
-- ============================================================

-- 1. Habilitar pgcrypto en el schema extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Agregar columna (inicialmente NULL)
ALTER TABLE public.localidades_base 
ADD COLUMN IF NOT EXISTS loc_id_global VARCHAR(64);

-- 3. Poblar las 405 filas con formato determinista
UPDATE public.localidades_base
SET loc_id_global = 'LOC_' || 
    UPPER(CASE 
        WHEN nom_ent ILIKE 'Hidalgo%' THEN 'HGO'
        WHEN nom_ent ILIKE 'Puebla%' THEN 'PUE'
        WHEN nom_ent ILIKE 'Veracruz%' THEN 'VER'
        ELSE SUBSTRING(REGEXP_REPLACE(nom_ent, '[^a-zA-Z0-9]', '', 'g'), 1, 3)
    END) || '_' ||
    UPPER(SUBSTRING(REGEXP_REPLACE(nom_mun, '[^a-zA-Z0-9]', '', 'g'), 1, 3)) || '_' ||
    loc_id::TEXT || '_' ||
    SUBSTRING(ENCODE(extensions.digest(nom_ent || '_' || nom_mun || '_' || loc_id::TEXT, 'sha256'), 'hex'), 1, 8)
WHERE loc_id_global IS NULL;

-- 4. Aplicar NOT NULL
ALTER TABLE public.localidades_base 
ALTER COLUMN loc_id_global SET NOT NULL;

-- 5. Aplicar UNIQUE
ALTER TABLE public.localidades_base 
ADD CONSTRAINT uq_localidades_loc_id_global UNIQUE (loc_id_global);

-- 6. Índice explícito
CREATE INDEX IF NOT EXISTS idx_localidades_loc_id_global 
ON public.localidades_base (loc_id_global);