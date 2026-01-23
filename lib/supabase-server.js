const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function processEntryFee(uId, mode, amount) {
    const currency = mode === 'casual' ? 'coins' : 'gems';
    try {
        const { data: p } = await supabase.from('profiles').select(currency).eq('id', uId).single();
        if (!p || p[currency] < amount) {
            console.error(`[SERVER_ECONOMY] Insufficient funds for ${uId}: ${p ? p[currency] : 'No profile'}`);
            return false;
        }
        const { error } = await supabase.from('profiles').update({ [currency]: p[currency] - amount }).eq('id', uId);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('[SERVER_ECONOMY] Deduction failed:', e.message);
        return false;
    }
}

async function recordMatch(matchData) {
    try {
        const { error } = await supabase.from('matches').insert(matchData);
        if (error) throw error;
        return true;
    } catch (err) {
        console.error('[SERVER_DB] Match record exception:', err.message);
        return false;
    }
}

async function incrementPlayerStats(rpcData, manualFallbackData) {
    const { error: statsError } = await supabase.rpc('increment_player_stats', rpcData);

    if (statsError) {
        console.warn('[SERVER_STATS] RPC failed, using manual upsert');
        const { data: existingStats } = await supabase.from('player_stats').select('*').eq('user_id', manualFallbackData.user_id).single();

        const newStatsRow = {
            ...manualFallbackData,
            matches_played: (existingStats?.matches_played || 0) + 1,
            wins: (existingStats?.wins || 0) + manualFallbackData.wins,
            rock_count: (existingStats?.rock_count || 0) + manualFallbackData.rock_count,
            paper_count: (existingStats?.paper_count || 0) + manualFallbackData.paper_count,
            scissors_count: (existingStats?.scissors_count || 0) + manualFallbackData.scissors_count,
            opening_rock: (existingStats?.opening_rock || 0) + manualFallbackData.opening_rock,
            opening_paper: (existingStats?.opening_paper || 0) + manualFallbackData.opening_paper,
            opening_scissors: (existingStats?.opening_scissors || 0) + manualFallbackData.opening_scissors,
            updated_at: new Date().toISOString()
        };
        await supabase.from('player_stats').upsert(newStatsRow);
    }
}

module.exports = {
    supabase,
    processEntryFee,
    recordMatch,
    incrementPlayerStats
};
