'use client';

import { useState } from 'react';
import { X, Coins, Diamond } from 'lucide-react';

interface SendChallengeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSendInvite: (type: 'casual' | 'ranked', amount: number) => void;
    friendName: string;
    userBalance: { coins: number; gems: number };
}

export const SendChallengeModal = ({ isOpen, onClose, onSendInvite, friendName, userBalance }: SendChallengeModalProps) => {
    const [mode, setMode] = useState<'casual' | 'ranked'>('casual');
    const [amount, setAmount] = useState<number>(10);

    if (!isOpen) return null;

    const balanceCoins = Number(userBalance?.coins || 0);
    const balanceGems = Number(userBalance?.gems || 0);
    const maxAmount = mode === 'casual' ? balanceCoins : balanceGems;
    const currentAmount = Number(amount);
    const canAfford = currentAmount <= maxAmount && currentAmount > 0;

    console.log('[DEBUG_BALANCE] Rendering SendChallengeModal:', {
        mode,
        currentAmount,
        maxAmount,
        canAfford,
        userBalanceProvided: userBalance,
        computed: { balanceCoins, balanceGems }
    });

    const handleAmountChange = (val: any) => {
        const numVal = Number(val);
        if (isNaN(numVal) || numVal < 0) return;
        setAmount(numVal);
    };

    return (
        <div className="send-challenge-overlay">
            <div className="send-challenge-container">
                <div className="send-challenge-header">
                    <h3>Retar a <span className="friend-name-highlight">{friendName}</span></h3>
                    <button onClick={onClose} className="send-challenge-close">
                        <X size={20} />
                    </button>
                </div>

                <div className="send-challenge-content">
                    <p className="send-challenge-subtitle">Selecciona la apuesta para el duelo</p>

                    <div className="currency-selector">
                        <button
                            className={`currency-option casual ${mode === 'casual' ? 'active' : ''}`}
                            onClick={() => { setMode('casual'); setAmount(10); }}
                        >
                            <Coins size={28} />
                            <span>Metales</span>
                        </button>
                        <button
                            className={`currency-option ranked ${mode === 'ranked' ? 'active' : ''}`}
                            onClick={() => { setMode('ranked'); setAmount(100); }}
                        >
                            <Diamond size={28} />
                            <span>Gemas</span>
                        </button>
                    </div>

                    <div className="amount-input-section">
                        <label>CANTIDAD</label>
                        <div className="amount-controls">
                            <button className="ctrl-btn" onClick={() => handleAmountChange(amount - 50)}>-50</button>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                            />
                            <button className="ctrl-btn" onClick={() => handleAmountChange(amount + 50)}>+50</button>
                        </div>
                        <div className={`balance-info ${!canAfford ? 'insufficient' : ''}`}>
                            Tu saldo: {mode === 'casual' ? `${balanceCoins} 🪙` : `${balanceGems} 💎`}
                            {!canAfford && <span className="error-msg"> (Insuficiente)</span>}
                        </div>
                    </div>

                    <div className="send-challenge-footer">
                        <p className="fee-notice">Se cobrará un 10% de comisión del botín total.</p>
                        <button
                            className="send-invite-btn"
                            disabled={!canAfford || currentAmount <= 0}
                            onClick={() => onSendInvite(mode, currentAmount)}
                        >
                            ENVIAR DESAFÍO
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .send-challenge-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(15px) saturate(160%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 20px;
                    animation: overlayIn 0.3s ease-out;
                }

                .send-challenge-container {
                    background: linear-gradient(165deg, #1e293b 0%, #0f172a 100%);
                    width: 100%;
                    max-width: 480px;
                    border-radius: 40px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 
                        0 25px 50px -12px rgba(0, 0, 0, 0.8),
                        0 0 40px rgba(59, 130, 246, 0.15);
                    overflow: hidden;
                    position: relative;
                    animation: modalIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                .send-challenge-container::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.6), transparent);
                }

                .send-challenge-header {
                    padding: 32px 40px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(255, 255, 255, 0.02);
                }

                .send-challenge-header h3 {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 900;
                    color: white;
                    text-transform: uppercase;
                    letter-spacing: -0.5px;
                }

                .friend-name-highlight {
                    background: linear-gradient(to right, #fbbf24, #f59e0b);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .send-challenge-close {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: rgba(255, 255, 255, 0.5);
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .send-challenge-close:hover {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    transform: rotate(90deg);
                }

                .send-challenge-content {
                    padding: 40px;
                }

                .send-challenge-subtitle {
                    text-align: center;
                    color: rgba(255, 255, 255, 0.4);
                    margin-bottom: 32px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .currency-selector {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 32px;
                }

                .currency-option {
                    flex: 1;
                    padding: 24px 16px;
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    background: rgba(255, 255, 255, 0.03);
                    color: rgba(255, 255, 255, 0.4);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .currency-option.casual.active {
                    background: rgba(251, 191, 36, 0.1);
                    border-color: rgba(251, 191, 36, 0.4);
                    color: #fbbf24;
                    box-shadow: 0 0 20px rgba(251, 191, 36, 0.1);
                }

                .currency-option.ranked.active {
                    background: rgba(6, 182, 212, 0.1);
                    border-color: rgba(6, 182, 212, 0.4);
                    color: #06b6d4;
                    box-shadow: 0 0 20px rgba(6, 182, 212, 0.1);
                }

                .currency-option span {
                    font-weight: 900;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                }

                .amount-input-section {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-bottom: 40px;
                }

                .amount-input-section label {
                    font-size: 0.75rem;
                    font-weight: 900;
                    color: rgba(255, 255, 255, 0.3);
                    letter-spacing: 2px;
                }

                .amount-controls {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }

                .ctrl-btn {
                    padding: 12px 20px;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: white;
                    font-weight: 800;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .ctrl-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.2);
                }

                .amount-controls input {
                    flex: 1;
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    height: 56px;
                    color: white;
                    text-align: center;
                    font-size: 1.5rem;
                    font-weight: 900;
                    outline: none;
                    transition: all 0.2s;
                }

                .amount-controls input:focus {
                    border-color: rgba(59, 130, 246, 0.5);
                    box-shadow: 0 0 15px rgba(59, 130, 246, 0.1);
                }

                .balance-info {
                    text-align: center;
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.3);
                    padding: 8px;
                    background: rgba(0,0,0,0.1);
                    border-radius: 10px;
                }

                .error-msg {
                    color: #f87171;
                    font-weight: bold;
                }

                .send-challenge-footer {
                    text-align: center;
                }

                .fee-notice {
                    font-size: 0.75rem;
                    color: rgba(255, 255, 255, 0.2);
                    margin-bottom: 24px;
                }

                .send-invite-btn {
                    width: 100%;
                    padding: 20px;
                    border-radius: 20px;
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white;
                    border: none;
                    font-size: 1.1rem;
                    font-weight: 900;
                    cursor: pointer;
                    box-shadow: 0 10px 25px rgba(37, 99, 235, 0.3);
                    transition: all 0.3s;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .send-invite-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 15px 35px rgba(37, 99, 235, 0.4);
                }

                .send-invite-btn:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                    filter: grayscale(1);
                }

                @keyframes overlayIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes modalIn {
                    from { transform: scale(0.9) translateY(20px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }

                @media (max-width: 640px) {
                    .send-challenge-container {
                        max-width: 100%;
                        border-radius: 32px;
                    }

                    .send-challenge-header {
                        padding: 24px;
                    }

                    .send-challenge-content {
                        padding: 24px;
                    }

                    .currency-selector {
                        gap: 10px;
                    }

                    .currency-option {
                        padding: 16px 8px;
                    }

                    .amount-controls input {
                        font-size: 1.25rem;
                    }

                    .ctrl-btn {
                        padding: 8px 12px;
                        font-size: 0.8rem;
                    }
                }
            `}</style>
        </div>
    );
};
