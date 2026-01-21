import { useState, useEffect } from 'react';
import { GameState, Choice } from '@/lib/types';

export const useGameState = () => {
    const [gameState, setGameState] = useState<GameState>('lobby');
    const [gameMode, setGameMode] = useState<'casual' | 'ranked'>('casual');

    // Scoring & Rounds
    const [playerScore, setPlayerScore] = useState<number>(0);
    const [opponentScore, setOpponentScore] = useState<number>(0);
    const [round, setRound] = useState<number>(1);

    // Choices
    const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
    const [opponentChoice, setOpponentChoice] = useState<Choice | null>(null);
    const [choiceMade, setChoiceMade] = useState(false);

    // Results
    const [roundWinner, setRoundWinner] = useState<'player' | 'opponent' | 'tie' | null>(null);
    const [gameWinner, setGameWinner] = useState<'player' | 'opponent' | null>(null);

    // Opponent Data
    const [opponentImageUrl, setOpponentImageUrl] = useState<string | null>(null);

    // Timers & Animations
    const [countdown, setCountdown] = useState<number>(3);
    const [turnTimer, setTurnTimer] = useState<number>(3);
    const [showCollision, setShowCollision] = useState<boolean>(false);

    // Rematch
    const [rematchRequested, setRematchRequested] = useState<boolean>(false);
    const [rematchStatus, setRematchStatus] = useState<string>('');

    // Rewards Animation
    const [showRewardAnim, setShowRewardAnim] = useState(false);
    const [rewardData, setRewardData] = useState<{ type: 'coins' | 'gems' | 'rp', amount: number, isWin: boolean } | null>(null);

    // Stakes
    const [selectedStake, setSelectedStake] = useState(10);
    const [currentMatchStake, setCurrentMatchStake] = useState<number | null>(null);

    // Turn Timer Logic
    useEffect(() => {
        let timerId: NodeJS.Timeout;
        if (gameState === 'playing' && turnTimer > 0 && !choiceMade) {
            timerId = setInterval(() => {
                setTurnTimer(prev => Math.max(0, prev - 0.1));
            }, 100);
        }
        return () => clearInterval(timerId);
    }, [gameState, turnTimer, choiceMade]);

    // Reset for new game
    const resetGame = () => {
        setPlayerScore(0);
        setOpponentScore(0);
        setRound(1);
        setPlayerChoice(null);
        setOpponentChoice(null);
        setRoundWinner(null);
        setGameWinner(null);
        setChoiceMade(false);
        setRematchRequested(false);
        setRematchStatus('');
        setOpponentImageUrl(null);
    };

    return {
        gameState, setGameState,
        gameMode, setGameMode,
        playerScore, setPlayerScore,
        opponentScore, setOpponentScore,
        round, setRound,
        playerChoice, setPlayerChoice,
        opponentChoice, setOpponentChoice,
        choiceMade, setChoiceMade,
        roundWinner, setRoundWinner,
        gameWinner, setGameWinner,
        opponentImageUrl, setOpponentImageUrl,
        countdown, setCountdown,
        turnTimer, setTurnTimer,
        showCollision, setShowCollision,
        rematchRequested, setRematchRequested,
        rematchStatus, setRematchStatus,
        showRewardAnim, setShowRewardAnim,
        rewardData, setRewardData,
        selectedStake, setSelectedStake,
        currentMatchStake, setCurrentMatchStake,
        resetGame
    };
};
