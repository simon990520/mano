'use client';

import { useState, useEffect } from 'react';
import { Swords, X, Trophy, Coins, Diamond } from 'lucide-react';

interface BattleInviteModalProps {
    challenge: {
        fromId: string;
        fromUsername: string;
        stakeTier: number;
        mode: 'casual' | 'ranked';
        challengerImageUrl?: string | null;
    } | null;
    onAccept: () => void;
    onDecline: () => void;
}

export const BattleInviteModal = ({ challenge, onAccept, onDecline }: BattleInviteModalProps) => {
    const [timeLeft, setTimeLeft] = useState(15);

    // Reset timer when a new challenge arrives
    useEffect(() => {
        if (challenge) {
            setTimeLeft(15);
        }
    }, [challenge]);

    // Independent timer loop
    useEffect(() => {
        if (!challenge) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                const next = prev - 1;
                return next < 0 ? 0 : next;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [challenge]);

    // Safe side effect: call onDecline when time hits zero
    useEffect(() => {
        if (challenge && timeLeft === 0) {
            onDecline();
        }
    }, [timeLeft, challenge, onDecline]);

    if (!challenge) return null;

    return (
        <div className="received-challenge-overlay">
            <div className="received-challenge-container">
                <div className="received-challenge-banner">
                    <div className="timer-badge">
                        {timeLeft}s
                    </div>
                    <div className="icon-glow">
                        <Swords size={40} className="swords-icon" />
                    </div>
                </div>

                <div className="received-challenge-body">
                    <div className="challenger-info">
                        <div className="challenger-avatar">
                            {challenge.challengerImageUrl ? (
                                <img src={challenge.challengerImageUrl} alt={challenge.fromUsername} />
                            ) : (
                                <div className="avatar-placeholder">
                                    {challenge.fromUsername.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <h2 className="invite-title">¡DESAFÍO RECIBIDO!</h2>
                        <p className="invite-text">
                            <span className="username">@{challenge.fromUsername}</span> quiere pelear contigo.
                        </p>
                    </div>

                    <div className="challenge-details-grid">
                        <div className="detail-item">
                            <label>APUESTA</label>
                            <div className="value">
                                {challenge.mode === 'casual' ? (
                                    <><Coins size={16} className="coin-icon" /> {challenge.stakeTier}</>
                                ) : (
                                    <><Diamond size={16} className="gem-icon" /> {challenge.stakeTier}</>
                                )}
                            </div>
                        </div>
                        <div className="detail-item">
                            <label>MODO</label>
                            <div className={`value mode-${challenge.mode}`}>
                                <Trophy size={16} />
                                {challenge.mode.toUpperCase()}
                            </div>
                        </div>
                    </div>

                    <div className="received-challenge-actions">
                        <button onClick={onAccept} className="accept-btn">
                            ACEPTAR DUELO
                        </button>
                        <button onClick={onDecline} className="decline-btn">
                            IGNORAR
                        </button>
                    </div>
                </div>

                <div className="timer-progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${(timeLeft / 15) * 100}%` }}
                    />
                </div>
            </div>

            <style jsx>{`
                .received-challenge-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(12px) saturate(160%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    padding: 20px;
                    animation: overlayFade 0.3s ease-out;
                }

                .received-challenge-container {
                    background: linear-gradient(165deg, #1e293b 0%, #0f172a 100%);
                    width: 100%;
                    max-width: 400px;
                    border-radius: 32px;
                    border: 1px solid rgba(234, 179, 8, 0.3);
                    box-shadow: 
                        0 25px 50px -12px rgba(0, 0, 0, 0.9),
                        0 0 40px rgba(234, 179, 8, 0.1);
                    overflow: hidden;
                    position: relative;
                    animation: modalPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                .received-challenge-banner {
                    height: 120px;
                    background: linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(217, 119, 6, 0.1) 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }

                .timer-badge {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(234, 179, 8, 0.4);
                    color: #fbbf24;
                    padding: 4px 12px;
                    border-radius: 99px;
                    font-weight: 900;
                    font-size: 0.8rem;
                    box-shadow: 0 0 15px rgba(234, 179, 8, 0.2);
                }

                .icon-glow {
                    width: 70px;
                    height: 70px;
                    background: #fbbf24;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 0 30px rgba(234, 179, 8, 0.4);
                    transform: rotate(-10deg);
                    animation: iconPulse 2s infinite ease-in-out;
                }

                .swords-icon {
                    color: #0f172a;
                }

                .received-challenge-body {
                    padding: 32px;
                    text-align: center;
                }

                .challenger-avatar {
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    border: 2px solid #fbbf24;
                    margin: 0 auto 16px;
                    overflow: hidden;
                    background: #1e293b;
                    box-shadow: 0 0 20px rgba(234, 179, 8, 0.2);
                }

                .challenger-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .avatar-placeholder {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    font-weight: 900;
                    color: #fbbf24;
                }

                .invite-title {
                    font-size: 1.25rem;
                    font-weight: 900;
                    color: white;
                    margin-bottom: 4px;
                    letter-spacing: 1px;
                }

                .invite-text {
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 0.95rem;
                    margin-bottom: 24px;
                }

                .username {
                    color: #fbbf24;
                    font-weight: 800;
                }

                .challenge-details-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    margin-bottom: 32px;
                }

                .detail-item {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    padding: 12px;
                    border-radius: 16px;
                }

                .detail-item label {
                    display: block;
                    font-size: 0.65rem;
                    font-weight: 900;
                    color: rgba(255, 255, 255, 0.3);
                    margin-bottom: 4px;
                    letter-spacing: 1px;
                }

                .detail-item .value {
                    font-weight: 900;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    font-size: 1rem;
                }

                .gem-icon { color: #c084fc; }
                .coin-icon { color: #fbbf24; }
                
                .mode-casual { color: #fbbf24 !important; }
                .mode-ranked { color: #c084fc !important; }

                .received-challenge-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .accept-btn {
                    padding: 16px;
                    border-radius: 16px;
                    background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
                    color: #0f172a;
                    border: none;
                    font-weight: 900;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    box-shadow: 0 10px 20px rgba(217, 119, 6, 0.2);
                }

                .accept-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 15px 30px rgba(217, 119, 6, 0.3);
                }

                .decline-btn {
                    padding: 12px;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: rgba(255, 255, 255, 0.4);
                    border-radius: 16px;
                    font-weight: 800;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-transform: uppercase;
                    font-size: 0.8rem;
                }

                .decline-btn:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: white;
                }

                .timer-progress-bar {
                    height: 4px;
                    background: rgba(255, 255, 255, 0.05);
                    width: 100%;
                }

                .progress-fill {
                    height: 100%;
                    background: #fbbf24;
                    box-shadow: 0 0 10px rgba(234, 179, 8, 0.5);
                    transition: width 1s linear;
                }

                @keyframes overlayFade {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes modalPop {
                    from { transform: scale(0.9) translateY(20px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }

                @keyframes iconPulse {
                    0%, 100% { transform: rotate(-10deg) scale(1); }
                    50% { transform: rotate(5deg) scale(1.1); }
                }

                @media (max-width: 480px) {
                    .received-challenge-container {
                        max-width: 100%;
                        border-radius: 24px;
                    }
                    .received-challenge-body {
                        padding: 24px;
                    }
                }
            `}</style>
        </div>
    );
};
