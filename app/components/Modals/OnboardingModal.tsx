import React from 'react';
import Image from 'next/image';

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
            <div className="modal-content" style={{ padding: '30px' }}>
                <div style={{ marginBottom: '20px', borderRadius: '15px', overflow: 'hidden' }}>
                    <Image
                        src="/assets/images/welcome_banner.png"
                        alt="Bono de Bienvenida"
                        width={400}
                        height={120}
                        layout="responsive"
                        className="welcome-banner-img"
                    />
                </div>
                <h2 className="modal-title" style={{ fontSize: '1.5rem', marginBottom: '20px' }}>¡BIENVENIDO!</h2>
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
