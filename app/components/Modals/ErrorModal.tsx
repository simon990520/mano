import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ErrorModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ isOpen, title, message, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="leaderboard-overlay" style={{ zIndex: 50000 }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="leaderboard-card"
                        style={{
                            maxWidth: '400px',
                            border: '2px solid rgba(255, 68, 102, 0.3)',
                            background: 'rgba(20, 20, 30, 0.95)',
                            boxShadow: '0 0 40px rgba(255, 68, 102, 0.2)'
                        }}
                    >
                        <div className="leaderboard-header">
                            <div className="leaderboard-logo" style={{ color: '#ff4466' }}>⚠️</div>
                            <h2 className="leaderboard-title" style={{ color: '#ff4466' }}>{title}</h2>
                            <button className="close-btn" onClick={onClose}>×</button>
                        </div>

                        <div style={{
                            padding: '20px',
                            textAlign: 'center',
                            color: 'rgba(255, 255, 255, 0.9)',
                            fontSize: '1.1rem',
                            lineHeight: '1.5'
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
                                    maxWidth: '200px',
                                    background: 'linear-gradient(135deg, #ff4466 0%, #cc0033 100%)',
                                    boxShadow: '0 8px 16px rgba(255, 68, 102, 0.3)'
                                }}
                            >
                                ENTENDIDO
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
