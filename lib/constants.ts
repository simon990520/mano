export const CHOICE_EMOJIS = {
    rock: '✊',
    paper: '✋',
    scissors: '✌️'
};

export const ARENAS = [
    { id: 10, name: 'NOVATO', icon: '🪙', color: '#4caf50', entry: 10, prize: 20 },
    { id: 100, name: 'AVANZADO', icon: '🔥', color: '#ff9800', entry: 100, prize: 200 },
    { id: 500, name: 'ELITE', icon: '💎', color: '#2196f3', entry: 500, prize: 1000 },
    { id: 1000, name: 'LEYENDA', icon: '👑', color: '#e91e63', entry: 1000, prize: 2000 }
];

export const RANKED_ARENAS = [
    { id: 10, name: 'NOVATO', icon: '🪙', color: '#4caf50', entry: 10, prize: 20 },
    { id: 100, name: 'AVANZADO', icon: '🔥', color: '#ff9800', entry: 100, prize: 200 },
    { id: 500, name: 'ELITE', icon: '💎', color: '#2196f3', entry: 500, prize: 1000 },
    { id: 1000, name: 'LEYENDA', icon: '👑', color: '#e91e63', entry: 1000, prize: 2000 }
];

export const RANKS = [
    { id: 'BRONCE', name: 'BRONCE', icon: '🥉', color: '#cd7f32', minRp: 0, maxRp: 100, stake: 1 },
    { id: 'PLATA', name: 'PLATA', icon: '🥈', color: '#c0c0c0', minRp: 101, maxRp: 300, stake: 2 },
    { id: 'ORO', name: 'ORO', icon: '🥇', color: '#ffd700', minRp: 301, maxRp: 600, stake: 5 },
    { id: 'PLATINO', name: 'PLATINO', icon: '💠', color: '#e5e4e2', minRp: 601, maxRp: 1000, stake: 10 },
    { id: 'DIAMANTE', name: 'DIAMANTE', icon: '💎', color: '#b9f2ff', minRp: 1001, maxRp: 2000, stake: 25 },
    { id: 'LEYENDA', name: 'LEYENDA', icon: '👑', color: '#ff00ff', minRp: 2001, maxRp: 999999, stake: 50 }
];
