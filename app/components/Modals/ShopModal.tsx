import React from 'react';

interface ShopModalProps {
    type: 'coins' | 'gems';
    onClose: () => void;
    onPurchase: (type: 'coins' | 'gems', amount: number) => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({ type, onClose, onPurchase }) => {
    const isCoins = type === 'coins';
    const title = isCoins ? 'COIN SHOP' : 'GEM SHOP';
    const icon = isCoins ? '🪙' : '💎';
    const amounts = [10, 50, 100, 250, 500, 1000];

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
                        const isRewardedAd = type === 'coins' && amount === 10;
                        return (
                            <button
                                key={amount}
                                className={`shop-item-btn ${type} ${isRewardedAd ? 'rewarded-btn' : ''}`}
                                onClick={() => onPurchase(type, amount)}
                                style={isRewardedAd ? { border: '2px solid #ffd700', background: 'linear-gradient(45deg, #ff6b6b, #fca5a5)' } : undefined}
                            >
                                <span className="shop-item-icon">{icon}</span>
                                <span className="shop-item-amount">+{amount}</span>
                                <span className="shop-item-price">
                                    {isRewardedAd ? 'GRATIS (ADS)' : 'RELOAD'}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
