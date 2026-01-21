import React from 'react';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';

interface LobbyScreenProps {
    user: any;
    gameMode: 'casual' | 'ranked';
    setGameMode: (mode: 'casual' | 'ranked') => void;
    selectedStake: number;
    setSelectedStake: (stake: number) => void;
    onFindMatch: () => void;
    playSound: (path: string) => void;

    // Ranked Props
    rankName: string;
    rp: number;
}

const ARENAS = [
    { id: 10, name: 'NOVATO', icon: '🪙', color: '#4caf50', entry: 10, prize: 20 },
    { id: 100, name: 'AVANZADO', icon: '🔥', color: '#ff9800', entry: 100, prize: 200 },
    { id: 500, name: 'ELITE', icon: '💎', color: '#2196f3', entry: 500, prize: 1000 },
    { id: 1000, name: 'LEYENDA', icon: '👑', color: '#e91e63', entry: 1000, prize: 2000 }
];

const RANKED_ARENAS = [
    { id: 10, name: 'NOVATO', icon: '🪙', color: '#4caf50', entry: 10, prize: 20 },
    { id: 100, name: 'AVANZADO', icon: '🔥', color: '#ff9800', entry: 100, prize: 200 },
    { id: 500, name: 'ELITE', icon: '💎', color: '#2196f3', entry: 500, prize: 1000 },
    { id: 1000, name: 'LEYENDA', icon: '👑', color: '#e91e63', entry: 1000, prize: 2000 }
];

const RANKS = [
    { id: 'BRONCE', name: 'BRONCE', icon: '🥉', color: '#cd7f32', minRp: 0, maxRp: 100, stake: 1 },
    { id: 'PLATA', name: 'PLATA', icon: '🥈', color: '#c0c0c0', minRp: 101, maxRp: 300, stake: 2 },
    { id: 'ORO', name: 'ORO', icon: '🥇', color: '#ffd700', minRp: 301, maxRp: 600, stake: 5 },
    { id: 'PLATINO', name: 'PLATINO', icon: '💠', color: '#e5e4e2', minRp: 601, maxRp: 1000, stake: 10 },
    { id: 'DIAMANTE', name: 'DIAMANTE', icon: '💎', color: '#b9f2ff', minRp: 1001, maxRp: 2000, stake: 25 },
    { id: 'LEYENDA', name: 'LEYENDA', icon: '👑', color: '#ff00ff', minRp: 2001, maxRp: 999999, stake: 50 }
];

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
    user,
    gameMode,
    setGameMode,
    selectedStake,
    setSelectedStake,
    onFindMatch,
    playSound,
    rankName,
    rp
}) => {
    return (
        <div className="center-content">
            <div style={{ textAlign: 'center' }}>
                <h1 className="game-title" style={{ marginBottom: '40px' }}>
                    ROCK<br />PAPER<br />SCISSORS
                </h1>

                <SignedOut>
                    <SignInButton mode="modal">
                        <button className="btn-primary">
                            START
                        </button>
                    </SignInButton>
                    <p style={{ marginTop: '15px', opacity: 0.6, fontSize: '0.9rem' }}>
                        Sign in required to play
                    </p>
                </SignedOut>

                <SignedIn>
                    {/* Mode Selector */}
                    <div className="mode-toggle-container">
                        <button
                            className={`mode-btn ${gameMode === 'casual' ? 'active' : ''}`}
                            onClick={() => { setGameMode('casual'); playSound('/sounds/sfx/click.mp3'); }}
                        >
                            CASUAL
                        </button>
                        <button
                            className={`mode-btn ${gameMode === 'ranked' ? 'active' : ''}`}
                            onClick={() => { setGameMode('ranked'); playSound('/sounds/sfx/click.mp3'); }}
                        >
                            RANKED
                        </button>
                    </div>

                    <div className="mode-display-container" style={{ display: 'block' }}>
                        <div className="arena-selector" style={{ marginTop: '0' }}>
                            <p className="arena-label">
                                {gameMode === 'casual' ? 'ELIGE TU ARENA (COINS)' : 'ELIGE TU ARENA (GEMS)'}
                            </p>

                            {gameMode === 'ranked' && (
                                <div className="ranked-banner" style={{
                                    border: `1px solid ${RANKS.find(r => r.id === rankName)?.color}44`,
                                    boxShadow: `0 4px 15px rgba(0,0,0,0.3), inset 0 0 10px ${RANKS.find(r => r.id === rankName)?.color}22`
                                } as any}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ fontSize: '2.5rem', filter: `drop-shadow(0 0 10px ${RANKS.find(r => r.id === rankName)?.color})` }}>
                                            {RANKS.find(r => r.id === rankName)?.icon}
                                        </div>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{
                                                fontSize: '1.1rem',
                                                fontWeight: 900,
                                                color: RANKS.find(r => r.id === rankName)?.color,
                                                textTransform: 'uppercase',
                                                letterSpacing: '1px'
                                            }}>{rankName}</div>
                                            <div style={{ fontSize: '0.9rem', opacity: 0.8, fontWeight: 700 }}>{rp} RP</div>
                                        </div>
                                    </div>
                                    <div style={{ width: '40%', maxWidth: '150px' }}>
                                        <div className="rp-progress-bg" style={{ height: '6px', marginTop: '0', background: 'rgba(255,255,255,0.05)' }}>
                                            <div className="rp-progress-fill" style={{
                                                width: `${Math.min(100, ((rp - (RANKS.find(r => r.id === rankName)?.minRp || 0)) / ((RANKS.find(r => r.id === rankName)?.maxRp || 1) - (RANKS.find(r => r.id === rankName)?.minRp || 0))) * 100)}%`,
                                                boxShadow: `0 0 10px ${RANKS.find(r => r.id === rankName)?.color}`
                                            }}></div>
                                        </div>
                                        <div style={{ fontSize: '0.65rem', textAlign: 'right', marginTop: '4px', opacity: 0.5, fontWeight: 700 }}>
                                            NEXT RANK: {RANKS.find(r => r.minRp > rp)?.name || 'MAX'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="arena-grid">
                                {(gameMode === 'casual' ? ARENAS : RANKED_ARENAS).map((arena) => (
                                    <div
                                        key={arena.id}
                                        className={`arena-card ${selectedStake === arena.id ? 'active' : ''}`}
                                        style={{ '--arena-color': arena.color } as any}
                                        onClick={() => {
                                            setSelectedStake(arena.id);
                                            playSound('/sounds/sfx/click.mp3');
                                        }}
                                    >
                                        <div className="arena-icon">{arena.icon}</div>
                                        <div className="arena-name">{arena.name}</div>
                                        <div className="arena-entry">{arena.entry} {gameMode === 'casual' ? '🪙' : '💎'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button
                        className="btn-primary"
                        onClick={() => {
                            playSound('/sounds/voices/announcer/battle.mp3');
                            onFindMatch();
                        }}
                        style={{ marginTop: '20px' }}
                    >
                        ¡BATALLA!
                    </button>
                    <p style={{ marginTop: '15px', opacity: 0.8, fontSize: '0.9rem', fontWeight: 600 }}>
                        Bienvenido, {user?.firstName || 'Jugador'}!
                    </p>
                </SignedIn>
            </div>
        </div>
    );
};
