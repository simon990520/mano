import { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import type { Choice, GameState, RoundResult, GameOverData } from '@/lib/types';
import confetti from 'canvas-confetti';

export const useGameController = (
    socket: Socket | null,
    user: any,
    playSound: (path: string) => void,
    checkProfile: () => void,
    onGameOverUpdate: (data: GameOverData) => void,
    checkBalanceForArena: (amount: number, mode: 'casual' | 'ranked') => boolean
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
    const [gameWinner, setGameWinner] = useState<'player' | 'opponent' | 'tie' | null>(null);
    const [inactivityRefund, setInactivityRefund] = useState(false);
    const [choiceMade, setChoiceMade] = useState(false);
    const [opponentImageUrl, setOpponentImageUrl] = useState<string | null>(null);
    const [opponentId, setOpponentId] = useState<string | null>(null);
    const [isOpponentDisconnected, setIsOpponentDisconnected] = useState(false);
    const [reconnectTimer, setReconnectTimer] = useState(10);
    const [showCollision, setShowCollision] = useState<boolean>(false);

    // Visual feedback state for round results
    const [roundResultFlash, setRoundResultFlash] = useState<'win' | 'lose' | null>(null);

    // Rematch states
    const [rematchRequested, setRematchRequested] = useState<boolean>(false);
    const [rematchStatus, setRematchStatus] = useState<string>('');

    // Animation State
    const [showRewardAnim, setShowRewardAnim] = useState(false);
    const [rewardData, setRewardData] = useState<{ type: 'coins' | 'gems' | 'rp', amount: number, isWin: boolean } | null>(null);

    // Error Modal State
    const [errorModal, setErrorModal] = useState<{ isOpen: boolean, title: string, message: string }>({
        isOpen: false,
        title: '',
        message: ''
    });

    // Refs para limpiar timeouts pendientes
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Lobby/Matchmaking State
    const [gameMode, setGameMode] = useState<'casual' | 'ranked'>('casual');
    const [selectedStake, setSelectedStake] = useState(10);
    const [currentMatchStake, setCurrentMatchStake] = useState<number | null>(null);
    const [turnTimer, setTurnTimer] = useState(5);

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

        // AUTO-RECONNECT CHECK ON MOUNT/RECOVERY
        socket.emit('checkReconnection');

        socket.on('matchError', (msg: string) => {
            console.log('[SOCKET_INFO] Match info:', msg);
            // Mostrar nuestro ErrorModal
            setErrorModal({
                isOpen: true,
                title: 'RECURSOS INSUFICIENTES',
                message: msg
            });
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
            setIsOpponentDisconnected(false); // Safeguard
            playSound('/sounds/voices/announcer/mach.mp3');

            if (data.stakeTier) {
                setCurrentMatchStake(data.stakeTier);
                setSelectedStake(data.stakeTier); // SYNC: Persist stake for future matches
                checkProfile();
            }

            if (data.mode) {
                setGameMode(data.mode); // SYNC: Persist mode for future matches
            }

            if (data?.opponentImageUrl) {
                setOpponentImageUrl(data.opponentImageUrl);
            } else {
                setOpponentImageUrl(null);
            }

            if (data?.opponentId) {
                setOpponentId(data.opponentId);
            } else {
                setOpponentId(null);
            }

            // GTM Analytics
            if (typeof window !== 'undefined' && (window as any).dataLayer) {
                (window as any).dataLayer.push({
                    event: 'match_start',
                    gameMode: data.mode || gameMode,
                    stake: data.stakeTier || selectedStake,
                    opponentId: data.opponentId || 'unknown'
                });
            }
        });

        socket.on('countdown', (count: number) => {
            setCountdown(count);
            setGameState('countdown');
            if (count === 3) {
                playSound('/sounds/sfx/countdown.mp3');
                setPlayerChoice(null);
                setOpponentChoice(null);
                setChoiceMade(false);
            }
        });

        socket.on('roundStart', (roundNum: number) => {
            setRound(roundNum);
            setGameState('playing');
            setIsOpponentDisconnected(false); // Clear if stuck
            setChoiceMade(false);
            setPlayerChoice(null);
            setOpponentChoice(null);
            setRoundWinner(null);
            setShowCollision(false);
            setTurnTimer(5);
            playSound('/sounds/sfx/fight.mp3');
        });

        socket.on('timer', (time: number) => {
            setTurnTimer(time);
        });

        socket.on('roundResult', (result: any) => {
            setPlayerChoice(result.playerChoice);
            setOpponentChoice(result.opponentChoice);
            setRoundWinner(result.winner);
            setPlayerScore(result.playerScore);
            setOpponentScore(result.opponentScore);
            setGameState('roundResult');
            setShowCollision(true);
            setTimeout(() => setShowCollision(false), 600);
            playSound('/sounds/sfx/collision.mp3');

            // Trigger visual feedback based on round result
            if (result.winner === 'player') {
                setRoundResultFlash('win');
                setTimeout(() => setRoundResultFlash(null), 500);
            } else if (result.winner === 'opponent') {
                setRoundResultFlash('lose');
                setTimeout(() => setRoundResultFlash(null), 500);
            }

            setTimeout(() => {
                if (result.winner === 'player') playSound('/sounds/sfx/win_round.mp3');
                else if (result.winner === 'opponent') playSound('/sounds/sfx/lose_round.mp3');
                else playSound('/sounds/sfx/tie.mp3');
            }, 400);

            // GTM Analytics
            if (typeof window !== 'undefined' && (window as any).dataLayer) {
                (window as any).dataLayer.push({
                    event: 'round_end',
                    roundNumber: round,
                    winner: result.winner,
                    playerChoice: result.playerChoice,
                    opponentChoice: result.opponentChoice
                });
            }
        });

        socket.on('gameOver', (data: GameOverData & { inactivityRefund?: boolean }) => {
            console.log('[GAME_STATUS] Game Over:', data);
            setGameWinner(data.winner);
            setGameState('gameOver');
            setIsOpponentDisconnected(false); // HIDE DISCONNECTION MODAL
            setInactivityRefund(data.inactivityRefund || false);

            // Trigger Economy Update
            if (onGameOverUpdate) onGameOverUpdate(data);

            // CRÍTICO: No mostrar animación de recompensa si:
            // 1. Es un empate por inactividad (inactivityRefund flag)
            // 2. El resultado es 'tie' (cualquier tipo de empate)
            // 3. No hay premio ni cambio de RP
            const shouldShowReward = !data.inactivityRefund
                && (data.winner as string) !== 'tie'
                && (data.prize || data.rpChange || (data.mode === 'casual' && data.stake));

            if (shouldShowReward) {
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
            } else {
                // Asegurar que la animación esté oculta para empates/reembolsos
                setShowRewardAnim(false);
                setRewardData(null);
            }

            setTimeout(() => {
                if (data.winner === 'player') playSound('/sounds/voices/announcer/win_game.mp3');
                else if (data.winner === 'opponent') playSound('/sounds/voices/announcer/lose_game.mp3');
                else if (data.winner === 'tie') playSound('/sounds/sfx/tie.mp3');
            }, 500);

            // GTM Analytics
            if (typeof window !== 'undefined' && (window as any).dataLayer) {
                (window as any).dataLayer.push({
                    event: 'game_over',
                    winner: data.winner,
                    gameMode: data.mode,
                    finalScore: `${playerScore}-${opponentScore}`,
                    inactivityRefund: data.inactivityRefund || false
                });
            }
        });

        socket.on('rematchRequested', () => {
            console.log('[REMATCH] Received request from opponent');
            setRematchStatus('¡El oponente quiere una revancha!');
        });

        socket.on('rematchAccepted', () => {
            console.log('[REMATCH] Accepted! Starting new game sequence...');
            setRematchStatus('¡Revancha aceptada! Iniciando nueva partida...');
            if (checkProfile) checkProfile();

            setTimeout(() => {
                console.log('[REMATCH] Resetting game state...');
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
            }, 500);
        });

        socket.on('rematchDeclined', () => {
            console.log('[REMATCH] Opponent declined');
            setRematchStatus('El oponente rechazó la revancha');
            setTimeout(() => {
                setGameState('lobby');
            }, 2000);
        });

        socket.on('opponentDisconnected', (data: { timeout: number }) => {
            console.warn('[GAME_STATUS] Opponent disconnected. Waiting...');
            setIsOpponentDisconnected(true);
            setReconnectTimer(Math.floor(data.timeout / 1000));
            setRematchStatus('Opponent disconnected!');
            setRematchRequested(false);
        });

        socket.on('opponentReconnected', (data?: { opponentImageUrl?: string, opponentId?: string }) => {
            console.log('[GAME_STATUS] Opponent reconnected!', data);
            setIsOpponentDisconnected(false);
            // Actualizar imagen del oponente si se proporciona
            if (data?.opponentImageUrl) {
                setOpponentImageUrl(data.opponentImageUrl);
            }
            if (data?.opponentId) {
                setOpponentId(data.opponentId);
            }
        });

        socket.on('reconnectSuccess', (data: any) => {
            console.log('[GAME_STATUS] Reconnection successful, restoring state:', data);

            // CRÍTICO: Limpiar timeout de reconexión anterior si existe
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
                console.log('[RECONNECT] Cleared previous reconnect timeout');
            }

            // PASO 1: Limpiar TODOS los estados de la sesión anterior
            setIsOpponentDisconnected(false);
            setShowCollision(false);
            setShowRewardAnim(false);
            setRewardData(null);
            setRematchRequested(false);
            setRematchStatus('');
            setGameWinner(null); // Limpiar ganador previo
            setRoundWinner(null); // Limpiar ganador de ronda previo

            // PASO 2: Restaurar información del oponente
            if (data.opponentImageUrl) {
                setOpponentImageUrl(data.opponentImageUrl);
            } else {
                const opponent = data.roomState?.players?.find((p: any) => p.userId !== user?.id);
                if (opponent?.imageUrl) {
                    setOpponentImageUrl(opponent.imageUrl);
                }
            }
            if (data.opponentId) setOpponentId(data.opponentId);

            // PASO 3: Restaurar scores y round
            setPlayerScore(data.myScore || 0);
            setOpponentScore(data.opScore || 0);
            setRound(data.currentRound || 1);

            // PASO 4: Limpiar elecciones para permitir nueva jugada
            setPlayerChoice(null);
            setOpponentChoice(null);
            setChoiceMade(false);

            // PASO 5: Sincronizar el timer con el servidor
            const serverTimer = data.turnTimer || 5;
            setTurnTimer(serverTimer);
            console.log(`[RECONNECT] Synchronized timer to server value: ${serverTimer}s`);

            // PASO 6: Establecer el estado del juego basado en el servidor
            const serverState = data.state || data.roomState?.state || 'playing';
            console.log(`[RECONNECT] Setting game state to: ${serverState}`);

            // Pequeño delay para asegurar que todos los states se hayan actualizado
            reconnectTimeoutRef.current = setTimeout(() => {
                setGameState(serverState);
                reconnectTimeoutRef.current = null;
            }, 100);

            console.log('[RECONNECT] State restoration complete, ready to resume');
        });

        socket.on('opponentLeft', () => {
            console.log('[GAME_STATUS] Opponent left');
            setRematchStatus('El oponente se fue a una nueva partida.');
            setRematchRequested(false);
        });

        socket.on('lobby', () => {
            setGameState('lobby');
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
            socket.off('opponentReconnected');
            socket.off('reconnectSuccess');
            socket.off('opponentLeft');
            socket.off('lobby');
        };
    }, [socket, isSignedIn]);

    // Action Handlers
    const handleFindMatch = () => {
        if (!isSignedIn || !socket || !socket.connected) return;

        // Check balance before finding match
        if (!checkBalanceForArena(selectedStake, gameMode)) return;

        socket.emit('findMatch', {
            imageUrl: user?.imageUrl,
            mode: gameMode,
            stakeTier: selectedStake
        });

        // GTM Analytics
        if (typeof window !== 'undefined' && (window as any).dataLayer) {
            (window as any).dataLayer.push({
                event: 'match_search_start',
                gameMode: gameMode,
                stake: selectedStake
            });
        }
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

            // GTM Analytics
            if (typeof window !== 'undefined' && (window as any).dataLayer) {
                (window as any).dataLayer.push({
                    event: 'choice_made',
                    choice: choice,
                    round: round
                });
            }
        }
    };

    const handleRequestRematch = () => {
        if (socket) {
            console.log('[REMATCH] Requesting...');
            playSound('/sounds/sfx/click.mp3');
            socket.emit('requestRematch');
            setRematchRequested(true);
            setRematchStatus('Esperando respuesta del oponente...');
        }
    };

    const handleRematchResponse = (accepted: boolean) => {
        if (socket) {
            console.log('[REMATCH] Responding:', accepted);
            playSound('/sounds/sfx/click.mp3');
            socket.emit('rematchResponse', accepted);
            if (accepted) {
                setRematchStatus('Rematch accepted! Starting new game...');
            } else {
                setRematchStatus('Rechazaste la revancha');
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

        // SECURITY/PERSISTENCE: Use the stake from the match just ended
        const nextStake = currentMatchStake || selectedStake;
        if (!checkBalanceForArena(nextStake, gameMode)) {
            setGameState('lobby'); // Return to lobby if they can't afford play again
            return;
        }

        if (socket && socket.connected) {
            socket.emit('findMatch', {
                imageUrl: user?.imageUrl,
                mode: gameMode,
                stakeTier: nextStake
            });
        }
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
        inactivityRefund,
        turnTimer,
        hands: { player: playerChoice, opponent: opponentChoice },
        roundWinner,
        gameWinner,
        opponentImageUrl,
        opponentId,
        isOpponentDisconnected,
        reconnectTimer,
        showCollision,
        rematch: { requested: rematchRequested, status: rematchStatus },
        reward: { show: showRewardAnim, data: rewardData },
        roundResultFlash,
        errorModal,
        currentMatchStake,
        actions: {
            findMatch: handleFindMatch,
            leaveQueue: handleLeaveQueue,
            makeChoice: handleChoice,
            requestRematch: handleRequestRematch,
            respondRematch: handleRematchResponse,
            playAgain: handlePlayAgain,
            closeError: () => setErrorModal(prev => ({ ...prev, isOpen: false })),
            goToLobby
        }
    };
};
