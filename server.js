require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const { supabase, processEntryFee, recordMatch, incrementPlayerStats } = require('./lib/supabase-server');
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

app.prepare().then(() => {
    const httpServer = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    const io = new Server(httpServer, {
        cors: {
            origin: process.env.PRODUCTION_URL || '*',
            methods: ['GET', 'POST']
        }
    });

    io.use(authMiddleware);

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
                const { error } = await supabase
                    .from('profiles')
                    .upsert({
                        id: userId,
                        username,
                        birth_date: birthDate,
                        updated_at: new Date().toISOString()
                    });

                if (error) {
                    console.error('[SERVER_DB] Profile update error:', error.message);
                    socket.emit('profileUpdateError', error.message);
                } else {
                    socket.emit('profileUpdated');
                }
            } catch (err) {
                console.error('[SERVER_DB] Profile update exception:', err.message);
                socket.emit('profileUpdateError', 'Internal Error');
            }
        });

        socket.on('purchase', async (data) => {
            const { type, amount } = data;
            try {
                const { data: profile, error: fetchError } = await supabase
                    .from('profiles')
                    .select('coins, gems')
                    .eq('id', userId)
                    .single();

                if (fetchError) {
                    socket.emit('purchaseError', 'User profile not found');
                    return;
                }

                const currentAmount = type === 'coins' ? (profile.coins || 0) : (profile.gems || 0);
                const newValue = parseInt(currentAmount) + parseInt(amount);

                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ [type]: newValue })
                    .eq('id', userId);

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

                    if (!(await processEntryFee(player.userId, mode, currentStake)) ||
                        !(await processEntryFee(opponent.userId, mode, currentStake))) {
                        socket.emit('matchError', 'Error al procesar la entrada.');
                        io.to(opponent.socketId).emit('matchError', 'Error al procesar la entrada.');
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
            const opponentSocket = room.players.find(p => p.socketId !== socket.id)?.socketId;

            if (accepted && requesterSocket && opponentSocket) {
                // CLEAR CLEANUP TIMER IF RE-MATCHING
                if (room.cleanupTimer) {
                    clearTimeout(room.cleanupTimer);
                    room.cleanupTimer = null;
                }

                if (!(await processEntryFee(room.players[0].userId, room.mode, room.stakeTier)) ||
                    !(await processEntryFee(room.players[1].userId, room.mode, room.stakeTier))) {
                    io.to(requesterSocket).emit('matchError', 'Recursos insuficientes.');
                    io.to(opponentSocket).emit('matchError', 'Recursos insuficientes.');
                    activeRooms.delete(room.players[0].socketId);
                    activeRooms.delete(room.players[1].socketId);
                    return;
                }

                io.to(requesterSocket).emit('rematchAccepted');
                io.to(opponentSocket).emit('rematchAccepted');

                setTimeout(() => {
                    // CLEAR ANY PENDING TIMEOUTS ON REMATCH
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

        const WAITING_TIMEOUT = 10; // 10 seconds
        socket.on('disconnect', () => {
            if (userSockets.get(userId) === socket.id) userSockets.delete(userId);
            removeFromQueue(socket.id, userId);

            const room = activeRooms.get(socket.id);
            if (room && room.state !== 'gameOver') {
                const opponent = room.players.find(p => p.socketId !== socket.id);
                if (!opponent) return;

                const player = room.players.find(p => p.socketId === socket.id);
                player.disconnected = true;

                // PAUSE GAME & CLEAR NEXT STEPS
                if (room.turnTimerInterval) {
                    clearInterval(room.turnTimerInterval);
                    room.turnTimerInterval = null;
                }
                if (room.nextStepTimeout) {
                    clearTimeout(room.nextStepTimeout);
                    room.nextStepTimeout = null;
                }

                // START RECONNECT COUNTDOWN
                let timeLeft = WAITING_TIMEOUT;
                if (opponent.socketId) io.to(opponent.socketId).emit('opponentDisconnected', { timeout: timeLeft * 1000 });

                if (room.reconnectInterval) clearInterval(room.reconnectInterval);
                room.reconnectInterval = setInterval(() => {
                    timeLeft--;
                    if (opponent.socketId) io.to(opponent.socketId).emit('opponentDisconnected', { timeout: timeLeft * 1000 });

                    if (timeLeft <= 0) {
                        clearInterval(room.reconnectInterval);
                        room.reconnectInterval = null;
                        console.log(`[SERVER_GAME] Reconnect timeout for ${userId}. Forfeiting.`);
                        endGame(room, opponent.userId);
                    }
                }, 1000);
            }
        });

        socket.on('checkReconnection', () => {
            for (const [key, room] of activeRooms.entries()) {
                const player = room.players.find(p => p.userId === userId && p.disconnected);
                if (player) {
                    // STOP RECONNECT COUNTDOWN
                    if (room.reconnectInterval) {
                        clearInterval(room.reconnectInterval);
                        room.reconnectInterval = null;
                    }

                    player.disconnected = false;
                    const oldSocketId = player.socketId;
                    player.socketId = socket.id;
                    activeRooms.delete(oldSocketId);
                    activeRooms.set(socket.id, room);
                    if (room.rematchRequestedBy === oldSocketId) room.rematchRequestedBy = socket.id;
                    socket.join(room.id);
                    socket.emit('reconnectSuccess', { roomState: room, currentRound: room.round, myScore: player.score, opScore: room.players.find(p => p.userId !== userId).score });
                    const opponent = room.players.find(p => p.userId !== userId);
                    io.to(opponent.socketId).emit('opponentReconnected');

                    // RESUME GAME
                    if (room.state === 'playing') {
                        startRound(room);
                    } else if (room.state === 'countdown') {
                        startCountdown(room.id);
                    }
                    return;
                }
            }
        });

        socket.on('getPlayerStats', async (targetUserId) => {
            try {
                const { data: profile } = await supabase.from('profiles').select('id, username, rank_name, total_wins, total_games').eq('id', targetUserId).single();
                const { data: stats } = await supabase.from('player_stats').select('*').eq('user_id', targetUserId).single();
                socket.emit('playerStatsData', {
                    ...profile,
                    ranked_stats: stats ? { matches: stats.matches_played, wins: stats.wins, rock: stats.rock_count, paper: stats.paper_count, scissors: stats.scissors_count, openings: { rock: stats.opening_rock, paper: stats.opening_paper, scissors: stats.opening_scissors } } : null
                });
            } catch (err) { }
        });
    });

    function startCountdown(roomId) {
        const room = findRoomById(roomId);
        if (!room) return;

        // SANITIZE: Clear existing interval
        if (room.countdownInterval) {
            clearInterval(room.countdownInterval);
            room.countdownInterval = null;
        }

        room.state = 'countdown';
        room.countdown = 3;

        room.countdownInterval = setInterval(() => {
            io.to(room.id).emit('countdown', room.countdown);
            if (room.countdown === 0) {
                clearInterval(room.countdownInterval);
                room.countdownInterval = null;
                room.nextStepTimeout = setTimeout(() => startRound(room), 100); // Small delay to sync
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
        if (room.turnTimerInterval) clearInterval(room.turnTimerInterval);
        const currency = room.mode === 'casual' ? 'coins' : 'gems';
        for (const player of room.players) {
            const { data: p } = await supabase.from('profiles').select(currency).eq('id', player.userId).single();
            if (p) await supabase.from('profiles').update({ [currency]: p[currency] + room.stakeTier }).eq('id', player.userId);
        }
        io.to(room.id).emit('matchError', 'Cancelada por inactividad. Reembolsado.');
        setTimeout(() => room.players.forEach(p => activeRooms.delete(p.socketId)), 2000);
    }

    async function resolveRound(room) {
        if (room.players.some(p => p.disconnected)) return; // Don't resolve if someone left
        if (room.turnTimerInterval) { clearInterval(room.turnTimerInterval); room.turnTimerInterval = null; }
        const [p1, p2] = room.players;
        if (p1.choice && p2.choice && room.turnTimer > 0) room.inactivityTies = 0;
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
        if (p1.score >= 3 || p2.score >= 3) {
            room.nextStepTimeout = setTimeout(() => endGame(room), 3000);
        } else {
            room.round++;
            room.nextStepTimeout = setTimeout(() => startCountdown(room.id), 4000);
        }
    }

    async function endGame(room, forcedWinnerId = null) {
        if (room.state === 'gameOver') return;
        room.state = 'gameOver';

        // CLEAR ALL INTERVALS/TIMEOUTS
        if (room.reconnectInterval) {
            clearInterval(room.reconnectInterval);
            room.reconnectInterval = null;
        }
        if (room.countdownInterval) {
            clearInterval(room.countdownInterval);
            room.countdownInterval = null;
        }
        if (room.turnTimerInterval) {
            clearInterval(room.turnTimerInterval);
            room.turnTimerInterval = null;
        }
        if (room.nextStepTimeout) {
            clearTimeout(room.nextStepTimeout);
            room.nextStepTimeout = null;
        }

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
            if (session) {
                await incrementPlayerStats({ t_user_id: player.userId, t_is_win: isWinner ? 1 : 0, t_rock: session.rock, t_paper: session.paper, t_scissors: session.scissors, t_o_rock: session.openings.rock, t_o_paper: session.openings.paper, t_o_scissors: session.openings.scissors },
                    { user_id: player.userId, wins: isWinner ? 1 : 0, rock_count: session.rock, paper_count: session.paper, scissors_count: session.scissors, opening_rock: session.openings.rock, opening_paper: session.openings.paper, opening_scissors: session.openings.scissors });
            }
            await supabase.from('profiles').update(updates).eq('id', player.userId);
            const { data: final } = await supabase.from('profiles').select('coins, gems').eq('id', player.userId).single();
            return { ...resultData, newCoins: final.coins, newGems: final.gems };
        };

        const [p1Res, p2Res] = await Promise.all([updateData(p1, winnerId === p1.userId), updateData(p2, winnerId === p2.userId)]);

        await recordMatch({ player1_id: p1.userId, player2_id: p2.userId, winner_id: winnerId === 'tie' ? null : winnerId, p1_score: p1.score, p2_score: p2.score, mode: room.mode, stake: room.stakeTier, created_at: new Date().toISOString() });

        room.players.forEach(p => {
            if (!p.disconnected) {
                const res = p.userId === p1.userId ? p1Res : p2Res;
                io.to(p.socketId).emit('gameOver', { winner: p.userId === winnerId ? 'player' : (winnerId === 'tie' ? 'tie' : 'opponent'), finalScore: { player: p.score, opponent: room.players.find(op => op.userId !== p.userId).score }, ...res, mode: room.mode, stake: room.stakeTier });
            }
        });

        room.cleanupTimer = setTimeout(() => room.players.forEach(p => { if (activeRooms.get(p.socketId) === room) activeRooms.delete(p.socketId); }), 15000); // Store timeout ref
    }

    httpServer.once('error', (err) => { console.error(err); process.exit(1); }).listen(port, () => { console.log(`> Ready on http://${hostname}:${port}`); });
});
