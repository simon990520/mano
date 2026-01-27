'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser, SignedIn } from '@clerk/nextjs';
import { useSocket } from '@/app/hooks/useSocket';
import { useAudioController } from '@/app/controllers/useAudioController';
import { useEconomyController } from '@/app/controllers/useEconomyController';
import { useGameController } from '@/app/controllers/useGameController';
import { supabase } from '@/app/services/supabase';

// Components
import { Header } from '@/app/components/layout/Header';
import { LobbyScreen } from '@/app/components/Lobby/LobbyScreen';
import { GameArena } from '@/app/components/Game/GameArena';
import { SettingsModal } from '@/app/components/Modals/SettingsModal';
import { ShopModal } from '@/app/components/Modals/ShopModal';
import { LeaderboardModal } from '@/app/components/Modals/LeaderboardModal';
import { OnboardingModal } from '@/app/components/Modals/OnboardingModal';
import { GameOverModal } from '@/app/components/Modals/GameOverModal';
import { PlayerStatsModal } from '@/app/components/Modals/PlayerStatsModal';
import { ErrorModal } from '@/app/components/Modals/ErrorModal';

export default function Home() {
    const { user, isSignedIn } = useUser();

    // 0. Local UI State
    const { showSettings, setShowSettings, showLeaderboard, setShowLeaderboard } = useLocalUI();
    const [statsUserId, setStatsUserId] = useState<string | null>(null);
    const [statsImageUrl, setStatsImageUrl] = useState<string | null>(null);
    const [showCollision, setShowCollision] = useState(false);

    const handleOpenStats = (userId: string, imageUrl?: string | null) => {
        setStatsUserId(userId);
        setStatsImageUrl(imageUrl || null);
        playSound('/sounds/sfx/click.mp3');
    };

    const handleCloseStats = () => {
        setStatsUserId(null);
        setStatsImageUrl(null);
    };

    // 1. Audio System
    const { playSound, musicRef, volumeStates, refs: audioRefs } = useAudioController();

    // 2. Socket Connection
    const socket = useSocket();

    // 3. Economy System
    const { economyState, economyActions } = useEconomyController(isSignedIn, user, socket, playSound);

    // 4. Game Logic
    const {
        gameState,
        actions: gameActions,
        ...gameData
    } = useGameController(
        socket,
        user,
        playSound,
        economyActions.checkProfile,
        economyActions.handleGameOverUpdate // INJECTED: Handle economy updates from game results
    );

    // 5. Background Music Logic
    const { isMuted, musicVolume } = volumeStates;

    useEffect(() => {
        if (isMuted) {
            if (musicRef.current) {
                musicRef.current.pause();
                musicRef.current = null;
            }
            return;
        }

        const playTheme = (path: string) => {
            const currentSrc = musicRef.current?.src || '';
            if (currentSrc.includes(path)) {
                if (musicRef.current) {
                    musicRef.current.volume = audioRefs.isMutedRef.current ? 0 : audioRefs.musicVolumeRef.current * 0.4;
                    if (musicRef.current.paused) {
                        musicRef.current.play().catch(() => { });
                    }
                }
                return;
            }

            if (musicRef.current) {
                musicRef.current.pause();
            }

            const audio = new Audio(path);
            audio.volume = audioRefs.musicVolumeRef.current * 0.4;
            audio.loop = true;

            const startAttempt = () => {
                audio.play().catch(e => {
                    console.warn('[AUDIO] Autoplay standby for:', path);
                    const unlock = () => {
                        audio.play().catch(() => { });
                        window.removeEventListener('mousedown', unlock);
                        window.removeEventListener('touchstart', unlock);
                        window.removeEventListener('click', unlock);
                    };
                    window.addEventListener('mousedown', unlock);
                    window.addEventListener('touchstart', unlock);
                    window.addEventListener('click', unlock);
                });
            };

            startAttempt();
            musicRef.current = audio;
        };

        if (gameState === 'lobby') {
            playTheme('/sounds/music/battle_theme.mp3');
        } else if (gameState === 'waiting') {
            playTheme('/sounds/music/menu_theme.mp3');
        } else if (gameState === 'countdown' || gameState === 'playing' || gameState === 'roundResult' || gameState === 'gameOver') {
            playTheme('/sounds/music/battle_theme.mp3');
        }
    }, [gameState, isMuted, musicVolume, musicRef, audioRefs]);


    // 6. Visual Effects (Infinite Hue Cycle)
    const hueRef = useRef(Math.floor(Math.random() * 360));
    useEffect(() => {
        let frameId: number;
        const updateBackground = () => {
            hueRef.current = (hueRef.current + 0.05) % 360;
            const h1 = hueRef.current;
            const h2 = (h1 + 60) % 360;
            const c1 = `hsl(${h1}, 65%, 20%)`;
            const c2 = `hsl(${h2}, 55%, 15%)`;
            document.documentElement.style.setProperty('--bg-1', c1);
            document.documentElement.style.setProperty('--bg-2', c2);
            frameId = requestAnimationFrame(updateBackground);
        };
        frameId = requestAnimationFrame(updateBackground);
        return () => cancelAnimationFrame(frameId);
    }, []);

    return (
        <>
            <Header
                gems={economyState.gems}
                coins={economyState.coins}
                onOpenSettings={() => setShowSettings(true)}
                onOpenGemShop={() => economyActions.setShowGemShop(true)}
                onOpenCoinShop={() => economyActions.setShowCoinShop(true)}
                onOpenLeaderboard={() => setShowLeaderboard(true)}
            />

            {/* Modals */}
            {showSettings && (
                <SettingsModal
                    onClose={() => setShowSettings(false)}
                    volumeStates={volumeStates}
                />
            )}

            {economyState.showCoinShop && (
                <ShopModal
                    type="coins"
                    onClose={() => economyActions.setShowCoinShop(false)}
                    onPurchase={economyActions.handlePurchase}
                />
            )}

            {economyState.showGemShop && (
                <ShopModal
                    type="gems"
                    onClose={() => economyActions.setShowGemShop(false)}
                    onPurchase={economyActions.handlePurchase}
                />
            )}

            {showLeaderboard && (
                <LeaderboardWrapper onClose={() => setShowLeaderboard(false)} onShowStats={handleOpenStats} />
            )}

            {statsUserId && (
                <PlayerStatsModal
                    isOpen={!!statsUserId}
                    userId={statsUserId}
                    imageUrl={statsImageUrl}
                    onClose={handleCloseStats}
                    socket={socket}
                />
            )}

            {/* Main Game Views */}
            {gameState === 'lobby' ? (
                <LobbyScreen
                    user={user}
                    gameMode={gameData.gameMode}
                    setGameMode={gameData.setGameMode}
                    selectedStake={gameData.selectedStake}
                    setSelectedStake={gameData.setSelectedStake}
                    onFindMatch={gameActions.findMatch}
                    playSound={playSound}
                    rankName={economyState.rankName}
                    rp={economyState.rp}
                    onShowStats={() => user ? handleOpenStats(user.id, user.imageUrl) : undefined}
                />
            ) : gameState === 'waiting' ? (
                <div className="center-content">
                    <div>
                        <h1 className="game-title waiting-dots" style={{ marginBottom: '20px' }}>
                            ROCK<br />PAPER<br />SCISSORS
                        </h1>
                        <p style={{ fontSize: '1.2rem', opacity: 0.8, textAlign: 'center' }}>
                            Buscando oponente<span className="waiting-dots"></span>
                        </p>
                        <button
                            className="btn-secondary"
                            style={{ marginTop: '20px', padding: '10px 30px' }}
                            onClick={gameActions.leaveQueue}
                        >
                            CANCELAR
                        </button>
                    </div>
                </div>
            ) : (
                <GameArena
                    gameState={gameState}
                    playerScore={gameData.playerScore}
                    opponentScore={gameData.opponentScore}
                    user={user}
                    opponentImageUrl={gameData.opponentImageUrl}
                    showCollision={gameData.showCollision}
                    playerChoice={gameData.hands.player}
                    opponentChoice={gameData.hands.opponent}
                    round={gameData.round}
                    roundWinner={gameData.roundWinner}
                    turnTimer={gameData.turnTimer}
                    currentMatchStake={gameData.currentMatchStake}
                    gameMode={gameData.gameMode}
                    countdown={gameData.countdown}
                    onShowStats={(id) => {
                        const img = id === user?.id ? user?.imageUrl : gameData.opponentImageUrl;
                        handleOpenStats(id, img);
                    }}
                    opponentId={gameData.opponentId}
                    isOpponentDisconnected={gameData.isOpponentDisconnected}
                    reconnectTimer={gameData.reconnectTimer}
                />
            )}

            {gameState === 'playing' && !gameData.hands.player && (
                <div style={{ position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '20px', zIndex: 100 }}>
                    {['rock', 'paper', 'scissors'].map((choice) => (
                        <button
                            key={choice}
                            className="choice-btn"
                            onClick={() => gameActions.makeChoice(choice as any)}
                            style={{ fontSize: '3rem', padding: '20px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}
                        >
                            {choice === 'rock' ? '✊' : choice === 'paper' ? '✋' : '✌️'}
                        </button>
                    ))}
                </div>
            )}

            {gameState === 'gameOver' && (
                <GameOverModal
                    gameWinner={gameData.gameWinner}
                    rematchRequested={gameData.rematch.requested}
                    rematchStatus={gameData.rematch.status}
                    onRequestRematch={gameActions.requestRematch}
                    onPlayAgain={gameActions.playAgain}
                    onGoToLobby={gameActions.goToLobby}
                    onRematchResponse={gameActions.respondRematch}
                    showRewardAnim={gameData.reward.show}
                    rewardData={gameData.reward.data}
                    inactivityRefund={gameData.inactivityRefund}
                />
            )}

            <ErrorModal
                isOpen={gameData.errorModal.isOpen}
                title={gameData.errorModal.title}
                message={gameData.errorModal.message}
                onClose={gameActions.closeError}
            />
        </>
    );
}

// Temporary Wrapper for Leaderboard logic
function LeaderboardWrapper({ onClose, onShowStats }: { onClose: () => void, onShowStats: (id: string) => void }) {
    const [data, setData] = useState<any[]>([]);
    const [filter, setFilter] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

    useEffect(() => {
        const fetchLeaderboard = async () => {
            const { data: lb } = await supabase.from('profiles').select('*').order('total_wins', { ascending: false }).limit(10);
            if (lb) setData(lb);
        };
        fetchLeaderboard();
    }, [filter]);

    return <LeaderboardModal leaderboardData={data} timeFilter={filter} setTimeFilter={setFilter} onClose={onClose} onShowStats={onShowStats} />;
}

function useLocalUI() {
    const [showSettings, setShowSettings] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    return { showSettings, setShowSettings, showLeaderboard, setShowLeaderboard };
}
