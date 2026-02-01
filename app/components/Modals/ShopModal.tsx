import React from 'react';

interface ShopModalProps {
    type: 'coins' | 'gems';
    onClose: () => void;
    onPurchase: (type: 'coins' | 'gems', amount: number) => void;
    currentStreak?: number;
    lastClaimedAt?: string | null;
}

export const ShopModal: React.FC<ShopModalProps> = ({ type, onClose, onPurchase, currentStreak = 0, lastClaimedAt }) => {
    const isCoins = type === 'coins';
    const title = isCoins ? 'COIN SHOP' : 'GEM SHOP';
    const icon = isCoins ? '🪙' : '💎';
    const amounts = [10, 50, 100, 250, 500, 1000];

    const isAlreadyClaimedToday = () => {
        if (!lastClaimedAt) return false;
        const last = new Date(lastClaimedAt).toDateString();
        const now = new Date().toDateString();
        return last === now;
    };

    const claimed = isAlreadyClaimedToday();

    return (
        <div className="leaderboard-overlay" style={{ zIndex: isCoins ? 10002 : 10003 }}>
            <div className="leaderboard-card shop-card" style={{ maxWidth: '400px' }}>
                <div className="leaderboard-header">
                    <div className="leaderboard-logo">{icon}</div>
                    <h2
                        className="leaderboard-title"
                        style={!isCoins ? {
                            background: 'linear-gradient(to bottom, #00ffff, #008b8b)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        } : undefined}
                    >
                        {title}
                    </h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <div className="shop-grid">
                    {amounts.map((amount) => {
                        const isDailyStreak = type === 'coins' && amount === 10;
                        const prices: { [key: number]: number } = {
                            10: isDailyStreak ? 0 : 1000, // Fallback if 10 gems/coins used elsewhere
                            50: 5000,
                            100: 10000,
                            250: 25000,
                            500: 50000,
                            1000: type === 'coins' ? 100000 : 1000000
                        };
                        const price = prices[amount];

                        let priceText = `$${price.toLocaleString('es-CO')}`;
                        if (isDailyStreak) {
                            priceText = claimed ? 'MAÑANA' : `RACHA (Día ${currentStreak + 1}/7)`;
                        }

                        // Determine rewards for streak
                        const displayedAmount = isDailyStreak ? (currentStreak + 1) * 10 : amount;

                        return (
                            <button
                                key={amount}
                                className={`shop-item-btn ${type} ${isDailyStreak ? 'rewarded-btn' : ''}`}
                                onClick={() => onPurchase(type, amount)}
                                disabled={isDailyStreak && claimed}
                                style={isDailyStreak ? {
                                    border: claimed ? '2px solid #555' : '2px solid #ffd700',
                                    background: claimed ? 'rgba(85,85,85,0.2)' : 'linear-gradient(45deg, #ff6b6b, #fca5a5)',
                                    opacity: claimed ? 0.6 : 1,
                                    cursor: claimed ? 'not-allowed' : 'pointer'
                                } : undefined}
                            >
                                <span className="shop-item-icon">{icon}</span>
                                <span className="shop-item-amount">+{displayedAmount}</span>
                                <span className="shop-item-price">
                                    {priceText}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
