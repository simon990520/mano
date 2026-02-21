'use client';

import { X, Sword, Diamond, Coins } from 'lucide-react';

interface ReceivedInvite {
    inviteId: string;
    challengerName: string;
    challengerImageUrl?: string | null;
    type: 'casual' | 'ranked';
    amount: number;
}

interface ReceivedBattleModalProps {
    isOpen: boolean;
    challengerName: string;
    challengerImageUrl?: string | null;
    type: 'casual' | 'ranked';
    amount: number;
    onRespond: (accepted: boolean) => void;
}

export const ReceivedBattleModal = ({ isOpen, challengerName, challengerImageUrl, type, amount, onRespond }: ReceivedBattleModalProps) => {
    if (!isOpen) return null;

    const handleAccept = () => {
        console.log('[DEBUG] Challenge ACCEPTED');
        onRespond(true);
    };

    const handleDecline = () => {
        console.log('[DEBUG] Challenge DECLINED');
        onRespond(false);
    };

    return (
        <div className="received-modal-overlay">
            <div className="received-modal-container">
                <div className="received-header">
                    {challengerImageUrl ? (
                        <div className="challenger-avatar-large">
                            <img src={challengerImageUrl} alt={challengerName} />
                        </div>
                    ) : (
                        <Sword className="sword-icon" size={64} />
                    )}
                    <h3>¡NUEVO DESAFÍO!</h3>
                </div>

                <div className="received-content">
                    <div className={`stake-display ${type}`}>
                        {type === 'casual' ? <Coins size={36} /> : <Diamond size={36} />}
                        <div className="stake-info">
                            <span className="stake-amount">{amount}</span>
                            <span className="stake-label">{type === 'casual' ? 'Metales' : 'Gemas'}</span>
                        </div>
                    </div>

                    <div className="received-actions">
                        <button className="respond-btn decline" onClick={handleDecline}>
                            RECHAZAR
                        </button>
                        <button className="respond-btn accept" onClick={handleAccept}>
                            ACEPTAR DUELO
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .received-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(20px) saturate(180%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    padding: 24px;
                    animation: overlayFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .received-modal-container {
                    background: linear-gradient(165deg, #0f172a 0%, #020617 100%);
                    width: 100%;
                    max-width: 440px;
                    border-radius: 48px;
                    border: 2px solid rgba(59, 130, 246, 0.3);
                    box-shadow: 
                        0 25px 60px -15px rgba(0, 0, 0, 0.8),
                        0 0 50px rgba(37, 99, 235, 0.2);
                    padding: 48px 40px;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                    animation: modalBounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                .received-modal-container::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at center, rgba(59, 130, 246, 0.1) 0%, transparent 70%);
                    pointer-events: none;
                }

                .received-header {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 20px;
                    margin-bottom: 32px;
                }

                .sword-icon {
                    color: #3b82f6;
                    filter: drop-shadow(0 0 15px rgba(59, 130, 246, 0.6));
                    animation: swordPulse 2s infinite ease-in-out;
                }

                .received-header h3 {
                    margin: 0;
                    font-size: 1.8rem;
                    font-weight: 950;
                    color: white;
                    letter-spacing: 3px;
                    text-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
                }

                .challenger-info {
                    margin-bottom: 40px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .challenger-name {
                    font-size: 2rem;
                    font-weight: 950;
                    background: linear-gradient(to right, #fbbf24, #f59e0b);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.3));
                }

                .challenge-text {
                    color: rgba(203, 213, 225, 0.7);
                    font-size: 1.1rem;
                    font-weight: 500;
                    letter-spacing: 0.5px;
                }

                .stake-display {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 32px;
                    padding: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                    margin-bottom: 48px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    position: relative;
                }

                .stake-display.casual { 
                    color: #fbbf24; 
                    border-color: rgba(251, 191, 36, 0.2);
                    box-shadow: inset 0 0 20px rgba(251, 191, 36, 0.05);
                }
                
                .stake-display.ranked { 
                    color: #06b6d4; 
                    border-color: rgba(6, 182, 212, 0.2);
                    box-shadow: inset 0 0 20px rgba(6, 182, 212, 0.05);
                }

                .stake-amount {
                    font-size: 3rem;
                    font-weight: 950;
                    letter-spacing: -1px;
                }

                .stake-label {
                    font-size: 1rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    opacity: 0.8;
                    letter-spacing: 2px;
                }

                .received-actions {
                    display: flex;
                    gap: 16px;
                }

                .respond-btn {
                    flex: 1;
                    padding: 20px;
                    border-radius: 20px;
                    font-weight: 950;
                    font-size: 1.1rem;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    border: none;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .respond-btn.decline {
                    background: rgba(255, 255, 255, 0.05);
                    color: rgba(255, 255, 255, 0.4);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }

                .respond-btn.decline:hover {
                    background: rgba(239, 68, 68, 0.1);
                    color: #f87171;
                    border-color: rgba(239, 68, 68, 0.2);
                }

                .respond-btn.accept {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    box-shadow: 0 10px 25px rgba(59, 130, 246, 0.4);
                }

                .respond-btn.accept:hover {
                    transform: translateY(-4px) scale(1.02);
                    box-shadow: 0 15px 35px rgba(59, 130, 246, 0.5);
                    filter: brightness(1.1);
                }

                .respond-btn.accept:active {
                    transform: translateY(-1px);
                }

                @keyframes overlayFadeIn {
                    from { opacity: 0; backdrop-filter: blur(0px); }
                    to { opacity: 1; backdrop-filter: blur(20px); }
                }

                @keyframes modalBounceIn {
                    from { transform: scale(0.8) translateY(60px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }

                @keyframes swordPulse {
                    0%, 100% { transform: scale(1) rotate(0deg); }
                    50% { transform: scale(1.2) rotate(10deg); }
                }

                .challenger-avatar-large {
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    border: 4px solid #3b82f6;
                    overflow: hidden;
                    box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
                    animation: swordPulse 2s infinite ease-in-out;
                    margin-bottom: 20px;
                }

                .challenger-avatar-large img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                @media (max-width: 640px) {
                    .received-modal-overlay {
                        padding: 12px;
                    }

                    .received-modal-container {
                        padding: 32px 24px;
                        border-radius: 32px;
                    }

                    .received-header h3 {
                        font-size: 1.4rem;
                    }

                    .challenger-name {
                        font-size: 1.5rem;
                    }

                    .stake-display {
                        padding: 24px;
                        margin-bottom: 32px;
                    }

                    .stake-amount {
                        font-size: 2.2rem;
                    }

                    .respond-btn {
                        padding: 16px;
                        font-size: 1rem;
                        border-radius: 16px;
                    }

                    .received-actions {
                        gap: 12px;
                    }
                }
            `}</style>
        </div>
    );
};
