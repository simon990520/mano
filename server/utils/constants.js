/**
 * CONSTANTS & GLOBAL CONFIGURATION
 * 
 * Configuraciones globales compartidas entre módulos
 */

// Bot Configuration (loaded from Supabase)
let botConfig = {
    enabled: true,
    lobby_wait_seconds: 25,
    random_mode_enabled: true
};

// App Settings (Dynamic configurations from DB)
let appSettings = {
    whatsapp_contact_number: '573146959639',
    whatsapp_group_id: '',
    ai_faq_prompt: 'Eres un asistente experto en el juego Piedra.fun. Responde de forma concisa y divertida.'
};

// Bot Arena Configs (loaded from DB)
let botArenaConfigs = [];
let botArenaStats = [];

// Daily reward cooldown cache (userId -> lastClaimTime)
const dailyRewardCooldowns = new Map();

// Bonus claim security lock
const bonusClaimLock = new Set();

/**
 * Updates botConfig
 * @param {Object} newConfig - New configuration object
 */
function updateBotConfig(newConfig) {
    botConfig = { ...botConfig, ...newConfig };
}

/**
 * Updates appSettings
 * @param {Object} newSettings - New settings object
 */
function updateAppSettings(newSettings) {
    appSettings = { ...appSettings, ...newSettings };
}

/**
 * Updates bot arena configs
 * @param {Array} configs - Arena configurations
 */
function updateBotArenaConfigs(configs) {
    botArenaConfigs = configs;
}

/**
 * Updates bot arena stats
 * @param {Array} stats - Arena statistics
 */
function updateBotArenaStats(stats) {
    botArenaStats = stats;
}

module.exports = {
    // Configuration objects
    botConfig,
    appSettings,
    botArenaConfigs,
    botArenaStats,

    // State maps
    dailyRewardCooldowns,
    bonusClaimLock,

    // Update functions
    updateBotConfig,
    updateAppSettings,
    updateBotArenaConfigs,
    updateBotArenaStats
};
