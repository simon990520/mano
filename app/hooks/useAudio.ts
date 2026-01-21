import { useState, useRef, useEffect } from 'react';

export const useAudio = (gameState: string) => {
    // Audio State
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [musicVolume, setMusicVolume] = useState<number>(0.5);
    const [sfxVolume, setSfxVolume] = useState<number>(0.7);
    const [announcerVolume, setAnnouncerVolume] = useState<number>(0.8);

    // Refs for accessing current values inside closures/callbacks without stale state
    const musicRef = useRef<HTMLAudioElement | null>(null);
    const musicVolumeRef = useRef<number>(0.5);
    const sfxVolumeRef = useRef<number>(0.7);
    const announcerVolumeRef = useRef<number>(0.8);
    const isMutedRef = useRef<boolean>(false);

    // Sync volume refs with state
    useEffect(() => {
        musicVolumeRef.current = musicVolume;
        sfxVolumeRef.current = sfxVolume;
        announcerVolumeRef.current = announcerVolume;
        isMutedRef.current = isMuted;
    }, [musicVolume, sfxVolume, announcerVolume, isMuted]);

    // Load persisted settings on mount
    useEffect(() => {
        const savedMusicVol = localStorage.getItem('musicVolume');
        const savedSfxVol = localStorage.getItem('sfxVolume');
        const savedAnnouncerVol = localStorage.getItem('announcerVolume');
        const savedMute = localStorage.getItem('isMuted');

        if (savedMusicVol !== null) setMusicVolume(parseFloat(savedMusicVol));
        if (savedSfxVol !== null) setSfxVolume(parseFloat(savedSfxVol));
        if (savedAnnouncerVol !== null) setAnnouncerVolume(parseFloat(savedAnnouncerVol));
        if (savedMute !== null) setIsMuted(savedMute === 'true');
    }, []);

    // Save persistence on change
    useEffect(() => {
        localStorage.setItem('musicVolume', musicVolume.toString());
        localStorage.setItem('sfxVolume', sfxVolume.toString());
        localStorage.setItem('announcerVolume', announcerVolume.toString());
        localStorage.setItem('isMuted', isMuted.toString());
    }, [musicVolume, sfxVolume, announcerVolume, isMuted]);

    // Centralized Audio Manager
    const playSound = (soundPath: string, volumeOverride?: number) => {
        if (isMutedRef.current) return;
        try {
            const audio = new Audio(soundPath);

            // Handle volume by category
            let baseVolume = sfxVolumeRef.current;
            if (soundPath.includes('/voices/announcer/')) {
                baseVolume = announcerVolumeRef.current;
            }

            audio.volume = volumeOverride !== undefined ? volumeOverride : baseVolume;
            audio.play().catch(err => console.warn('[AUDIO] Play failed:', err));
        } catch (error) {
            console.error('[AUDIO] Error playing sound:', error);
        }
    };

    const playMusic = (soundPath: string, loop: boolean = true) => {
        if (isMutedRef.current) return;
        try {
            const audio = new Audio(soundPath);
            audio.volume = musicVolumeRef.current * 0.6; // Background music at 60% of music volume
            audio.loop = loop;
            audio.play().catch(err => console.warn('[AUDIO] Music play failed:', err));
            return audio;
        } catch (error) {
            console.error('[AUDIO] Error playing music:', error);
            return null;
        }
    };

    // Dedicated Music Volume Sync (Ensures real-time sliding works)
    useEffect(() => {
        if (musicRef.current) {
            if (isMuted) {
                musicRef.current.volume = 0;
            } else {
                musicRef.current.volume = musicVolume * 0.4;
            }
        }
    }, [musicVolume, isMuted]);

    // Background Music Controller based on Game State
    useEffect(() => {
        if (isMuted) {
            if (musicRef.current) {
                musicRef.current.pause();
                musicRef.current = null;
            }
            return;
        }

        const playTheme = (path: string) => {
            // Check if we are already trying to play this exact file
            const currentSrc = musicRef.current?.src || '';
            if (currentSrc.includes(path)) {
                // UPDATE VOLUME REAL-TIME if same file
                if (musicRef.current) {
                    musicRef.current.volume = isMutedRef.current ? 0 : musicVolumeRef.current * 0.4;
                    // If it's already the current ref but it's paused (due to autoplay block), try playing again
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
            audio.volume = musicVolumeRef.current * 0.4;
            audio.loop = true;

            const startAttempt = () => {
                audio.play().catch(e => {
                    console.warn('[AUDIO] Autoplay standby for:', path);
                    // Global interaction listener to unlock ANY audio context
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
    }, [gameState, isMuted, musicVolume]);

    return {
        playSound,
        playMusic,
        volumeStates: {
            musicVolume,
            setMusicVolume,
            sfxVolume,
            setSfxVolume,
            announcerVolume,
            setAnnouncerVolume,
            isMuted,
            setIsMuted
        }
    };
};
