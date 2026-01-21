import React from 'react';
import { getRandomColors } from '@/lib/utils';
import { UserButton, useUser, SignedIn } from '@clerk/nextjs';

interface PlayerAvatarProps {
    isOpponent?: boolean;
    imageUrl?: string | null;
    isWinner?: boolean;
    colors?: { c1: string, c2: string };
    score?: number;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
    isOpponent = false,
    imageUrl,
    isWinner,
    colors,
    score = 0
}) => {
    // Generate constant colors if not provided (for fallback)
    const fallbackColors = React.useMemo(() => getRandomColors(), []);
    const { c1, c2 } = colors || fallbackColors;

    return (
        <div className="player-avatar-container">
            {isWinner && <div className="winner-crown">👑</div>}

            <div className={`avatar-circle ${isWinner ? 'winner' : ''}`} style={{
                background: `linear-gradient(135deg, ${c1}, ${c2})`,
                boxShadow: isWinner ? '0 0 30px #f0b90b' : '0 10px 25px rgba(0,0,0,0.3)'
            }}>
                {isOpponent ? (
                    imageUrl ? (
                        <img src={imageUrl} alt="Opponent" className="avatar-image-full" />
                    ) : (
                        <div style={{ fontSize: '2.5rem' }}>🤖</div>
                    )
                ) : (
                    <SignedIn>
                        <UserButton
                            appearance={{
                                elements: {
                                    userButtonAvatarBox: {
                                        width: '100%',
                                        height: '100%'
                                    }
                                }
                            }}
                        />
                    </SignedIn>
                )}
            </div>

            {/* Score Badge */}
            <div className="score-badge">
                {score}
            </div>
        </div>
    );
};
