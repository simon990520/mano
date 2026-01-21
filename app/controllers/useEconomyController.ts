import { useState, useEffect } from 'react';
import { supabase } from '@/app/services/supabase';
import { Socket } from 'socket.io-client';

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

        const onPurchaseError = (error: string) => {
            console.error('[ECONOMY] Server purchase error:', error);
            alert(`Error en la compra: ${error}. Por favor, verifica tu conexión o base de datos.`);
        };

        const onProfileUpdated = () => {
            setShowOnboarding(false);
            // We can emit a celebration event or callback here if we want the controller to handle it,
            // but for now we'll leave visual effects to the view or a separate coordinator.
            // Actually, the page.tsx had confetti here. We might want to expose a "profileUpdated" flag or event.
        };

        const onProfileUpdateError = (msg: string) => {
            alert('Error updating profile: ' + msg);
        };

        const onRoomRefunded = (data: { reason: string }) => {
            alert(data.reason);
            checkProfile(); // Update balances
        };

        socket.on('purchaseSuccess', onPurchaseSuccess);
        socket.on('purchaseError', onPurchaseError);
        socket.on('profileUpdated', onProfileUpdated);
        socket.on('profileUpdateError', onProfileUpdateError);
        socket.on('roomRefunded', onRoomRefunded);

        return () => {
            socket.off('purchaseSuccess', onPurchaseSuccess);
            socket.off('purchaseError', onPurchaseError);
            socket.off('profileUpdated', onProfileUpdated);
            socket.off('profileUpdateError', onProfileUpdateError);
            socket.off('roomRefunded', onRoomRefunded);
        };
    }, [socket]);


    const handlePurchase = (type: 'coins' | 'gems', amount: number) => {
        if (!isSignedIn || !user || !socket) {
            console.error('[ECONOMY] Purchase failed: User not signed in or socket not connected');
            return;
        }

        playSound('/sounds/sfx/click.mp3');
        console.log(`[ECONOMY] Emitting purchase to server: ${type} +${amount}`);
        socket.emit('purchase', { type, amount });
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
            birthDate
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
            handleSaveProfile,
            checkProfile
        }
    };
};
