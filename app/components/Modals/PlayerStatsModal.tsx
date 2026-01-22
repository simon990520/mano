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

export const PlayerStatsModal: React.FC<PlayerStatsModalProps> = ({ isOpen, onClose, userId, socket }) => {
    const [stats, setStats] = useState<PlayerProfile | null>(null);
    const [loading, setLoading] = useState(true);

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
        if (rock >= paper && rock >= scissors) return '✊';
        if (paper >= rock && paper >= scissors) return '✋';
        return '✌️';
    };

    const getPsychProfile = () => {
        if (!stats?.ranked_stats) return 'UNKNOWN';
        const { rock, paper, scissors } = stats.ranked_stats;
        const total = rock + paper + scissors;
        if (total < 5) return 'MYSTERY';

        const rPct = rock / total;
        const pPct = paper / total;

        if (rPct > 0.45) return 'AGGRESSIVE';
        if (pPct > 0.45) return 'DEFENSIVE';
        return 'TACTICAL';
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
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.2s ease-out'
        }} onClick={onClose}>
            <div style={{
                background: 'rgba(20, 20, 30, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '24px',
                padding: '30px',
                width: '90%',
                maxWidth: '400px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                position: 'relative'
            }} onClick={e => e.stopPropagation()}>

                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                        Loading intelligence...
                    </div>
                ) : stats ? (
                    <>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: '25px' }}>
                            <div style={{
                                width: '80px', height: '80px',
                                background: 'linear-gradient(135deg, #444, #222)',
                                borderRadius: '50%', margin: '0 auto 15px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2.5rem', border: '2px solid rgba(255,255,255,0.1)'
                            }}>
                                👤
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>{stats.username}</h2>
                            <span style={{
                                background: 'rgba(255,255,255,0.1)', padding: '4px 12px',
                                borderRadius: '20px', fontSize: '0.8rem', color: '#aaa',
                                marginTop: '8px', display: 'inline-block'
                            }}>
                                {stats.rank_name}
                            </span>
                        </div>

                        {/* Stats Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
                            <div className="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '16px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '5px' }}>WIN RATE</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: winRate > 50 ? '#4caf50' : '#ff4444' }}>
                                    {winRate}%
                                </div>
                            </div>
                            <div className="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '16px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '5px' }}>STYLE</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>
                                    {getPsychProfile()}
                                </div>
                            </div>
                        </div>

                        {/* Openings */}
                        <div style={{ marginBottom: '25px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                Opening Moves
                            </div>
                            <div style={{ display: 'flex', gap: '10px', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${openings.rock}%`, background: '#ff4444' }} />
                                <div style={{ width: `${openings.paper}%`, background: '#4caf50' }} />
                                <div style={{ width: `${openings.scissors}%`, background: '#2196f3' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: '#aaa' }}>
                                <span>✊ {openings.rock}%</span>
                                <span>✋ {openings.paper}%</span>
                                <span>✌️ {openings.scissors}%</span>
                            </div>
                        </div>

                        <div style={{ fontSize: '0.7rem', color: '#555', textAlign: 'center' }}>
                            Based on {stats.ranked_stats?.matches || 0} Ranked Matches
                        </div>
                    </>
                ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#f55' }}>
                        Failed to load data.
                    </div>
                )}
            </div>
        </div>
    );
};
