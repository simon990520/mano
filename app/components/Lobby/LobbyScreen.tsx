import React, { useMemo } from 'react';
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
    onShowStats?: () => void;
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
    rp,
    onShowStats
}) => {
    // Current Rank Helper
    const currentRank = useMemo(() =>
        RANKS.find(r => r.id === rankName) || RANKS[0]
        , [rankName]);

    // Next Rank Helper
    const nextRank = useMemo(() =>
        RANKS.find(r => r.minRp > currentRank.maxRp)
        , [currentRank]);

    // Progress Calculation
    const progressPercent = useMemo(() => {
        if (!currentRank) return 0;
        const totalRange = currentRank.maxRp - currentRank.minRp;
        if (totalRange <= 0) return 100; // Max level or error
        const currentProgress = rp - currentRank.minRp;
        const percent = (currentProgress / totalRange) * 100;
        return Math.min(100, Math.max(0, percent));
    }, [rp, currentRank]);

    return (
        <div className="center-content">
            <div style={{ textAlign: 'center' }}>
                <h1 className="game-title" style={{ marginBottom: '40px' }}>
                    ROCK<br />PAPER<br />SCISSORS
                </h1>

                <SignedOut>
                    <SignInButton mode="modal">
                        <button className="btn-primary">
                            INICIAR
                        </button>
                    </SignInButton>
                    <p style={{ marginTop: '15px', opacity: 0.6, fontSize: '0.9rem' }}>
                        Inicia sesión para jugar
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
                                <div
                                    className="ranked-banner clickable"
                                    onClick={onShowStats}
                                    style={{
                                        border: `1px solid ${currentRank.color}44`,
                                        boxShadow: `0 4px 15px rgba(0,0,0,0.3), inset 0 0 10px ${currentRank.color}22`,
                                        cursor: 'pointer'
                                    } as any}
                                    title="Ver mis estadísticas"
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ fontSize: '2.5rem', filter: `drop-shadow(0 0 10px ${currentRank.color})` }}>
                                            {currentRank.icon}
                                        </div>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{
                                                fontSize: '1.1rem',
                                                fontWeight: 900,
                                                color: currentRank.color,
                                                textTransform: 'uppercase',
                                                letterSpacing: '1px'
                                            }}>{currentRank.name}</div>
                                            <div style={{ fontSize: '0.9rem', opacity: 0.8, fontWeight: 700 }}>{rp} RP</div>
                                        </div>
                                    </div>
                                    <div style={{ width: '40%', maxWidth: '150px' }}>
                                        {/* Dynamic Progress Bar */}
                                        <div className="rp-progress-bg" style={{
                                            height: '6px',
                                            marginTop: '0',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: '3px',
                                            overflow: 'hidden'
                                        }}>
                                            <div className="rp-progress-fill" style={{
                                                width: `${progressPercent}%`,
                                                backgroundColor: currentRank.color,
                                                height: '100%',
                                                boxShadow: `0 0 10px ${currentRank.color}`,
                                                transition: 'width 0.5s ease-out'
                                            }}></div>
                                        </div>

                                        <div style={{ fontSize: '0.65rem', textAlign: 'right', marginTop: '4px', opacity: 0.5, fontWeight: 700 }}>
                                            NEXT: {nextRank?.name || 'MAX'}
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
