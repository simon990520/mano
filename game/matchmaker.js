const crypto = require('crypto');

const waitingPlayers = {
    10: [],
    100: [],
    500: [],
    1000: []
};

const waitingRanked = {
    'BRONCE': [],
    'PLATA': [],
    'ORO': [],
    'PLATINO': [],
    'DIAMANTE': [],
    'LEYENDA': []
};

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

function removeFromQueue(socketId, uId = null) {
    console.log(`[SERVER_GAME] Cleaning queues for socket: ${socketId}${uId ? `, user: ${uId}` : ''}`);
    // Remove from Casual
    Object.values(waitingPlayers).forEach(queue => {
        const index = queue.findIndex(p => p.socketId === socketId || (uId && p.userId === uId));
        if (index !== -1) queue.splice(index, 1);
    });
    // Remove from Ranked
    Object.values(waitingRanked).forEach(queue => {
        const index = queue.findIndex(p => p.socketId === socketId || (uId && p.userId === uId));
        if (index !== -1) queue.splice(index, 1);
    });
}

module.exports = {
    waitingPlayers,
    waitingRanked,
    createPlayer,
    removeFromQueue
};
