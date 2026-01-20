export type Choice = 'rock' | 'paper' | 'scissors';
export type GameState = 'lobby' | 'waiting' | 'countdown' | 'playing' | 'roundResult' | 'gameOver';

export interface Player {
    id: string;
    socketId: string;
    score: number;
    choice: Choice | null;
    ready: boolean;
}

export interface GameRoom {
    id: string;
    players: [Player, Player];
    round: number;
    state: GameState;
    countdown: number;
    winner: string | null;
    rematchRequested: false;
    rematchRequestedBy: string | null;
    inactivityTies: number;
}

export interface RoundResult {
    playerChoice: Choice;
    opponentChoice: Choice;
    winner: 'player' | 'opponent' | 'tie';
    playerScore: number;
    opponentScore: number;
    timeout?: boolean;
}

export interface GameOverData {
    winner: 'player' | 'opponent';
    finalScore: {
        player: number;
        opponent: number;
    };
    prize?: number;
    rpChange?: number;
    newRp?: number;
    newRank?: string;
    mode?: string;
    stake?: number;
    newCoins?: number;
    newGems?: number;
}
