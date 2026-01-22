import React, { useEffect, useState, useMemo } from 'react';
import { Socket } from 'socket.io-client';

interface PlayerStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null; // ID to fetch stats for
    socket: Socket | null;
}

interface RankedStats {
    matches: number;
    wins: number;
    rock: number;
    paper: number;
    scissors: number;
    openings: {
        rock: number;
        paper: number;
        scissors: number;
    };
}

interface PlayerProfile {
    username: string;
    rank_name: string;
    total_wins: number;
    total_games: number;
    ranked_stats: RankedStats | null;
}

const RANKS = [
    { id: 'BRONCE', name: 'BRONCE', icon: '🥉', color: '#cd7f32' },
    { id: 'PLATA', name: 'PLATA', icon: '🥈', color: '#c0c0c0' },
    { id: 'ORO', name: 'ORO', icon: '🥇', color: '#ffd700' },
    { id: 'PLATINO', name: 'PLATINO', icon: '💠', color: '#e5e4e2' },
    { id: 'DIAMANTE', name: 'DIAMANTE', icon: '💎', color: '#b9f2ff' },
    { id: 'LEYENDA', name: 'LEYENDA', icon: '👑', color: '#ff00ff' }
];

export const PlayerStatsModal: React.FC<PlayerStatsModalProps> = ({ isOpen, onClose, userId, socket }) => {
    const [stats, setStats] = useState<PlayerProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const currentRank = useMemo(() => {
        if (!stats) return RANKS[0];
        return RANKS.find(r => r.id === stats.rank_name) || RANKS[0];
    }, [stats]);

    useEffect(() => {
        if (isOpen && userId && socket) {
            setLoading(true);
            socket.emit('getPlayerStats', userId);

            const handleData = (data: PlayerProfile) => {
                setStats(data);
                setLoading(false);
            };

            socket.on('playerStatsData', handleData);
            return () => {
                socket.off('playerStatsData', handleData);
            };
        }
    }, [isOpen, userId, socket]);

    // Helpers
    const getWinRate = () => {
        if (!stats?.ranked_stats?.matches) return 0;
        return Math.round((stats.ranked_stats.wins / stats.ranked_stats.matches) * 100);
    };

    const getFavoriteHand = () => {
        if (!stats?.ranked_stats) return '❓';
        const { rock, paper, scissors } = stats.ranked_stats;
        if (rock === 0 && paper === 0 && scissors === 0) return '❓';
        if (rock >= paper && rock >= scissors) return '✊';
        if (paper >= rock && paper >= scissors) return '✋';
        return '✌️';
    };

    const getPsychProfile = () => {
        if (!stats?.ranked_stats) return 'UNKNOWN';
        const { rock, paper, scissors } = stats.ranked_stats;
        const total = rock + paper + scissors;
        if (total < 5) return 'STALKER';

        const rPct = rock / total;
        const pPct = paper / total;
        const sPct = scissors / total;

        if (rPct > 0.45) return 'AGGRESSIVE';
        if (pPct > 0.45) return 'DEFENSIVE';
        if (sPct > 0.45) return 'STRIKER';
        return 'BALANCED';
    };

    const getOpeningStats = () => {
        if (!stats?.ranked_stats?.openings) return { rock: 0, paper: 0, scissors: 0 };
        const { rock, paper, scissors } = stats.ranked_stats.openings;
        const total = rock + paper + scissors || 1;
        return {
            rock: Math.round((rock / total) * 100),
            paper: Math.round((paper / total) * 100),
            scissors: Math.round((scissors / total) * 100)
        };
    };

    if (!isOpen) return null;

    const winRate = getWinRate();
    const openings = getOpeningStats();

    return (
        <div className={`stats-modal-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10001,
            animation: 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            <style jsx>{`
                @keyframes statsPop {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .stats-card {
                    animation: statsPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .glow-text {
                    text-shadow: 0 0 20px currentColor;
                }
            `}</style>

            <div className="stats-card" style={{
                background: 'linear-gradient(165deg, rgba(30, 30, 45, 0.98), rgba(15, 15, 25, 1))',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '32px',
                padding: '40px 30px',
                width: '92%',
                maxWidth: '440px',
                boxShadow: '0 30px 60px rgba(0,0,0,0.8), inset 0 0 20px rgba(255,255,255,0.02)',
                position: 'relative',
                overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

                {/* Decorative Elements */}
                <div style={{
                    position: 'absolute', top: '-100px', right: '-100px',
                    width: '250px', height: '250px',
                    background: `radial-gradient(circle, ${currentRank.color}11 0%, transparent 70%)`,
                    zIndex: 0
                }} />

                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <div className="loading-spinner" style={{
                            width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)',
                            borderTopColor: currentRank.color, borderRadius: '50%', margin: '0 auto 15px',
                            animation: 'rotate 1s linear infinite'
                        }} />
                        <p style={{ color: '#888', fontWeight: 600, letterSpacing: '1px' }}>ANALYZING DATA...</p>
                    </div>
                ) : stats ? (
                    <>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: '35px', position: 'relative', zIndex: 1 }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                <div style={{
                                    width: '100px', height: '100px',
                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
                                    borderRadius: '50%', margin: '0 auto 20px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '3.5rem', border: `2px solid ${currentRank.color}44`,
                                    boxShadow: `0 0 30px ${currentRank.color}22`
                                }}>
                                    👤
                                </div>
                                <div style={{
                                    position: 'absolute', bottom: '15px', right: '-10px',
                                    fontSize: '2rem', filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))'
                                }}>
                                    {currentRank.icon}
                                </div>
                            </div>

                            <h2 style={{
                                margin: 0, fontSize: '2.2rem', color: '#fff', fontWeight: 900,
                                textTransform: 'uppercase', letterSpacing: '2px'
                            }}>
                                {stats.username}
                            </h2>

                            <div style={{
                                marginTop: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: `${currentRank.color}15`,
                                padding: '6px 16px',
                                borderRadius: '100px',
                                border: `1px solid ${currentRank.color}33`,
                            }}>
                                <span style={{ color: currentRank.color, fontSize: '1rem', fontWeight: 800 }}>{currentRank.name}</span>
                                <span style={{ width: '4px', height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '50%' }}></span>
                                <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>{stats.total_wins} WINS</span>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '35px', position: 'relative', zIndex: 1 }}>
                            <div style={{
                                background: 'rgba(255,255,255,0.04)', padding: '25px 15px',
                                borderRadius: '24px', textAlign: 'center',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', fontWeight: 700, letterSpacing: '1px' }}>WIN RATE</div>
                                <div className="glow-text" style={{
                                    fontSize: '3rem', fontWeight: 900,
                                    color: winRate > 50 ? '#4caf50' : '#ff4444'
                                }}>
                                    {winRate}<span style={{ fontSize: '1.2rem', opacity: 0.6 }}>%</span>
                                </div>
                            </div>
                            <div style={{
                                background: 'rgba(255,255,255,0.04)', padding: '25px 15px',
                                borderRadius: '24px', textAlign: 'center',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '10px', fontWeight: 700, letterSpacing: '1px' }}>STYLE</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', letterSpacing: '1px' }}>
                                    {getPsychProfile()}
                                </div>
                                <div style={{ fontSize: '1.5rem', marginTop: '5px' }}>
                                    {getFavoriteHand()}
                                </div>
                            </div>
                        </div>

                        {/* Openings Section */}
                        <div style={{
                            background: 'rgba(0,0,0,0.2)', padding: '25px', borderRadius: '24px',
                            border: '1px solid rgba(255,255,255,0.03)', position: 'relative', zIndex: 1
                        }}>
                            <div style={{
                                fontSize: '0.85rem', color: '#888', marginBottom: '15px',
                                textAlign: 'center', fontWeight: 700, letterSpacing: '2px'
                            }}>
                                OPENING TENDENCIES
                            </div>

                            <div style={{ height: '12px', borderRadius: '6px', overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.05)' }}>
                                <div style={{ width: `${openings.rock}%`, background: '#ff4444', boxShadow: '0 0 10px rgba(255,68,68,0.5)' }} />
                                <div style={{ width: `${openings.paper}%`, background: '#4caf50', boxShadow: '0 0 10px rgba(76,175,80,0.5)' }} />
                                <div style={{ width: `${openings.scissors}%`, background: '#2196f3', boxShadow: '0 0 10px rgba(33,150,243,0.5)' }} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>✊</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ff4444' }}>{openings.rock}%</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>✋</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#4caf50' }}>{openings.paper}%</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>✌️</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#2196f3' }}>{openings.scissors}%</div>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            marginTop: '25px', textAlign: 'center',
                            fontSize: '0.85rem', color: '#555', fontWeight: 600,
                            letterSpacing: '1px'
                        }}>
                            DATASET: {stats.ranked_stats?.matches || 0} RANKED BATTLES
                        </div>

                        <button
                            onClick={onClose}
                            style={{
                                marginTop: '30px', width: '100%', padding: '15px',
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '16px', color: '#888', fontWeight: 800,
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#888'; }}
                        >
                            CLOSE PROFILE
                        </button>
                    </>
                ) : (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '15px' }}>⚠️</div>
                        <p style={{ color: '#ff4444', fontWeight: 800 }}>FAILED TO SYNC DATA</p>
                        <button onClick={onClose} style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '10px', background: '#333', color: '#fff', border: 'none' }}>CLOSE</button>
                    </div>
                )}
            </div>
        </div>
    );
};
