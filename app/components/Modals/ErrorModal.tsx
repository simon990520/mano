import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ErrorModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onClose: () => void;
    onAction?: () => void;
    actionLabel?: string;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ isOpen, title, message, onClose, onAction, actionLabel }) => {
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
                            flexDirection: 'column',
                            gap: '12px',
                            alignItems: 'center'
                        }}>
                            {onAction && actionLabel && (
                                <button
                                    className="game-action-btn active"
                                    onClick={onAction}
                                    style={{
                                        width: '100%',
                                        maxWidth: '200px',
                                        background: 'linear-gradient(135deg, #00ff88 0%, #009955 100%)',
                                        boxShadow: '0 8px 16px rgba(0, 255, 136, 0.2)'
                                    }}
                                >
                                    {actionLabel}
                                </button>
                            )}
                            <button
                                className="game-action-btn inactive"
                                onClick={onClose}
                                style={{
                                    width: '100%',
                                    maxWidth: '200px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    background: 'transparent'
                                }}
                            >
                                {onAction ? 'CANCELAR' : 'ENTENDIDO'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
