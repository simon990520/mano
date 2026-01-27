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
        console.log(`[ECONOMY] handlePurchase triggered: ${type}, amount: ${amount}`);

        if (!isSignedIn || !user || !socket) {
            console.error('[ECONOMY] Purchase failed: User not signed in or socket not connected', { isSignedIn, user: !!user, socketConnected: socket?.connected });
            return;
        }

        // ADMOB REWARD INTERCEPTION
        if (type === 'coins' && amount === 10) {
            console.log('[ECONOMY] Intercepting for AdMob reward...');
            playSound('/sounds/sfx/click.mp3');

            const anyWindow = window as any;

            // CHECK LOAD STATUS FIRST
            if (anyWindow.admobStatus === 'error') {
                console.error('[ADMOB] Fast-fail: SDK failed to load.');
                alert('NO SE PUDO CARGAR EL ANUNCIO.\n\nCausa probable: Bloqueador de Anuncios activo (AdBlock, Brave Shield, etc).\n\nSolución: Desactiva el bloqueador para este sitio y recarga la página.');
                return;
            }

            if (typeof anyWindow.adBreak === 'function') {
                console.log('[ADMOB] window.adBreak found. Triggering adBreak call...');

                // Fail-safe timeout (5 seconds)
                const adBreakTimeout = setTimeout(() => {
                    console.error('[ADMOB] TIMEOUT: adBreak called but no response within 5s');
                    alert('El anuncio no responde. Revisa si tienes un bloqueador de anuncios activo.');
                }, 5000);

                try {
                    anyWindow.adBreak({
                        type: 'reward',
                        name: 'get_10_coins_reward',
                        beforeReward: (showAdFn: () => void) => {
                            clearTimeout(adBreakTimeout);
                            console.log('[ADMOB] beforeReward callback triggered. Showing ad...');
                            showAdFn();
                        },
                        adViewed: () => {
                            clearTimeout(adBreakTimeout);
                            console.log('[ADMOB] adViewed callback triggered. Success!');
                            socket.emit('purchase', { type: 'coins', amount: 10 });
                            playSound('/sounds/sfx/win_round.mp3');
                        },
                        adDismissed: () => {
                            clearTimeout(adBreakTimeout);
                            console.warn('[ADMOB] adDismissed callback triggered. No reward.');
                        },
                        adError: (err: any) => {
                            clearTimeout(adBreakTimeout);
                            console.error('[ADMOB] adError callback triggered:', err);
                            alert('No hay anuncios disponibles en este momento.');
                        }
                    });
                } catch (err) {
                    clearTimeout(adBreakTimeout);
                    console.error('[ADMOB] EXCEPTION calling adBreak:', err);
                    alert('Error técnico al iniciar el anuncio.');
                }
            } else {
                console.error('[ADMOB] ERROR: window.adBreak is NOT a function or is undefined.');
                alert('El sistema de anuncios (AdMob) no se ha cargado correctamente. Desactiva bloqueadores de publicidad.');
            }
            return;
        }

        playSound('/sounds/sfx/click.mp3');
        console.log(`[ECONOMY] Normal purchase flow emitting: ${type} +${amount}`);
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
            checkProfile,
            handleGameOverUpdate
        }
    };
};
