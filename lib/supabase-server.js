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

async function refundEntryFee(uId, mode, amount) {
    const currency = mode === 'casual' ? 'coins' : 'gems';
    try {
        const { data: p } = await supabase.from('profiles').select(currency).eq('id', uId).single();
        if (!p) {
            console.error(`[SERVER_ECONOMY] Cannot refund: profile not found for ${uId}`);
            return false;
        }
        const { error } = await supabase.from('profiles').update({ [currency]: (p[currency] || 0) + amount }).eq('id', uId);
        if (error) {
            console.error('[SERVER_ECONOMY] Refund failed:', error.message);
            return false;
        }
        return true;
    } catch (e) {
        console.error('[SERVER_ECONOMY] Refund exception:', e.message);
        return false;
    }
}

async function processEntryFeeAtomic(players, mode, stakeTier) {
    // Validar recursos de AMBOS jugadores ANTES de descontar
    const currency = mode === 'casual' ? 'coins' : 'gems';
    console.log(`[SERVER_ECONOMY] processEntryFeeAtomic - Mode: ${mode}, Stake: ${stakeTier}, Currency: ${currency}, Players: ${players.map(p => p.userId).join(', ')}`);

    const validations = await Promise.all(
        players.map(async (player) => {
            const { data: p } = await supabase.from('profiles').select(currency).eq('id', player.userId).single();
            const hasFunds = p && p[currency] >= stakeTier;
            console.log(`[SERVER_ECONOMY] Validation for ${player.userId}: ${p ? p[currency] : 'No profile'} ${currency}, Required: ${stakeTier}, HasFunds: ${hasFunds}`);
            return { player, hasFunds, currentAmount: p ? p[currency] : 0 };
        })
    );

    // Si alguno no tiene fondos, retornar false sin descontar nada
    for (const validation of validations) {
        if (!validation.hasFunds) {
            console.error(`[SERVER_ECONOMY] Player ${validation.player.userId} has insufficient funds: ${validation.currentAmount} < ${stakeTier}`);
            return { success: false, refunds: [] };
        }
    }

    console.log(`[SERVER_ECONOMY] All players have sufficient funds, proceeding with deductions...`);

    // Descontar a ambos
    const deductions = await Promise.all(
        players.map(async (player) => {
            console.log(`[SERVER_ECONOMY] Deducting ${stakeTier} ${currency} from ${player.userId}`);
            const success = await processEntryFee(player.userId, mode, stakeTier);
            console.log(`[SERVER_ECONOMY] Deduction result for ${player.userId}: ${success ? 'SUCCESS' : 'FAILED'}`);
            return { player, success };
        })
    );

    // Si alguna deducción falla, hacer rollback de las que sí se descontaron
    const failedDeductions = deductions.filter(d => !d.success);
    if (failedDeductions.length > 0) {
        console.error(`[SERVER_ECONOMY] ${failedDeductions.length} deduction(s) failed, rolling back...`);
        const successfulDeductions = deductions.filter(d => d.success);
        for (const deduction of successfulDeductions) {
            console.log(`[SERVER_ECONOMY] Rolling back deduction for ${deduction.player.userId}`);
            await refundEntryFee(deduction.player.userId, mode, stakeTier);
        }
        return { success: false, refunds: [] };
    }

    console.log(`[SERVER_ECONOMY] All deductions successful for both players`);
    return { success: true, refunds: deductions.map(d => ({ userId: d.player.userId, amount: stakeTier })) };
}

async function recordMatch(matchData) {
    console.log('[SERVER_DB] recordMatch payload:', JSON.stringify(matchData, null, 2));
    try {
        const { error } = await supabase.from('matches').insert(matchData);
        if (error) {
            console.error('[SERVER_DB] Match record error:', error.message);
            throw error;
        }
        console.log('[SERVER_DB] Match recorded successfully');
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
        const { data: existingStats } = await supabase.from('player_stats').select('user_id, matches_played, wins, rock_count, paper_count, scissors_count, opening_rock, opening_paper, opening_scissors').eq('user_id', manualFallbackData.user_id).single();

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
    refundEntryFee,
    processEntryFeeAtomic,
    recordMatch,
    incrementPlayerStats
};
