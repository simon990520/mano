import React from 'react';
import { SignedIn, UserButton } from '@clerk/nextjs';

interface HeaderProps {
    gems: number;
    coins: number;
    onOpenSettings: () => void;
    onOpenGemShop: () => void;
    onOpenCoinShop: () => void;
    onOpenLeaderboard: () => void;
    onOpenSocial: () => void;
    socialPendingCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
    gems,
    coins,
    onOpenSettings,
    onOpenGemShop,
    onOpenCoinShop,
    onOpenLeaderboard,
    onOpenSocial,
    socialPendingCount = 0
}) => {
    return (
        <div className="main-header">
            {/* Settings Button */}
            <button
                className="icon-btn"
                onClick={onOpenSettings}
                title="Ajustes"
                style={{ flexShrink: 0 }}
            >
                ⚙️
            </button>

            {/* Gems */}
            <div
                className="economy-item gem interactive"
                onClick={onOpenGemShop}
                title="Tienda de Gemas"
            >
                <span className="economy-icon">💎</span>
                <span className="economy-value">{gems.toLocaleString()}</span>
            </div>

            {/* Coins */}
            <div
                className="economy-item coin interactive"
                onClick={onOpenCoinShop}
                title="Tienda de Monedas"
            >
                <span className="economy-icon">🪙</span>
                <span className="economy-value">{coins.toLocaleString()}</span>
            </div>

            {/* Rankings Button */}
            <button
                className="leaderboard-toggle"
                onClick={onOpenLeaderboard}
                style={{ margin: 0, flexShrink: 0 }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                    🏆 <span>Rankings</span>
                </span>
            </button>

            {/* Social Button */}
            <button
                className="leaderboard-toggle"
                onClick={onOpenSocial}
                style={{
                    margin: 0,
                    flexShrink: 0,
                    background: 'rgba(234, 179, 8, 0.12)',
                    borderColor: 'rgba(234, 179, 8, 0.35)',
                    color: '#eab308',
                    position: 'relative'
                }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                    👥 <span>Social</span>
                </span>
                {socialPendingCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '10px',
                        borderRadius: '50%',
                        minWidth: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
                        border: '2px solid rgba(0,0,0,0.5)',
                        padding: '0 3px'
                    }}>
                        {socialPendingCount > 99 ? '99+' : socialPendingCount}
                    </span>
                )}
            </button>

            {/* User Profile */}
            <SignedIn>
                <UserButton afterSignOutUrl="/" />
            </SignedIn>
        </div>
    );
};
