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
const { getBotChoice, createBotProfile } = require('./lib/bot-engine');

// MVC MODULES
const { isAdmin, sanitizeInput, validatePhoneNumber, ALLOWED_STAKES } = require('./server/utils/security');
const { botConfig, appSettings, botArenaConfigs, botArenaStats, bonusClaimLock, updateBotConfig, updateAppSettings, updateBotArenaConfigs, updateBotArenaStats } = require('./server/utils/constants');
const { connectToWhatsApp, getStatus, getQr } = require('./server/services/whatsappService');
const { handleIncomingWaMessage, sendWelcomeMessage, registerWhatsappHandlers } = require('./server/controllers/whatsappController');

// WhatsApp Bot Dependencies loaded in service module

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

// Rate Limiting Maps
// Rate Limiting Maps
const rateLimits = new Map();
const dailyRewardCooldowns = new Map(); // Fix: Define this map
// bonusClaimLock and roomRefundLock are imported from constants
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const userSockets = new Map(); // userId -> socketId (Enforce single session)


// Admin whitelist from .env
// Admin whitelist from .env
const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim());
// isAdmin imported from security utils

// ALLOWED_STAKES imported from security/constants

// dailyRewardCooldowns imported from constants

// sanitizeInput imported from security utils

// bonusClaimLock imported from constants

// HUMANIZATION & ANTI-DETECTION
const messageHistory = new Map(); // Track message patterns
const lastMessageTime = new Map(); // Anti-spam

// Humanization: Random delay between min and max (in milliseconds)
function getHumanDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Simulate typing indicator duration based on message length
function getTypingDuration(messageLength) {
    // Average typing speed: 40-60 chars per second
    const baseSpeed = 45 + Math.random() * 15; // 45-60 cps
    const duration = (messageLength / baseSpeed) * 1000;
    // Add random pause (thinking time)
    const thinkingTime = Math.random() * 2000; // 0-2s
    return Math.min(duration + thinkingTime, 10000); // Max 10s
}

// Humanization functions imported from utils
// waGroups imported from service


// Helper for parsing JSON body
const getBody = (req) => new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve({}); }
    });
});

// Cargar configuración global (App Settings)
async function loadAppSettings() {
    try {
        const { data: settings } = await supabase.from('app_settings').select('*');
        if (settings) {
            settings.forEach(s => {
                if (appSettings.hasOwnProperty(s.key)) {
                    appSettings[s.key] = s.value;
                }
            });
            console.log('[APP_SETTINGS] Loaded:', appSettings);
        }
    } catch (error) {
        console.error('[APP_SETTINGS] Error loading:', error.message);
    }
}

// Cargar configuración del bot desde Supabase
async function loadBotConfig() {
    try {
        await loadAppSettings(); // Load global settings first

        // Cargar configuración global
        const { data: config } = await supabase.from('bot_config').select('*').limit(1).single();
        if (config) {
            Object.assign(botConfig, config);
            console.log('[BOT_SYSTEM] Configuration loaded:', botConfig);
        }

        // Cargar configuración por arena
        const { data: arenaConfigs } = await supabase.from('bot_arena_config').select('*');
        if (arenaConfigs) {
            botArenaConfigs.length = 0;
            botArenaConfigs.push(...arenaConfigs);
            console.log(`[BOT_SYSTEM] Loaded ${arenaConfigs.length} arena configurations`);
        }

        // Cargar estadísticas
        const { data: stats } = await supabase.from('bot_arena_stats').select('*');
        if (stats) {
            botArenaStats.length = 0;
            botArenaStats.push(...stats);
            console.log(`[BOT_SYSTEM] Loaded stats for ${stats.length} arenas`);
        }
    } catch (error) {
        console.error('[BOT_SYSTEM] Error loading configuration:', error.message);
    }
}

// WHATSAPP BOT INITIALIZATION (now using service module)
// Connection function moved to server/services/whatsappService.js
// Message handler moved to server/controllers/whatsappController.js
// This function just calls the service
async function initializeWhatsAppBot(io) {
    const socket = await connectToWhatsApp(io);

    if (socket) {
        // Set up message listener
        socket.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify') {
                for (const msg of m.messages) {
                    if (!msg.key.fromMe && msg.message) {
                        await handleIncomingWaMessage(msg);
                    }
                }
            }
        });
    }
}

// Export for controller access
module.exports.loadAppSettings = loadAppSettings;


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

    // Cargar configuración del bot al iniciar
    loadBotConfig();

    // Iniciar conexión de WhatsApp e inicializar listeners
    initializeWhatsAppBot(io).catch(err => console.error('[WA_INIT] Error:', err));

    // SECURITY & SYNC: Supabase Realtime Listener (Syncs online server with local/remote admin changes)
    const subscribeToBotConfig = () => {
        console.log('[SUPABASE_REALTIME] Initializing bot configuration sync...');

        supabase.channel('bot-sync-global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_config' }, (payload) => {
                console.log(`[SUPABASE_REALTIME] Bot Global Config ${payload.eventType}:`, payload.new || payload.old);
                if (payload.eventType === 'DELETE') {
                    // Reset to defaults via mutation
                    Object.assign(botConfig, { enabled: false, lobby_wait_seconds: 25 });
                } else {
                    Object.assign(botConfig, payload.new);
                }
                io.to('admins').emit('botConfigUpdated', botConfig);
            })
            .subscribe();

        supabase.channel('bot-sync-arenas')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_arena_config' }, (payload) => {
                console.log(`[SUPABASE_REALTIME] Bot Arena Config ${payload.eventType}:`, payload.new || payload.old);
                if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                    const idx = botArenaConfigs.findIndex(c => c.mode === payload.new.mode && c.stake_tier === payload.new.stake_tier);
                    if (idx !== -1) botArenaConfigs[idx] = { ...botArenaConfigs[idx], ...payload.new };
                    else botArenaConfigs.push(payload.new);
                } else if (payload.eventType === 'DELETE') {
                    const idx = botArenaConfigs.findIndex(c => c.id === payload.old.id);
                    if (idx !== -1) botArenaConfigs.splice(idx, 1);
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_arena_stats' }, (payload) => {
                console.log(`[SUPABASE_REALTIME] Bot Arena Stats ${payload.eventType}:`, payload.new || payload.old);
                if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
                    const idx = botArenaStats.findIndex(c => c.mode === payload.new.mode && c.stake_tier === payload.new.stake_tier);
                    if (idx !== -1) botArenaStats[idx] = { ...botArenaStats[idx], ...payload.new };
                    else botArenaStats.push(payload.new);
                } else if (payload.eventType === 'DELETE') {
                    const idx = botArenaStats.findIndex(c => c.id === payload.old.id);
                    if (idx !== -1) botArenaStats.splice(idx, 1);
                }
            })
            .subscribe((status) => {
                console.log(`[SUPABASE_REALTIME] Arena sync status: ${status}`);
            });
    };
    subscribeToBotConfig();

    const subscribeToAppSettings = () => {
        supabase.channel('app-settings-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
                console.log(`[SUPABASE_REALTIME] App Settings ${payload.eventType}:`, payload.new || payload.old);
                if (payload.new && payload.new.key && appSettings.hasOwnProperty(payload.new.key)) {
                    appSettings[payload.new.key] = payload.new.value;
                    io.emit('appSettingsUpdated', appSettings);
                }
            })
            .subscribe((status) => {
                console.log(`[SUPABASE_REALTIME] Settings sync status: ${status}`);
            });
    };
    subscribeToAppSettings();

    // FALLBACK: Periodic reload every 5 minutes in case Realtime fails
    setInterval(() => {
        console.log('[BOT_SYSTEM] Running periodic configuration sync fallback...');
        loadBotConfig();
    }, 5 * 60 * 1000);

    io.use(authMiddleware);
    process.io = io; // Expose io for Bold Webhook access

    io.on('connection', (socket) => {
        const userId = socket.userId;
        console.log('[SERVER_INFO] Player connected:', socket.id, 'User:', userId);

        // Send public configuration upon connection
        socket.emit('botConfigUpdated', botConfig);

        // Register WhatsApp Admin Handlers
        registerWhatsappHandlers(io, socket, userId, isAdmin);

        if (userSockets.has(userId)) {
            const oldSocketId = userSockets.get(userId);
            const oldSocket = io.sockets.sockets.get(oldSocketId);
            if (oldSocket) {
                console.log(`[SESSION_SECURITY] Disconnecting old session for ${userId}. New session: ${socket.id}, Old: ${oldSocketId}`);
                oldSocket.disconnect();
            } else {
                console.log(`[SESSION_SECURITY] Old socket ID ${oldSocketId} found for ${userId} but it's already stale.`);
            }
        }
        userSockets.set(userId, socket.id);

        socket.on('updateProfile', async (data) => {
            let { username, birthDate, phone_number } = data;

            // SECURITY: Sanitize inputs
            username = sanitizeInput(username);
            phone_number = sanitizeInput(phone_number);

            try {
                // Check if username is already taken by someone ELSE
                if (username) {
                    const { data: existingUserWithSameName, error: checkError } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('username', username)
                        .neq('id', userId)
                        .maybeSingle();

                    if (existingUserWithSameName) {
                        return socket.emit('profileUpdateError', 'El nombre de usuario ya está en uso.');
                    }
                }

                // Fetch existing profile to check columns (include streak data and phone)
                const { data: existing } = await supabase
                    .from('profiles')
                    .select('id, username, birth_date, coins, gems, current_streak, last_claimed_at, phone_number')
                    .eq('id', userId)
                    .maybeSingle();

                // WELCOME BONUS: Triggered if they haven't set their birth_date yet (our onboarding completion metric)
                const isNewOnboarding = !existing || !existing.birth_date;

                // SECURITY: Double-check if bonus was already claimed during this session/request burst
                const alreadyClaiming = bonusClaimLock.has(userId);
                if (isNewOnboarding && alreadyClaiming) {
                    console.warn(`[BONUS_SECURITY] Blocked concurrent bonus claim attempt for user: ${userId}`);
                    return socket.emit('profileUpdateError', 'Ya se está procesando tu registro.');
                }

                console.log(`[BONUS_LOG] Checking bonus for ${userId}. Has BirthDate: ${!!existing?.birth_date}, isNew: ${isNewOnboarding}`);

                let finalCoins = (existing?.coins || 0);
                let finalGems = (existing?.gems || 0);
                let currentStreak = existing?.current_streak || 0;
                let lastClaimedAt = existing?.last_claimed_at || null;

                if (isNewOnboarding) {
                    bonusClaimLock.add(userId); // LOCK
                    finalCoins += 30; // ADD 30
                    console.log(`[BONUS_LOG] NEW USER DETECTED. Adding 30 coins. Total set to: ${finalCoins}`);
                }

                const { error } = await supabase
                    .from('profiles')
                    .upsert({
                        id: userId,
                        username: username,
                        birth_date: birthDate,
                        phone_number: phone_number,
                        coins: finalCoins,
                        gems: finalGems,
                        current_streak: currentStreak,
                        last_claimed_at: lastClaimedAt,
                        updated_at: new Date().toISOString()
                    });

                const phoneChanged = phone_number && (phone_number !== existing?.phone_number);
                console.log(`[WA_BOT_TRACE] Profile Update Logic. error: ${!!error}, isNew: ${isNewOnboarding}, phoneChanged: ${phoneChanged}, phone: ${phone_number}, Status: ${getStatus()}`);

                // Trigger welcome if phone is new/changed OR if it's the very first onboarding
                if (!error && phone_number && (isNewOnboarding || phoneChanged) && getStatus() === 'connected') {
                    try {
                        console.log(`[WA_BOT_TRACE] Triggering sendWelcomeMessage for ${username} (${phone_number})`);
                        const { sendWelcomeMessage } = require('./server/controllers/whatsappController');
                        await sendWelcomeMessage(phone_number, username);
                    } catch (waErr) {
                        console.error('[WA_BOT] Error triggering welcome flow:', waErr.message);
                    }
                }

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
            } finally {
                // ALWAYS release the lock if it was held
                if (bonusClaimLock.has(userId)) {
                    // Small delay to ensure DB consistency before allowing another request
                    setTimeout(() => bonusClaimLock.delete(userId), 2000);
                }
            }
        });

        socket.on('claimDailyReward', async () => {
            // SECURITY: Cooldown check (5 seconds between attempts)
            const now = Date.now();
            const lastClaim = dailyRewardCooldowns.get(userId) || 0;
            if (now - lastClaim < 5000) {
                return socket.emit('purchaseError', 'Espera un momento antes de reclamar de nuevo.');
            }
            dailyRewardCooldowns.set(userId, now);

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
                        .update({
                            coins: newCoins,
                            last_claimed_at: claimedAt,
                            current_streak: newStreak
                        })
                        .eq('id', userId);

                    if (updateError) {
                        socket.emit('purchaseError', 'Error al reclamar: ' + updateError.message);
                    } else {
                        socket.emit('rewardClaimed', { newCoins, streak: newStreak, currentStreak: newStreak, claimedAt });
                    }
                }
            } catch (err) {
                console.error('[STREAK_ERROR]', err);
                socket.emit('purchaseError', 'Internal Streak Error');
            }
        });

        socket.on('joinAdmin', () => {
            if (!isAdmin(userId)) {
                console.warn(`[SERVER_AUTH] Unauthorized admin access attempt by: ${userId}`);
                return socket.emit('adminError', 'No tienes permisos de administrador.');
            }
            socket.join('admins');
            console.log(`[ADMIN] Socket ${socket.id} joined admin room.`);
            // Send initial users list upon joining
            socket.emit('adminDataRefreshed');
        });

        // WhatsApp Admin Controls handled by registerWhatsappHandlers (controllers/whatsappController.js)


        socket.on('getAppSettings', async () => {
            // Both users and admins need settings (for contact number)
            await loadAppSettings();
            socket.emit('appSettingsUpdated', appSettings);
        });

        socket.on('updateAppSettings', async (data) => {
            if (!isAdmin(userId)) return socket.emit('adminError', 'No autorizado');
            try {
                for (const [key, value] of Object.entries(data)) {
                    if (appSettings.hasOwnProperty(key)) {
                        await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() });
                    }
                }
                await loadAppSettings();
                socket.emit('adminSuccess', 'Configuración actualizada');
                io.emit('appSettingsUpdated', appSettings); // Notify everyone
            } catch (e) {
                socket.emit('adminError', 'Error actualizando settings');
            }
        });

        socket.on('adminGetUsers', async () => {
            if (!isAdmin(userId)) return socket.emit('adminError', 'No autorizado');
            try {
                const { data, error } = await supabase.from('profiles').select('id, username, coins, gems, rp, rank_name, total_wins, total_games');
                if (error) {
                    console.error('[ADMIN_ERROR] adminGetUsers:', error.message);
                    socket.emit('adminError', error.message);
                } else {
                    socket.emit('adminUsersList', data);
                }
            } catch (e) { socket.emit('adminError', e.message); }
        });

        // ============ BOT ADMIN CONTROLS ============
        socket.on('getBotConfig', async () => {
            if (!isAdmin(userId)) return socket.emit('adminError', 'No autorizado');
            try {
                await loadBotConfig(); // Refrescar cache
                socket.emit('botConfigData', {
                    config: botConfig,
                    arenaConfigs: botArenaConfigs,
                    stats: botArenaStats
                });
            } catch (e) {
                socket.emit('adminError', 'Error cargando configuración del bot');
            }
        });

        socket.on('updateBotConfig', async (data) => {
            if (!isAdmin(userId)) return socket.emit('adminError', 'No autorizado');
            const { enabled, lobby_wait_seconds, min_withdrawal_cop } = data;
            console.log(`[ADMIN_ACTION] UpdateBotConfig: enabled=${enabled}, wait=${lobby_wait_seconds}s, min_withdraw=${min_withdrawal_cop} COP`);
            try {
                const configData = {
                    enabled,
                    lobby_wait_seconds,
                    min_withdrawal_cop,
                    updated_at: new Date().toISOString()
                };

                // Use upsert if no ID exists, otherwise update
                const query = botConfig.id ?
                    supabase.from('bot_config').update(configData).eq('id', botConfig.id) :
                    supabase.from('bot_config').upsert({ ...configData, id: '00000000-0000-0000-0000-000000000000' });

                const { data: updated, error } = await query.select().single();

                if (error) {
                    console.error('[ADMIN_ERROR] updateBotConfig:', error.message);
                    socket.emit('adminError', error.message);
                } else {
                    Object.assign(botConfig, updated || configData); // Update cache via mutation
                    socket.emit('adminSuccess', 'Configuración del bot actualizada');
                    io.to('admins').emit('botConfigUpdated', botConfig);
                }
            } catch (e) {
                console.error('[ADMIN_EXCEPTION] updateBotConfig:', e.message);
                socket.emit('adminError', e.message);
            }
        });

        socket.on('updateArenaConfig', async (data) => {
            if (!isAdmin(userId)) return socket.emit('adminError', 'No autorizado');
            const { mode, stake_tier, target_win_rate, is_random } = data;
            console.log(`[ADMIN_ACTION] UpdateArenaConfig: ${mode}/${stake_tier} -> ${target_win_rate}%, random=${is_random}`);
            try {
                const { error } = await supabase.from('bot_arena_config')
                    .update({
                        target_win_rate,
                        is_random,
                        updated_at: new Date().toISOString()
                    })
                    .match({ mode, stake_tier });

                if (error) {
                    console.error('[ADMIN_ERROR] updateArenaConfig:', error.message);
                    socket.emit('adminError', error.message);
                } else {
                    // Update cache
                    const idx = botArenaConfigs.findIndex(c => c.mode === mode && c.stake_tier === stake_tier);
                    if (idx !== -1) {
                        botArenaConfigs[idx].target_win_rate = target_win_rate;
                        botArenaConfigs[idx].is_random = is_random;
                    }
                    socket.emit('adminSuccess', `Arena ${mode}/${stake_tier} actualizada`);
                }
            } catch (e) {
                console.error('[ADMIN_EXCEPTION] updateArenaConfig:', e.message);
                socket.emit('adminError', e.message);
            }
        });


        socket.on('adminUpdateProfile', async (data) => {
            if (!isAdmin(userId)) return socket.emit('adminError', 'No autorizado');
            const { targetUserId, username, rank } = data;
            console.log(`[ADMIN_ACTION] UpdateProfile: ${targetUserId} to ${username}/${rank}`);
            try {
                const { error } = await supabase.from('profiles').update({ username, rank_name: rank }).eq('id', targetUserId);
                if (error) {
                    console.error('[ADMIN_ERROR] updateProfile:', error.message);
                    socket.emit('adminError', error.message);
                } else {
                    socket.emit('adminSuccess', 'Perfil actualizado con éxito');
                    io.to('admins').emit('adminDataRefreshed');
                }
            } catch (e) {
                console.error('[ADMIN_EXCEPTION] updateProfile:', e.message);
                socket.emit('adminError', e.message);
            }
        });

        socket.on('adminTransferBalance', async (data) => {
            if (!isAdmin(userId)) return socket.emit('adminError', 'No autorizado');
            const { targetUserId, type, amount, operation } = data;
            console.log(`[ADMIN_ACTION] Transfer: ${operation} ${amount} ${type} to ${targetUserId}`);
            try {
                const { data: p, error: fError } = await supabase.from('profiles').select('coins, gems').eq('id', targetUserId).single();
                if (fError || !p) return socket.emit('adminError', 'Usuario no encontrado');

                const isCoins = type === 'coins';
                const current = isCoins ? (p.coins || 0) : (p.gems || 0);
                const newVal = Math.max(0, operation === 'add' ? current + amount : current - amount);

                const { error } = await supabase.from('profiles').update({ [isCoins ? 'coins' : 'gems']: newVal }).eq('id', targetUserId);
                if (error) {
                    console.error('[ADMIN_ERROR] transferBalance:', error.message);
                    socket.emit('adminError', error.message);
                } else {
                    socket.emit('adminSuccess', `Balance actualizado: ${newVal} ${type}`);
                    io.to('admins').emit('adminDataRefreshed');
                }
            } catch (e) {
                console.error('[ADMIN_EXCEPTION] transferBalance:', e.message);
                socket.emit('adminError', e.message);
            }
        });

        socket.on('purchase', async (data) => {
            if (!isAdmin(userId)) {
                console.warn(`[SERVER_ECONOMY] Arbitrary purchase attempted by ${userId}. Event disabled for safety.`);
                return socket.emit('purchaseError', 'Esta operación está deshabilitada por seguridad.');
            }
            // If admin, we allow for testing purposes or manual fixes
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
                    .update({
                        [type]: newValue
                    })
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
            let stakeTier = parseInt(data?.stakeTier) || 10;

            // SECURITY: Validate stakeTier against whitelist to prevent negative injections
            if (!ALLOWED_STAKES.includes(stakeTier)) {
                console.warn(`[SECURITY] Invalid stake attempt by ${userId}: ${stakeTier}`);
                return socket.emit('matchError', 'Monto de apuesta no permitido.');
            }

            try {
                const { data: profile, error } = await supabase.from('profiles').select('coins, gems, rp').eq('id', userId).single();
                if (error) throw error;

                let currentStake = stakeTier;
                let currentRank = null;

                if (mode === 'casual') {
                    if (profile.coins < stakeTier) return socket.emit('matchError', 'No tienes suficientes monedas.');
                } else {
                    currentRank = getRankByRp(profile.rp || 0);
                    // Ranked stakes might have fixed values or multipliers, but we validate against whitelist too
                    currentStake = stakeTier;
                    if (profile.gems < currentStake) return socket.emit('matchError', `Necesitas ${currentStake} gemas.`);
                }

                // Matchmaking
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

                // CHECK TUTORIAL STATUS
                const { data: tutorialProfile } = await supabase
                    .from('profiles')
                    .select('tutorial_match_completed')
                    .eq('id', userId)
                    .single();

                // FORCE INSTANT BOT MATCH FOR TUTORIAL
                if (tutorialProfile && !tutorialProfile.tutorial_match_completed) {
                    console.log(`[TUTORIAL] Instant bot match for new player ${userId}`);

                    const player = createPlayer(socket.id, userId, imageUrl);
                    player.mode = mode;
                    player.stakeTier = currentStake;
                    player.rank = currentRank;

                    const botProfile = createBotProfile();
                    const botPlayer = createPlayer('BOT_' + Date.now(), botProfile.id, null);
                    botPlayer.username = botProfile.username;
                    botPlayer.isBot = true;
                    botPlayer.isTutorialBot = true; // Flag for forced win

                    const room = createRoom(player, botPlayer);
                    room.mode = mode;
                    room.stakeTier = currentStake;
                    room.rank = currentRank;
                    room.isBotGame = true;
                    room.botPlayerId = botProfile.id;

                    activeRooms.set(socket.id, room);
                    socket.join(room.id);

                    // Skip fee for tutorial? Or process it? Let's process it to be realistic, but maybe ensure they have funds?
                    // They get 30 coins on signup, so 10 coins stake is fine.
                    const feeResult = await processEntryFeeAtomic([player], mode, currentStake);
                    if (!feeResult.success) {
                        socket.emit('matchError', 'Error al procesar entrada (Saldo insuficiente).');
                        return;
                    }

                    socket.emit('matchFound', {
                        roomId: room.id,
                        playerIndex: 0,
                        opponentId: botProfile.id,
                        opponentImageUrl: null,
                        stakeTier: currentStake,
                        mode,
                        rank: currentRank
                    });

                    setTimeout(() => startCountdown(room.id), 1000);
                    return; // EXIT FUNCTION, DO NOT ADD TO QUEUE
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
                    if (opponent.botTimer) clearTimeout(opponent.botTimer);

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

                    // [BOT SYSTEM] Timer Start
                    if (botConfig.enabled && queueMap[queueKey].length === 1) {
                        const waitTime = (botConfig.lobby_wait_seconds || 25) * 1000;
                        console.log(`[BOT_SYSTEM] Timer started for ${userId} in ${mode}/${currentStake}. Wait time: ${waitTime}ms`);

                        player.botTimer = setTimeout(async () => {
                            const currentQueue = mode === 'casual' ? waitingPlayers : waitingRanked;
                            const idx = currentQueue[queueKey]?.findIndex(p => p.userId === userId);

                            if (idx !== -1) {
                                console.log(`[BOT_SYSTEM] Triggering bot match for ${userId}`);
                                currentQueue[queueKey].splice(idx, 1); // Remove from queue

                                const botProfile = createBotProfile();
                                const botPlayer = createPlayer('BOT_' + Date.now(), botProfile.id, null);
                                botPlayer.username = botProfile.username;
                                botPlayer.isBot = true;

                                // TUTORIAL MATCH LOGIC: Force win for P1 if it's their first game
                                try {
                                    const { data: p1Profile } = await supabase
                                        .from('profiles')
                                        .select('tutorial_match_completed')
                                        .eq('id', player.userId) // Use 'player' here, not 'player1'
                                        .single();

                                    if (p1Profile && !p1Profile.tutorial_match_completed) {
                                        console.log(`[TUTORIAL] Forcing win for new player ${player.userId}`);
                                        // This logic is for the game outcome, not match setup.
                                        // It should be in `endGame` or `resolveRound` where winner is determined.
                                        // For now, we'll just mark the bot as a tutorial bot.
                                        botPlayer.isTutorialBot = true;

                                        // Mark tutorial as completed (this should happen AFTER the game ends)
                                        // await supabase
                                        //     .from('profiles')
                                        //     .update({ tutorial_match_completed: true })
                                        //     .eq('id', player.userId);
                                    }
                                } catch (tutErr) {
                                    console.error('[TUTORIAL_CHECK_ERROR]', tutErr);
                                }

                                // AI Opponent Logic (if not tutorial forced)
                                const room = createRoom(player, botPlayer);
                                room.mode = mode;
                                room.stakeTier = currentStake;
                                room.rank = currentRank;
                                room.isBotGame = true;
                                room.botPlayerId = botProfile.id;

                                activeRooms.set(socket.id, room);
                                socket.join(room.id);

                                const feeResult = await processEntryFeeAtomic([player], mode, currentStake);
                                if (!feeResult.success) {
                                    socket.emit('matchError', 'Error al procesar entrada (Saldo insuficiente).');
                                    return;
                                }

                                socket.emit('matchFound', {
                                    roomId: room.id,
                                    playerIndex: 0,
                                    opponentId: botProfile.id,
                                    opponentImageUrl: null,
                                    stakeTier: currentStake,
                                    mode,
                                    rank: currentRank
                                });

                                setTimeout(() => startCountdown(room.id), 1000);
                            }
                        }, waitTime);
                    }
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

                // [BOT SYSTEM] Instant Bot Reply
                if (room.isBotGame && !room.botReplied) {
                    const botPlayer = room.players.find(p => p.isBot);
                    if (botPlayer) {
                        // CHECK FOR TUTORIAL BOT
                        if (botPlayer.isTutorialBot) {
                            const humanPlayer = room.players.find(p => !p.isBot);
                            const hScore = humanPlayer ? humanPlayer.score : 0;
                            const bScore = botPlayer.score;

                            let wantBotWin = false;
                            // SCRIPTED FLOW: 3-2 Suspense
                            // 0-0 -> Human Wins (1-0)
                            // 1-0 -> Bot Wins (1-1)
                            // 1-1 -> Human Wins (2-1)
                            // 2-1 -> Bot Wins (2-2)
                            // 2-2 -> Human Wins (3-2) -> END

                            if (hScore === 0 && bScore === 0) wantBotWin = false;
                            else if (hScore === 1 && bScore === 0) wantBotWin = true;
                            else if (hScore === 1 && bScore === 1) wantBotWin = false;
                            else if (hScore === 2 && bScore === 1) wantBotWin = true;
                            else wantBotWin = false; // Default to letting human win to ensure progress

                            const winMove = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
                            const loseMove = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

                            botPlayer.choice = wantBotWin ? winMove[choice] : loseMove[choice];

                            console.log(`[TUTORIAL] Scripted. Score ${hScore}-${bScore}. Bot will ${wantBotWin ? 'WIN' : 'LOSE'}`);
                        } else {
                            // Normal Bot Logic
                            botPlayer.choice = getBotChoice(room, botPlayer, botArenaStats, botArenaConfigs);
                        }
                        room.botReplied = true; // Flag to prevent double choice in same round
                    }
                }

                if (room.players[0].choice && room.players[1].choice) {
                    room.botReplied = false; // Reset for next round
                    resolveRound(room);
                }
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
                // [BOT SYSTEM] Virtual Bot Profile
                if (targetUserId === 'bot_ai_opponent') {
                    return socket.emit('playerStatsData', {
                        id: 'bot_ai_opponent',
                        username: '🤖 CPU Challenger',
                        rank_name: 'MAESTRO',
                        total_wins: 500,
                        total_games: 1000,
                        ranked_stats: {
                            matches: 1000,
                            wins: 500,
                            rock: 333,
                            paper: 333,
                            scissors: 334,
                            openings: { rock: 33, paper: 33, scissors: 34 }
                        }
                    });
                }

                const { data: profile } = await supabase.from('profiles').select('id, username, rank_name, total_wins, total_games').eq('id', targetUserId).single();
                const { data: stats } = await supabase.from('player_stats').select('user_id, matches_played, wins, rock_count, paper_count, scissors_count, opening_rock, opening_paper, opening_scissors').eq('user_id', targetUserId).single();
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
        room.botReplied = false;
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

        // TUTORIAL LOGIC: Force human win if playing against tutorial bot
        let isTutorialMatch = false;
        if (!forcedWinnerId) {
            if (p2.isTutorialBot) {
                console.log(`[TUTORIAL] Forcing win for human player ${p1.userId} against tutorial bot`);
                winnerId = p1.userId;
                isTutorialMatch = true;

                // Mark tutorial as completed for the human player
                try {
                    await supabase.from('profiles').update({ tutorial_match_completed: true }).eq('id', p1.userId);
                } catch (e) {
                    console.error('[TUTORIAL_DB_ERROR]', e);
                }
            } else if (p1.isTutorialBot) {
                // Should not happen in current flow, but handling just in case (bot vs human?)
                winnerId = p2.userId;
                isTutorialMatch = true;
                try {
                    await supabase.from('profiles').update({ tutorial_match_completed: true }).eq('id', p2.userId);
                } catch (e) {
                    console.error('[TUTORIAL_DB_ERROR]', e);
                }
            }
        }

        if (p1.score === p2.score && !forcedWinnerId && !isTutorialMatch) winnerId = 'tie';

        const updateData = async (player, isWinner) => {
            if (player.isBot) return { newCoins: 999999, newGems: 999999, prize: 0, rpChange: 0, newRp: 1000, newRank: 'MAESTRO' };

            const { data: profile } = await supabase.from('profiles').select('id, coins, gems, rp, rank_name, total_wins, total_games').eq('id', player.userId).single();
            if (!profile) return {};
            let updates = { total_wins: isWinner ? (profile.total_wins || 0) + 1 : (profile.total_wins || 0), total_games: (profile.total_games || 0) + 1 };
            let resultData = { rpChange: 0, newRp: profile.rp, newRank: profile.rank_name, prize: 0 };
            if (room.mode === 'ranked') {
                const multiplier = room.stakeTier >= 1000 ? 10 : (room.stakeTier >= 500 ? 5 : (room.stakeTier >= 100 ? 2 : 1));
                const rpChange = isWinner ? (20 * multiplier) : -(15 * multiplier);
                updates.rp = Math.max(0, (profile.rp || 0) + rpChange);
                updates.rank_name = getRankByRp(updates.rp);
                if (isWinner) {
                    const prize = Math.floor(room.stakeTier * 1.8); // 10% Rake (90% of pot)
                    updates.gems = (profile.gems || 0) + prize;
                    resultData.prize = prize;
                    console.log(`[RAKE] Ranked Match: User ${player.userId} won ${prize} gems (10% rake applied)`);
                }
                resultData = { ...resultData, rpChange, newRp: updates.rp, newRank: updates.rank_name };
            } else if (isWinner) {
                const prize = Math.floor(room.stakeTier * 1.8); // 10% Rake (90% of pot)
                updates.coins = (profile.coins || 0) + prize;
                resultData.prize = prize;
                console.log(`[RAKE] Casual Match: User ${player.userId} won ${prize} coins (10% rake applied)`);
            }
            const session = room.stats[player.userId];
            if (session) await incrementPlayerStats({ t_user_id: player.userId, t_is_win: isWinner ? 1 : 0, t_rock: session.rock, t_paper: session.paper, t_scissors: session.scissors, t_o_rock: session.openings.rock, t_o_paper: session.openings.paper, t_o_scissors: session.openings.scissors }, { user_id: player.userId, wins: isWinner ? 1 : 0, rock_count: session.rock, paper_count: session.paper, scissors_count: session.scissors, opening_rock: session.openings.rock, opening_paper: session.openings.paper, opening_scissors: session.openings.scissors });
            await supabase.from('profiles').update(updates).eq('id', player.userId);
            const { data: final } = await supabase.from('profiles').select('coins, gems').eq('id', player.userId).single();
            return { ...resultData, newCoins: final.coins, newGems: final.gems };
        };

        const [p1Res, p2Res] = await Promise.all([updateData(p1, winnerId === p1.userId), updateData(p2, winnerId === p2.userId)]);

        // Record ALL matches (including Bot matches) so they appear in Rankings
        await recordMatch({
            player1_id: p1.userId,
            player2_id: p2.userId,
            winner_id: winnerId === 'tie' ? null : winnerId,
            p1_score: p1.score,
            p2_score: p2.score,
            mode: room.mode,
            stake: room.stakeTier,
            created_at: new Date().toISOString(),
            is_bot_match: p1.isBot || p2.isBot // New flag for filtering if needed
        });

        // [BOT SYSTEM] Update Bot Statistics
        const botPlayer = room.players.find(p => p.isBot);
        if (botPlayer) {
            const isBotWinner = winnerId === botPlayer.userId;
            const isTie = winnerId === 'tie';

            // Update local cache
            const statEntry = botArenaStats.find(s => s.mode === room.mode && s.stake_tier === room.stakeTier);
            if (statEntry) {
                statEntry.total_games = (statEntry.total_games || 0) + 1;
                if (isBotWinner) statEntry.total_wins = (statEntry.total_wins || 0) + 1;
                else if (!isTie) statEntry.total_losses = (statEntry.total_losses || 0) + 1;

                // Update win rate
                if (statEntry.total_games > 0) {
                    statEntry.current_win_rate = (statEntry.total_wins / statEntry.total_games) * 100;
                }
                statEntry.last_game_at = new Date().toISOString();

                // Update DB and notify admins
                supabase.from('bot_arena_stats')
                    .update({
                        total_games: statEntry.total_games,
                        total_wins: statEntry.total_wins,
                        total_losses: statEntry.total_losses,
                        last_game_at: statEntry.last_game_at
                    })
                    .match({ mode: room.mode, stake_tier: room.stakeTier })
                    .then(({ error }) => {
                        if (error) console.error('[BOT_STATS] DB Update error:', error.message);
                        else io.to('admins').emit('botConfigData', { config: botConfig, arenaConfigs: botArenaConfigs, stats: botArenaStats });
                    });
            }
        }
        room.players.forEach(p => {
            if (!p.disconnected) {
                const res = p.userId === p1.userId ? p1Res : p2Res;
                io.to(p.socketId).emit('gameOver', { winner: p.userId === winnerId ? 'player' : (winnerId === 'tie' ? 'tie' : 'opponent'), finalScore: { player: p.score, opponent: (room.players.find(op => op.userId !== p.userId) || { score: 0 }).score }, ...res, mode: room.mode, stake: room.stakeTier });
            }
        });
        room.cleanupTimer = setTimeout(() => room.players.forEach(p => { if (activeRooms.get(p.socketId) === room) activeRooms.delete(p.socketId); }), 15000);
    }

    // Real-time Stats Broadcast (Every 5 seconds)
    setInterval(async () => {
        try {
            const { data } = await supabase.from('profiles').select('coins, gems').neq('id', 'bot_ai_opponent');
            const coins = data?.reduce((acc, p) => acc + (p.coins || 0), 0) || 0;
            const gems = data?.reduce((acc, p) => acc + (p.gems || 0), 0) || 0;
            io.to('admins').emit('adminRealtimeStats', {
                online: userSockets.size,
                activeGames: Array.from(activeRooms.values()).filter((v, i, a) => a.indexOf(v) === i).length, // Unique rooms count
                coinsInCirc: coins,
                gemsInCirc: gems,
                totalUsers: data?.length || 0,
                timestamp: new Date().toISOString()
            });
        } catch (e) { console.error('[ADMIN_STATS] Error:', e.message); }
    }, 5000);

    httpServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`[SERVER_FATAL] Port ${port} is already in use. Please kill the other process.`);
        } else {
            console.error('[SERVER_FATAL] Unexpected error:', err);
        }
        process.exit(1);
    }).listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
