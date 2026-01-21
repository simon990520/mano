import React from 'react';
import { ArenaSelector } from './ArenaSelector';
import { RankedBanner } from './RankedBanner';

interface LobbyViewProps {
    gameMode: 'casual' | 'ranked';
    setGameMode: (mode: 'casual' | 'ranked') => void;
    rankName: string;
    rp: number;
    selectedStake: number;
    setSelectedStake: (id: number) => void;
    playSound: (path: string) => void;
    onFindMatch: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
    gameMode,
    setGameMode,
    rankName,
    rp,
    selectedStake,
    setSelectedStake,
    playSound,
    onFindMatch
}) => {
    return (
        <div className="mode-display-container" style={{ display: 'block' }}>
            {/* Mode Toggle */}
            <div className="mode-toggle-container">
                <button
                    className={`mode-btn ${gameMode === 'casual' ? 'active' : ''}`}
                    onClick={() => { setGameMode('casual'); playSound('/sounds/sfx/click.mp3'); }}
                >
                    CASUAL
                </button>
                <button
                    className={`mode-btn ${gameMode === 'ranked' ? 'active' : ''}`}
                    onClick={() => { setGameMode('ranked'); playSound('/sounds/sfx/click.mp3'); }}
                >
                    RANKED
                </button>
            </div>

            {/* Ranked Banner (only in ranked mode) */}
            {gameMode === 'ranked' && (
                <RankedBanner rankName={rankName} rp={rp} />
            )}

            {/* Arena Grid */}
            <ArenaSelector
                gameMode={gameMode}
                selectedStake={selectedStake}
                onSelectStake={setSelectedStake}
                playSound={playSound}
            />

            {/* Find Match Button */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                <button
                    className="btn-primary"
                    onClick={onFindMatch}
                >
                    FIND MATCH
                </button>
            </div>
        </div>
    );
};
