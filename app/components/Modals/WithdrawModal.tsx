import React, { useState } from 'react';

interface WithdrawModalProps {
    type: 'coins' | 'gems';
    onClose: () => void;
    onConfirm: (amount: number) => void;
    currentBalance: number;
    minWithdrawalCOP?: number;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ type, onClose, onConfirm, currentBalance, minWithdrawalCOP = 10000 }) => {
    const [amount, setAmount] = useState<string>('');
    const isCoins = type === 'coins';
    const rate = isCoins ? 10 : 100;
    const minCOP = minWithdrawalCOP;
    const minAmount = minCOP / rate;

    const numericAmount = Number(amount);
    const copValue = Math.floor(numericAmount * rate);
    const canWithdraw = numericAmount >= minAmount && numericAmount <= currentBalance;

    return (
        <div className="leaderboard-overlay" style={{ zIndex: 11000 }}>
            <div className="leaderboard-card shop-card" style={{
                maxWidth: '400px',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div className="leaderboard-header">
                    <div className="leaderboard-logo">{isCoins ? '🪙' : '💎'}</div>
                    <h2 className="leaderboard-title" style={{ fontSize: '1.2rem' }}>RETIRAR {type.toUpperCase()}</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    overflowY: 'auto',
                    flex: 1
                }}>
                    <p style={{ marginBottom: '12px', fontSize: '0.85rem', opacity: 0.9 }}>
                        Saldo disponible: <span style={{ fontWeight: 800, color: isCoins ? '#ffd700' : '#47efff' }}>{currentBalance.toLocaleString()} {isCoins ? '🪙' : '💎'}</span>
                    </p>

                    <div style={{ marginBottom: '20px', position: 'relative' }}>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                            className="onboarding-input"
                            style={{
                                textAlign: 'center',
                                fontSize: '1.8rem',
                                padding: '12px',
                                background: 'rgba(0,0,0,0.3)',
                                border: '2px solid rgba(255,255,255,0.1)',
                                width: '100%',
                                borderRadius: '15px',
                                fontWeight: 900,
                                color: '#fff'
                            }}
                        />
                        <div style={{
                            position: 'absolute',
                            right: '15px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            opacity: 0.5,
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            pointerEvents: 'none'
                        }}>
                            {type.toUpperCase()}
                        </div>
                    </div>

                    <div style={{
                        padding: '15px',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                        borderRadius: '15px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        marginBottom: '20px'
                    }}>
                        <p style={{ fontSize: '0.7rem', marginBottom: '6px', opacity: 0.6, letterSpacing: '1px', textTransform: 'uppercase' }}>Recibirás en COP aprox:</p>
                        <p style={{
                            fontSize: '1.5rem',
                            fontWeight: 900,
                            color: canWithdraw ? '#00ff88' : 'rgba(255,255,255,0.2)',
                            textShadow: canWithdraw ? '0 0 20px rgba(0,255,136,0.3)' : 'none',
                            transition: 'all 0.3s ease'
                        }}>
                            ${copValue.toLocaleString('es-CO')}
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button
                            className="btn-primary"
                            style={{
                                width: '100%',
                                padding: '14px',
                                fontSize: '1rem',
                                opacity: canWithdraw ? 1 : 0.4,
                                cursor: canWithdraw ? 'pointer' : 'not-allowed',
                                transform: canWithdraw ? 'scale(1)' : 'scale(0.98)',
                                transition: 'all 0.2s ease'
                            }}
                            disabled={!canWithdraw}
                            onClick={() => onConfirm(numericAmount)}
                        >
                            ENVIAR SOLICITUD
                        </button>

                        <p style={{
                            fontSize: '0.7rem',
                            opacity: 0.7,
                            color: numericAmount > 0 && numericAmount < minAmount ? '#ff4466' : 'inherit'
                        }}>
                            {numericAmount > currentBalance
                                ? '⚠️ Saldo insuficiente'
                                : `Mínimo de retiro: ${minAmount.toLocaleString()} ${isCoins ? 'monedas' : 'gemas'}`
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
