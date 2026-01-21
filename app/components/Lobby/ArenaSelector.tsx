import React from 'react';
import { ARENAS, RANKED_ARENAS } from '@/lib/constants';

interface ArenaSelectorProps {
    gameMode: 'casual' | 'ranked';
    selectedStake: number;
    onSelectStake: (id: number) => void;
    playSound: (path: string) => void;
}

export const ArenaSelector: React.FC<ArenaSelectorProps> = ({ gameMode, selectedStake, onSelectStake, playSound }) => {
    const arenas = gameMode === 'casual' ? ARENAS : RANKED_ARENAS;

    return (
        <div className="arena-selector" style={{ marginTop: '0' }}>
            <p className="arena-label">
                {gameMode === 'casual' ? 'ELIGE TU ARENA (COINS)' : 'ELIGE TU ARENA (GEMS)'}
            </p>

            {/* In the original code, RankedBanner was here conditionally. 
                In the new architecture, LobbyView will compose them. 
                Here we only render the grid. */}

            <div className="arena-grid">
                {arenas.map((arena) => (
                    <div
                        key={arena.id}
                        className={`arena-card ${selectedStake === arena.id ? 'active' : ''}`}
                        style={{ '--arena-color': arena.color } as any}
                        onClick={() => {
                            onSelectStake(arena.id);
                            playSound('/sounds/sfx/click.mp3');
                        }}
                    >
                        <div className="arena-icon">{arena.icon}</div>
                        <div className="arena-name">{arena.name}</div>
                        <div className="arena-entry">{arena.entry} {gameMode === 'casual' ? '🪙' : '💎'}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};
