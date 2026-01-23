const crypto = require('crypto');

const activeRooms = new Map();

function createRoom(player1, player2) {
    const roomId = crypto.randomUUID();
    return {
        id: roomId,
        players: [player1, player2],
        round: 1,
        state: 'countdown',
        countdown: 3,
        winner: null,
        rematchRequested: false,
        rematchRequestedBy: null,
        inactivityTies: 0,
        roundTimeout: null,
        stats: {
            [player1.userId]: { rock: 0, paper: 0, scissors: 0, openings: { rock: 0, paper: 0, scissors: 0 } },
            [player2.userId]: { rock: 0, paper: 0, scissors: 0, openings: { rock: 0, paper: 0, scissors: 0 } }
        }
    };
}

function findRoomById(roomId) {
    for (const room of activeRooms.values()) {
        if (room.id === roomId) return room;
    }
    return null;
}

module.exports = {
    activeRooms,
    createRoom,
    findRoomById
};
