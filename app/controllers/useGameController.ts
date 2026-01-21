import { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import type { Choice, GameState, RoundResult, GameOverData } from '@/lib/types';
import confetti from 'canvas-confetti';

export const useGameController = (
    socket: Socket | null,
    user: any,
    playSound: (path: string) => void,
    checkProfile: () => void
) => {
    // Game State
    const [gameState, setGameState] = useState<GameState>('lobby');
    const [countdown, setCountdown] = useState<number>(3);
    const [playerScore, setPlayerScore] = useState<number>(0);
    const [opponentScore, setOpponentScore] = useState<number>(0);
    const [round, setRound] = useState<number>(1);
    const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
    const [opponentChoice, setOpponentChoice] = useState<Choice | null>(null);
    const [roundWinner, setRoundWinner] = useState<'player' | 'opponent' | 'tie' | null>(null);
    const [gameWinner, setGameWinner] = useState<'player' | 'opponent' | null>(null);
    const [choiceMade, setChoiceMade] = useState(false);
    const [opponentImageUrl, setOpponentImageUrl] = useState<string | null>(null);
    const [showCollision, setShowCollision] = useState<boolean>(false);

    // Rematch states
    const [rematchRequested, setRematchRequested] = useState<boolean>(false);
    const [rematchStatus, setRematchStatus] = useState<string>('');

    // Animation State
    const [showRewardAnim, setShowRewardAnim] = useState(false);
    const [rewardData, setRewardData] = useState<{ type: 'coins' | 'gems' | 'rp', amount: number, isWin: boolean } | null>(null);

    // Lobby/Matchmaking State
    const [gameMode, setGameMode] = useState<'casual' | 'ranked'>('casual');
    const [selectedStake, setSelectedStake] = useState(10);
    const [currentMatchStake, setCurrentMatchStake] = useState<number | null>(null);
    const [turnTimer, setTurnTimer] = useState<number>(3);

    const isSignedIn = !!user;

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

    // Socket Event Listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('matchError', (msg: string) => {
            console.error('[SOCKET_INFO] Match error:', msg);
            alert(msg);
            setGameState('lobby');
        });

        socket.on('waiting', () => {
            console.log('[GAME_STATUS] Waiting in queue...');
            setGameState('waiting');
        });

        socket.on('matchFound', (data: any) => {
            console.log('[GAME_STATUS] Match found! Data:', data);
            setGameState('countdown');
            setPlayerScore(0);
            setOpponentScore(0);
            setRound(1);
            setRematchRequested(false);
            setRematchStatus('');
            playSound('/sounds/voices/announcer/mach.mp3');

            if (data.stakeTier) {
                setCurrentMatchStake(data.stakeTier);
                checkProfile();
            }

            if (data?.opponentImageUrl) {
                setOpponentImageUrl(data.opponentImageUrl);
            } else {
                setOpponentImageUrl(null);
            }
        });

        socket.on('countdown', (count: number) => {
            setCountdown(count);
            setGameState('countdown');
            if (count === 3) {
                playSound('/sounds/sfx/countdown.mp3');
            }
        });

        socket.on('roundStart', (roundNum: number) => {
            setRound(roundNum);
            setGameState('playing');
            setChoiceMade(false);
            setPlayerChoice(null);
            setOpponentChoice(null);
            setRoundWinner(null);
            setShowCollision(false);
            setTurnTimer(3);
            playSound('/sounds/sfx/fight.mp3');
        });

        socket.on('roundResult', (result: RoundResult) => {
            setPlayerChoice(result.playerChoice);
            setOpponentChoice(result.opponentChoice);
            setRoundWinner(result.winner);
            setPlayerScore(result.playerScore);
            setOpponentScore(result.opponentScore);
            setGameState('roundResult');
            setShowCollision(true);
            setTimeout(() => setShowCollision(false), 600);
            playSound('/sounds/sfx/collision.mp3');
            setTimeout(() => {
                if (result.winner === 'player') playSound('/sounds/sfx/win_round.mp3');
                else if (result.winner === 'opponent') playSound('/sounds/sfx/lose_round.mp3');
                else playSound('/sounds/sfx/tie.mp3');
            }, 400);
        });

        socket.on('gameOver', (data: GameOverData) => {
            setGameWinner(data.winner);
            setGameState('gameOver');

            if (data.prize || data.rpChange || (data.mode === 'casual' && data.stake)) {
                const isWinner = data.winner === 'player';
                let rewardType: 'coins' | 'gems' | 'rp' = 'coins';
                let rewardAmount = 0;

                if (data.mode === 'ranked') {
                    rewardType = 'gems';
                    if (isWinner) rewardAmount = data.prize || 0;
                    else rewardAmount = -(data.stake || 0);
                } else {
                    rewardType = 'coins';
                    if (isWinner) rewardAmount = data.prize || 0;
                    else rewardAmount = -(data.stake || 0);
                }

                if (rewardAmount !== 0) {
                    setRewardData({ type: rewardType, amount: rewardAmount, isWin: isWinner });
                    setShowRewardAnim(true);
                }
            }

            setTimeout(() => {
                if (data.winner === 'player') playSound('/sounds/voices/announcer/win_game.mp3');
                else playSound('/sounds/voices/announcer/lose_game.mp3');
            }, 500);
        });

        socket.on('rematchRequested', () => {
            setRematchStatus('Opponent wants a rematch!');
        });

        socket.on('rematchAccepted', () => {
            setRematchStatus('Rematch accepted! Starting new game...');
            checkProfile();
            setTimeout(() => {
                setGameState('countdown');
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
            }, 2000);
        });

        socket.on('rematchDeclined', () => {
            setRematchStatus('Opponent declined the rematch');
            setTimeout(() => {
                setGameState('lobby');
            }, 2000);
        });

        socket.on('opponentDisconnected', () => {
            console.warn('[GAME_STATUS] Opponent disconnected mid-game');
            setGameState('gameOver');
            setRematchStatus('Opponent disconnected!');
            setRematchRequested(false);
        });

        socket.on('opponentLeft', () => {
            setRematchStatus('Opponent left for a new game.');
            setRematchRequested(false);
        });

        return () => {
            socket.off('matchError');
            socket.off('waiting');
            socket.off('matchFound');
            socket.off('countdown');
            socket.off('roundStart');
            socket.off('roundResult');
            socket.off('gameOver');
            socket.off('rematchRequested');
            socket.off('rematchAccepted');
            socket.off('rematchDeclined');
            socket.off('opponentDisconnected');
            socket.off('opponentLeft');
        };
    }, [socket, isSignedIn]); // Added isSignedIn but mostly depends on socket presence.

    // Action Handlers
    const handleFindMatch = () => {
        if (!isSignedIn || !socket || !socket.connected) return;
        socket.emit('findMatch', {
            imageUrl: user?.imageUrl,
            mode: gameMode,
            stakeTier: selectedStake
        });
    };

    const handleLeaveQueue = () => {
        if (socket) socket.emit('leaveQueue');
        setGameState('lobby');
        playSound('/sounds/sfx/click.mp3');
    };

    const handleChoice = (choice: Choice) => {
        if (socket && !choiceMade) {
            setChoiceMade(true);
            setPlayerChoice(choice);
            playSound('/sounds/sfx/click.mp3');
            playSound(`/sounds/voices/announcer/${choice}.mp3`);
            socket.emit('makeChoice', choice);
        }
    };

    const handleRequestRematch = () => {
        if (socket) {
            playSound('/sounds/sfx/click.mp3');
            socket.emit('requestRematch');
            setRematchRequested(true);
            setRematchStatus('Waiting for opponent response...');
        }
    };

    const handleRematchResponse = (accepted: boolean) => {
        if (socket) {
            playSound('/sounds/sfx/click.mp3');
            socket.emit('rematchResponse', accepted);
            if (accepted) {
                setRematchStatus('Rematch accepted! Starting new game...');
            } else {
                setRematchStatus('You declined the rematch');
                setTimeout(() => {
                    setGameState('lobby');
                }, 2000);
            }
        }
    };

    const handlePlayAgain = () => {
        setGameState('waiting');
        setPlayerScore(0);
        setOpponentScore(0);
        setRound(1);
        setPlayerChoice(null);
        setOpponentChoice(null);
        setRoundWinner(null);
        setGameWinner(null);
        setChoiceMade(false);
        setOpponentImageUrl(null);
        setRematchRequested(false);
        setRematchStatus('');
        handleFindMatch();
    };

    const goToLobby = () => {
        setGameState('lobby');
        setRematchStatus('');
        setRematchRequested(false);
        if (socket) socket.emit('leaveQueue');
        playSound('/sounds/sfx/click.mp3');
    };

    return {
        gameState,
        gameMode, setGameMode,
        selectedStake, setSelectedStake,
        countdown,
        playerScore,
        opponentScore,
        round,
        turnTimer,
        hands: { player: playerChoice, opponent: opponentChoice },
        roundWinner,
        gameWinner,
        opponentImageUrl,
        showCollision,
        rematch: { requested: rematchRequested, status: rematchStatus },
        reward: { show: showRewardAnim, data: rewardData },
        currentMatchStake,
        actions: {
            findMatch: handleFindMatch,
            leaveQueue: handleLeaveQueue,
            makeChoice: handleChoice,
            requestRematch: handleRequestRematch,
            respondRematch: handleRematchResponse,
            playAgain: handlePlayAgain,
            goToLobby
        }
    };
};
