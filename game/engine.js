const RANK_CONFIG = {
    'BRONCE': { min: 0, max: 100, stake: 1 },
    'PLATA': { min: 101, max: 300, stake: 2 },
    'ORO': { min: 301, max: 600, stake: 5 },
    'PLATINO': { min: 601, max: 1000, stake: 10 },
    'DIAMANTE': { min: 1001, max: 2000, stake: 25 },
    'LEYENDA': { min: 2001, max: 999999, stake: 50 }
};

function determineWinner(choice1, choice2) {
    if (choice1 === choice2) return 'tie';
    if (
        (choice1 === 'rock' && choice2 === 'scissors') ||
        (choice1 === 'paper' && choice2 === 'rock') ||
        (choice1 === 'scissors' && choice2 === 'paper')
    ) {
        return 'player1';
    }
    return 'player2';
}

function getRankByRp(rp) {
    for (const [rank, config] of Object.entries(RANK_CONFIG)) {
        if (rp >= config.min && rp <= config.max) return rank;
    }
    return 'BRONCE';
}

module.exports = {
    RANK_CONFIG,
    determineWinner,
    getRankByRp
};
