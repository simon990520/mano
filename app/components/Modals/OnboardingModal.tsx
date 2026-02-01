import React from 'react';

interface OnboardingModalProps {
    username: string;
    setUsername: (u: string) => void;
    birthDate: string;
    setBirthDate: (d: string) => void;
    onSave: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
    username,
    setUsername,
    birthDate,
    setBirthDate,
    onSave
}) => {
    return (
        <div className="modal-overlay" style={{ zIndex: 30000 }}>
            <div className="modal-content">
                <h2 className="modal-title">WELCOME PLAYER</h2>
                <div className="input-group">
                    <label className="input-label">Choose your fighter name</label>
                    <input
                        type="text"
                        className="modal-input"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        maxLength={15}
                    />
                </div>
                <div className="input-group">
                    <label className="input-label">Date of Birth</label>
                    <input
                        type="date"
                        className="modal-input"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                    />
                </div>
                <button className="btn-enter-arena" onClick={onSave}>
                    ENTER ARENA
                </button>
            </div>
        </div>
    );
};
