import { useState, useEffect } from 'react';
import { supabase } from '@/app/services/supabase';
import { Socket } from 'socket.io-client';
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
        checkProfile();
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
            console.log(`[ECONOMY] Daily reward claimed! Streak: ${streak}, New Coins: ${newCoins}`);
        };

        const onPurchaseError = (error: string) => {
            console.error('[ECONOMY] Server purchase error:', error);
            alert(`Error en la operación: ${error}.`);
        };

        const onProfileUpdated = () => {
            setShowOnboarding(false);
        };

        const onProfileUpdateError = (msg: string) => {
            alert('Error updating profile: ' + msg);
        };

        const onRoomRefunded = (data: { reason: string }) => {
            alert(data.reason);
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
            alert('Please fill in all fields');
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
            lastClaimedAt
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
            handleGameOverUpdate
        }
    };
};
