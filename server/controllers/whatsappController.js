/**
 * WHATSAPP CONTROLLER
 * 
 * Event handlers y lógica del controlador para WhatsApp Bot
 */

const { processIncomingMessage } = require('../services/aiService');
const {
    sendMessageWithTyping,
    sendHumanizedMessage,
    fetchBotGroups,
    connectToWhatsApp,
    getStatus,
    getQr,
    getGroups,
    getSocket,
    addUserToGroup
} = require('../services/whatsappService');
const { appSettings } = require('../utils/constants');

/**
 * Handler de mensajes entrantes de WhatsApp
 * Procesa con IA y responde con humanización
 * @param {Object} msg - Mensaje de Baileys
 */
async function handleIncomingWaMessage(msg) {
    const sender = msg.key.remoteJid;
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

    const result = await processIncomingMessage({ sender, body });

    if (result.shouldRespond && result.response) {
        try {
            await sendMessageWithTyping(sender, result.response);
        } catch (err) {
            console.error('[WA_CONTROLLER] Error sending response:', err.message);
        }
    }
}

/**
 * Envía mensaje de bienvenida a nuevo usuario
 * @param {string} phoneNumber - Número de teléfono con código de país
 * @param {string} username - Nombre de usuario
 */
async function sendWelcomeMessage(phoneNumber, username) {
    const waSock = getSocket();
    const waStatus = getStatus();

    if (!waSock || waStatus !== 'connected') {
        console.log('[WA_CONTROLLER] Cannot send welcome: not connected');
        return false;
    }

    try {
        const jid = phoneNumber.replace('+', '').replace(/\s/g, '') + '@s.whatsapp.net';

        // Welcome DM
        const welcomeMsg = `¡Bienvenido *${username}* a Piedra.fun! 🚀\n\nTu cuenta ha sido creada con éxito y has recibido un bono de *30 monedas*. 🪙\n\nSi tienes dudas, ¡pregúntame por aquí! Soy tu asistente IA.`;
        await sendHumanizedMessage(jid, welcomeMsg);

        //  Group Invitation (if configured)
        if (appSettings.whatsapp_group_id) {
            const added = await addUserToGroup(appSettings.whatsapp_group_id, jid);
            if (added) {
                console.log(`[WA_CONTROLLER] Added ${username} to group`);
            }
        }

        return true;
    } catch (error) {
        console.error('[WA_CONTROLLER] Error sending welcome message:', error.message);
        return false;
    }
}

/**
 * Registra event handlers de WhatsApp en Socket.io
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Socket.io client socket
 * @param {string} userId - ID del usuario
 * @param {Function} isAdmin - Función para verificar si es admin
 */
function registerWhatsappHandlers(io, socket, userId, isAdmin) {
    const { supabase } = require('../../lib/supabase-server');
    const { updateAppSettings } = require('../utils/constants');

    // [ADMIN] Get WhatsApp bot status and groups
    socket.on('getWaStatus', async () => {
        if (!isAdmin(userId)) {
            console.log(`[WA_ADMIN] Unauthorized access attempt from ${userId}`);
            return;
        }

        console.log('[WA_ADMIN] Sending status to admin');
        socket.emit('waStatusUpdated', {
            status: getStatus(),
            qr: getQr()
        });

        // If connected, fetch and send groups
        if (getStatus() === 'connected') {
            const groups = await fetchBotGroups();
            socket.emit('waGroupsUpdated', { groups: getGroups() });
        }
    });

    // [ADMIN] Get WhatsApp groups list
    socket.on('getWaGroups', async () => {
        if (!isAdmin(userId)) return;

        console.log('[WA_ADMIN] Fetching WhatsApp groups for admin');
        const groups = await fetchBotGroups();
        socket.emit('waGroupsUpdated', { groups });
    });

    // [ADMIN] Force WhatsApp reconnection
    socket.on('waReconnect', () => {
        if (!isAdmin(userId)) return;

        console.log('[WA_BOT] Manual reconnect requested by admin');
        connectToWhatsApp(io);
    });

    // [ADMIN] Get current app settings
    socket.on('getAppSettings', async () => {
        const { loadAppSettings } = require('../../server');
        await loadAppSettings();
        socket.emit('appSettingsUpdated', appSettings);
    });

    // [ADMIN] Update app settings (contact number, group ID, AI prompt)
    socket.on('updateAppSettings', async (data) => {
        if (!isAdmin(userId)) {
            return socket.emit('adminError', 'No autorizado');
        }

        console.log('[WA_ADMIN] Updating app settings:', Object.keys(data));

        try {
            for (const [key, value] of Object.entries(data)) {
                if (appSettings.hasOwnProperty(key)) {
                    console.log(`[WA_ADMIN] Updating ${key} to: ${value.substring ? value.substring(0, 50) + '...' : value}`);

                    await supabase.from('app_settings').upsert({
                        key,
                        value
                    }, {
                        onConflict: 'key'
                    });

                    // Update local cache
                    updateAppSettings({ [key]: value });
                }
            }

            const { loadAppSettings } = require('../../server');
            await loadAppSettings(); // Reload from DB to ensure consistency

            socket.emit('adminSuccess', 'Configuración actualizada correctamente');
            io.emit('appSettingsUpdated', appSettings); // Broadcast to all clients

            console.log('[WA_ADMIN] Settings updated successfully');
        } catch (e) {
            console.error('[WA_ADMIN] Error updating settings:', e.message);
            socket.emit('adminError', 'Error actualizando configuración: ' + e.message);
        }
    });
}

module.exports = {
    handleIncomingWaMessage,
    sendWelcomeMessage,
    registerWhatsappHandlers
};
