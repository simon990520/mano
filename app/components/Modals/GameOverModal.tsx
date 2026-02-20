import React from 'react';
import { motion } from 'framer-motion';

interface GameOverModalProps {
    gameWinner: 'player' | 'opponent' | 'tie' | null;
    rematchRequested: boolean;
    rematchStatus: string;
    onRequestRematch: () => void;
    onPlayAgain: () => void;
    onGoToLobby: () => void;
    onRematchResponse: (accept: boolean) => void;

    // Social
    onAddFriend?: (username: string) => void;
    opponentUsername?: string;

    // Reward Data
    showRewardAnim: boolean;
    rewardData: { type: 'coins' | 'gems' | 'rp', amount: number, isWin: boolean } | null;
    inactivityRefund?: boolean; // Flag para indicar reembolso por inactividad
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
    gameWinner,
    rematchRequested,
    rematchStatus,
    onRequestRematch,
    onPlayAgain,
    onGoToLobby,
    onRematchResponse,
    showRewardAnim,
    rewardData,
    inactivityRefund = false,
    onAddFriend,
    opponentUsername
}) => {
    const isTie = gameWinner === 'tie';
    const isVictory = gameWinner === 'player';

    return (
        <div className="rematch-card">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, type: 'spring' }}
                style={{
                    fontSize: '3.5rem',
                    fontWeight: 900,
                    marginBottom: '15px',
                    color: isTie ? '#ffd700' : (isVictory ? '#00ff88' : '#ff4466'),
                    textShadow: `0 0 40px ${isTie ? '#ffd700' : (isVictory ? '#00ff88' : '#ff4466')}`,
                    textTransform: 'uppercase',
                    letterSpacing: '3px'
                }}
            >
                {isTie ? 'EMPATE' : (isVictory ? 'VICTORIA' : 'DERROTA')}
            </motion.div>

            {inactivityRefund && (
                <p style={{
                    marginBottom: '15px',
                    fontSize: '1.1rem',
                    opacity: 0.9,
                    letterSpacing: '1px',
                    color: '#ffd700',
                    fontWeight: 600
                }}>
                    Partida cancelada por inactividad mutua. Reembolsado.
                </p>
            )}

            <p style={{
                marginBottom: '30px',
                fontSize: '1rem',
                opacity: 0.7,
                letterSpacing: '1px',
                color: 'rgba(255,255,255,0.8)'
            }}>
                {isTie ? 'The match ended in a tie.' : 'Play this opponent again?'}
            </p>
            <div className="game-over-buttons">
                <button
                    className="game-action-btn active"
                    onClick={onRequestRematch}
                    disabled={rematchRequested || rematchStatus === '¡Oponente desconectado!'}
                >
                    {rematchRequested ? 'ESPERANDO...' : 'REVANCHA'}
                </button>
                <button
                    className="game-action-btn"
                    onClick={onPlayAgain}
                >
                    INICIAR
                </button>
                <button
                    className="game-action-btn"
                    onClick={onGoToLobby}
                >
                    MENÚ
                </button>
            </div>

            {opponentUsername && onAddFriend && (
                <div style={{ marginTop: '15px' }}>
                    <button
                        onClick={() => onAddFriend(opponentUsername)}
                        style={{
                            padding: '10px 20px',
                            background: 'rgba(234, 179, 8, 0.1)',
                            border: '1px solid rgba(234, 179, 8, 0.3)',
                            borderRadius: '12px',
                            color: '#eab308',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(234, 179, 8, 0.2)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(234, 179, 8, 0.1)'}
                    >
                        👤 Agregar a {opponentUsername}
                    </button>
                </div>
            )}

            {rematchStatus && (
                <div className="rematch-status" style={{ marginTop: '20px', color: 'var(--primary)', fontWeight: 600 }}>
                    {rematchStatus}
                    {(rematchStatus.includes('wants a rematch') || rematchStatus.includes('quiere una revancha')) && (
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
                            <button className="btn-primary" onClick={() => onRematchResponse(true)} style={{ padding: '8px 20px', fontSize: '0.9rem' }}>Aceptar</button>
                            <button className="btn-secondary" onClick={() => onRematchResponse(false)} style={{ padding: '8px 20px', fontSize: '0.9rem' }}>Rechazar</button>
                        </div>
                    )}
                </div>
            )}

            {/* Premium Reward Transfer Component */}
            {/* Using the logic from page.tsx lines 1309-1600+ */}
            {showRewardAnim && rewardData && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        marginTop: '30px',
                        padding: '25px',
                        background: rewardData.isWin
                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.15) 100%)'
                            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.15) 100%)',
                        backdropFilter: 'blur(20px) saturate(180%)',
                        borderRadius: '20px',
                        border: `2px solid ${rewardData.isWin ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        boxShadow: rewardData.isWin
                            ? '0 8px 32px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                            : '0 8px 32px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                        position: 'relative',
                        overflow: 'hidden',
                        width: '100%',
                        maxWidth: '400px'
                    }}
                >
                    {/* Glow Effect Background */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '200px',
                        height: '200px',
                        background: rewardData.isWin
                            ? 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, transparent 70%)',
                        filter: 'blur(40px)',
                        pointerEvents: 'none'
                    }} />

                    {/* Header with Icon */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        style={{
                            textAlign: 'center',
                            marginBottom: '20px',
                            position: 'relative',
                            zIndex: 1
                        }}
                    >
                        <div style={{
                            fontSize: '2.5rem',
                            marginBottom: '8px',
                            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))'
                        }}>
                            {rewardData.isWin ? '🎉' : '💸'}
                        </div>
                        <div style={{
                            fontSize: '1rem',
                            fontWeight: 800,
                            letterSpacing: '2px',
                            textTransform: 'uppercase',
                            background: rewardData.isWin
                                ? 'linear-gradient(to right, #10b981, #34d399)'
                                : 'linear-gradient(to right, #ef4444, #f87171)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                        }}>
                            {rewardData.isWin ? 'TRANSFERENCIA RECIBIDA' : 'TRANSFERENCIA ENVIADA'}
                        </div>
                    </motion.div>

                    {/* Player Labels */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '15px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        letterSpacing: '1px',
                        position: 'relative',
                        zIndex: 1
                    }}>
                        <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            style={{
                                color: rewardData.isWin ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)',
                                padding: '4px 12px',
                                background: rewardData.isWin ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                borderRadius: '8px',
                                border: `1px solid ${rewardData.isWin ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                            }}
                        >
                            {rewardData.isWin ? 'OPONENTE' : 'TÚ'}
                        </motion.div>
                        <motion.div
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            style={{
                                color: rewardData.isWin ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                                padding: '4px 12px',
                                background: rewardData.isWin ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                borderRadius: '8px',
                                border: `1px solid ${rewardData.isWin ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                            }}
                        >
                            {rewardData.isWin ? 'TÚ' : 'OPONENTE'}
                        </motion.div>
                    </div>

                    {/* Enhanced Progress Bar */}
                    <div
                        style={{
                            position: 'relative',
                            height: '60px',
                            background: 'rgba(0, 0, 0, 0.3)',
                            borderRadius: '30px',
                            overflow: 'hidden',
                            border: '2px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3)',
                            marginBottom: '20px',
                            zIndex: 1
                        }}
                    >
                        {/* Animated Fill Bar */}
                        <motion.div
                            initial={{ width: '0%' }}
                            animate={{ width: '100%' }}
                            transition={{
                                duration: 2.5,
                                ease: 'easeInOut',
                                repeat: Infinity,
                                repeatDelay: 0.3
                            }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                height: '100%',
                                background: rewardData.isWin
                                    ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.4), rgba(16, 185, 129, 0.7), rgba(5, 150, 105, 0.5))'
                                    : 'linear-gradient(90deg, rgba(239, 68, 68, 0.4), rgba(239, 68, 68, 0.7), rgba(220, 38, 38, 0.5))',
                                boxShadow: rewardData.isWin
                                    ? '0 0 20px rgba(16, 185, 129, 0.4)'
                                    : '0 0 20px rgba(239, 68, 68, 0.4)'
                            }}
                        />

                        {/* Shimmer Effect */}
                        <motion.div
                            animate={{
                                x: ['-100%', '200%']
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: 'linear'
                            }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                height: '100%',
                                width: '30%',
                                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                                pointerEvents: 'none'
                            }}
                        />

                        {/* Flowing Icons */}
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none'
                        }}>
                            {[...Array(5)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ x: '-150%', opacity: 0, scale: 0.8 }}
                                    animate={{
                                        x: '150%',
                                        opacity: [0, 1, 1, 1, 0],
                                        scale: [0.8, 1.2, 1, 1, 0.8]
                                    }}
                                    transition={{
                                        duration: 2.2,
                                        delay: i * 0.25,
                                        repeat: Infinity,
                                        repeatDelay: 0.1,
                                        ease: 'easeInOut'
                                    }}
                                    style={{
                                        position: 'absolute',
                                        fontSize: '1.8rem',
                                        filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3))'
                                    }}
                                >
                                    {rewardData.type === 'rp' ? '⭐' : rewardData.type === 'gems' ? '💎' : '🪙'}
                                </motion.div>
                            ))}
                        </div>

                        {/* Center Arrow with Pulse */}
                        <motion.div
                            animate={{
                                scale: [1, 1.3, 1],
                                x: [0, 8, 0]
                            }}
                            transition={{
                                duration: 1.2,
                                repeat: Infinity,
                                ease: 'easeInOut'
                            }}
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                fontSize: '2rem',
                                fontWeight: 900,
                                color: rewardData.isWin ? '#10b981' : '#ef4444',
                                textShadow: `0 0 20px ${rewardData.isWin ? '#10b981' : '#ef4444'}, 0 0 40px ${rewardData.isWin ? '#10b981' : '#ef4444'}`,
                                zIndex: 3,
                                filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))'
                            }}
                        >
                            →
                        </motion.div>
                    </div>

                    {/* Amount Display - Enhanced */}
                    <motion.div
                        initial={{ scale: 0, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ delay: 0.6, type: 'spring', stiffness: 150 }}
                        style={{
                            padding: '16px 24px',
                            background: rewardData.isWin
                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.2))'
                                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.2))',
                            borderRadius: '16px',
                            border: `2px solid ${rewardData.isWin ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                            textAlign: 'center',
                            position: 'relative',
                            zIndex: 1,
                            boxShadow: rewardData.isWin
                                ? '0 4px 16px rgba(16, 185, 129, 0.2)'
                                : '0 4px 16px rgba(239, 68, 68, 0.2)'
                        }}
                    >
                        <motion.div
                            animate={{
                                scale: [1, 1.05, 1],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: 'easeInOut'
                            }}
                            style={{
                                fontSize: '2rem',
                                fontWeight: 900,
                                letterSpacing: '1px',
                                background: rewardData.isWin
                                    ? 'linear-gradient(to right, #10b981, #34d399, #6ee7b7)'
                                    : 'linear-gradient(to right, #ef4444, #f87171, #fca5a5)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                                filter: `drop-shadow(0 0 12px ${rewardData.isWin ? '#10b981' : '#ef4444'})`,
                                lineHeight: 1.2
                            }}
                        >
                            {rewardData.isWin ? '+' : '-'}{Math.abs(rewardData.amount)}
                            <span style={{ marginLeft: '8px' }}>
                                {rewardData.type === 'coins' ? '🪙' : rewardData.type === 'gems' ? '💎' : '⭐'}
                            </span>
                        </motion.div>
                        <div style={{
                            fontSize: '0.85rem',
                            color: 'rgba(255, 255, 255, 0.7)',
                            marginTop: '8px',
                            fontWeight: 600,
                            letterSpacing: '1px',
                            textTransform: 'uppercase'
                        }}>
                            {rewardData.isWin ? 'Recompensa Añadida' : 'Apuesta Perdida'}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </div>
    );
};
