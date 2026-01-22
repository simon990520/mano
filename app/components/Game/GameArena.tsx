import React from 'react';
import type { Choice, GameState } from '@/lib/types';

interface GameArenaProps {
    gameState: GameState;
    playerScore: number;
    opponentScore: number;
    user: any;
    opponentImageUrl: string | null;
    showCollision: boolean;
    playerChoice: Choice | null;
    opponentChoice: Choice | null;
    round: number;
    roundWinner: 'player' | 'opponent' | 'tie' | null;
    turnTimer: number;
    currentMatchStake: number | null;

    gameMode: 'casual' | 'ranked';
    countdown: number;
    onShowStats: (userId: string) => void;
    opponentId?: string | null;
}

const CHOICE_EMOJIS = {
    rock: '✊',
    paper: '✋',
    scissors: '✌️'
};

export const GameArena: React.FC<GameArenaProps> = ({
    gameState,
    playerScore,
    opponentScore,
    user,
    opponentImageUrl,
    showCollision,
    playerChoice,
    opponentChoice,
    round,
    roundWinner,
    turnTimer,
    currentMatchStake,
    gameMode,
    countdown,
    onShowStats,
    opponentId
}) => {
    return (
        <div className={`game-container ${(gameState === 'roundResult' && showCollision) ? 'shake' : ''}`}>
            {/* Integrated Vertical Score Bars */}
            {(gameState === 'playing' || gameState === 'roundResult' || gameState === 'countdown' || gameState === 'gameOver') && (
                <>
                    <div className="score-bar score-bar-left">
                        <div className="score-text" style={{ color: 'var(--score-green)' }}>{playerScore}</div>
                        <div className="score-track">
                            <div className="score-fill fill-left" style={{ height: `${(playerScore / 3) * 100}%` }}></div>
                        </div>
                        <div
                            className="score-avatar clickable"
                            onClick={() => user?.id && onShowStats(user.id)}
                            style={{ cursor: 'pointer', pointerEvents: 'auto', zIndex: 100 }}
                            title="Ver mis estadísticas"
                        >
                            {user?.imageUrl ? <img src={user.imageUrl} className="avatar-img" alt="You" /> : <span style={{ fontSize: '1.5rem' }}>😎</span>}
                        </div>
                    </div>
                    <div className="score-bar score-bar-right">
                        <div className="score-text" style={{ color: 'var(--score-red)' }}>{opponentScore}</div>
                        <div className="score-track">
                            <div className="score-fill fill-right" style={{ height: `${(opponentScore / 3) * 100}%` }}></div>
                        </div>
                        <div
                            className="score-avatar clickable"
                            onClick={() => opponentId && onShowStats(opponentId)}
                            style={{ cursor: 'pointer', pointerEvents: 'auto', zIndex: 100 }}
                            title="Ver perfil del oponente"
                        >
                            {opponentImageUrl ? <img src={opponentImageUrl} className="avatar-img" alt="Opponent" /> : <span style={{ fontSize: '1.5rem' }}>🤖</span>}
                        </div>
                    </div>
                </>
            )}

            {/* Simplified Top Info Bar */}
            {(gameState === 'playing' || gameState === 'roundResult' || gameState === 'gameOver') && (
                <div className="top-info-bar" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    {currentMatchStake && (
                        <div
                            className="stake-badge"
                            style={{
                                position: 'relative',
                                overflow: 'hidden',
                                background: gameState === 'playing' ? 'rgba(0,0,0,0.3)' : undefined
                            }}
                        >
                            {gameState === 'playing' && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        height: '100%',
                                        width: `${(turnTimer / 3) * 100}%`,
                                        background: 'linear-gradient(90deg, #ffd700, #ff8c00)',
                                        transition: 'width 0.1s linear',
                                        zIndex: 0
                                    }}
                                />
                            )}
                            <span style={{ position: 'relative', zIndex: 1 }}>
                                APUESTA: {currentMatchStake * 2} {gameMode === 'casual' ? '🪙' : '💎'}
                            </span>
                        </div>
                    )}
                    {gameState === 'playing' && (
                        <div className="game-status-text" style={{ fontSize: '1.5rem', fontWeight: 900 }}>ROUND {round}</div>
                    )}
                    {(gameState === 'roundResult') && (
                        <div className="game-status-text result" style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '4px' }}>
                            {roundWinner === 'player' ? 'WIN' : roundWinner === 'opponent' ? 'LOSS' : 'TIE'}
                        </div>
                    )}
                </div>
            )}

            {/* Hands visual with collision animation */}
            {(gameState === 'countdown' || gameState === 'playing' || gameState === 'roundResult') && (
                <div className="hands-container">
                    <div className={`hand top ${showCollision ? 'collide-top' : ''}`}>
                        {gameState === 'roundResult' && opponentChoice ? CHOICE_EMOJIS[opponentChoice] : '✊'}
                    </div>
                    <div className={`hand bottom ${showCollision ? 'collide-bottom' : ''}`}>
                        {gameState === 'roundResult' && playerChoice ? CHOICE_EMOJIS[playerChoice] : '✊'}
                    </div>
                </div>
            )}

            {/* Countdown Overlay */}
            {gameState === 'countdown' && (
                <div className="countdown-overlay">
                    <div className="countdown">{countdown}</div>
                </div>
            )}

            {/* Reconnection Overlay - Simplified to use boolean or flag if available */}
            {gameState === 'playing' && (
                <div id="disconnection-overlay" style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)', zIndex: 9999,
                    display: 'none', // Controlled by external logic or state if we add it
                    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(5px)'
                }}>
                    <div style={{ fontSize: '3rem', animation: 'pulse 1s infinite' }}>⚠️</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ff4444', marginTop: '10px' }}>OPPONENT DISCONNECTED</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '5px' }}>Waiting for reconnection...</div>
                </div>
            )}

            {gameState === 'playing' && (
                <div className="center-content">
                    <h1 className="game-subtitle">FIGHT</h1>
                </div>
            )}
        </div>
    );
};
