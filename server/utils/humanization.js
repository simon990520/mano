/**
 * HUMANIZATION & ANTI-DETECTION UTILITIES
 * 
 * Funciones para hacer que el bot de WhatsApp se comporte de manera natural
 * y evitar detección como bot automatizado.
 */

// ESTADO GLOBAL
const messageHistory = new Map(); // Track message patterns
const lastMessageTime = new Map(); // Anti-spam tracking

/**
 * Genera un delay aleatorio entre min y max milisegundos
 * @param {number} min - Tiempo mínimo en ms
 * @param {number} max - Tiempo máximo en ms
 * @returns {number} Delay aleatorio en ms
 */
function getHumanDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calcula duración de "typing" basado en longitud del mensaje
 * Simula velocidad de escritura humana (45-60 cps)
 * @param {number} messageLength - Longitud del mensaje en caracteres
 * @returns {number} Duración en ms
 */
function getTypingDuration(messageLength) {
    // Average typing speed: 40-60 chars per second
    const baseSpeed = 45 + Math.random() * 15; // 45-60 cps
    const duration = (messageLength / baseSpeed) * 1000;
    // Add random pause (thinking time)
    const thinkingTime = Math.random() * 2000; // 0-2s
    return Math.min(duration + thinkingTime, 10000); // Max 10s
}

/**
 * Agrega variaciones casuales al mensaje (emojis, etc.)
 * Solo 20% de las veces para mantener naturalidad
 * @param {string} text - Texto original
 * @returns {string} Texto con posible variación
 */
function humanizeMessage(text) {
    // Occasionally add casual variations (20% of the time)
    if (Math.random() > 0.8) {
        const variations = ['😊', '👍', '🙂', '✨'];
        const variation = variations[Math.floor(Math.random() * variations.length)];
        return text + ` ${variation}`;
    }
    return text;
}

/**
 * Verifica si un usuario está enviando mensajes demasiado rápido (spam)
 * @param {string} userId - ID del usuario (JID de WhatsApp)
 * @returns {boolean} true si está spammeando
 */
function isSpamming(userId) {
    const now = Date.now();
    const lastTime = lastMessageTime.get(userId) || 0;
    const timeDiff = now - lastTime;

    if (timeDiff < 3000) { // Less than 3 seconds between messages
        return true;
    }

    lastMessageTime.set(userId, now);
    return false;
}

/**
 * Limpia el historial de mensajes antiguos (garbage collection)
 * Llamar periódicamente para evitar memory leaks
 */
function cleanupMessageHistory() {
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;

    for (const [userId, timestamp] of lastMessageTime.entries()) {
        if (now - timestamp > HOUR) {
            lastMessageTime.delete(userId);
            messageHistory.delete(userId);
        }
    }
}

// Cleanup cada hora
setInterval(cleanupMessageHistory, 60 * 60 * 1000);

module.exports = {
    getHumanDelay,
    getTypingDuration,
    humanizeMessage,
    isSpamming,
    messageHistory,
    lastMessageTime,
    cleanupMessageHistory
};
