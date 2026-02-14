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
    const [phoneNumber, setPhoneNumber] = useState('');
    const [whatsappContact, setWhatsappContact] = useState('573146959639'); // Default fallback

    // Shop visibility helpers (UI state)
    const [showCoinShop, setShowCoinShop] = useState<boolean>(false);
    const [showGemShop, setShowGemShop] = useState<boolean>(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
    const [withdrawType, setWithdrawType] = useState<'coins' | 'gems'>('coins');
    const [minWithdrawal, setMinWithdrawal] = useState<number>(10000);

    const [currentStreak, setCurrentStreak] = useState<number>(0);
    const [lastClaimedAt, setLastClaimedAt] = useState<string | null>(null);

    // Global Error/Success States (Economy/General)
    const [errorModal, setErrorModal] = useState<{ isOpen: boolean, title: string, message: string, onAction?: () => void, actionLabel?: string }>({
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

        console.log('[ONBOARDING_DEBUG] Starting checkProfile for user:', user.id);

        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, birth_date, phone_number, coins, gems, rp, rank_name, current_streak, last_claimed_at')
            .eq('id', user.id)
            .single();

        console.log('[ONBOARDING_DEBUG] Query result:', {
            hasError: !!error,
            errorMessage: error?.message,
            hasData: !!data,
            username: data?.username,
            birth_date: data?.birth_date,
            phone_number: data?.phone_number,
            fullData: data
        });

        // NETWORK ERROR: Don't show onboarding modal for connection issues
        if (error && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
            console.warn('[ONBOARDING_DEBUG] Network error detected. Skipping onboarding check.', error.message);
            return; // Don't change showOnboarding state on network errors
        }

        // If profile is COMPLETE (has all 3 fields), explicitly hide onboarding
        if (data && data.username && data.birth_date && data.phone_number) {
            console.log('[ONBOARDING_DEBUG] Profile is COMPLETE. Setting showOnboarding = FALSE');
            setShowOnboarding(false);
        }
        // If profile missing or incomplete (no username, birth_date, OR phone_number)
        else if (!data || !data.username || !data.birth_date || !data.phone_number) {
            console.log('[ONBOARDING_DEBUG] Profile INCOMPLETE. Setting showOnboarding = TRUE', {
                reason: !data ? 'no data' : !data.username ? 'no username' : !data.birth_date ? 'no birth_date' : 'no phone_number'
            });
            setShowOnboarding(true);
            // Pre-fill existing data if any
            if (data?.username) setUsername(data.username);
            if (data?.phone_number) setPhoneNumber(data.phone_number);
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

        const onRewardClaimed = (data: { streak: number; newCoins: number; currentStreak?: number, claimedAt: string }) => {
            const { streak, newCoins, currentStreak, claimedAt } = data;

            setCoins(newCoins);
            // Update streak with the server's value if provided, otherwise fallback to existing streak logic
            if (currentStreak !== undefined) {
                setCurrentStreak(currentStreak);
            } else {
                setCurrentStreak(streak); // Fallback to 'streak' if 'currentStreak' is not provided
            }
            setLastClaimedAt(claimedAt); // Keep setting claimedAt
            playSound('/sounds/sfx/win_round.mp3');

            // Confetti effect
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FFD700', '#FFA500', '#ffffff'],
                zIndex: 30000
            });

            // CLOSE SHOP AUTOMATICALLY
            setShowCoinShop(false);

            console.log(`[ECONOMY] Daily reward claimed! Streak: ${currentStreak ?? streak}, New Coins: ${newCoins}`);

            // GTM Analytics
            if (typeof window !== 'undefined' && (window as any).dataLayer) {
                (window as any).dataLayer.push({
                    event: 'daily_reward_claim_success',
                    streak: currentStreak ?? streak,
                    rewardAmount: (currentStreak ?? streak) * 10
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

        const onProfileUpdated = (data?: { coins?: number }) => {
            console.log('[ECONOMY] Profile update success event received:', data);
            setShowOnboarding(false);
            if (data?.coins !== undefined) {
                setCoins(data.coins);
            }

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

        const onConfigUpdated = (config: any) => {
            if (config?.min_withdrawal_cop !== undefined) {
                console.log('[ECONOMY] Dynamic min withdrawal updated:', config.min_withdrawal_cop);
                setMinWithdrawal(config.min_withdrawal_cop);
            }
        };

        socket.on('purchaseSuccess', onPurchaseSuccess);
        socket.on('rewardClaimed', onRewardClaimed);
        socket.on('purchaseError', onPurchaseError);
        socket.on('profileUpdated', onProfileUpdated);
        socket.on('appSettingsUpdated', (settings: any) => {
            if (settings.whatsapp_contact_number) setWhatsappContact(settings.whatsapp_contact_number);
        });
        socket.emit('getAppSettings'); // Request dynamic settings
        socket.on('profileUpdateError', onProfileUpdateError);
        socket.on('roomRefunded', onRoomRefunded);
        socket.on('botConfigUpdated', onConfigUpdated);

        return () => {
            socket.off('purchaseSuccess', onPurchaseSuccess);
            socket.off('rewardClaimed', onRewardClaimed);
            socket.off('purchaseError', onPurchaseError);
            socket.off('profileUpdated', onProfileUpdated);
            socket.off('profileUpdateError', onProfileUpdateError);
            socket.off('roomRefunded', onRoomRefunded);
            socket.off('botConfigUpdated', onConfigUpdated);
        };
    }, [socket]);


    const effectiveUsername = username || 'Jugador';

    const handlePurchase = async (type: 'coins' | 'gems', amount: number) => {
        console.log(`[ECONOMY] handlePurchase triggered: ${type}, amount: ${amount}`);

        if (!isSignedIn || !user || !socket) {
            console.error('[ECONOMY] Purchase failed: User not signed in or socket not connected', { isSignedIn, user: !!user, socketConnected: socket?.connected });
            return;
        }

        // 1. Get accurate username from DB or generic fallback
        let finalUsername = username;
        if (!finalUsername || finalUsername === user?.username) {
            console.log('[ECONOMY] State username empty or matches Clerk, fetching strictly from DB...');
            const { data } = await supabase.from('profiles').select('username').eq('id', user.id).single();
            finalUsername = data?.username || 'Jugador';
        }

        // DAILY STREAK CLAIM (Replaces Ads/WhatsApp for 10 coins)
        if (type === 'coins' && amount === 10) {
            console.log('[ECONOMY] Claiming daily reward replacement');
            handleClaimDaily();
            return;
        }

        // WHATSAPP REDIRECTION
        const phoneNumber = whatsappContact;
        const itemType = type === 'coins' ? 'monedas' : 'gemas';
        const message = `Hola soy ${finalUsername} deseo comprar ${amount} ${itemType}`;
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

        // GTM Analytics
        if (typeof window !== 'undefined' && (window as any).dataLayer) {
            (window as any).dataLayer.push({
                event: 'purchase_attempt',
                itemType: type,
                amount: amount
            });
        }

        console.log('[ECONOMY] Opening WhatsApp for purchase:', whatsappUrl);
        playSound('/sounds/sfx/click.mp3');
        window.open(whatsappUrl, '_blank');
    };

    const handleClaimDaily = () => {
        if (socket) {
            socket.emit('claimDailyReward');
            playSound('/sounds/sfx/click.mp3');
        }
    };

    const handleWithdraw = async (type: 'coins' | 'gems') => {
        console.log('[ECONOMY] handleWithdraw triggered for:', type);
        if (!isSignedIn || !user) return;
        setWithdrawType(type);
        setShowWithdrawModal(true);
        playSound('/sounds/sfx/click.mp3');
    };

    const handleConfirmWithdraw = async (amount: number) => {
        if (!isSignedIn || !user) return;

        // 1. Get accurate username
        let finalUsername = username;
        if (!finalUsername || finalUsername === user?.username) {
            const { data } = await supabase.from('profiles').select('username').eq('id', user.id).single();
            finalUsername = data?.username || 'Jugador';
        }

        const rate = withdrawType === 'coins' ? 10 : 100;
        const copValue = Math.floor(amount * rate);
        const itemType = withdrawType === 'coins' ? 'monedas' : 'gemas';

        console.log(`[ECONOMY] Processing withdrawal: ${amount} ${itemType} (${copValue} COP)`);

        const phoneNumber = whatsappContact;
        const message = `Hola soy ${finalUsername} y deseo retirar ${amount} ${itemType} (Equivalente a $${copValue.toLocaleString('es-CO')} COP)`;
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

        playSound('/sounds/sfx/click.mp3');
        window.open(whatsappUrl, '_blank');
        setShowWithdrawModal(false);
    };

    /**
     * Revisa si el usuario tiene saldo para una arena. 
     * Si no tiene, abre la modal de error con opción de ir a la tienda.
     */
    const checkBalanceForArena = (required: number, type: 'casual' | 'ranked') => {
        const itemType = type === 'casual' ? 'coins' : 'gems';
        const balance = type === 'casual' ? coins : gems;

        if (balance < required) {
            setErrorModal({
                isOpen: true,
                title: 'SALDO INSUFICIENTE',
                message: `No tienes suficientes ${itemType === 'coins' ? 'monedas' : 'gemas'} para esta arena. ¿Deseas recargar?`,
                onAction: () => {
                    setErrorModal(prev => ({ ...prev, isOpen: false }));
                    if (itemType === 'coins') setShowCoinShop(true);
                    else setShowGemShop(true);
                },
                actionLabel: 'IR A LA TIENDA'
            });
            return false;
        }
        return true;
    };

    const handleSaveProfile = () => {
        if (!username.trim() || !birthDate || !phoneNumber.trim()) {
            setErrorModal({
                isOpen: true,
                title: 'DATOS FALTANTES',
                message: 'Por favor, completa todos los campos del perfil.'
            });
            return;
        }
        // Validate phone number format
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
            setErrorModal({
                isOpen: true,
                title: 'NÚMERO INVÁLIDO',
                message: 'Por favor, ingresa un número de WhatsApp válido con código de país (Ej: +573001234567)'
            });
            return;
        }
        if (socket) {
            socket.emit('updateProfile', {
                username,
                birth_date: birthDate,
                phone_number: phoneNumber
            });
        }
    };

    // Helper to update economy from Game Over data
    const handleGameOverUpdate = (data: GameOverData) => {
        if (data.newRp !== undefined) setRp(data.newRp);
        if (data.newRank) setRankName(data.newRank);
        if (data.newCoins !== undefined) setCoins(data.newCoins);
        if (data.newGems !== undefined) setGems(data.newGems);
    };

    return {
        economyState: {
            coins,
            gems,
            rp,
            rankName,
            showCoinShop,
            showGemShop,
            showWithdrawModal,
            withdrawType,
            minWithdrawal,
            showOnboarding,
            username,
            birthDate,
            phoneNumber,
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
            setShowWithdrawModal,
            setShowOnboarding,
            setUsername,
            setBirthDate,
            setPhoneNumber,
            handlePurchase,
            handleClaimDaily,
            handleWithdraw,
            handleConfirmWithdraw,
            handleSaveProfile,
            checkProfile,
            handleGameOverUpdate,
            checkBalanceForArena,
            closeError: () => setErrorModal(prev => ({ ...prev, isOpen: false })),
            closeSuccess: () => setSuccessModal(prev => ({ ...prev, isOpen: false }))
        }
    };
};
