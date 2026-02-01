import React from 'react';
import Image from 'next/image';

interface WelcomeBonusModalProps {
    onClaim: () => void;
}

export const WelcomeBonusModal: React.FC<WelcomeBonusModalProps> = ({ onClaim }) => {
    return (
        <div className="modal-overlay" style={{ zIndex: 35000, background: 'rgba(0, 0, 0, 0.9)' }}>
            <div className="modal-content welcome-bonus-content" style={{ maxWidth: '400px', background: 'transparent', border: 'none', boxShadow: 'none' }}>
                <h1 className="welcome-bonus-title" style={{ color: 'white', fontSize: '2.5rem', fontWeight: 900, marginBottom: '20px', textShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                    BONO DE BIENVENIDA
                </h1>

                <div className="welcome-bonus-image-container" style={{ margin: '30px 0' }}>
                    <Image
                        src="/artifacts/welcome_bonus_coins.png"
                        alt="Monedas de Bienvenida"
                        width={250}
                        height={250}
                        className="floating-animation"
                    />
                </div>

                <h2 className="welcome-bonus-text" style={{ color: 'white', fontSize: '2rem', fontWeight: 800, marginBottom: '30px', textShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>
                    30 MONEDAS GRATIS!
                </h2>

                <button
                    className="btn-enter-arena claim-bonus-btn"
                    onClick={onClaim}
                    style={{
                        background: 'linear-gradient(45deg, #4d7c0f, #65a30d)',
                        border: '2px solid rgba(255,255,255,0.3)',
                        padding: '20px 40px',
                        fontSize: '1.4rem'
                    }}
                >
                    ¡RECLAMAR AHORA!
                </button>
            </div>

            <style jsx>{`
                .welcome-bonus-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    animation: zoomIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                @keyframes zoomIn {
                    from { opacity: 0; transform: scale(0.5); }
                    to { opacity: 1; transform: scale(1); }
                }

                .floating-animation {
                    animation: float 3s ease-in-out infinite;
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-15px); }
                }

                .claim-bonus-btn:hover {
                    transform: scale(1.05);
                    box-shadow: 0 0 30px rgba(101, 163, 13, 0.5);
                }
            `}</style>
        </div>
    );
};
