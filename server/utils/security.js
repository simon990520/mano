/**
 * SECURITY UTILITIES
 * 
 * Funciones de seguridad, sanitización y validación
 */

// Admin whitelist from .env
const adminIds = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim());

/**
 * Verifica si un usuario es administrador
 * @param {string} userId - ID del usuario
 * @returns {boolean} true si es admin
 */
function isAdmin(userId) {
    return adminIds.includes(userId);
}

/**
 * Sanitiza input del usuario removiendo HTML y limitando longitud
 * @param {string} str - String a sanitizar
 * @returns {string} String limpio
 */
function sanitizeInput(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>]/g, '').trim().substring(0, 30); // Remove HTML tags and limit length
}

/**
 * Valida formato de número de teléfono
 * @param {string} phoneNumber - Número a validar
 * @returns {boolean} true si es válido
 */
function validatePhoneNumber(phoneNumber) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber.replace(/\s/g, ''));
}

/**
 * Stakes permitidos para evitar manipulación
 */
const ALLOWED_STAKES = [10, 50, 100, 500, 1000];

/**
 * Valida que un stake sea permitido
 * @param {number} stake - Cantidad apostada
 * @returns {boolean} true si es válido
 */
function isValidStake(stake) {
    return ALLOWED_STAKES.includes(stake);
}

module.exports = {
    isAdmin,
    sanitizeInput,
    validatePhoneNumber,
    isValidStake,
    ALLOWED_STAKES,
    adminIds
};
