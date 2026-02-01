require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const crypto = require('crypto');

const { supabase, processEntryFee, refundEntryFee, processEntryFeeAtomic, recordMatch, incrementPlayerStats } = require('./lib/supabase-server');
const { clerkClient, authMiddleware } = require('./lib/clerk-server');
const { determineWinner, getRankByRp } = require('./game/engine');
const { waitingPlayers, waitingRanked, createPlayer, removeFromQueue } = require('./game/matchmaker');
const { activeRooms, createRoom, findRoomById } = require('./game/roomManager');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const userSockets = new Map(); // userId -> socketId (Enforce single session)

// Helper for parsing JSON body
const getBody = (req) => new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve({}); }
    });
});

app.prepare().then(() => {
    const httpServer = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error handling request:', err);
            res.statusCode = 500;
            res.end('Internal Server Error');
        }
    });

    const io = new Server(httpServer, {
        cors: {
            origin: process.env.PRODUCTION_URL || '*',
            methods: ['GET', 'POST']
        }
    });

    io.use(authMiddleware);
    process.io = io; // Expose io for Bold Webhook access

    io.on('connection', (socket) => {
        const userId = socket.userId;
        console.log('[SERVER_INFO] Player connected:', socket.id, 'User:', userId);

        if (userSockets.has(userId)) {
            const oldSocketId = userSockets.get(userId);
            io.sockets.sockets.get(oldSocketId)?.disconnect();
            console.log('Multiple tabs detected. Disconnected old session for:', userId);
        }
        userSockets.set(userId, socket.id);

        socket.on('updateProfile', async (data) => {
            const { username, birthDate } = data;
            try {
                // Fetch existing profile to check columns
                const { data: existing } = await supabase
                    .from('profiles')
                    .select('username, coins, gems')
                    .eq('id', userId)
                    .maybeSingle();

                // WELCOME BONUS: Only if they don't have a username yet
                const isNewOnboarding = !existing || !existing.username || existing.username.trim() === '';
                console.log(`[BONUS_LOG] Checking bonus for ${userId}. Existing username: "${existing?.username || ''}", isNew: ${isNewOnboarding}`);

                let finalCoins = (existing?.coins || 0);
                let finalGems = (existing?.gems || 0);

                if (isNewOnboarding) {
                    finalCoins += 30; // ADD 30
                    console.log(`[BONUS_LOG] NEW USER DETECTED. Adding 30 coins. Total set to: ${finalCoins}`);
                }

                const { error } = await supabase
                    .from('profiles')
                    .upsert({
                        id: userId,
                        username: username,
                        birth_date: birthDate,
                        coins: finalCoins,
                        gems: finalGems,
                        updated_at: new Date().toISOString()
                    });

                if (error) {
                    console.error('[SERVER_DB] Profile update error:', error.message);
                    socket.emit('profileUpdateError', error.message);
                } else {
                    console.log(`[SERVER_DB] Profile updated for ${userId}. Coins: ${finalCoins}, Gems: ${finalGems}`);
                    socket.emit('profileUpdated', { coins: finalCoins, gems: finalGems });
                }
            } catch (err) {
                console.error('[SERVER_DB] Profile update exception:', err.message);
                socket.emit('profileUpdateError', 'Internal Error');
            }
        });

        socket.on('claimDailyReward', async () => {
            try {
                const { data: profile, error: fetchError } = await supabase
                    .from('profiles')
                    .select('coins, last_claimed_at, current_streak')
                    .eq('id', userId)
                    .single();

                let profileData = profile;

                if (fetchError || !profile) {
                    // NEW USER case: Create a default profile structure
                    profileData = {
                        coins: 0,
                        last_claimed_at: null,
                        current_streak: 0
                    };
                }

                const now = new Date();
                const lastClaimed = profileData.last_claimed_at ? new Date(profileData.last_claimed_at) : null;

                let newStreak = 1;
                let canClaim = false;

                if (!lastClaimed) {
                    canClaim = true;
                    newStreak = 1;
                } else {
                    // Reset hours/minutes for day comparison
                    const lastDate = new Date(lastClaimed.getFullYear(), lastClaimed.getMonth(), lastClaimed.getDate());
                    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const diffDays = Math.floor((nowDate - lastDate) / (1000 * 60 * 60 * 24));

                    if (diffDays === 0) {
                        socket.emit('purchaseError', 'Ya reclamaste tu recompensa hoy.');
                        return;
                    } else if (diffDays === 1) {
                        // Consecutive day
                        newStreak = (profileData.current_streak || 0) + 1;
                        if (newStreak > 7) newStreak = 1;
                        canClaim = true;
                    } else {
                        // Lost streak
                        newStreak = 1;
                        canClaim = true;
                    }
                }

                if (canClaim) {
                    const reward = newStreak * 10;
                    const newCoins = (profileData.coins || 0) + reward;
                    const claimedAt = now.toISOString();

                    const { error: updateError } = await supabase
                        .from('profiles')
                        .upsert({
                            id: userId,
                            coins: newCoins,
                            last_claimed_at: claimedAt,
                            current_streak: newStreak
                        });

                    if (updateError) {
                        socket.emit('purchaseError', 'Error al reclamar: ' + updateError.message);
                    } else {
                        socket.emit('rewardClaimed', { newCoins, streak: newStreak, claimedAt });
                    }
                }
            } catch (err) {
                console.error('[STREAK_ERROR]', err);
                socket.emit('purchaseError', 'Internal Streak Error');
            }
        });

        socket.on('purchase', async (data) => {
            const { type, amount } = data;
            // Legacy purchase logic - Keep for other gems/coins if needed via different flow
            // But for amount 10 it will be handled by claimDailyReward via frontend intercept
            try {
                const { data: profile, error: fetchError } = await supabase
                    .from('profiles')
                    .select('coins, gems')
                    .eq('id', userId)
                    .single();

                const currentAmount = profile ? (type === 'coins' ? (profile.coins || 0) : (profile.gems || 0)) : 0;
                const newValue = parseInt(currentAmount) + parseInt(amount);

                const { error: updateError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: userId,
                        [type]: newValue
                    });

                if (updateError) {
                    socket.emit('purchaseError', updateError.message);
                } else {
                    socket.emit('purchaseSuccess', { type, newValue });
                }
            } catch (err) {
                socket.emit('purchaseError', 'Internal Economy Error');
            }
        });

        socket.on('findMatch', async (data) => {
            const imageUrl = data?.imageUrl;
            const mode = data?.mode || 'casual';
            const stakeTier = data?.stakeTier || 10;

            try {
                const { data: profile, error } = await supabase.from('profiles').select('coins, gems, rp').eq('id', userId).single();
                if (error) throw error;

                let currentStake = stakeTier;
                let currentRank = null;

                if (mode === 'casual') {
                    if (profile.coins < stakeTier) return socket.emit('matchError', 'No tienes suficientes monedas.');
                } else {
                    currentRank = getRankByRp(profile.rp || 0);
                    currentStake = stakeTier;
                    if (profile.gems < currentStake) return socket.emit('matchError', `Necesitas ${currentStake} gemas.`);
                }

                if (activeRooms.has(socket.id)) {
                    const room = activeRooms.get(socket.id);
                    if (room.state === 'gameOver') {
                        const opponent = room.players.find(p => p.socketId !== socket.id);
                        if (opponent) {
                            io.to(opponent.socketId).emit('opponentLeft');
                            activeRooms.delete(opponent.socketId);
                        }
                        activeRooms.delete(socket.id);
                    }
                }

                const isWaiting = (Object.values(waitingPlayers).flat().some(p => p.userId === userId)) ||
                    (Object.values(waitingRanked).flat().some(p => p.userId === userId));
                if (isWaiting) return;

                const player = createPlayer(socket.id, userId, imageUrl);
                player.mode = mode;
                player.stakeTier = currentStake;
                player.rank = currentRank;

                const queueMap = mode === 'casual' ? waitingPlayers : waitingRanked;
                const queueKey = mode === 'casual' ? currentStake : `${currentRank}_${currentStake}`;

                if (queueMap[queueKey] && queueMap[queueKey].length > 0) {
                    const opponent = queueMap[queueKey].shift();
                    const room = createRoom(player, opponent);
                    room.mode = mode;
                    room.stakeTier = currentStake;
                    room.rank = currentRank;

                    activeRooms.set(socket.id, room);
                    activeRooms.set(opponent.socketId, room);
                    socket.join(room.id);
                    io.sockets.sockets.get(opponent.socketId)?.join(room.id);

                    const feeResult = await processEntryFeeAtomic([player, opponent], mode, currentStake);
                    if (!feeResult.success) {
                        socket.emit('matchError', 'Error al procesar la entrada. Recursos insuficientes.');
                        io.to(opponent.socketId).emit('matchError', 'Error al procesar la entrada. Recursos insuficientes.');
                        return;
                    }

                    socket.emit('matchFound', { roomId: room.id, playerIndex: 0, opponentId: opponent.userId, opponentImageUrl: opponent.imageUrl, stakeTier: currentStake, mode, rank: currentRank });
                    io.to(opponent.socketId).emit('matchFound', { roomId: room.id, playerIndex: 1, opponentId: player.userId, opponentImageUrl: player.imageUrl, stakeTier: currentStake, mode, rank: currentRank });

                    setTimeout(() => startCountdown(room.id), 1000);
                } else {
                    if (!queueMap[queueKey]) queueMap[queueKey] = [];
                    queueMap[queueKey].push(player);
                    socket.emit('waiting');
                }
            } catch (err) {
                socket.emit('matchError', 'Error al cargar perfil.');
            }
        });

        socket.on('leaveQueue', () => {
            removeFromQueue(socket.id, userId);
            const room = activeRooms.get(socket.id);
            if (room && room.state === 'gameOver') activeRooms.delete(socket.id);
            socket.emit('lobby');
        });

        socket.on('makeChoice', (choice) => {
            const room = activeRooms.get(socket.id);
            if (!room || room.state !== 'playing') return;
            const player = room.players.find(p => p.socketId === socket.id);
            if (player) {
                player.choice = choice;
                if (room.players[0].choice && room.players[1].choice) resolveRound(room);
            }
        });

        socket.on('requestRematch', () => {
            const room = activeRooms.get(socket.id);
            if (!room || room.state !== 'gameOver') return;
            room.rematchRequested = true;
            room.rematchRequestedBy = socket.id;
            const opponent = room.players.find(p => p.socketId !== socket.id);
            if (opponent) io.to(opponent.socketId).emit('rematchRequested');
        });

        socket.on('rematchResponse', async (accepted) => {
            const room = activeRooms.get(socket.id);
            if (!room || !room.rematchRequested) return;

            const requesterSocket = room.rematchRequestedBy;
            const accepterSocket = socket.id;
            const opponentSocket = room.players.find(p => p.socketId !== socket.id)?.socketId;

            if (accepted && requesterSocket && opponentSocket) {
                if (room.cleanupTimer) {
                    clearTimeout(room.cleanupTimer);
                    room.cleanupTimer = null;
                }

                const requesterPlayer = room.players.find(p => p.socketId === requesterSocket);
                const accepterPlayer = room.players.find(p => p.socketId === accepterSocket);

                if (!requesterPlayer || !accepterPlayer) {
                    console.error('[REMATCH] Could not find players for rematch');
                    return;
                }

                if (requesterPlayer.userId === accepterPlayer.userId) {
                    console.error('[REMATCH] ERROR: Requester and accepter are the same player!');
                    return;
                }

                const feeResult = await processEntryFeeAtomic([requesterPlayer, accepterPlayer], room.mode, room.stakeTier);
                if (!feeResult.success) {
                    io.to(requesterSocket).emit('matchError', 'Recursos insuficientes para la revancha.');
                    io.to(accepterSocket).emit('matchError', 'Recursos insuficientes para la revancha.');
                    activeRooms.delete(room.players[0].socketId);
                    activeRooms.delete(room.players[1].socketId);
                    return;
                }

                io.to(requesterSocket).emit('rematchAccepted');
                io.to(accepterSocket).emit('rematchAccepted');

                setTimeout(() => {
                    if (room.nextStepTimeout) {
                        clearTimeout(room.nextStepTimeout);
                        room.nextStepTimeout = null;
                    }

                    room.players.forEach(p => { p.score = 0; p.choice = null; });
                    room.round = 1;
                    room.state = 'countdown';
                    room.winner = null;
                    room.rematchRequested = false;
                    room.rematchRequestedBy = null;
                    room.stats = {
                        [room.players[0].userId]: { rock: 0, paper: 0, scissors: 0, openings: { rock: 0, paper: 0, scissors: 0 } },
                        [room.players[1].userId]: { rock: 0, paper: 0, scissors: 0, openings: { rock: 0, paper: 0, scissors: 0 } }
                    };
                    startCountdown(room.id);
                }, 2000);
            } else {
                if (requesterSocket) io.to(requesterSocket).emit('rematchDeclined');
                if (opponentSocket) io.to(opponentSocket).emit('rematchDeclined');
                setTimeout(() => {
                    activeRooms.delete(room.players[0].socketId);
                    activeRooms.delete(room.players[1].socketId);
                }, 2000);
            }
        });

        socket.on('disconnect', () => {
            if (userSockets.get(userId) === socket.id) userSockets.delete(userId);
            removeFromQueue(socket.id, userId);

            const room = activeRooms.get(socket.id);
            if (room && room.state !== 'gameOver') {
                const opponent = room.players.find(p => p.socketId !== socket.id);
                if (!opponent) return;

                const player = room.players.find(p => p.socketId === socket.id);
                player.disconnected = true;

                if (room.turnTimerInterval) { clearInterval(room.turnTimerInterval); room.turnTimerInterval = null; }
                if (room.nextStepTimeout) { clearTimeout(room.nextStepTimeout); room.nextStepTimeout = null; }

                let timeLeft = 10;
                if (opponent.socketId) io.to(opponent.socketId).emit('opponentDisconnected', { timeout: timeLeft * 1000 });

                if (room.reconnectInterval) clearInterval(room.reconnectInterval);
                room.reconnectInterval = setInterval(() => {
                    timeLeft--;
                    if (opponent.socketId) io.to(opponent.socketId).emit('opponentDisconnected', { timeout: timeLeft * 1000 });

                    if (timeLeft <= 0) {
                        clearInterval(room.reconnectInterval);
                        room.reconnectInterval = null;
                        endGame(room, opponent.userId);
                    }
                }, 1000);
            }
        });

        socket.on('checkReconnection', () => {
            for (const [key, room] of activeRooms.entries()) {
                const player = room.players.find(p => p.userId === userId);
                if (player && player.socketId !== socket.id) {
                    if (room.reconnectInterval) { clearInterval(room.reconnectInterval); room.reconnectInterval = null; }
                    player.disconnected = false;
                    const oldSocketId = player.socketId;
                    player.socketId = socket.id;
                    activeRooms.delete(oldSocketId);
                    activeRooms.set(socket.id, room);
                    if (room.rematchRequestedBy === oldSocketId) room.rematchRequestedBy = socket.id;
                    socket.join(room.id);
                    const opponent = room.players.find(p => p.userId !== userId);
                    socket.emit('reconnectSuccess', { roomState: room, state: room.state, currentRound: room.round, myScore: player.score, opScore: opponent.score, opponentId: opponent.userId, opponentImageUrl: opponent.imageUrl || null, isOpponentDisconnected: !!opponent.disconnected, turnTimer: room.turnTimer || 5 });
                    io.to(opponent.socketId).emit('opponentReconnected', { opponentImageUrl: player.imageUrl, opponentId: player.userId });
                    setTimeout(() => {
                        if (room.state === 'playing') { room.players.forEach(p => p.choice = null); startRound(room); }
                        else if (room.state === 'countdown') startCountdown(room.id);
                        else if (room.state === 'roundResult') {
                            const [p1, p2] = room.players;
                            if (p1.score >= 3 || p2.score >= 3) room.nextStepTimeout = setTimeout(() => endGame(room), 2000);
                            else { room.round++; room.nextStepTimeout = setTimeout(() => startCountdown(room.id), 2000); }
                        }
                    }, 1000);
                    return;
                }
            }
        });

        socket.on('getPlayerStats', async (targetUserId) => {
            try {
                const { data: profile } = await supabase.from('profiles').select('id, username, rank_name, total_wins, total_games').eq('id', targetUserId).single();
                const { data: stats } = await supabase.from('player_stats').select('*').eq('user_id', targetUserId).single();
                socket.emit('playerStatsData', { ...profile, ranked_stats: stats ? { matches: stats.matches_played, wins: stats.wins, rock: stats.rock_count, paper: stats.paper_count, scissors: stats.scissors_count, openings: { rock: stats.opening_rock, paper: stats.opening_paper, scissors: stats.opening_scissors } } : null });
            } catch (err) { }
        });
    });

    function startCountdown(roomId) {
        const room = findRoomById(roomId);
        if (!room) return;
        if (room.countdownInterval) { clearInterval(room.countdownInterval); room.countdownInterval = null; }
        room.state = 'countdown';
        room.countdown = 3;
        room.countdownInterval = setInterval(() => {
            io.to(room.id).emit('countdown', room.countdown);
            if (room.countdown === 0) {
                clearInterval(room.countdownInterval);
                room.countdownInterval = null;
                room.nextStepTimeout = setTimeout(() => startRound(room), 100);
            }
            room.countdown--;
        }, 1000);
    }

    function startRound(room) {
        if (!room || room.state === 'gameOver') return;
        room.state = 'playing';
        room.players.forEach(p => p.choice = null);
        room.turnTimer = 5;
        io.to(room.id).emit('roundStart', room.round);
        io.to(room.id).emit('timer', room.turnTimer);
        if (room.turnTimerInterval) clearInterval(room.turnTimerInterval);
        room.turnTimerInterval = setInterval(() => {
            room.turnTimer--;
            io.to(room.id).emit('timer', room.turnTimer);
            if (room.turnTimer <= 0) {
                clearInterval(room.turnTimerInterval);
                room.turnTimerInterval = null;
                handleRoundTimeout(room);
            }
        }, 1000);
    }

    function handleRoundTimeout(room) {
        if (!room || room.state !== 'playing' || room.players.some(p => p.disconnected)) return;
        const [p1, p2] = room.players;
        if (!p1.choice && !p2.choice) {
            room.inactivityTies = (room.inactivityTies || 0) + 1;
            if (room.inactivityTies >= 3) return refundAndEndGame(room);
            p1.choice = p2.choice = 'rock';
        } else if (p1.choice && !p2.choice) {
            p2.choice = p1.choice === 'rock' ? 'scissors' : (p1.choice === 'paper' ? 'rock' : 'paper');
            room.inactivityTies = 0;
        } else if (!p1.choice && p2.choice) {
            p1.choice = p2.choice === 'rock' ? 'scissors' : (p2.choice === 'paper' ? 'rock' : 'paper');
            room.inactivityTies = 0;
        }
        resolveRound(room);
    }

    async function refundAndEndGame(room) {
        room.state = 'gameOver';
        if (room.reconnectInterval) { clearInterval(room.reconnectInterval); room.reconnectInterval = null; }
        if (room.countdownInterval) { clearInterval(room.countdownInterval); room.countdownInterval = null; }
        if (room.turnTimerInterval) { clearInterval(room.turnTimerInterval); room.turnTimerInterval = null; }
        if (room.nextStepTimeout) { clearTimeout(room.nextStepTimeout); room.nextStepTimeout = null; }

        const currency = room.mode === 'casual' ? 'coins' : 'gems';
        const [p1, p2] = room.players;

        await Promise.all(room.players.map(async (player) => {
            const { data: p } = await supabase.from('profiles').select(currency).eq('id', player.userId).single();
            if (p) await supabase.from('profiles').update({ [currency]: (p[currency] || 0) + room.stakeTier }).eq('id', player.userId);
        }));

        const getFinalData = async (player) => {
            const { data: profile } = await supabase.from('profiles').select('coins, gems').eq('id', player.userId).single();
            return { newCoins: profile?.coins || 0, newGems: profile?.gems || 0, prize: 0, rpChange: 0, newRp: profile?.rp || 0, newRank: profile?.rank_name || 'BRONCE' };
        };

        const [p1Final, p2Final] = await Promise.all([getFinalData(p1), getFinalData(p2)]);
        room.players.forEach(p => {
            if (!p.disconnected) {
                const res = p.userId === p1.userId ? p1Final : p2Final;
                const adjustedScore = p.userId === p1.userId ? { player: p1.score, opponent: p2.score } : { player: p2.score, opponent: p1.score };
                io.to(p.socketId).emit('gameOver', { winner: 'tie', finalScore: adjustedScore, mode: room.mode, stake: room.stakeTier, inactivityRefund: true, prize: 0, rpChange: 0, ...res });
            }
        });

        await recordMatch({ player1_id: p1.userId, player2_id: p2.userId, winner_id: null, p1_score: p1.score, p2_score: p2.score, mode: room.mode, stake: room.stakeTier, created_at: new Date().toISOString() });
        room.cleanupTimer = setTimeout(() => room.players.forEach(p => { if (activeRooms.get(p.socketId) === room) activeRooms.delete(p.socketId); }), 15000);
    }

    async function resolveRound(room) {
        if (room.players.some(p => p.disconnected)) return;
        if (room.turnTimerInterval) { clearInterval(room.turnTimerInterval); room.turnTimerInterval = null; }
        const [p1, p2] = room.players;
        const result = determineWinner(p1.choice, p2.choice);
        if (result === 'player1') p1.score++; else if (result === 'player2') p2.score++;
        if (room.stats && p1.choice && p2.choice) {
            room.stats[p1.userId][p1.choice]++; room.stats[p2.userId][p2.choice]++;
            if (room.round === 1) { room.stats[p1.userId].openings[p1.choice]++; room.stats[p2.userId].openings[p2.choice]++; }
        }
        room.state = 'roundResult';
        room.players.forEach((p, idx) => {
            const opp = room.players[idx === 0 ? 1 : 0];
            io.to(p.socketId).emit('roundResult', { winner: result === 'tie' ? 'tie' : (result === `player${idx + 1}` ? 'player' : 'opponent'), playerChoice: p.choice, opponentChoice: opp.choice, playerScore: p.score, opponentScore: opp.score, round: room.round });
        });
        if (p1.score >= 3 || p2.score >= 3) room.nextStepTimeout = setTimeout(() => endGame(room), 2000);
        else { room.round++; room.nextStepTimeout = setTimeout(() => startCountdown(room.id), 2000); }
    }

    async function endGame(room, forcedWinnerId = null) {
        if (room.state === 'gameOver') return;
        room.state = 'gameOver';
        if (room.reconnectInterval) { clearInterval(room.reconnectInterval); room.reconnectInterval = null; }
        if (room.countdownInterval) { clearInterval(room.countdownInterval); room.countdownInterval = null; }
        if (room.turnTimerInterval) { clearInterval(room.turnTimerInterval); room.turnTimerInterval = null; }
        if (room.nextStepTimeout) { clearTimeout(room.nextStepTimeout); room.nextStepTimeout = null; }
        room.players.forEach(p => { if (p.reconnectTimeout) clearTimeout(p.reconnectTimeout); });

        const [p1, p2] = room.players;
        let winnerId = forcedWinnerId || (p1.score > p2.score ? p1.userId : p2.userId);
        if (p1.score === p2.score && !forcedWinnerId) winnerId = 'tie';

        const updateData = async (player, isWinner) => {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', player.userId).single();
            if (!profile) return {};
            let updates = { total_wins: isWinner ? (profile.total_wins || 0) + 1 : (profile.total_wins || 0), total_games: (profile.total_games || 0) + 1 };
            let resultData = { rpChange: 0, newRp: profile.rp, newRank: profile.rank_name, prize: 0 };
            if (room.mode === 'ranked') {
                const multiplier = room.stakeTier >= 1000 ? 10 : (room.stakeTier >= 500 ? 5 : (room.stakeTier >= 100 ? 2 : 1));
                const rpChange = isWinner ? (20 * multiplier) : -(15 * multiplier);
                updates.rp = Math.max(0, (profile.rp || 0) + rpChange);
                updates.rank_name = getRankByRp(updates.rp);
                if (isWinner) { updates.gems = (profile.gems || 0) + room.stakeTier * 2; resultData.prize = room.stakeTier * 2; }
                resultData = { ...resultData, rpChange, newRp: updates.rp, newRank: updates.rank_name };
            } else if (isWinner) {
                updates.coins = (profile.coins || 0) + room.stakeTier * 2;
                resultData.prize = room.stakeTier * 2;
            }
            const session = room.stats[player.userId];
            if (session) await incrementPlayerStats({ t_user_id: player.userId, t_is_win: isWinner ? 1 : 0, t_rock: session.rock, t_paper: session.paper, t_scissors: session.scissors, t_o_rock: session.openings.rock, t_o_paper: session.openings.paper, t_o_scissors: session.openings.scissors }, { user_id: player.userId, wins: isWinner ? 1 : 0, rock_count: session.rock, paper_count: session.paper, scissors_count: session.scissors, opening_rock: session.openings.rock, opening_paper: session.openings.paper, opening_scissors: session.openings.scissors });
            await supabase.from('profiles').update(updates).eq('id', player.userId);
            const { data: final } = await supabase.from('profiles').select('coins, gems').eq('id', player.userId).single();
            return { ...resultData, newCoins: final.coins, newGems: final.gems };
        };

        const [p1Res, p2Res] = await Promise.all([updateData(p1, winnerId === p1.userId), updateData(p2, winnerId === p2.userId)]);
        await recordMatch({ player1_id: p1.userId, player2_id: p2.userId, winner_id: winnerId === 'tie' ? null : winnerId, p1_score: p1.score, p2_score: p2.score, mode: room.mode, stake: room.stakeTier, created_at: new Date().toISOString() });
        room.players.forEach(p => {
            if (!p.disconnected) {
                const res = p.userId === p1.userId ? p1Res : p2Res;
                io.to(p.socketId).emit('gameOver', { winner: p.userId === winnerId ? 'player' : (winnerId === 'tie' ? 'tie' : 'opponent'), finalScore: { player: p.score, opponent: (room.players.find(op => op.userId !== p.userId) || { score: 0 }).score }, ...res, mode: room.mode, stake: room.stakeTier });
            }
        });
        room.cleanupTimer = setTimeout(() => room.players.forEach(p => { if (activeRooms.get(p.socketId) === room) activeRooms.delete(p.socketId); }), 15000);
    }

    httpServer.once('error', (err) => { console.error(err); process.exit(1); }).listen(port, () => { console.log(`> Ready on http://${hostname}:${port}`); });
});
