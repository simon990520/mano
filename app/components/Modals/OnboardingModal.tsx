import React from 'react';
import Image from 'next/image';

interface OnboardingModalProps {
    username: string;
    setUsername: (u: string) => void;
    birthDate: string;
    setBirthDate: (d: string) => void;
    phoneNumber: string;
    setPhoneNumber: (p: string) => void;
    onSave: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
    username,
    setUsername,
    birthDate,
    setBirthDate,
    phoneNumber,
    setPhoneNumber,
    onSave
}) => {
    // Auto-detect country code based on timezone
    React.useEffect(() => {
        if (!phoneNumber) {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz === 'America/Bogota') {
                setPhoneNumber('+57');
            } else {
                setPhoneNumber('+');
            }
        }
    }, []);

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
                <div className="input-group">
                    <label className="input-label">Número de WhatsApp (con indicativo)</label>
                    <input
                        type="tel"
                        className="modal-input"
                        placeholder="Ej: +573001234567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                </div>
                <button className="btn-enter-arena" onClick={onSave}>
                    ENTRAR A LA ARENA
                </button>
            </div>
        </div>
    );
};
