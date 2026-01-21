import { useState, useEffect } from 'react';
import { supabase } from '@/app/services/supabase';
import { useUser } from '@clerk/nextjs';

export const useEconomy = (isSignedIn: boolean | undefined, user: any, socket: any) => {
    const [coins, setCoins] = useState<number>(0);
    const [gems, setGems] = useState<number>(0);
    const [rp, setRp] = useState<number>(0);
    const [rankName, setRankName] = useState<string>('BRONCE');

    // Onboarding State (tied to profile check)
    const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
    const [username, setUsername] = useState('');
    const [birthDate, setBirthDate] = useState('');

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

    // Also re-check when matched with stake (can be triggered externally via ref or prop if needed, 
    // but for now we expose checkProfile)

    const handlePurchase = (type: 'coins' | 'gems', amount: number, playSound: (path: string) => void) => {
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
        coins, setCoins,
        gems, setGems,
        rp, setRp,
        rankName, setRankName,
        checkProfile,
        handlePurchase,
        showOnboarding, setShowOnboarding,
        username, setUsername,
        birthDate, setBirthDate,
        handleSaveProfile
    };
};
