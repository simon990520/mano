/**
 * WHATSAPP SERVICE
 * 
 * Maneja la conexión y operaciones del bot de WhatsApp usando Baileys
 */

const QRCode = require('qrcode'); // Fallback for non-ESM usage
const { getHumanDelay, getTypingDuration, humanizeMessage, isSpamming } = require('../utils/humanization');
const { appSettings } = require('../utils/constants');

// WhatsApp Bot State
let waSock = null;
let waQr = null;
let waStatus = 'disconnected'; // disconnected, connecting, connected
let waGroups = []; // Lista de grupos donde el bot es admin
let reconnectTimeout = null;
let isExplicitlyStopped = false;

// ESM Dependencies (loaded dynamically)
let makeWASocket, useMultiFileAuthState, DisconnectReason, Boom, pino;

/**
 * Carga las dependencias ESM de forma dinámica
 */
async function loadWaDependencies() {
    if (makeWASocket) return; // Already loaded
    try {
        const baileys = await import('@whiskeysockets/baileys');
        makeWASocket = baileys.default || baileys.makeWASocket;
        useMultiFileAuthState = baileys.useMultiFileAuthState || (baileys.default?.useMultiFileAuthState);
        DisconnectReason = baileys.DisconnectReason || (baileys.default?.DisconnectReason);

        const boom = await import('@hapi/boom');
        Boom = boom.Boom;

        const pinoMod = await import('pino');
        pino = pinoMod.default || pinoMod.pino;

        console.log('[WA_SERVICE] Dependencies loaded successfully');
    } catch (err) {
        console.error('[WA_SERVICE] Failed to load dependencies:', err.message);
    }
}

/**
 * Conecta el bot de WhatsApp y registra event listeners
 * @param {Object} io - Socket.io server instance
 */
async function connectToWhatsApp(io) {
    await loadWaDependencies();
    if (!makeWASocket) {
        console.error('[WA_SERVICE] Cannot connect: dependencies not loaded');
        return;
    }

    const { state, saveCreds } = await useMultiFileAuthState('wa_auth_session');

    waStatus = 'connecting';
    isExplicitlyStopped = false;
    io.emit('waStatusUpdated', { status: waStatus });

    // Clear any pending reconnect
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    // Close existing socket if any
    if (waSock) {
        try {
            waSock.ev.removeAllListeners('connection.update');
            waSock.end(undefined);
            waSock = null;
        } catch (e) {
            console.warn('[WA_SERVICE] Error closing old socket:', e.message);
        }
    }

    waSock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Piedra.fun', 'Chrome', '1.0.0']
    });

    waSock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            waQr = await QRCode.toDataURL(qr);
            io.emit('waQrUpdated', { qr: waQr });
            console.log('[WA_SERVICE] New QR generated');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;

            console.log(`[WA_SERVICE] Connection closed. Type: ${lastDisconnect.error?.output?.statusCode || 'Unknown'}. Reconnecting: ${shouldReconnect}`);

            waStatus = 'disconnected';
            waQr = null;
            io.emit('waStatusUpdated', { status: waStatus, qr: waQr });

            if (shouldReconnect && !isExplicitlyStopped) {
                // Exponential backoff or simple delay to prevent tight loops
                reconnectTimeout = setTimeout(() => {
                    reconnectTimeout = null;
                    connectToWhatsApp(io);
                }, 3000);
            }
        } else if (connection === 'open') {
            console.log('[WA_SERVICE] Connection opened successfully');
            waStatus = 'connected';
            waQr = null;
            io.emit('waStatusUpdated', { status: waStatus, qr: waQr });

            // Fetch groups when connected, but don't block
            fetchBotGroups().catch(e => console.error('[WA_SERVICE] Failed to fetch groups on connect:', e.message));
        }
    });

    waSock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                if (!msg.key.fromMe) {
                    const { handleIncomingWaMessage } = require('../controllers/whatsappController');
                    await handleIncomingWaMessage(msg);
                }
            }
        }
    });

    waSock.ev.on('creds.update', saveCreds);

    return waSock;
}

/**
 * Envía un mensaje con humanización (delays, emojis, etc.)
 * @param {string} jid - WhatsApp JID del destinatario
 * @param {string} text - Texto del mensaje
 */
async function sendHumanizedMessage(jid, text) {
    if (!waSock || waStatus !== 'connected') {
        console.error('[WA_SERVICE] Cannot send message: not connected');
        return;
    }

    // Add random humanization
    const humanizedText = humanizeMessage(text);

    // Small delay before sending (network latency simulation)
    await new Promise(resolve => setTimeout(resolve, getHumanDelay(200, 500)));

    await waSock.sendMessage(jid, { text: humanizedText });
}

/**
 * Envía un mensaje con typing indicator humanizado
 * @param {string} jid - WhatsApp JID del destinatario
 * @param {string} text - Texto del mensaje
 */
async function sendMessageWithTyping(jid, text) {
    if (!waSock || waStatus !== 'connected') {
        console.error('[WA_SERVICE] Cannot send message: not connected');
        return;
    }

    // Show typing indicator
    await waSock.sendPresenceUpdate('composing', jid);

    // Typing duration based on message length
    const typingDuration = getTypingDuration(text.length);
    await new Promise(resolve => setTimeout(resolve, typingDuration));

    // Stop typing, show online
    await waSock.sendPresenceUpdate('available', jid);

    // Send humanized message
    await sendHumanizedMessage(jid, text);
}

/**
 * Obtiene lista de grupos donde el bot es admin
 * @returns {Array} Lista de grupos
 */
async function fetchBotGroups() {
    if (!waSock || waStatus !== 'connected') {
        console.log('[WA_SERVICE] Cannot fetch groups: not connected');
        return [];
    }

    try {
        const groups = await waSock.groupFetchAllParticipating();
        const groupList = [];

        for (const groupId in groups) {
            try {
                console.log('[DEBUG_ADMIN] waSock.user:', JSON.stringify(waSock.user, null, 2));
                const group = groups[groupId];
                const participants = group.participants || [];
                const botNumber = waSock.user.id.split(':')[0].split('@')[0];
                const botLid = waSock.user.lid ? waSock.user.lid.split(':')[0].split('@')[0] : null;

                // Find bot in participants
                const botParticipant = participants.find(p => {
                    const pNumber = p.id.split(':')[0].split('@')[0];
                    return pNumber === botNumber || (botLid && pNumber === botLid);
                });


                const isAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');

                groupList.push({
                    id: groupId,
                    name: group.subject,
                    participantCount: participants.length,
                    isAdmin: !!isAdmin
                });
            } catch (innerErr) {
                console.error(`[WA_SERVICE] Error processing group ${groupId}:`, innerErr.message);
            }
        }

        console.log(`[WA_SERVICE] Found ${groupList.length} groups (Admin in ${groupList.filter(g => g.isAdmin).length}).`);
        waGroups = groupList;
        return groupList;
    } catch (error) {
        console.error('[WA_SERVICE] Error fetching groups:', error.message);
        return [];
    }
}

/**
 * Verifica si un usuario está en el grupo y lo agrega si no lo está
 * @param {string} groupId - ID del grupo
 * @param {string} userJid - JID del usuario (numeros@s.whatsapp.net)
 * @returns {Promise<boolean>} true si fue agregado o ya estaba, false si falló
 */
async function ensureUserInGroup(groupId, userJid) {
    console.log(`[WA_BOT_TRACE] ensureUserInGroup entry. Group: ${groupId}, JID: ${userJid}`);
    if (!waSock || waStatus !== 'connected') {
        console.error('[WA_SERVICE] Cannot ensure user in group: not connected');
        return { added: false, alreadyMember: false, error: 'not connected' };
    }

    try {
        // 0. Verify if bot is admin in this group
        const groupList = getGroups();
        const targetGroup = groupList.find(g => g.id === groupId);
        console.log(`[WA_BOT_TRACE] ensureUserInGroup: Target group found: ${!!targetGroup}, Bot is admin: ${targetGroup?.isAdmin}`);

        if (targetGroup && !targetGroup.isAdmin) {
            console.warn(`[WA_BOT_TRACE] Bot is NOT admin in group ${groupId}. Cannot add users.`);
            return { added: false, alreadyMember: false, error: 'bot not admin' };
        }

        // 1. Check if user is already in group
        const groupMetadata = await waSock.groupMetadata(groupId);
        const participants = groupMetadata.participants || [];

        const userNumber = userJid.split('@')[0].replace(/\D/g, '');
        console.log(`[WA_BOT_TRACE] Checking if ${userNumber} is in group of ${participants.length} participants`);

        const isMember = participants.some(p => {
            const pNumber = p.id.split('@')[0].split(':')[0].replace(/\D/g, '');
            const pLid = p.lid ? p.lid.split('@')[0].split(':')[0].replace(/\D/g, '') : null;

            const match = pNumber === userNumber || (pLid && pLid === userNumber);
            if (match) {
                console.log(`[WA_BOT_TRACE] Match found: pNumber=${pNumber}, pLid=${pLid} vs userNumber=${userNumber}`);
            }
            return match;
        });

        if (isMember) {
            console.log(`[WA_BOT_TRACE] User ${userNumber} is already in group ${groupId}`);
            return { added: false, alreadyMember: true };
        }

        // 2. Add if not present
        console.log(`[WA_BOT_TRACE] Adding missing user ${userNumber} to group...`);
        try {
            const response = await waSock.groupParticipantsUpdate(groupId, [userJid], 'add');
            console.log(`[WA_BOT_TRACE] Baileys Response:`, JSON.stringify(response));

            // Check if Baileys returned a failure inside the response array
            const participantResult = response[0];
            if (participantResult && participantResult.status >= 400) {
                throw new Error(`Baileys status code: ${participantResult.status}`);
            }

            return { added: true, alreadyMember: false };
        } catch (addErr) {
            console.warn(`[WA_BOT_TRACE] Direct add failed for ${userNumber}:`, addErr.message);

            // FALLBACK: If direct add fails (often privacy settings), try to send invite link
            if (addErr.message.includes('403') || addErr.message.includes('bad-request') || addErr.message.includes('not-authorized')) {
                try {
                    console.log(`[WA_BOT_TRACE] Attempting invite link fallback for ${userNumber}...`);
                    const code = await waSock.groupInviteCode(groupId);
                    const inviteMsg = `¡Hola! 👋 Quise agregarte al grupo oficial de Piedra.fun pero tu configuración de privacidad no me lo permitió.\n\nÚnete aquí: https://chat.whatsapp.com/${code}`;
                    await sendHumanizedMessage(userJid, inviteMsg);
                    return { added: true, alreadyMember: false, fallbackInvite: true };
                } catch (inviteErr) {
                    console.error('[WA_BOT_TRACE] Invite link fallback also failed:', inviteErr.message);
                }
            }
            throw addErr; // Re-throw to be caught by the outer catch
        }

    } catch (error) {
        console.error(`[WA_BOT_TRACE] Error ensuring user in group:`, error.message);
        return { added: false, alreadyMember: false, error: error.message };
    }
}

/**
 * Agrega un usuario a un grupo de WhatsApp (Wrapper simple)
 */
async function addUserToGroup(groupId, userJid) {
    return ensureUserInGroup(groupId, userJid);
}

/**
 * Sincroniza los participantes del grupo con la base de datos
 * @param {Object} io - Socket.io instance
 * @param {string} groupId - ID del grupo
 */
async function syncGroupParticipants(io, groupId) {
    if (!waSock || waStatus !== 'connected') {
        io.emit('adminError', 'Bot desconectado. No se puede sincronizar.');
        return;
    }

    try {
        console.log('[WA_SYNC] Starting group sync...');
        io.emit('adminSyncStatus', { status: 'loading', message: 'Analizando participantes...' });

        // 1. Fetch group participants (Normalization)
        const groupMetadata = await waSock.groupMetadata(groupId);
        const existingNumbers = new Set(
            groupMetadata.participants.map(p => p.id.split('@')[0].split(':')[0].replace(/\D/g, ''))
        );
        console.log(`[WA_SYNC] Found ${existingNumbers.size} unique participants in group.`);

        // 2. Fetch all users from DB
        const { supabase } = require('../../lib/supabase-server');
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, username, phone_number')
            .not('phone_number', 'is', null)
            .neq('phone_number', ''); // Also ignore empty strings

        if (error) throw error;
        console.log(`[WA_SYNC] Found ${profiles?.length || 0} profiles total in DB with phone numbers.`);
        if (profiles) {
            profiles.forEach(p => console.log(`[WA_SYNC_DEBUG] DB Profile: ${p.username} | Phone: ${p.phone_number}`));
        }

        // 3. Find missing users
        const botNumber = waSock.user.id.split(':')[0].split('@')[0];
        const botLid = waSock.user.lid ? waSock.user.lid.split(':')[0].split('@')[0] : null;

        const missingUsers = profiles.filter(p => {
            if (!p.phone_number) return false;
            const dbNumber = p.phone_number.replace(/\D/g, '');

            // IGNORE THE BOT ITSELF
            if (dbNumber === botNumber || (botLid && dbNumber === botLid)) {
                return false;
            }

            // Valid length check (e.g. at least 7 digits)
            if (dbNumber.length < 7) return false;
            return !existingNumbers.has(dbNumber);
        });

        console.log(`[WA_SYNC] Found ${missingUsers.length} missing users (will attempt to add).`);

        if (missingUsers.length === 0) {
            io.emit('adminSyncStatus', { status: 'complete', message: '¡Sincronización al día! No hay usuarios faltantes.' });
            return;
        }

        io.emit('adminSyncStatus', { status: 'progress', total: missingUsers.length, current: 0, message: `Faltan ${missingUsers.length} usuarios. Iniciando...` });

        // 4. Add users with delay
        let addedCount = 0;
        for (const user of missingUsers) {
            const cleanPhone = user.phone_number.replace(/\D/g, '');
            const jid = `${cleanPhone}@s.whatsapp.net`;

            try {
                // Double check before adding (redundancy)
                const result = await ensureUserInGroup(groupId, jid);
                if (result.added || result.alreadyMember) {
                    addedCount++;
                    io.emit('adminSyncStatus', {
                        status: 'progress',
                        total: missingUsers.length,
                        current: addedCount,
                        message: result.added ? (result.fallbackInvite ? `Invitación enviada: ${user.username}` : `Agregado: ${user.username}`) : `Verificado: ${user.username}`
                    });

                    // If they WERE actually added (not already there), let's send them a welcome DM too!
                    if (result.added && !result.fallbackInvite) {
                        const welcomeMsg = `¡Hola *${user.username}*! 👋 Te acabamos de agregar al grupo oficial de Piedra.fun.\n\n¡Bienvenido! 🚀🪙`;
                        await sendHumanizedMessage(jid, welcomeMsg);
                    }
                } else {
                    console.warn(`[WA_SYNC] Could not verify/add user: ${user.username}`, result.error);

                    if (result.error?.includes('rate-overlimit')) {
                        io.emit('adminSyncStatus', { status: 'error', message: 'Límite de velocidad de WhatsApp alcanzado. Espera unos minutos.' });
                        return; // Stop the sync loop
                    }
                }

                // Human delay (5-10s) - Increased to avoid further rate-overlimit
                const delay = Math.floor(Math.random() * 5000) + 5000;
                await new Promise(r => setTimeout(r, delay));

            } catch (err) {
                console.error(`[WA_SYNC] Failed to process ${user.username}:`, err.message);
            }
        }

        io.emit('adminSyncStatus', { status: 'complete', message: `Sincronización finalizada.` });

    } catch (error) {
        console.error('[WA_SYNC] Error:', error.message);
        io.emit('adminError', 'Error crítico en sincronización: ' + error.message);
        io.emit('adminSyncStatus', { status: 'error', message: 'Fallo la sincronización' });
    }
}

/**
 * Cierra la conexión de WhatsApp y previene reconexiones automáticas
 */
async function stopWhatsApp() {
    isExplicitlyStopped = true;
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }

    if (waSock) {
        try {
            console.log('[WA_SERVICE] Stopping WhatsApp socket...');
            waSock.ev.removeAllListeners('connection.update');
            waSock.end(undefined);
            waSock = null;
        } catch (e) {
            console.warn('[WA_SERVICE] Error in stopWhatsApp:', e.message);
        }
    }
    waStatus = 'disconnected';
    waQr = null;
}

// Getters para estado
function getSocket() { return waSock; }
function getStatus() { return waStatus; }
function getQr() { return waQr; }
function getGroups() { return waGroups; }


module.exports = {
    connectToWhatsApp,
    sendHumanizedMessage,
    sendMessageWithTyping,
    fetchBotGroups,
    addUserToGroup,
    ensureUserInGroup, // New export
    syncGroupParticipants,
    loadWaDependencies,
    stopWhatsApp, // New export
    getSocket,
    getStatus,
    getQr,
    getGroups
};
