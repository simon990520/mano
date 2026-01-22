-- Create a separate table for ranked statistics to improve performance and data integrity
CREATE TABLE IF NOT EXISTS public.player_stats (
    user_id TEXT PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    matches_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    
    -- Choice counts
    rock_count INTEGER DEFAULT 0,
    paper_count INTEGER DEFAULT 0,
    scissors_count INTEGER DEFAULT 0,
    
    -- Opening counts (Round 1 moves)
    opening_rock INTEGER DEFAULT 0,
    opening_paper INTEGER DEFAULT 0,
    opening_scissors INTEGER DEFAULT 0,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public profiles are viewable by everyone" ON public.player_stats
    FOR SELECT USING (true);

-- Function to initialize stats on profile creation (Optional but recommended)
CREATE OR REPLACE FUNCTION public.handle_new_player_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.player_stats (user_id)
    VALUES (new.id::text);
    RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create stats row when a profile is created
-- DROP TRIGGER IF EXISTS on_auth_user_created_stats ON public.profiles;
-- CREATE TRIGGER on_auth_user_created_stats
--     AFTER INSERT ON public.profiles
--     FOR EACH ROW EXECUTE FUNCTION public.handle_new_player_stats();

-- Comment for clarity
COMMENT ON TABLE public.player_stats IS 'Relational table for storing detailed move tendencies and ranked performance metrics.';

-- Helper function to perform atomic increments (UPSERT style)
CREATE OR REPLACE FUNCTION public.increment_player_stats(
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
    INSERT INTO public.player_stats (
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
        matches_played = public.player_stats.matches_played + 1,
        wins = public.player_stats.wins + EXCLUDED.wins,
        rock_count = public.player_stats.rock_count + EXCLUDED.rock_count,
        paper_count = public.player_stats.paper_count + EXCLUDED.paper_count,
        scissors_count = public.player_stats.scissors_count + EXCLUDED.scissors_count,
        opening_rock = public.player_stats.opening_rock + EXCLUDED.opening_rock,
        opening_paper = public.player_stats.opening_paper + EXCLUDED.opening_paper,
        opening_scissors = public.player_stats.opening_scissors + EXCLUDED.opening_scissors,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
