import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SuccessModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, title, message, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="leaderboard-overlay" style={{ zIndex: 20000 }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="leaderboard-card"
                        style={{
                            maxWidth: '400px',
                            border: '2px solid rgba(0, 255, 136, 0.3)',
                            background: 'rgba(20, 30, 25, 0.98)',
                            boxShadow: '0 0 50px rgba(0, 255, 136, 0.2)'
                        }}
                    >
                        <div className="leaderboard-header">
                            <div className="leaderboard-logo" style={{ color: '#00ff88', fontSize: '2.5rem' }}>🎉</div>
                            <h2 className="leaderboard-title" style={{
                                background: 'linear-gradient(to right, #00ff88, #60efff)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                fontWeight: 900
                            }}>{title}</h2>
                            <button className="close-btn" onClick={onClose}>×</button>
                        </div>

                        <div style={{
                            padding: '30px 20px',
                            textAlign: 'center',
                            color: 'white',
                            fontSize: '1.2rem',
                            fontWeight: 600,
                            lineHeight: '1.4'
                        }}>
                            {message}
                        </div>

                        <div style={{
                            padding: '20px',
                            display: 'flex',
                            justifyContent: 'center'
                        }}>
                            <button
                                className="game-action-btn active"
                                onClick={onClose}
                                style={{
                                    width: '100%',
                                    maxWidth: '220px',
                                    background: 'linear-gradient(135deg, #00ff88 0%, #00bd68 100%)',
                                    boxShadow: '0 8px 16px rgba(0, 255, 136, 0.3)',
                                    color: '#000',
                                    fontWeight: 900
                                }}
                            >
                                ¡EXCELENTE!
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
