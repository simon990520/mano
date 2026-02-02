-- Script de Supabase para Sistema de Bot de Matchmaking
-- Versión: 1.0
-- Descripción: Configura las tablas necesarias para el sistema de bot automático

-- Tabla de configuración del bot (una sola fila, configuración global)
CREATE TABLE IF NOT EXISTS bot_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled BOOLEAN NOT NULL DEFAULT false,
    lobby_wait_seconds INTEGER NOT NULL DEFAULT 25,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de configuración de tasa de victoria por arena
CREATE TABLE IF NOT EXISTS bot_arena_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode TEXT NOT NULL, -- 'casual' o 'ranked'
    stake_tier INTEGER NOT NULL, -- 10, 50, 100, 500, 1000, etc.
    target_win_rate DECIMAL(5,2) NOT NULL DEFAULT 50.00, -- Porcentaje (ej: 50.00 = 50%)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mode, stake_tier)
);

-- Tabla de tracking de estadísticas del bot por arena
CREATE TABLE IF NOT EXISTS bot_arena_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode TEXT NOT NULL,
    stake_tier INTEGER NOT NULL,
    total_games INTEGER NOT NULL DEFAULT 0,
    total_wins INTEGER NOT NULL DEFAULT 0,
    total_losses INTEGER NOT NULL DEFAULT 0,
    current_win_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN total_games > 0 THEN (total_wins::DECIMAL / total_games::DECIMAL * 100)
            ELSE 0
        END
    ) STORED,
    last_game_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mode, stake_tier)
);

-- Insertar configuración por defecto (bot desactivado)
INSERT INTO bot_config (enabled, lobby_wait_seconds)
VALUES (false, 25)
ON CONFLICT DO NOTHING;

-- Insertar configuraciones por defecto para cada arena
-- Arenas Casual (Monedas)
INSERT INTO bot_arena_config (mode, stake_tier, target_win_rate) VALUES
    ('casual', 10, 50.00),
    ('casual', 50, 50.00),
    ('casual', 100, 50.00),
    ('casual', 500, 50.00),
    ('casual', 1000, 50.00)
ON CONFLICT (mode, stake_tier) DO NOTHING;

-- Arenas Ranked (Gemas)
INSERT INTO bot_arena_config (mode, stake_tier, target_win_rate) VALUES
    ('ranked', 10, 50.00),
    ('ranked', 50, 50.00),
    ('ranked', 100, 50.00),
    ('ranked', 500, 50.00),
    ('ranked', 1000, 50.00)
ON CONFLICT (mode, stake_tier) DO NOTHING;

-- Inicializar stats para cada arena
INSERT INTO bot_arena_stats (mode, stake_tier, total_games, total_wins, total_losses) VALUES
    ('casual', 10, 0, 0, 0),
    ('casual', 50, 0, 0, 0),
    ('casual', 100, 0, 0, 0),
    ('casual', 500, 0, 0, 0),
    ('casual', 1000, 0, 0, 0),
    ('ranked', 10, 0, 0, 0),
    ('ranked', 50, 0, 0, 0),
    ('ranked', 100, 0, 0, 0),
    ('ranked', 500, 0, 0, 0),
    ('ranked', 1000, 0, 0, 0)
ON CONFLICT (mode, stake_tier) DO NOTHING;

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bot_config_updated_at BEFORE UPDATE ON bot_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_arena_config_updated_at BEFORE UPDATE ON bot_arena_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_arena_stats_updated_at BEFORE UPDATE ON bot_arena_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Políticas de seguridad RLS (Row Level Security)
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_arena_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_arena_stats ENABLE ROW LEVEL SECURITY;

-- Permitir lectura pública (para que el servidor pueda consultar)
CREATE POLICY "Allow public read on bot_config" ON bot_config FOR SELECT USING (true);
CREATE POLICY "Allow public read on bot_arena_config" ON bot_arena_config FOR SELECT USING (true);
CREATE POLICY "Allow public read on bot_arena_stats" ON bot_arena_stats FOR SELECT USING (true);

-- IMPORTANTE: Las políticas de escritura deben configurarse según tu sistema de autenticación
-- Por ahora, permitimos escritura desde el service role (servidor)
-- Para admin dashboard, necesitarás configurar políticas basadas en roles de usuario

-- Comentario: Recuerda ejecutar este script desde el SQL Editor de Supabase
-- o usar el dashboard de Supabase para crear las tablas manualmente
