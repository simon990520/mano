import { useState, useRef, useEffect } from 'react';

export const useAudioController = () => {
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
        if (typeof window === 'undefined') return;

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
        if (typeof window === 'undefined') return;

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
        if (isMutedRef.current) {
            // If muted, we might still want to setup current music ref but paused?
            // Or just handle it in the effect consumer.
            // Here we just return null or setup logic.
        }

        try {
            // Logic handled by consumer effect usually, but this helper can be used for one-offs.
            // But for background music, we need the Ref control. 
            // So we expose the Ref logic via a helper or direct access? 
            // Better to expose a robust helper.
            return;
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

    return {
        playSound,
        musicRef, // Expose ref for external control
        volumeStates: {
            musicVolume,
            setMusicVolume,
            sfxVolume,
            setSfxVolume,
            announcerVolume,
            setAnnouncerVolume,
            isMuted,
            setIsMuted
        },
        refs: {
            musicVolumeRef,
            isMutedRef
        }
    };
};
