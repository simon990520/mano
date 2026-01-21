import React from 'react';

interface SettingsModalProps {
    onClose: () => void;
    volumeStates: {
        musicVolume: number;
        setMusicVolume: (v: number) => void;
        sfxVolume: number;
        setSfxVolume: (v: number) => void;
        announcerVolume: number;
        setAnnouncerVolume: (v: number) => void;
        isMuted: boolean;
        setIsMuted: (m: boolean) => void;
    };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, volumeStates }) => {
    const {
        musicVolume, setMusicVolume,
        sfxVolume, setSfxVolume,
        announcerVolume, setAnnouncerVolume,
        isMuted, setIsMuted
    } = volumeStates;

    return (
        <div className="leaderboard-overlay" style={{ zIndex: 10001 }}>
            <div className="leaderboard-card" style={{ maxWidth: '400px' }}>
                <div className="leaderboard-header">
                    <div className="leaderboard-logo">⚙️</div>
                    <h2 className="leaderboard-title">SETTINGS</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    {/* Mute Toggle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>Master Mute</span>
                        <button
                            className={`btn-${isMuted ? 'primary' : 'secondary'}`}
                            onClick={() => setIsMuted(!isMuted)}
                            style={{ padding: '8px 20px', fontSize: '0.9rem' }}
                        >
                            {isMuted ? 'UNMUTE' : 'MUTE'}
                        </button>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />

                    {/* Music Volume */}
                    <div className="volume-control">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>🎵 Music</span>
                            <span>{Math.round(musicVolume * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="1" step="0.01"
                            value={musicVolume}
                            onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                            className="volume-slider"
                        />
                    </div>

                    {/* SFX Volume */}
                    <div className="volume-control">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>💥 Effects</span>
                            <span>{Math.round(sfxVolume * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="1" step="0.01"
                            value={sfxVolume}
                            onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
                            className="volume-slider"
                        />
                    </div>

                    {/* Announcer Volume */}
                    <div className="volume-control">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span>🎙️ Announcer</span>
                            <span>{Math.round(announcerVolume * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="1" step="0.01"
                            value={announcerVolume}
                            onChange={(e) => setAnnouncerVolume(parseFloat(e.target.value))}
                            className="volume-slider"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
