import React from 'react';
import { PlayerAvatar } from './PlayerAvatar';
import { ChoiceActions } from './ChoiceActions'; // Will create next
import { Choice, GameState } from '@/lib/types';
import { getRandomColors } from '@/lib/utils'; // If needed for passing down

interface GameBoardProps {
    gameState: GameState;
    playerScore: number;
    opponentScore: number;
    opponentImageUrl: string | null;
    countdown: number;
    choiceMade: boolean;
    onMakeChoice: (choice: Choice) => void;
    gameWinner: 'player' | 'opponent' | null;
    roundWinner: 'player' | 'opponent' | 'tie' | null;
    playerChoice: Choice | null;
    opponentChoice: Choice | null;
    showCollision: boolean;
    turnTimer: number;
    playSound: (path: string) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
    gameState,
    playerScore,
    opponentScore,
    opponentImageUrl,
    countdown,
    choiceMade,
    onMakeChoice,
    gameWinner,
    roundWinner,
    playerChoice,
    opponentChoice,
    showCollision,
    turnTimer,
    playSound
}) => {

    // Memoize colors for opponent so they don't change every render if random
    const opponentColors = React.useMemo(() => getRandomColors(), []);

    // Helper to get emoji
    const getEmoji = (c: Choice) => {
        if (c === 'rock') return '✊';
        if (c === 'paper') return '✋';
        if (c === 'scissors') return '✌️';
        return '';
    };

    return (
        <div className="game-container">
            {/* Player Section (Left) */}
            <div className="player-section slide-in-left">
                <PlayerAvatar
                    score={playerScore}
                    isWinner={gameWinner === 'player' || roundWinner === 'player'}
                />
                <div className="player-label">YOU</div>

                {/* Visual Feedback for Choice */}
                {playerChoice && (
                    <div className="choice-indicator fade-in-up">
                        {getEmoji(playerChoice)}
                    </div>
                )}
            </div>

            {/* Center Area (VS / Timer / Outcome) */}
            <div className="center-area zoom-in">
                {gameState === 'countdown' && (
                    <div className="countdown-number pulse-fast">
                        {countdown}
                    </div>
                )}

                {gameState === 'playing' && (
                    <div className="vs-badge pulse-slow">
                        VS
                        <div className="timer-bar">
                            <div
                                className="timer-fill"
                                style={{ width: `${(turnTimer / 3) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Collision Animation */}
                {showCollision && playerChoice && opponentChoice && (
                    <div className="collision-container">
                        <div className="collision-side left">
                            {getEmoji(playerChoice)}
                        </div>
                        <div className="collision-flash">💥</div>
                        <div className="collision-side right">
                            {getEmoji(opponentChoice)}
                        </div>
                    </div>
                )}
            </div>

            {/* Opponent Section (Right) */}
            <div className="player-section slide-in-right">
                <PlayerAvatar
                    isOpponent
                    imageUrl={opponentImageUrl}
                    score={opponentScore}
                    isWinner={gameWinner === 'opponent' || roundWinner === 'opponent'}
                    colors={opponentColors}
                />
                <div className="player-label">RIVAL</div>

                {/* Visual Feedback for Choice */}
                {opponentChoice && (
                    <div className="choice-indicator fade-in-up">
                        {getEmoji(opponentChoice)}
                    </div>
                )}
            </div>

            {/* Choice Actions Bar (Bottom) */}
            {(gameState === 'playing' || gameState === 'roundResult') && (
                <ChoiceActions
                    disabled={choiceMade || gameState !== 'playing'}
                    onMakeChoice={onMakeChoice}
                    playSound={playSound}
                />
            )}
        </div>
    );
};
