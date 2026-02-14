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
    io.emit('waStatusUpdated', { status: waStatus });

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
            console.log('[WA_SERVICE] Connection closed. Reconnecting:', shouldReconnect);
            waStatus = 'disconnected';
            waQr = null;
            io.emit('waStatusUpdated', { status: waStatus, qr: waQr });
            if (shouldReconnect) connectToWhatsApp(io);
        } else if (connection === 'open') {
            console.log('[WA_SERVICE] Connection opened successfully');
            waStatus = 'connected';
            waQr = null;
            io.emit('waStatusUpdated', { status: waStatus, qr: waQr });

            // Fetch groups when connected
            await fetchBotGroups();
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
            const group = groups[groupId];
            const participants = group.participants || [];
            const botJid = waSock.user.id.split(':')[0] + '@s.whatsapp.net';

            // Find bot in participants
            const botParticipant = participants.find(p => {
                const pId = p.id.split(':')[0] + '@s.whatsapp.net';
                return pId === botJid;
            });
            const isAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin');

            groupList.push({
                id: groupId,
                name: group.subject,
                participantCount: participants.length,
                isAdmin: !!isAdmin
            });
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
 * Agrega un usuario a un grupo de WhatsApp
 * @param {string} groupId - ID del grupo
 * @param {string} userJid - JID del usuario
 */
async function addUserToGroup(groupId, userJid) {
    if (!waSock || waStatus !== 'connected') {
        console.error('[WA_SERVICE] Cannot add to group: not connected');
        return false;
    }

    try {
        await waSock.groupParticipantsUpdate(groupId, [userJid], 'add');
        console.log(`[WA_SERVICE] Added user to group ${groupId}`);
        return true;
    } catch (error) {
        console.error('[WA_SERVICE] Error adding to group:', error.message);
        return false;
    }
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
    loadWaDependencies,
    getSocket,
    getStatus,
    getQr,
    getGroups
};
