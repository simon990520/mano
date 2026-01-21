import React from 'react';
import { SignedIn, UserButton } from '@clerk/nextjs';

interface HeaderProps {
    gems: number;
    coins: number;
    onOpenSettings: () => void;
    onOpenGemShop: () => void;
    onOpenCoinShop: () => void;
    onOpenLeaderboard: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    gems,
    coins,
    onOpenSettings,
    onOpenGemShop,
    onOpenCoinShop,
    onOpenLeaderboard
}) => {
    return (
        <div className="main-header">
            {/* Settings Toggle (Leftmost) */}
            <button
                className="icon-btn settings-btn"
                onClick={onOpenSettings}
                title="Settings"
            >
                ⚙️
            </button>

            {/* Gems (Visual Only) */}
            <div
                className="economy-item gem interactive"
                onClick={onOpenGemShop}
                title="Open Gem Shop"
            >
                <span className="economy-icon">💎</span>
                <span className="economy-value">{gems.toLocaleString()}</span>
            </div>

            {/* Coins (Visual Only) */}
            <div
                className="economy-item coin interactive"
                onClick={onOpenCoinShop}
                title="Open Coin Shop"
            >
                <span className="economy-icon">🪙</span>
                <span className="economy-value">{coins.toLocaleString()}</span>
            </div>

            {/* Rankings Button */}
            <button
                className="leaderboard-toggle"
                onClick={onOpenLeaderboard}
                style={{ margin: 0 }}
            >
                🏆 Rankings
            </button>

            {/* User Profile (Rightmost) */}
            <SignedIn>
                <UserButton afterSignOutUrl="/" />
            </SignedIn>
        </div>
    );
};
