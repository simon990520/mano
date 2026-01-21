import React from 'react';

interface OnboardingModalProps {
    username: string;
    setUsername: (u: string) => void;
    birthDate: string;
    setBirthDate: (d: string) => void;
    onSave: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ username, setUsername, birthDate, setBirthDate, onSave }) => {
    return (
        <div className="leaderboard-overlay" style={{ zIndex: 20000, backdropFilter: 'blur(15px)' }}>
            <div className="leaderboard-card" style={{ maxWidth: '400px', border: '2px solid var(--primary)', boxShadow: '0 0 50px rgba(0,255,136,0.3)' }}>
                <div className="leaderboard-header">
                    <div className="leaderboard-logo">👋</div>
                    <h2 className="leaderboard-title">WELCOME PLAYER</h2>
                </div>

                <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <p style={{ textAlign: 'center', opacity: 0.8, marginBottom: '10px' }}>
                        Create your Identity to enter the Arena.
                    </p>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>USERNAME</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="ProGamer123"
                            maxLength={12}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: 'white',
                                fontSize: '1rem',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>BIRTH DATE</label>
                        <input
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: 'white',
                                fontFamily: 'inherit',
                                fontSize: '1rem',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <button
                        className="btn-primary"
                        onClick={onSave}
                        style={{ marginTop: '20px', width: '100%', padding: '15px' }}
                    >
                        START JOURNEY
                    </button>
                </div>
            </div>
        </div>
    );
};
