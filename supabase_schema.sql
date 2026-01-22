-- ==========================================
-- 1. NUCLEAR MIGRATION (Fixing UUID vs Clerk TEXT IDs)
-- ==========================================
DO $$ 
BEGIN
    -- A. DROP ALL POLICIES (They block column type changes)
    DROP POLICY IF EXISTS "Users can view their own matches" ON matches;
    DROP POLICY IF EXISTS "Users can view their own stats" ON player_stats;
    DROP POLICY IF EXISTS "Anyone can view leaderboard stats" ON player_stats;

    -- B. DROP FOREIGN KEYS (They block column type changes)
    -- We drop them by name if they exist in the common formats
    ALTER TABLE IF EXISTS matches DROP CONSTRAINT IF EXISTS matches_player1_id_fkey;
    ALTER TABLE IF EXISTS matches DROP CONSTRAINT IF EXISTS matches_player2_id_fkey;
    ALTER TABLE IF EXISTS matches DROP CONSTRAINT IF EXISTS matches_winner_id_fkey;
    ALTER TABLE IF EXISTS player_stats DROP CONSTRAINT IF EXISTS player_stats_user_id_fkey;

    -- C. FIX PROFILES TABLE (If it exists and is UUID)
    -- Note: Clerk IDs are strings. If profiles.id is UUID, it's incompatible.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'id' AND data_type = 'uuid') THEN
        ALTER TABLE profiles ALTER COLUMN id TYPE TEXT;
    END IF;

    -- D. FIX MATCHES TABLE
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'player1_id' AND data_type = 'uuid') THEN
        ALTER TABLE matches ALTER COLUMN player1_id TYPE TEXT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'player2_id' AND data_type = 'uuid') THEN
        ALTER TABLE matches ALTER COLUMN player2_id TYPE TEXT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'winner_id' AND data_type = 'uuid') THEN
        ALTER TABLE matches ALTER COLUMN winner_id TYPE TEXT;
    END IF;

    -- E. FIX PLAYER_STATS TABLE
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_stats' AND column_name = 'user_id' AND data_type = 'uuid') THEN
        ALTER TABLE player_stats ALTER COLUMN user_id TYPE TEXT;
    END IF;

END $$;

-- ==========================================
-- 2. TABLE DEFINITIONS (Ensure TEXT is used)
-- ==========================================
CREATE TABLE IF NOT EXISTS player_stats (
    user_id TEXT PRIMARY KEY,
    matches_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    rock_count INTEGER DEFAULT 0,
    paper_count INTEGER DEFAULT 0,
    scissors_count INTEGER DEFAULT 0,
    opening_rock INTEGER DEFAULT 0,
    opening_paper INTEGER DEFAULT 0,
    opening_scissors INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id TEXT NOT NULL,
    player2_id TEXT NOT NULL,
    winner_id TEXT,
    p1_score INTEGER DEFAULT 0,
    p2_score INTEGER DEFAULT 0,
    mode TEXT NOT NULL,
    stake INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. RE-ADD FOREIGN KEYS (Safe now as both are TEXT)
-- ==========================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        ALTER TABLE matches ADD CONSTRAINT matches_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES profiles(id);
        ALTER TABLE matches ADD CONSTRAINT matches_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES profiles(id);
        ALTER TABLE player_stats ADD CONSTRAINT player_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
    END IF;
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Could not re-add foreign keys. Ensuring profiles table is correct.';
END $$;

-- ==========================================
-- 4. RLS POLICIES (Restore)
-- ==========================================
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own matches" 
ON matches FOR SELECT 
USING (auth.uid()::text = player1_id OR auth.uid()::text = player2_id);

CREATE POLICY "Users can view their own stats" 
ON player_stats FOR SELECT 
USING (auth.uid()::text = user_id);

CREATE POLICY "Anyone can view leaderboard stats" 
ON player_stats FOR SELECT 
USING (true);

-- ==========================================
-- 5. RPC FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION increment_player_stats(
    t_user_id TEXT,
    t_is_win INTEGER,
    t_rock INTEGER,
    t_paper INTEGER,
    t_scissors INTEGER,
    t_o_rock INTEGER,
    t_o_paper INTEGER,
    t_o_scissors INTEGER
) RETURNS VOID AS $$
BEGIN
    INSERT INTO player_stats (
        user_id, matches_played, wins, 
        rock_count, paper_count, scissors_count, 
        opening_rock, opening_paper, opening_scissors
    )
    VALUES (
        t_user_id, 1, t_is_win, 
        t_rock, t_paper, t_scissors, 
        t_o_rock, t_o_paper, t_o_scissors
    )
    ON CONFLICT (user_id) DO UPDATE SET
        matches_played = player_stats.matches_played + 1,
        wins = player_stats.wins + t_is_win,
        rock_count = player_stats.rock_count + t_rock,
        paper_count = player_stats.paper_count + t_paper,
        scissors_count = player_stats.scissors_count + t_scissors,
        opening_rock = player_stats.opening_rock + t_o_rock,
        opening_paper = player_stats.opening_paper + t_o_paper,
        opening_scissors = player_stats.opening_scissors + t_o_scissors,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
