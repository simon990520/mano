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
                <h2 className="modal-title">¡BIENVENIDO!</h2>
                <div className="input-group">
                    <label className="input-label">Elige tu nombre de luchador</label>
                    <input
                        type="text"
                        className="modal-input"
                        placeholder="Nombre de usuario"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        maxLength={15}
                    />
                </div>
                <div className="input-group">
                    <label className="input-label">Fecha de Nacimiento</label>
                    <input
                        type="date"
                        className="modal-input"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                    />
                </div>
                <button className="btn-enter-arena" onClick={onSave}>
                    ENTRAR A LA ARENA
                </button>
            </div>
        </div>
    );
};
