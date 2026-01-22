require('dotenv').config();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { createClerkClient } = require('@clerk/clerk-sdk-node');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Game state
const waitingPlayers = {
    10: [],
    100: [],
    500: [],
    1000: []
};

const RANK_CONFIG = {
    'BRONCE': { min: 0, max: 100, stake: 1 },
    'PLATA': { min: 101, max: 300, stake: 2 },
    'ORO': { min: 301, max: 600, stake: 5 },
    'PLATINO': { min: 601, max: 1000, stake: 10 },
    'DIAMANTE': { min: 1001, max: 2000, stake: 25 },
    'LEYENDA': { min: 2001, max: 999999, stake: 50 }
};

const waitingRanked = {
    'BRONCE': [],
    'PLATA': [],
    'ORO': [],
    'PLATINO': [],
    'DIAMANTE': [],
    'LEYENDA': []
};
const activeRooms = new Map();
const userSockets = new Map(); // userId -> socketId (Enforce single session)

// Helper functions
function createPlayer(socketId, userId, imageUrl) {
    return {
        id: crypto.randomUUID(),
        userId,
        socketId,
        imageUrl,
        score: 0,
        choice: null,
        ready: true
    };
}

function createRoom(player1, player2) {
    const roomId = crypto.randomUUID();
    return {
        id: roomId,
        players: [player1, player2],
        round: 1,
        state: 'countdown',
        countdown: 3,
        winner: null,
        rematchRequested: false,
        rematchRequestedBy: null,
        inactivityTies: 0,
        roundTimeout: null,
        // In-memory stats accumulator
        stats: {
            [player1.userId]: { rock: 0, paper: 0, scissors: 0, openings: { rock: 0, paper: 0, scissors: 0 } },
            [player2.userId]: { rock: 0, paper: 0, scissors: 0, openings: { rock: 0, paper: 0, scissors: 0 } }
        }
    };
}

function determineWinner(choice1, choice2) {
    if (choice1 === choice2) return 'tie';
    if (
        (choice1 === 'rock' && choice2 === 'scissors') ||
        (choice1 === 'paper' && choice2 === 'rock') ||
        (choice1 === 'scissors' && choice2 === 'paper')
    ) {
        return 'player1';
    }
    return 'player2';
}

function getRankByRp(rp) {
    for (const [rank, config] of Object.entries(RANK_CONFIG)) {
        if (rp >= config.min && rp <= config.max) return rank;
    }
    return 'BRONCE';
}

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

    // Security Middleware: Validate Clerk Token
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error('Authentication error: Token missing'));

            // Use verifyToken for faster, more robust JWT verification
            // This doesn't poll Clerk's API, it verifies the signature locally
            const payload = await clerkClient.verifyToken(token);

            if (!payload) {
                console.error('[SERVER_AUTH] Token verification failed for socket:', socket.id);
                return next(new Error('Authentication error: Invalid token'));
            }

            // The userId is in the 'sub' field of the JWT
            socket.userId = payload.sub;
            console.log('[SERVER_AUTH] User authenticated via JWT:', socket.userId);
            next();
        } catch (err) {
            console.error('[SERVER_AUTH] Socket Auth Error:', err.message);
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.userId;
        console.log('[SERVER_INFO] Player connected:', socket.id, 'User:', userId);

        // Enforce Single Session
        if (userSockets.has(userId)) {
            const oldSocketId = userSockets.get(userId);
            io.sockets.sockets.get(oldSocketId)?.disconnect();
            console.log('Multiple tabs detected. Disconnected old session for:', userId);
        }
        userSockets.set(userId, socket.id);

        socket.on('updateProfile', async (data) => {
            const { username, birthDate } = data;
            console.log('[SERVER_AUTH] Updating profile for:', userId, { username, birthDate });

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
            const userId = socket.userId;
            console.log('[SERVER_ECONOMY] Purchase request:', { userId, type, amount });

            try {
                // Get current balance FIRST to ensure consistency
                const { data: profile, error: fetchError } = await supabase
                    .from('profiles')
                    .select('coins, gems')
                    .eq('id', userId)
                    .single();

                if (fetchError) {
                    console.error('[SERVER_DB] Fetch balance error:', fetchError.message);
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
                    console.error('[SERVER_DB] Update balance error:', updateError.message);
                    socket.emit('purchaseError', updateError.message);
                } else {
                    console.log(`[SERVER_ECONOMY] SUCCESS: Purchased ${amount} ${type} for ${userId}. New total: ${newValue}`);
                    socket.emit('purchaseSuccess', { type, newValue });
                }
            } catch (err) {
                console.error('[SERVER_DB] Purchase exception:', err.message);
                socket.emit('purchaseError', 'Internal Economy Error');
            }
        });

        socket.on('findMatch', async (data) => {
            const userId = socket.userId;
            const imageUrl = data?.imageUrl;
            const mode = data?.mode || 'casual';
            const stakeTier = data?.stakeTier || 10;

            console.log('[SERVER_GAME] findMatch request:', { userId, mode, stakeTier });

            // 1. Fetch Profile for validation
            let profile;
            try {
                const { data: p, error } = await supabase.from('profiles').select('coins, gems, rp').eq('id', userId).single();
                if (error) throw error;
                profile = p;
            } catch (err) {
                console.error('[SERVER_GAME] Profile fetch error:', err.message);
                socket.emit('matchError', 'Error al cargar perfil.');
                return;
            }

            // 2. Resource Validation
            let currentStake = stakeTier;
            let currentRank = null;

            if (mode === 'casual') {
                if (profile.coins < stakeTier) {
                    socket.emit('matchError', 'No tienes suficientes monedas para esta Arena.');
                    return;
                }
            } else {
                currentRank = getRankByRp(profile.rp || 0);
                // Use the stakeTier from the arena selected by the user
                currentStake = stakeTier;
                if (profile.gems < currentStake) {
                    socket.emit('matchError', `Necesitas ${currentStake} gemas para jugar en esta Arena.`);
                    return;
                }
            }

            // 3. Clear Stale Rooms
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

            // 4. Prevent duplicate queue
            const isWaiting = (Object.values(waitingPlayers).flat().some(p => p.userId === userId)) ||
                (Object.values(waitingRanked).flat().some(p => p.userId === userId));
            if (isWaiting) {
                console.warn('[SERVER_GAME] Player already in queue:', userId);
                return;
            }

            const player = createPlayer(socket.id, userId, imageUrl);
            player.mode = mode;
            player.stakeTier = currentStake;
            player.rank = currentRank;

            // 5. Matchmaking logic
            const queueMap = mode === 'casual' ? waitingPlayers : waitingRanked;
            const queueKey = mode === 'casual' ? currentStake : currentRank;

            if (queueMap[queueKey] && queueMap[queueKey].length > 0) {
                const opponent = queueMap[queueKey].shift();
                console.log(`[SERVER_GAME] MATCH FOUND: ${mode} mode (${queueKey})!`);

                const room = createRoom(player, opponent);
                room.mode = mode;
                room.stakeTier = currentStake;
                room.rank = currentRank;

                activeRooms.set(socket.id, room);
                activeRooms.set(opponent.socketId, room);
                socket.join(room.id);
                io.sockets.sockets.get(opponent.socketId)?.join(room.id);

                // DEDUCT ENTRY FEES
                const processEntryFee = async (uId, mode, amount) => {
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
                };

                const p1Deducted = await processEntryFee(player.userId, mode, currentStake);
                const p2Deducted = await processEntryFee(opponent.userId, mode, currentStake);

                if (!p1Deducted || !p2Deducted) {
                    // Logic to handle if deduction fails (e.g., someone cheated or spent coins while in queue)
                    // For now, we emit an error
                    socket.emit('matchError', 'Error al procesar la entrada.');
                    io.to(opponent.socketId).emit('matchError', 'Error al procesar la entrada.');
                    return;
                }

                // Notify both players
                socket.emit('matchFound', {
                    roomId: room.id,
                    playerIndex: 0,
                    opponentId: opponent.id,
                    opponentImageUrl: opponent.imageUrl || null,
                    stakeTier: currentStake,
                    mode: mode,
                    rank: currentRank
                });

                io.to(opponent.socketId).emit('matchFound', {
                    roomId: room.id,
                    playerIndex: 1,
                    opponentId: player.id,
                    opponentImageUrl: player.imageUrl || null,
                    stakeTier: currentStake,
                    mode: mode,
                    rank: currentRank
                });

                setTimeout(() => { startCountdown(room.id); }, 1000);
            } else {
                if (!queueMap[queueKey]) queueMap[queueKey] = [];
                queueMap[queueKey].push(player);
                console.log(`[SERVER_GAME] Added to ${mode} queue (${queueKey}). Size:`, queueMap[queueKey].length);
                socket.emit('waiting');
            }
        });

        socket.on('makeChoice', (choice) => {
            const room = activeRooms.get(socket.id);
            if (!room || room.state !== 'playing') return;

            // Find which player made the choice
            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex === -1) return;

            room.players[playerIndex].choice = choice;

            // Check if both players made their choice
            if (room.players[0].choice && room.players[1].choice) {
                resolveRound(room);
            }
        });

        socket.on('requestRematch', () => {
            const room = activeRooms.get(socket.id);
            if (!room || room.state !== 'gameOver') return;

            room.rematchRequested = true;
            room.rematchRequestedBy = socket.id;

            // Notify opponent
            const opponentSocket = room.players.find(p => p.socketId !== socket.id)?.socketId;
            if (opponentSocket) {
                io.to(opponentSocket).emit('rematchRequested');
            }
        });

        socket.on('rematchResponse', async (accepted) => {
            const room = activeRooms.get(socket.id);
            if (!room || !room.rematchRequested) return;

            const requesterSocket = room.rematchRequestedBy;
            const opponentSocket = room.players.find(p => p.socketId !== socket.id)?.socketId;

            if (accepted && requesterSocket && opponentSocket) {
                // REDEDUCT ENTRY FEES FOR REMATCH
                const mode = room.mode || 'casual';
                const currentStake = room.stakeTier || 0;

                const processEntryFee = async (uId, m, amount) => {
                    const curr = m === 'casual' ? 'coins' : 'gems';
                    try {
                        const { data: p } = await supabase.from('profiles').select(curr).eq('id', uId).single();
                        if (!p || p[curr] < amount) return false;
                        const { error } = await supabase.from('profiles').update({ [curr]: p[curr] - amount }).eq('id', uId);
                        if (error) throw error;
                        return true;
                    } catch (e) { return false; }
                };

                const p1Id = room.players[0].userId;
                const p2Id = room.players[1].userId;

                const d1 = await processEntryFee(p1Id, mode, currentStake);
                const d2 = await processEntryFee(p2Id, mode, currentStake);

                if (!d1 || !d2) {
                    io.to(requesterSocket).emit('matchError', 'Uno de los jugadores no tiene suficientes recursos para la revancha.');
                    io.to(opponentSocket).emit('matchError', 'Uno de los jugadores no tiene suficientes recursos para la revancha.');

                    // Clean up room
                    activeRooms.delete(room.players[0].socketId);
                    activeRooms.delete(room.players[1].socketId);
                    return;
                }

                // Notify both players
                // Notify both players
                io.to(requesterSocket).emit('rematchAccepted');
                io.to(opponentSocket).emit('rematchAccepted');

                // Reset room state
                setTimeout(() => {
                    room.players[0].score = 0;
                    room.players[1].score = 0;
                    room.players[0].choice = null;
                    room.players[1].choice = null;
                    room.round = 1;
                    room.state = 'countdown';
                    room.winner = null;
                    room.rematchRequested = false;
                    room.rematchRequestedBy = null;

                    // Reset in-memory stats for rematch
                    room.stats = {
                        [room.players[0].userId]: { rock: 0, paper: 0, scissors: 0, openings: { rock: 0, paper: 0, scissors: 0 } },
                        [room.players[1].userId]: { rock: 0, paper: 0, scissors: 0, openings: { rock: 0, paper: 0, scissors: 0 } }
                    };

                    startCountdown(room.id);
                }, 2000);
            } else {
                // Notify requester
                if (requesterSocket) {
                    io.to(requesterSocket).emit('rematchDeclined');
                }
                if (opponentSocket) {
                    io.to(opponentSocket).emit('rematchDeclined');
                }

                // Clean up room
                setTimeout(() => {
                    activeRooms.delete(room.players[0].socketId);
                    activeRooms.delete(room.players[1].socketId);
                }, 2000);
            }
        });


        const WAITING_TIMEOUT = 10000; // 10 seconds to reconnect

        socket.on('disconnect', () => {
            console.log('Player disconnected:', socket.id);

            // Handle session map
            if (userSockets.get(userId) === socket.id) {
                userSockets.delete(userId);
            }

            // Remove from waiting queues immediately if just queuing
            removeFromQueue(socket.id);

            // Handle active game disconnection
            const room = activeRooms.get(socket.id);
            if (room && room.state !== 'gameOver') {
                const opponent = room.players.find(p => p.socketId !== socket.id);

                // If game is already over or won, ignore
                if (!opponent) return;

                // Mark player as disconnected but don't kill room yet
                const player = room.players.find(p => p.socketId === socket.id);
                player.disconnected = true;

                // Notify opponent to start countdown
                if (opponent.socketId) {
                    io.to(opponent.socketId).emit('opponentDisconnected', { timeout: WAITING_TIMEOUT });
                }

                // Set 10s timeout to forfeit
                player.reconnectTimeout = setTimeout(() => {
                    console.log(`[SERVER_GAME] Reconnect timeout expired for ${userId}. Forfeiting.`);
                    player.disconnected = true; // Confirm
                    endGame(room, opponent.userId); // Opponent wins by default
                }, WAITING_TIMEOUT);

                // We keep the room in activeRooms map referenced by the DISCONNECTED socket ID 
                // temporarily so we can find it if they reconnect or if timeout fires.
                // However, we ideally want to map UserID -> Room to handle reconnection from NEW socket.
                // See 'handleReconnection' logic below.
            }
        });

        // NEW: Handle Reconnection Attempt (Client must emit this on mount if recovering)
        socket.on('checkReconnection', () => {
            // Logic to find if this user (userId) was in an active room
            // We can iterate activeRooms or keep a separate userId->roomId map.
            // For simplicity in this file-based refactor, we iterate.
            for (const [key, room] of activeRooms.entries()) {
                const player = room.players.find(p => p.userId === userId && p.disconnected);
                if (player) {
                    // FOUND DISCONNECTED SESSION
                    console.log(`[SERVER_GAME] User ${userId} reconnected! Restoring session...`);

                    // 1. Cancel timeout
                    clearTimeout(player.reconnectTimeout);
                    player.disconnected = false;

                    // 2. Update socket info
                    const oldSocketId = player.socketId;
                    player.socketId = socket.id;

                    // 3. Update maps
                    activeRooms.delete(oldSocketId); // Remove old key
                    activeRooms.set(socket.id, room); // Set new key

                    // 4. Re-join socket room
                    socket.join(room.id);

                    // 5. Sync State
                    socket.emit('reconnectSuccess', {
                        roomState: room,
                        currentRound: room.round,
                        myScore: player.score,
                        opScore: room.players.find(p => p.userId !== userId).score
                    });

                    // 6. Notify Opponent
                    const opponent = room.players.find(p => p.userId !== userId);
                    io.to(opponent.socketId).emit('opponentReconnected');

                    return;
                }
            }
        });

        socket.on('getPlayerStats', async (targetUserId) => {
            console.log('[SERVER_STATS] Fetching stats for:', targetUserId);
            try {
                // Fetch basic profile info
                const { data: profile, error: profileErr } = await supabase
                    .from('profiles')
                    .select('id, username, rank_name, total_wins, total_games')
                    .eq('id', targetUserId)
                    .single();

                if (profileErr) throw profileErr;

                // Fetch detailed stats from the new intermediate table
                const { data: stats, error: statsErr } = await supabase
                    .from('player_stats')
                    .select('*')
                    .eq('user_id', targetUserId)
                    .single();

                // If stats don't exist yet, return empty defaults
                const finalData = {
                    ...profile,
                    ranked_stats: stats ? {
                        matches: stats.matches_played,
                        wins: stats.wins,
                        rock: stats.rock_count,
                        paper: stats.paper_count,
                        scissors: stats.scissors_count,
                        openings: {
                            rock: stats.opening_rock,
                            paper: stats.opening_paper,
                            scissors: stats.opening_scissors
                        }
                    } : null
                };

                socket.emit('playerStatsData', finalData);
            } catch (err) {
                console.error('[SERVER_STATS] Error:', err.message);
            }
        });

        function removeFromQueue(socketId) {
            // Remove from Casual
            Object.values(waitingPlayers).forEach(queue => {
                const index = queue.findIndex(p => p.socketId === socketId);
                if (index !== -1) queue.splice(index, 1);
            });
            // Remove from Ranked
            Object.values(waitingRanked).forEach(queue => {
                const index = queue.findIndex(p => p.socketId === socketId);
                if (index !== -1) queue.splice(index, 1);
            });
        }
    });

    // Helper functions for game loop
    function startCountdown(roomId) {
        const room = findRoomById(roomId);
        if (!room) return;

        room.state = 'countdown';
        room.countdown = 3;

        const interval = setInterval(() => {
            io.to(room.id).emit('countdown', room.countdown);
            if (room.countdown === 0) {
                clearInterval(interval);
                startRound(room);
            }
            room.countdown--;
        }, 1000);
    }

    function startRound(room) {
        if (!room || room.state === 'gameOver') return;

        room.state = 'playing';
        room.players.forEach(p => p.choice = null);
        room.turnTimer = 3; // 3 seconds to choose

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
        if (!room || room.state !== 'playing') return;

        console.log(`[SERVER_GAME] Round ${room.round} timeout in room ${room.id}. Checking choices.`);

        const p1 = room.players[0];
        const p2 = room.players[1];

        if (!p1.choice && !p2.choice) {
            // Both inactive
            room.inactivityTies = (room.inactivityTies || 0) + 1;
            console.log(`[SERVER_GAME] Both players inactive. Inactivity count: ${room.inactivityTies}`);

            if (room.inactivityTies >= 3) {
                refundAndEndGame(room);
                return;
            }

            // Auto-assign rock to both for a tie round result
            p1.choice = 'rock';
            p2.choice = 'rock';
        } else if (p1.choice && !p2.choice) {
            // P1 wins by forfeit
            p2.choice = p1.choice === 'rock' ? 'scissors' : (p1.choice === 'paper' ? 'rock' : 'paper');
            room.inactivityTies = 0; // Reset as someone active
        } else if (!p1.choice && p2.choice) {
            // P2 wins by forfeit
            p1.choice = p2.choice === 'rock' ? 'scissors' : (p2.choice === 'paper' ? 'rock' : 'paper');
            room.inactivityTies = 0; // Reset
        } else {
            // Both chose, should not happen in timeout but for safety
            room.inactivityTies = 0;
        }

        resolveRound(room);
    }

    function findRoomById(roomId) {
        for (const room of activeRooms.values()) {
            if (room.id === roomId) return room;
        }
        return null;
    }

    // ... (rest of helper functions, make sure endGame is robust)

    async function refundAndEndGame(room) {
        console.log(`[SERVER_GAME] Refund and End Game for room: ${room.id}`);
        room.state = 'gameOver';
        if (room.turnTimerInterval) clearInterval(room.turnTimerInterval);

        const mode = room.mode || 'casual';
        const stake = room.stakeTier || 0;
        const currency = mode === 'casual' ? 'coins' : 'gems';

        for (const player of room.players) {
            try {
                const { data: p } = await supabase.from('profiles').select(currency).eq('id', player.userId).single();
                if (p) {
                    await supabase.from('profiles').update({ [currency]: p[currency] + stake }).eq('id', player.userId);
                    console.log(`[SERVER_ECONOMY] Refunded ${stake} ${currency} to ${player.userId}`);
                }
            } catch (e) {
                console.error(`[SERVER_ECONOMY] Refund failed for ${player.userId}:`, e.message);
            }
        }

        io.to(room.id).emit('matchError', 'Partida cancelada por inactividad. Se han devuelto las apuestas.');
        setTimeout(() => {
            room.players.forEach(p => activeRooms.delete(p.socketId));
        }, 2000);
    }

    async function resolveRound(room) {
        if (room.turnTimerInterval) {
            clearInterval(room.turnTimerInterval);
            room.turnTimerInterval = null;
        }

        const [player1, player2] = room.players;

        // Reset inactivity tiles if ANYONE manually chose (check before resolve)
        // Note: handleRoundTimeout set auto-choices, so we should check real choices if possible,
        // but handleRoundTimeout already handles resetting inactivityTies if someone chose.
        // For resolveRound called by makeChoice:
        if (player1.choice && player2.choice && room.turnTimer > 0) {
            room.inactivityTies = 0;
        }

        const result = determineWinner(player1.choice, player2.choice);

        // Update scores
        if (result === 'player1') player1.score++;
        else if (result === 'player2') player2.score++;

        // ACCUMULATE STATS
        if (room.stats && player1.choice && player2.choice) {
            room.stats[player1.userId][player1.choice]++;
            room.stats[player2.userId][player2.choice]++;
            if (room.round === 1) {
                room.stats[player1.userId].openings[player1.choice]++;
                room.stats[player2.userId].openings[player2.choice]++;
            }
        }

        room.state = 'roundResult';

        // Emit personalized results to each player
        room.players.forEach((p, idx) => {
            const oppIdx = idx === 0 ? 1 : 0;
            const opp = room.players[oppIdx];

            io.to(p.socketId).emit('roundResult', {
                winner: result === 'tie' ? 'tie' : (result === `player${idx + 1}` ? 'player' : 'opponent'),
                playerChoice: p.choice,
                opponentChoice: opp.choice,
                playerScore: p.score,
                opponentScore: opp.score,
                round: room.round
            });
        });

        // Check if game is over (First to 3)
        if (player1.score >= 3 || player2.score >= 3) {
            setTimeout(() => {
                endGame(room);
            }, 3000);
        } else {
            room.round++;
            setTimeout(() => {
                startRound(room);
            }, 4000);
        }
    }

    // ... (handleRoundTimeout - similar updates if choice fell back to rock, or skip stats for timeouts?)
    // For simplicity, we skip stats on timeout auto-picks or handle if they made a choice.

    async function endGame(room, forcedWinnerId = null) {
        if (room.state === 'gameOver') return; // Prevent double trigger
        room.state = 'gameOver';

        // Clear timeouts
        if (room.roundTimeout) clearTimeout(room.roundTimeout);
        room.players.forEach(p => { if (p.reconnectTimeout) clearTimeout(p.reconnectTimeout); });

        const [player1, player2] = room.players;

        let winnerId = forcedWinnerId;
        if (!winnerId) {
            winnerId = player1.score > player2.score ? player1.userId : player2.userId;
            if (player1.score === player2.score) winnerId = 'tie'; // Handle strict ties if needed
        }

        const isP1Winner = winnerId === player1.userId;
        const winner = isP1Winner ? 'player1' : 'player2';

        // PRE-CALCULATE UPDATES & PERSIST
        const getUpdateData = async (player, isWinner) => {
            let resultData = { rpChange: 0, newRp: 0, newRank: 'BRONCE', prize: 0, newCoins: 0, newGems: 0 };
            try {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', player.userId).single();
                if (!profile) return resultData;

                let updates = {
                    total_wins: isWinner ? (profile.total_wins || 0) + 1 : (profile.total_wins || 0),
                    total_games: (profile.total_games || 0) + 1
                };

                // HANDLE RANKED STATS & RP
                if (room.mode === 'ranked') {
                    // 1. RP Logic
                    let multiplier = 1;
                    if (room.stakeTier >= 1000) multiplier = 10;
                    else if (room.stakeTier >= 500) multiplier = 5;
                    else if (room.stakeTier >= 100) multiplier = 2;

                    const rpChange = isWinner ? (20 * multiplier) : -(15 * multiplier);
                    const newRp = Math.max(0, (profile.rp || 0) + rpChange);
                    const newRank = getRankByRp(newRp);

                    updates.rp = newRp;
                    updates.rank_name = newRank;
                    resultData.rpChange = rpChange;
                    resultData.newRp = newRp;
                    resultData.newRank = newRank;

                    if (isWinner) {
                        const prize = room.stakeTier * 2;
                        updates.gems = (profile.gems || 0) + prize;
                        resultData.prize = prize;
                    }

                    // 2. STATS AGGREGATION (Relational Table)
                    const session = room.stats[player.userId];
                    const { error: statsError } = await supabase.rpc('increment_player_stats', {
                        t_user_id: player.userId,
                        t_is_win: isWinner ? 1 : 0,
                        t_rock: session.rock || 0,
                        t_paper: session.paper || 0,
                        t_scissors: session.scissors || 0,
                        t_o_rock: session.openings.rock || 0,
                        t_o_paper: session.openings.paper || 0,
                        t_o_scissors: session.openings.scissors || 0
                    });

                    if (statsError) {
                        // Fallback to manual update if RPC is missing or fails
                        console.warn('[SERVER_STATS] RPC failed, using manual upsert');
                        const { data: existingStats } = await supabase.from('player_stats').select('*').eq('user_id', player.userId).single();

                        const newStatsRow = {
                            user_id: player.userId,
                            matches_played: (existingStats?.matches_played || 0) + 1,
                            wins: (existingStats?.wins || 0) + (isWinner ? 1 : 0),
                            rock_count: (existingStats?.rock_count || 0) + (session.rock || 0),
                            paper_count: (existingStats?.paper_count || 0) + (session.paper || 0),
                            scissors_count: (existingStats?.scissors_count || 0) + (session.scissors || 0),
                            opening_rock: (existingStats?.opening_rock || 0) + (session.openings.rock || 0),
                            opening_paper: (existingStats?.opening_paper || 0) + (session.openings.paper || 0),
                            opening_scissors: (existingStats?.opening_scissors || 0) + (session.openings.scissors || 0),
                            updated_at: new Date().toISOString()
                        };

                        await supabase.from('player_stats').upsert(newStatsRow);
                    }
                }
                // Handle Casual Mode
                else if (isWinner && room.stakeTier) {
                    const prize = room.stakeTier * 2;
                    updates.coins = (profile.coins || 0) + prize;
                    resultData.prize = prize;
                }

                await supabase.from('profiles').update(updates).eq('id', player.userId);

                // Fetch final balances
                const { data: finalProfile } = await supabase.from('profiles').select('coins, gems').eq('id', player.userId).single();
                if (finalProfile) {
                    resultData.newCoins = finalProfile.coins;
                    resultData.newGems = finalProfile.gems;
                }

                return resultData;
            } catch (e) {
                console.error('[SERVER_GAME] Profile update failed:', e.message);
                return resultData;
            }
        };

        const p1Data = await getUpdateData(player1, winner === 'player1');
        const p2Data = await getUpdateData(player2, winner === 'player2');

        // RECORD MATCH IN DB
        try {
            const { error } = await supabase.from('matches').insert({
                player1_id: player1.userId,
                player2_id: player2.userId,
                winner_id: winnerId === 'tie' ? null : winnerId,
                p1_score: player1.score,
                p2_score: player2.score,
                mode: room.mode || 'casual',
                stake: room.stakeTier || 0,
                created_at: new Date().toISOString() // Explicit timestamp
            });

            if (error) throw error;
            console.log(`[SERVER_DB] Match recorded. Winner: ${winnerId}`);
        } catch (err) {
            console.error('[SERVER_DB] Match record FAILED:', err.message);
        }

        // Emit gameOver to players (if connected)
        room.players.forEach(p => {
            if (!p.disconnected) {
                const data = p.userId === player1.userId ? p1Data : p2Data;
                const opponentData = p.userId === player1.userId ? p2Data : p1Data;
                io.to(p.socketId).emit('gameOver', {
                    winner: p.userId === winnerId ? 'player' : (winnerId === 'tie' ? 'tie' : 'opponent'),
                    finalScore: { player: p.score, opponent: room.players.find(op => op.userId !== p.userId).score },
                    rpChange: data.rpChange,
                    newRp: data.newRp,
                    newRank: data.newRank,
                    prize: data.prize,
                    mode: room.mode,
                    stake: room.stakeTier,
                    newCoins: data.newCoins,
                    newGems: data.newGems
                });
            }
        });

        // Cleanup room after delay
        setTimeout(() => {
            room.players.forEach(p => activeRooms.delete(p.socketId));
        }, 5000);
    }

    httpServer
        .once('error', (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
