-- SQL for player_stats table
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

-- SQL for matches table
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

-- Enable RLS (Optional but recommended)
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- RPC for atomic updates
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
