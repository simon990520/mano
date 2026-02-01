import { useState, useEffect } from 'react';
import { supabase } from '@/app/services/supabase';
import { Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import type { GameOverData } from '@/lib/types';

export const useEconomyController = (isSignedIn: boolean | undefined, user: any, socket: Socket | null, playSound: (path: string) => void) => {
    const [coins, setCoins] = useState<number>(0);
    const [gems, setGems] = useState<number>(0);
    const [rp, setRp] = useState<number>(0);
    const [rankName, setRankName] = useState<string>('BRONCE');

    // Onboarding State (tied to profile check)
    const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
    const [username, setUsername] = useState('');
    const [birthDate, setBirthDate] = useState('');

    // Shop visibility helpers (UI state)
    const [showCoinShop, setShowCoinShop] = useState<boolean>(false);
    const [showGemShop, setShowGemShop] = useState<boolean>(false);

    const [currentStreak, setCurrentStreak] = useState<number>(0);
    const [lastClaimedAt, setLastClaimedAt] = useState<string | null>(null);

    // Global Error/Success States (Economy/General)
    const [errorModal, setErrorModal] = useState<{ isOpen: boolean, title: string, message: string }>({
        isOpen: false,
        title: '',
        message: ''
    });

    const [successModal, setSuccessModal] = useState<{ isOpen: boolean, title: string, message: string }>({
        isOpen: false,
        title: '',
        message: ''
    });

    const checkProfile = async () => {
        if (!isSignedIn || !user) return;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        // If profile missing or incomplete (no username or birth_date)
        if (error || !data || !data.username || !data.birth_date) {
            setShowOnboarding(true);
            if (data?.username) setUsername(data.username);
        }

        if (data) {
            setCoins(data.coins || 0);
            setGems(data.gems || 0);
            setRp(data.rp || 0);
            setRankName(data.rank_name || 'BRONCE');
            setCurrentStreak(data.current_streak || 0);
            setLastClaimedAt(data.last_claimed_at || null);
        }
    };

    // Check Profile on Load
    useEffect(() => {
        if (isSignedIn !== undefined && user) {
            checkProfile();
        }
    }, [isSignedIn, user]);

    // Handle Socket Events for Economy
    useEffect(() => {
        if (!socket) return;

        const onPurchaseSuccess = ({ type, newValue }: { type: 'coins' | 'gems', newValue: number }) => {
            if (type === 'coins') setCoins(newValue);
            else setGems(newValue);
            console.log(`[ECONOMY] Purchase confirmed by server: ${type} = ${newValue}`);
        };

        const onRewardClaimed = ({ newCoins, streak, claimedAt }: { newCoins: number, streak: number, claimedAt: string }) => {
            setCoins(newCoins);
            setCurrentStreak(streak);
            setLastClaimedAt(claimedAt);
            playSound('/sounds/sfx/win_round.mp3');

            // RACHA SUCCESS CONFETTI
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#ffd700', '#ffffff', '#ff6b6b'],
                zIndex: 30000
            });

            // RACHA SUCCESS MODAL
            setSuccessModal({
                isOpen: true,
                title: '¡RECOMPENSA!',
                message: `Has reclamado ${streak * 10} monedas. ¡Vuelve mañana para el día ${streak === 7 ? 1 : streak + 1}! 🚀`
            });

            console.log(`[ECONOMY] Daily reward claimed! Streak: ${streak}, New Coins: ${newCoins}`);

            // GTM Analytics
            if (typeof window !== 'undefined' && (window as any).dataLayer) {
                (window as any).dataLayer.push({
                    event: 'daily_reward_claim_success',
                    streak: streak,
                    rewardAmount: streak * 10
                });
            }
        };

        const onPurchaseError = (error: string) => {
            console.error('[ECONOMY] Server purchase error:', error);
            setErrorModal({
                isOpen: true,
                title: 'TIENDA',
                message: error
            });
        };

        const onProfileUpdated = () => {
            setShowOnboarding(false);

            // CELEBRATION FOR PROFILE/ONBOARDING
            confetti({
                particleCount: 100,
                spread: 60,
                origin: { y: 0.7 },
                colors: ['#00ff88', '#60efff', '#ffffff'],
                zIndex: 30000
            });
        };

        const onProfileUpdateError = (msg: string) => {
            setErrorModal({
                isOpen: true,
                title: 'PERFIL',
                message: msg
            });
        };

        const onRoomRefunded = (data: { reason: string }) => {
            setErrorModal({
                isOpen: true,
                title: 'REEMBOLSO',
                message: data.reason
            });
            checkProfile(); // Update balances
        };

        socket.on('purchaseSuccess', onPurchaseSuccess);
        socket.on('rewardClaimed', onRewardClaimed);
        socket.on('purchaseError', onPurchaseError);
        socket.on('profileUpdated', onProfileUpdated);
        socket.on('profileUpdateError', onProfileUpdateError);
        socket.on('roomRefunded', onRoomRefunded);

        return () => {
            socket.off('purchaseSuccess', onPurchaseSuccess);
            socket.off('rewardClaimed', onRewardClaimed);
            socket.off('purchaseError', onPurchaseError);
            socket.off('profileUpdated', onProfileUpdated);
            socket.off('profileUpdateError', onProfileUpdateError);
            socket.off('roomRefunded', onRoomRefunded);
        };
    }, [socket]);


    const handlePurchase = async (type: 'coins' | 'gems', amount: number) => {
        console.log(`[ECONOMY] handlePurchase triggered: ${type}, amount: ${amount}`);

        if (!isSignedIn || !user || !socket) {
            console.error('[ECONOMY] Purchase failed: User not signed in or socket not connected', { isSignedIn, user: !!user, socketConnected: socket?.connected });
            return;
        }

        // DAILY STREAK CLAIM (Replaces Ads/WhatsApp for 10 coins)
        if (type === 'coins' && amount === 10) {
            handleClaimDaily();
            return;
        }

        // MANUAL WHATSAPP INTEGRATION
        const prices: { [key: number]: number } = {
            50: 5000,
            100: 10000,
            250: 25000,
            500: 50000,
            1000: type === 'coins' ? 100000 : 1000000
        };

        const price = prices[amount];
        if (!price) {
            console.error('Invalid amount selected');
            return;
        }

        playSound('/sounds/sfx/click.mp3');

        // WHATSAPP REDIRECTION
        const phoneNumber = '573506049629';
        const itemType = type === 'coins' ? 'monedas' : 'gemas';
        const message = `Hola buenos dias deseo comprar ${amount} ${itemType}`;
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

        // GTM Analytics
        if (typeof window !== 'undefined' && (window as any).dataLayer) {
            (window as any).dataLayer.push({
                event: 'purchase_attempt',
                itemType: type,
                amount: amount
            });
        }

        window.open(whatsappUrl, '_blank');
    };

    const handleClaimDaily = () => {
        if (socket) {
            socket.emit('claimDailyReward');
            playSound('/sounds/sfx/click.mp3');
        }
    };

    const handleSaveProfile = () => {
        if (!username.trim() || !birthDate) {
            setErrorModal({
                isOpen: true,
                title: 'DATOS FALTANTES',
                message: 'Por favor, completa todos los campos del perfil.'
            });
            return;
        }
        if (socket) {
            socket.emit('updateProfile', { username, birthDate });
        }
    };

    // Helper to update economy from Game Over data
    const handleGameOverUpdate = (data: GameOverData) => {
        if (data.newRp !== undefined) setRp(data.newRp);
        if (data.newRank) setRankName(data.newRank);
        if (data.newCoins !== undefined) setCoins(data.newCoins);
        if (data.newGems !== undefined) setGems(data.newGems);
    }

    return {
        economyState: {
            coins,
            gems,
            rp,
            rankName,
            showCoinShop,
            showGemShop,
            showOnboarding,
            username,
            birthDate,
            currentStreak,
            lastClaimedAt,
            errorModal,
            successModal
        },
        economyActions: {
            setCoins,
            setGems,
            setRp,
            setRankName,
            setShowCoinShop,
            setShowGemShop,
            setShowOnboarding,
            setUsername,
            setBirthDate,
            handlePurchase,
            handleClaimDaily,
            handleSaveProfile,
            checkProfile,
            handleGameOverUpdate,
            closeError: () => setErrorModal(prev => ({ ...prev, isOpen: false })),
            closeSuccess: () => setSuccessModal(prev => ({ ...prev, isOpen: false }))
        }
    };
};
