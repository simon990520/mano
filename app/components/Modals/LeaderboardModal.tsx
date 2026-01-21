import React from 'react';
import type { User } from '@/lib/types'; // Assuming User or similar interface might exist, otherwise using any for prop

interface LeaderboardModalProps {
    onClose: () => void;
    leaderboardData: any[];
    timeFilter: 'daily' | 'weekly' | 'monthly';
    setTimeFilter: (filter: 'daily' | 'weekly' | 'monthly') => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ onClose, leaderboardData, timeFilter, setTimeFilter }) => {
    return (
        <div className="leaderboard-overlay">
            <div className="leaderboard-card">
                <div className="leaderboard-header">
                    <div className="leaderboard-logo">🏆</div>
                    <h2 className="leaderboard-title">HALL OF FAME</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="filter-tabs">
                    <button
                        className={`tab-btn ${timeFilter === 'daily' ? 'active' : ''}`}
                        onClick={() => setTimeFilter('daily')}
                    >
                        Daily
                    </button>
                    <button
                        className={`tab-btn ${timeFilter === 'weekly' ? 'active' : ''}`}
                        onClick={() => setTimeFilter('weekly')}
                    >
                        Weekly
                    </button>
                    <button
                        className={`tab-btn ${timeFilter === 'monthly' ? 'active' : ''}`}
                        onClick={() => setTimeFilter('monthly')}
                    >
                        Monthly
                    </button>
                </div>

                <div className="top-three-container">
                    {[1, 0, 2].map((orderIndex) => {
                        const player = leaderboardData[orderIndex];
                        // If we don't have enough players, show placeholder? Logic from page.tsx:
                        // if (!player && leaderboardData.length > orderIndex) return null; -> Wait, this logic was slightly weird in original.
                        // "if (!player) return placeholder..."

                        if (!player) return (
                            <div key={`placeholder-${orderIndex}`} className={`rank-card rank-${orderIndex + 1}`} style={{ opacity: 0.3 }}>
                                <div className="rank-avatar">?</div>
                                <div className="rank-name">Empty</div>
                                <div className="rank-score">--</div>
                            </div>
                        );

                        return (
                            <div key={player.id} className={`rank-card rank-${orderIndex + 1}`}>
                                <div className="rank-avatar">{orderIndex + 1}</div>
                                <div className="rank-name">{player.username || `Player ${player.id.substring(0, 4)}`}</div>
                                <div className="rank-score">{player.total_wins} W</div>
                            </div>
                        );
                    })}
                </div>

                <div className="leaderboard-list">
                    {leaderboardData.slice(3).length === 0 ? (
                        <div style={{ textAlign: 'center', opacity: 0.5, padding: '20px', fontSize: '0.9rem' }}>
                            {leaderboardData.length <= 3 ? "No other contenders..." : "Loading..."}
                        </div>
                    ) : (
                        leaderboardData.slice(3).map((player, index) => (
                            <div key={player.id} className="leaderboard-item">
                                <div className="rank-badge" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', width: '30px', height: '30px', fontSize: '0.9rem' }}>
                                    {index + 4}
                                </div>
                                <div className="player-info">
                                    <div className="player-name">{player.username || `Player ${player.id.substring(0, 5)}`}</div>
                                    <div className="player-stats">{player.total_games} games</div>
                                </div>
                                <div className="win-count" style={{ fontSize: '1rem' }}>{player.total_wins} W</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
