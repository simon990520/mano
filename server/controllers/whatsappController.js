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
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.quotedMessage?.conversation;
    
    console.log(`[WA_BOT_TRACE] Incoming message from ${sender}. Body: ${body?.substring(0, 50)}...`);

    if (!body) {
        console.log('[WA_BOT_TRACE] Message body is empty or type not supported, ignoring.');
        return;
    }

    try {
        const result = await processIncomingMessage({ sender, body });
        console.log(`[WA_BOT_TRACE] AI Result for ${sender}: shouldRespond=${result.shouldRespond}, responseLen=${result.response?.length}`);

        if (result.shouldRespond && result.response) {
            await sendMessageWithTyping(sender, result.response);
            console.log(`[WA_BOT_TRACE] Response sent to ${sender}`);
        }
    } catch (err) {
        console.error('[WA_BOT_TRACE] Error in handleIncomingWaMessage:', err.message);
    }
}

/**
 * Envía mensaje de bienvenida a nuevo usuario
 * @param {string} phoneNumber - Número de teléfono con código de país
 * @param {string} username - Nombre de usuario
 */
async function sendWelcomeMessage(phoneNumber, username) {
    console.log(`[WA_BOT_TRACE] sendWelcomeMessage entry. Phone: ${phoneNumber}, User: ${username}`);
    const waSock = getSocket();
    const waStatus = getStatus();

    if (!waSock || waStatus !== 'connected') {
        console.log(`[WA_BOT_TRACE] Cannot send welcome: not connected (Status: ${waStatus})`);
        return false;
    }

    try {
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const jid = `${cleanPhone}@s.whatsapp.net`;
        console.log(`[WA_BOT_TRACE] Constructed JID: ${jid}`);

        let userWasAdded = false;

        //  Group Invitation (if configured)
        console.log(`[WA_BOT_TRACE] Checking group ID: ${appSettings.whatsapp_group_id}`);
        if (appSettings.whatsapp_group_id) {
            console.log(`[WA_BOT_TRACE] Adding ${username} to group ${appSettings.whatsapp_group_id}`);
            const result = await addUserToGroup(appSettings.whatsapp_group_id, jid);
            if (result.added) {
                console.log(`[WA_BOT_TRACE] Success: Added ${username} to group`);
                userWasAdded = true;
            } else if (result.alreadyMember) {
                console.log(`[WA_BOT_TRACE] ${username} was already a member.`);
            } else {
                console.warn(`[WA_BOT_TRACE] Failed: Could not add ${username} to group:`, result.error);
            }
        }

        // Welcome DM - Always send if it's a welcome flow (new phone/onboarding)
        const welcomeMsg = `¡Bienvenido *${username}* a Piedra.fun! 🚀\n\nTu cuenta ha sido creada con éxito y has recibido un bono de *30 monedas*. 🪙\n\nSi tienes dudas, ¡pregúntame por aquí! Soy tu asistente IA.`;
        console.log(`[WA_BOT_TRACE] Sending Welcome DM to ${jid}...`);
        await sendHumanizedMessage(jid, welcomeMsg);

        return true;
    } catch (error) {
        console.error('[WA_BOT_TRACE] Error in welcome flow:', error.message);
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

    // [ADMIN] Expose Group Sync
    socket.on('syncWaGroup', async (data) => {
        if (!isAdmin(userId)) return socket.emit('adminError', 'No autorizado');

        const { groupId } = data;
        if (!groupId) return socket.emit('adminError', 'Faltan parámetros (groupId)');

        const { syncGroupParticipants } = require('../services/whatsappService');
        try {
            // Run in background, don't await blocking
            syncGroupParticipants(io, groupId);
            socket.emit('adminSuccess', 'Sincronización iniciada en segundo plano...');
        } catch (e) {
            socket.emit('adminError', 'Error al iniciar sync: ' + e.message);
        }
    });
}

module.exports = {
    handleIncomingWaMessage,
    sendWelcomeMessage,
    registerWhatsappHandlers
};
