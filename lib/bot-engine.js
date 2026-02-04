/**
 * Bot Engine - Sistema de IA Adaptativa para Rock Paper Scissors
 * Mantiene una tasa de victoria del 50% por arena ajustando su estrategia
 */

const choices = ['rock', 'paper', 'scissors'];

/**
 * Determina la elección ganadora contra una jugada específica
 */
function getWinningChoice(opponentChoice) {
    const winMap = {
        rock: 'paper',
        paper: 'scissors',
        scissors: 'rock'
    };
    return winMap[opponentChoice];
}

/**
 * Determina la elección perdedora contra una jugada específica
 */
function getLosingChoice(opponentChoice) {
    const loseMap = {
        rock: 'scissors',
        paper: 'rock',
        scissors: 'paper'
    };
    return loseMap[opponentChoice];
}

/**
 * Elección completamente aleatoria
 */
function getRandomChoice() {
    return choices[Math.floor(Math.random() * choices.length)];
}

/**
 * Decide si el bot debe intentar ganar esta ronda
 * Basado en la diferencia entre win rate actual y objetivo
 */
function shouldBotWin(currentWinRate, targetWinRate) {
    const difference = currentWinRate - targetWinRate;

    // Si está muy por debajo del objetivo (>5%), aumentar probabilidad de ganar
    if (difference < -5) {
        return Math.random() < 0.7; // 70% probabilidad de intentar ganar
    }
    // Si está muy por encima del objetivo (>5%), aumentar probabilidad de perder
    else if (difference > 5) {
        return Math.random() < 0.3; // 30% probabilidad de intentar ganar
    }
    // Si está cerca del objetivo (±5%), 50/50 aleatorio
    else {
        return Math.random() < 0.5;
    }
}

/**
 * Calcula la elección del bot para una ronda
 * Estrategia adaptativa basada en win rate
 */
function calculateBotChoice(currentWinRate, targetWinRate, opponentLastChoice = null) {
    const shouldWin = shouldBotWin(currentWinRate, targetWinRate);

    // Si no tenemos historial del oponente, jugar aleatorio
    if (!opponentLastChoice) {
        return getRandomChoice();
    }

    // Estrategia básica: predecir que el jugador repetirá o cambiará
    // El bot NO es omnisciente - solo puede usar historial pasado

    if (shouldWin) {
        // Intentar ganar: asumir que el jugador repite y contraatacar
        // (Esto es una simplificación - un bot más avanzado usaría patrones)
        return getWinningChoice(opponentLastChoice);
    } else {
        // Intentar perder: asumir que el jugador repite y perder intencionalmente
        return getLosingChoice(opponentLastChoice);
    }
}

/**
 * Genera una opción del bot durante el juego real
 * Esta función es la interfaz principal que usa el servidor
 */
function getBotChoice(room, botPlayer, botStats, arenaConfigs = []) {
    const mode = room.mode;
    const stake = room.stakeTier;

    // Obtener las estadísticas actuales del bot para esta arena
    const arenaStats = botStats.find(s => s.mode === mode && s.stake_tier === stake);

    // Obtener la configuración específica (aquí está el flag is_random)
    const arenaConfig = arenaConfigs.find(c => c.mode === mode && c.stake_tier === stake);

    const currentWinRate = arenaStats?.current_win_rate || 50.0;
    const targetWinRate = arenaStats?.target_win_rate || 50.0;

    // Prioridad al flag en la configuración de la arena
    const isRandom = arenaConfig?.is_random || arenaStats?.is_random || false;

    // Obtener la última jugada del oponente (si existe)
    const opponent = room.players.find(p => p.userId !== botPlayer.userId);
    const opponentLastChoice = opponent?.lastChoice || null;

    // Calcular y retornar la elección del bot
    let choice;
    if (isRandom) {
        choice = getRandomChoice();
        console.log(`[BOT_ENGINE] Arena: ${mode}/${stake} | Mode: RANDOM | Choice: ${choice}`);
    } else {
        choice = calculateBotChoice(currentWinRate, targetWinRate, opponentLastChoice);
        console.log(`[BOT_ENGINE] Arena: ${mode}/${stake} | Win Rate: ${currentWinRate.toFixed(1)}% (Target: ${targetWinRate}%) | Choice: ${choice}`);
    }

    return choice;
}

/**
 * Crea un perfil virtual del bot para una partida
 */
function createBotProfile() {
    return {
        id: 'bot_ai_opponent',
        username: '🤖 CPU Challenger',
        isBot: true,
        coins: 999999,
        gems: 999999,
        rp: 1000,
        rank_name: 'MAESTRO'
    };
}

module.exports = {
    getBotChoice,
    createBotProfile,
    calculateBotChoice,
    shouldBotWin,
    getRandomChoice,
    getWinningChoice,
    getLosingChoice
};
