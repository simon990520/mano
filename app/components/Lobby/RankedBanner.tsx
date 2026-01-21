import React from 'react';
import { RANKS } from '@/lib/constants';

interface RankedBannerProps {
    rankName: string;
    rp: number;
}

export const RankedBanner: React.FC<RankedBannerProps> = ({ rankName, rp }) => {
    const currentRank = RANKS.find(r => r.id === rankName);
    if (!currentRank) return null;

    const nextRank = RANKS.find(r => r.minRp > rp);
    const progress = Math.min(100, ((rp - currentRank.minRp) / ((currentRank.maxRp || 1) - currentRank.minRp)) * 100);

    return (
        <div className="ranked-banner" style={{
            border: `1px solid ${currentRank.color}44`,
            boxShadow: `0 4px 15px rgba(0,0,0,0.3), inset 0 0 10px ${currentRank.color}22`
        } as any}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '2.5rem', filter: `drop-shadow(0 0 10px ${currentRank.color})` }}>
                    {currentRank.icon}
                </div>
                <div style={{ textAlign: 'left' }}>
                    <div style={{
                        fontSize: '1.1rem',
                        fontWeight: 900,
                        color: currentRank.color,
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}>{currentRank.name}</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.8, fontWeight: 700 }}>{rp} RP</div>
                </div>
            </div>
            <div style={{ width: '40%', maxWidth: '150px' }}>
                <div className="rp-progress-bg" style={{ height: '6px', marginTop: '0', background: 'rgba(255,255,255,0.05)' }}>
                    <div className="rp-progress-fill" style={{
                        width: `${progress}%`,
                        boxShadow: `0 0 10px ${currentRank.color}`
                    }}></div>
                </div>
                <div style={{ fontSize: '0.65rem', textAlign: 'right', marginTop: '4px', opacity: 0.5, fontWeight: 700 }}>
                    NEXT RANK: {nextRank?.name || 'MAX'}
                </div>
            </div>
        </div>
    );
};
