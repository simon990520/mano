'use client';

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth, SignInButton, SignedIn, SignedOut } from '@clerk/nextjs';

// Icons
const Icons = {
    Dashboard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>,
    Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    Economy: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>,
    Menu: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>,
    Close: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
    Pulse: () => <span className="admin-pulse"></span>
};

type View = 'dashboard' | 'users' | 'economy' | 'botcontrol';

export default function AdminDashboard() {
    const { getToken, sessionId, isSignedIn, isLoaded } = useAuth();
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [activeView, setActiveView] = useState<View>('dashboard');
    const [mounted, setMounted] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalUsers: 0, coinsInCirc: 0, gemsInCirc: 0, online: 0, activeRooms: 0, lastUpdate: ''
    });

    // Modals state
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [transferData, setTransferData] = useState({ type: 'coins' as 'coins' | 'gems', amount: 0, operation: 'add' as 'add' | 'subtract' });
    const [editData, setEditData] = useState({ username: '', rank: '' });

    const [searchTerm, setSearchTerm] = useState('');

    // Bot Control state
    const [botConfig, setBotConfig] = useState({ enabled: false, lobby_wait_seconds: 25, min_withdrawal_cop: 10000 });
    const [botArenaConfigs, setBotArenaConfigs] = useState<any[]>([]);
    const [botArenaStats, setBotArenaStats] = useState<any[]>([]);
    const [botLoading, setBotLoading] = useState(false);

    // WhatsApp & Settings state
    const [waStatus, setWaStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [waQr, setWaQr] = useState<string | null>(null);
    const [waGroups, setWaGroups] = useState<any[]>([]);
    const [appSettingsState, setAppSettingsState] = useState({
        whatsapp_contact_number: '',
        whatsapp_group_id: '',
        ai_faq_prompt: ''
    });
    const [syncStatus, setSyncStatus] = useState({ status: 'idle', message: '', total: 0, current: 0 });

    useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined' && window.innerWidth > 1024) setSidebarOpen(true);
    }, []);

    // Socket Connection with Auth
    useEffect(() => {
        if (!isSignedIn || !sessionId || !mounted) return;

        let socketInstance: Socket;

        const initSocket = async () => {
            const token = await getToken();
            const socketUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

            console.log('[ADMIN_SOCKET] Connecting with token to:', socketUrl);

            socketInstance = io(socketUrl, {
                auth: { token, sessionId },
                transports: ['websocket', 'polling'], // Polling fallback if websocket fails
                reconnection: true
            });

            socketRef.current = socketInstance;

            socketInstance.on('connect', () => {
                console.log('[ADMIN_SOCKET] Connected!');
                socketInstance.emit('joinAdmin');
                socketInstance.emit('adminGetUsers');
                socketInstance.emit('getWaStatus'); // Request initial WA status
            });

            socketInstance.on('adminRealtimeStats', (data) => {
                setStats(prev => ({
                    ...prev,
                    online: data.online,
                    activeRooms: data.activeGames,
                    coinsInCirc: data.coinsInCirc,
                    gemsInCirc: data.gemsInCirc,
                    totalUsers: data.totalUsers || prev.totalUsers,
                    lastUpdate: new Date().toLocaleTimeString()
                }));
            });

            socketInstance.on('adminUsersList', (data) => {
                setProfiles(data);
                setStats(prev => ({ ...prev, totalUsers: data.length }));
                setLoading(false);
            });

            socketInstance.on('adminDataRefreshed', () => {
                socketInstance.emit('adminGetUsers');
                socketInstance.emit('getWaStatus');
                socketInstance.emit('getAppSettings');
            });

            socketInstance.on('waStatusUpdated', (data) => {
                setWaStatus(data.status);
                if (data.qr) setWaQr(data.qr);
                else if (data.status === 'connected') setWaQr(null);
            });

            socketInstance.on('waQrUpdated', (data) => {
                setWaQr(data.qr);
            });

            socketInstance.on('waGroupsUpdated', (data) => {
                console.log('[ADMIN] Groups received:', data.groups);
                setWaGroups(data.groups || []);
            });

            socketInstance.on('appSettingsUpdated', (settings) => {
                setAppSettingsState(settings);
            });

            socketInstance.on('adminSuccess', (msg) => {
                alert('🎉 ' + msg);
                socketInstance.emit('adminGetUsers');
            });

            socketInstance.on('adminError', (msg) => {
                alert('❌ Error de Servidor: ' + msg);
            });

            socketInstance.on('adminSyncStatus', (data) => {
                setSyncStatus(prev => ({ ...prev, ...data }));
                if (data.status === 'complete') {
                    setTimeout(() => setSyncStatus({ status: 'idle', message: '', total: 0, current: 0 }), 5000);
                }
            });

            // Bot Control Listeners
            socketInstance.on('botConfigData', (data) => {
                setBotConfig(data.config);
                setBotArenaConfigs(data.arenaConfigs);
                setBotArenaStats(data.stats);
                setBotLoading(false);
            });

            socketInstance.on('botConfigUpdated', (config) => {
                setBotConfig(config);
            });


            socketInstance.on('connect_error', (err) => {
                console.error('[ADMIN_SOCKET] Connection Error:', err.message);
                if (err.message === 'Authentication error') {
                    // Potential token expiry, could re-fetch token here
                }
            });
        };

        initSocket();

        return () => {
            if (socketInstance) socketInstance.disconnect();
        };
    }, [isSignedIn, sessionId, mounted, getToken]);

    const fetchData = () => {
        if (socketRef.current && socketRef.current.connected) {
            setLoading(true);
            socketRef.current.emit('adminGetUsers');
        } else {
            alert('Esperando conexión al servidor...');
        }
    };

    const handleUpdateProfile = () => {
        if (!selectedUser || !socketRef.current) return;
        socketRef.current.emit('adminUpdateProfile', {
            targetUserId: selectedUser.id,
            username: editData.username,
            rank: editData.rank
        });
        setEditModalOpen(false);
    };

    const handleTransfer = () => {
        if (!selectedUser || !socketRef.current || !transferData.amount) return;
        socketRef.current.emit('adminTransferBalance', {
            targetUserId: selectedUser.id,
            type: transferData.type,
            amount: transferData.amount,
            operation: transferData.operation
        });
        setTransferModalOpen(false);
    };

    // Bot Control Functions
    const loadBotConfig = () => {
        if (socketRef.current && socketRef.current.connected) {
            setBotLoading(true);
            socketRef.current.emit('getBotConfig');
        }
    };

    const handleUpdateBotConfig = () => {
        if (!socketRef.current) return;
        socketRef.current.emit('updateBotConfig', {
            enabled: botConfig.enabled,
            lobby_wait_seconds: botConfig.lobby_wait_seconds,
            min_withdrawal_cop: botConfig.min_withdrawal_cop
        });
    };

    const handleUpdateArenaConfig = (mode: string, stake: number, newWinRate: number, isRandom?: boolean) => {
        if (!socketRef.current) return;

        // Find existing config to merge
        const existing = botArenaConfigs.find(c => c.mode === mode && c.stake_tier === stake);
        const finalRandom = isRandom !== undefined ? isRandom : (existing?.is_random || false);

        socketRef.current.emit('updateArenaConfig', {
            mode,
            stake_tier: stake,
            target_win_rate: newWinRate,
            is_random: finalRandom
        });

        // Update locally for immediate feedback
        setBotArenaConfigs(prev => prev.map(c =>
            c.mode === mode && c.stake_tier === stake
                ? { ...c, target_win_rate: newWinRate, is_random: finalRandom }
                : c
        ));
    };

    const handleUpdateAppSettings = () => {
        if (!socketRef.current) return;
        socketRef.current.emit('updateAppSettings', appSettingsState);
    };

    const handleWaReconnect = () => {
        if (!socketRef.current) return;
        socketRef.current.emit('waReconnect');
    };

    const handleWaResetSession = () => {
        if (!socketRef.current) return;
        const confirmed = window.confirm(
            '⚠️ ¿Estás seguro de que quieres LIMPIAR la sesión de WhatsApp?\n\n' +
            'Esto cerrará la sesión actual y borrará todos los archivos de autorización.\n' +
            'Tendrás que escanear un nuevo código QR para reconectar el bot.'
        );
        if (!confirmed) return;
        socketRef.current.emit('waResetSession');
    };

    const handleSyncGroup = () => {
        if (!socketRef.current || !appSettingsState.whatsapp_group_id) return;
        setSyncStatus({ status: 'loading', message: 'Iniciando...', total: 0, current: 0 });
        socketRef.current.emit('syncWaGroup', { groupId: appSettingsState.whatsapp_group_id });
    };

    // Load bot config when switching to bot control view
    useEffect(() => {
        if (activeView === 'botcontrol' && socketRef.current?.connected) {
            loadBotConfig();
            socketRef.current.emit('getWaStatus'); // Refresh WA status/groups on view switch
        }
    }, [activeView]);


    const colors = theme === 'dark' ? {
        bg: '#0a0f1d', sidebar: '#111827', sidebarActiveBg: 'rgba(59, 130, 246, 0.1)',
        card: '#1f2937', cardSecondary: '#374151', cardBorder: 'rgba(255,255,255,0.06)',
        textMain: '#f9fafb', textMuted: '#9ca3af', primary: '#3b82f6', accent: '#10b981',
        gems: '#06b6d4', coins: '#fbbf24', danger: '#ef4444'
    } : {
        bg: '#f3f4f6', sidebar: '#ffffff', sidebarActiveBg: '#f0fdfa',
        card: '#ffffff', cardSecondary: '#f9fafb', cardBorder: 'rgba(0,0,0,0.08)',
        textMain: '#111827', textMuted: '#6b7280', primary: '#0d9488', accent: '#10b981',
        gems: '#0d9488', coins: '#d97706', danger: '#dc2626'
    };

    if (!mounted || !isLoaded) return <div style={{ backgroundColor: '#0a0f1d', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Iniciando Sistema...</div>;

    const filteredUsers = profiles.filter(p =>
        (p.username || '').toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (dateStr: string) => {
        if (!dateStr || dateStr === 'Invalid Date') return 'Reciente';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Reciente';
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderDashboard = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.1)', padding: '16px 32px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 800 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Icons.Pulse /> MONITOR DASHBOARD V8 (AUTH OK)</div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Última Sinc: {stats.lastUpdate || 'Buscando...'}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                {[
                    { label: 'ONLINE', val: stats.online, icon: '🟢', color: colors.accent, sub: 'Jugadores en línea' },
                    { label: 'PARTIDAS', val: stats.activeRooms, icon: '⚡', color: colors.primary, sub: 'Salas activas' },
                    { label: 'POBLACIÓN', val: stats.totalUsers, icon: '👥', color: colors.textMain, sub: 'Usuarios en DB' },
                    { label: 'CAPITAL', val: `${((stats.coinsInCirc * 10) + (stats.gemsInCirc * 1000)).toLocaleString()}`, icon: '💰', color: colors.gems, sub: 'Circulación COP' },
                ].map((s, i) => (
                    <div key={i} style={{ backgroundColor: colors.card, padding: '32px', borderRadius: '28px', border: `1px solid ${colors.cardBorder}`, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                        <div style={{ fontSize: '0.85rem', color: colors.textMuted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</div>
                        <div style={{ fontSize: '2.2rem', fontWeight: 900, marginTop: '16px', color: s.color }}>{s.val}</div>
                        <div style={{ marginTop: '8px', fontSize: '0.8rem', opacity: 0.6 }}>{s.sub}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '32px' }}>
                <div style={{ backgroundColor: colors.card, borderRadius: '32px', border: `1px solid ${colors.cardBorder}`, padding: '32px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '24px', fontWeight: 900 }}>🏆 Top Tier Holders</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {profiles.sort((a, b) => (b.gems || 0) - (a.gems || 0)).slice(0, 5).map((p, idx) => (
                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: colors.cardSecondary, borderRadius: '16px' }}>
                                <div style={{ fontWeight: 800 }}>{idx + 1}. {p.username || 'Anon'}</div>
                                <div style={{ color: colors.gems, fontWeight: 900 }}>💎 {p.gems || 0}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{ backgroundColor: colors.card, borderRadius: '32px', border: `1px solid ${colors.cardBorder}`, padding: '32px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '24px', fontWeight: 900 }}>🚀 Estatus de Red</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: colors.textMuted }}>Handshake Auth</span> <span style={{ color: colors.accent, fontWeight: 800 }}>VERIFICADO</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: colors.textMuted }}>Transporte</span> <span style={{ color: colors.accent, fontWeight: 800 }}>WEBSOCKET</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: colors.textMuted }}>Latencia</span> <span style={{ fontWeight: 800 }}>{(socketRef.current?.connected ? 'Real' : 'Error')}</span></div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderUsers = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 950, margin: 0 }}>Gestión de Jugadores</h2>
                <div style={{ position: 'relative', flex: 1, maxWidth: '500px' }}>
                    <input
                        type="text"
                        placeholder="Filtrar por nombre o ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ padding: '16px 24px', borderRadius: '20px', border: `2px solid ${colors.cardBorder}`, backgroundColor: colors.card, color: colors.textMain, width: '100%', fontSize: '1rem', fontWeight: 600, outline: 'none' }}
                    />
                </div>
            </div>

            <div style={{ backgroundColor: colors.card, borderRadius: '32px', border: `1px solid ${colors.cardBorder}`, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
                        <thead>
                            <tr style={{ backgroundColor: colors.cardSecondary, textAlign: 'left' }}>
                                {['Usuario', 'Balance', 'Rango / RP', 'Win Rate / Partidas', 'Acciones'].map(h => (
                                    <th key={h} style={{ padding: '24px 32px', fontSize: '0.8rem', color: colors.textMuted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(p => (
                                <tr key={p.id} style={{ borderBottom: `1px solid ${colors.cardBorder}`, verticalAlign: 'middle' }}>
                                    <td style={{ padding: '20px 32px' }}>
                                        <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{p.username || '---'}</div>
                                        <div style={{ fontSize: '0.7rem', color: colors.textMuted, opacity: 0.6 }}>ID: {p.id.slice(0, 8)}...</div>
                                    </td>
                                    <td style={{ padding: '20px 32px' }}>
                                        <div style={{ color: colors.gems, fontWeight: 900 }}>💎 {p.gems || 0}</div>
                                        <div style={{ color: colors.coins, fontWeight: 800, fontSize: '0.9rem' }}>🪙 {p.coins || 0}</div>
                                    </td>
                                    <td style={{ padding: '20px 32px' }}>
                                        <div style={{ fontWeight: 900 }}>⭐ {p.rp || 0} RP</div>
                                        <div style={{ padding: '4px 12px', borderRadius: '30px', background: colors.sidebarActiveBg, color: colors.primary, fontSize: '0.7rem', fontWeight: 900, display: 'inline-block' }}>{p.rank_name || 'BRONCE'}</div>
                                    </td>
                                    <td style={{ padding: '20px 32px', fontSize: '0.85rem', color: colors.textMuted }}>
                                        <div style={{ fontWeight: 800, color: colors.accent }}>{p.total_games ? ((p.total_wins / p.total_games) * 100).toFixed(0) : 0}% Win Rate</div>
                                        <div style={{ fontSize: '0.75rem' }}>{p.total_wins || 0}W / {(p.total_games || 0) - (p.total_wins || 0)}L</div>
                                    </td>
                                    <td style={{ padding: '20px 32px' }}>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <button
                                                onClick={() => { setSelectedUser(p); setEditData({ username: p.username || '', rank: p.rank_name || 'BRONCE' }); setEditModalOpen(true); }}
                                                style={{ padding: '10px 18px', borderRadius: '12px', background: colors.cardSecondary, color: colors.textMain, border: 'none', fontWeight: 800, cursor: 'pointer' }}
                                            >Editar</button>
                                            <button
                                                onClick={() => { setSelectedUser(p); setTransferModalOpen(true); }}
                                                style={{ padding: '10px 18px', borderRadius: '12px', background: colors.primary, color: 'white', border: 'none', fontWeight: 900, cursor: 'pointer' }}
                                            >Gesti&oacute;n</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderEconomy = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 950, margin: 0 }}>Análisis Macroeconómico</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '32px' }}>
                <div style={{ backgroundColor: colors.card, padding: '48px', borderRadius: '40px', border: `3px solid ${colors.cardBorder}` }}>
                    <h3 style={{ marginTop: 0, fontWeight: 900, fontSize: '1.5rem' }}>🪙 Metales (Casual)</h3>
                    <div style={{ fontSize: '5rem', fontWeight: 950, color: colors.coins, margin: '24px 0' }}>{stats.coinsInCirc.toLocaleString()}</div>
                    <div style={{ padding: '24px', borderRadius: '24px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ fontWeight: 700 }}>Tasa Fija</span> <span>1 Metal = $10 COP</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 900 }}><span style={{ color: colors.textMuted }}>Circulaci&oacute;n</span> <span style={{ color: colors.accent }}>${(stats.coinsInCirc * 10).toLocaleString()}</span></div>
                    </div>
                </div>

                <div style={{ backgroundColor: colors.card, padding: '48px', borderRadius: '40px', border: `3px solid ${colors.cardBorder}` }}>
                    <h3 style={{ marginTop: 0, fontWeight: 900, fontSize: '1.5rem' }}>💎 Gemas (VIP/Ranked)</h3>
                    <div style={{ fontSize: '5rem', fontWeight: 950, color: colors.gems, margin: '24px 0' }}>{stats.gemsInCirc.toLocaleString()}</div>
                    <div style={{ padding: '24px', borderRadius: '24px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ fontWeight: 700 }}>Tasa Fija</span> <span>1 Gema = $1,000 COP</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 900 }}><span style={{ color: colors.textMuted }}>Circulaci&oacute;n</span> <span style={{ color: colors.accent }}>${(stats.gemsInCirc * 1000).toLocaleString()}</span></div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderBotControl = () => {
        const getStatsForArena = (mode: string, stake: number) => {
            return botArenaStats.find(s => s.mode === mode && s.stake_tier === stake) || {
                total_games: 0, total_wins: 0, total_losses: 0, current_win_rate: 0
            };
        };

        const getConfigForArena = (mode: string, stake: number) => {
            return botArenaConfigs.find(c => c.mode === mode && c.stake_tier === stake) || { target_win_rate: 50 };
        };

        const getWinRateColor = (current: number, target: number) => {
            const diff = Math.abs(current - target);
            if (diff <= 5) return colors.accent;
            if (diff <= 10) return '#fbbf24';
            return colors.danger;
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 950, margin: 0 }}>🤖 Bot Control Center</h2>
                        <p style={{ color: colors.textMuted, marginTop: '8px' }}>Configuración del sistema de matchmaking automático</p>
                    </div>
                    <button onClick={loadBotConfig} style={{ padding: '14px 28px', borderRadius: '18px', background: colors.primary, color: 'white', border: 'none', fontWeight: 950, cursor: 'pointer' }}>
                        {botLoading ? '...' : 'REFRESCAR'}
                    </button>
                </div>

                <div style={{ backgroundColor: colors.card, borderRadius: '32px', border: `1px solid ${colors.cardBorder}`, padding: '40px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '32px', fontWeight: 900, fontSize: '1.5rem' }}>⚙️ Configuración Global</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 950, color: colors.textMuted, display: 'block', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Estado del Bot</label>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setBotConfig({ ...botConfig, enabled: true })} style={{ flex: 1, padding: '18px', borderRadius: '16px', border: `2px solid ${botConfig.enabled ? colors.accent : 'transparent'}`, background: botConfig.enabled ? colors.sidebarActiveBg : colors.cardSecondary, color: botConfig.enabled ? colors.accent : colors.textMuted, fontWeight: 900, cursor: 'pointer' }}>✅ ACTIVO</button>
                                <button onClick={() => setBotConfig({ ...botConfig, enabled: false })} style={{ flex: 1, padding: '18px', borderRadius: '16px', border: `2px solid ${!botConfig.enabled ? colors.danger : 'transparent'}`, background: !botConfig.enabled ? 'rgba(239, 68, 68, 0.1)' : colors.cardSecondary, color: !botConfig.enabled ? colors.danger : colors.textMuted, fontWeight: 900, cursor: 'pointer' }}>❌ INACTIVO</button>
                            </div>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 950, color: colors.textMuted, display: 'block', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Tiempo de Espera (segundos)</label>
                            <input type="number" min="10" max="120" value={botConfig.lobby_wait_seconds} onChange={(e) => setBotConfig({ ...botConfig, lobby_wait_seconds: Number(e.target.value) })} style={{ width: '100%', padding: '18px 24px', borderRadius: '16px', background: colors.cardSecondary, border: `2px solid ${colors.cardBorder}`, color: colors.textMain, fontWeight: 800, fontSize: '1.2rem', textAlign: 'center' }} />
                            <p style={{ fontSize: '0.75rem', color: colors.textMuted, marginTop: '8px' }}>Si no encuentra oponente en este tiempo, emparejará con bot</p>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 950, color: colors.textMuted, display: 'block', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Mínimo de Retiro (COP)</label>
                            <input type="number" min="1000" step="1000" value={botConfig.min_withdrawal_cop} onChange={(e) => setBotConfig({ ...botConfig, min_withdrawal_cop: Number(e.target.value) })} style={{ width: '100%', padding: '18px 24px', borderRadius: '16px', background: colors.cardSecondary, border: `2px solid ${colors.cardBorder}`, color: colors.accent, fontWeight: 900, fontSize: '1.2rem', textAlign: 'center' }} />
                            <p style={{ fontSize: '0.75rem', color: colors.textMuted, marginTop: '8px' }}>Mínimo de dinero real que un usuario puede solicitar retirar</p>
                        </div>
                    </div>
                    <button onClick={handleUpdateBotConfig} style={{ width: '100%', marginTop: '32px', padding: '20px', borderRadius: '20px', background: colors.primary, color: 'white', border: 'none', fontWeight: 950, fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)' }}>💾 GUARDAR CONFIGURACIÓN</button>
                </div>

                <div style={{ backgroundColor: colors.card, borderRadius: '32px', border: `1px solid ${colors.cardBorder}`, padding: '40px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.5rem' }}>📱 WhatsApp Bot & AI settings</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', borderRadius: '14px', background: waStatus === 'connected' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: waStatus === 'connected' ? colors.accent : colors.danger, fontWeight: 900, fontSize: '0.9rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: waStatus === 'connected' ? colors.accent : colors.danger, display: 'inline-block' }}></span>
                            {waStatus.toUpperCase()}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 950, color: colors.textMuted, display: 'block', marginBottom: '12px', textTransform: 'uppercase' }}>Número de Contacto (Visible para todos)</label>
                                <input type="text" value={appSettingsState.whatsapp_contact_number} onChange={(e) => setAppSettingsState({ ...appSettingsState, whatsapp_contact_number: e.target.value })} style={{ width: '100%', padding: '18px 24px', borderRadius: '16px', background: colors.cardSecondary, border: `2px solid ${colors.cardBorder}`, color: colors.textMain, fontWeight: 800 }} placeholder="Ej: 573001234567" />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 950, color: colors.textMuted, display: 'block', marginBottom: '12px', textTransform: 'uppercase' }}>WhatsApp Group ID (Opcional)</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input type="text" value={appSettingsState.whatsapp_group_id} onChange={(e) => setAppSettingsState({ ...appSettingsState, whatsapp_group_id: e.target.value })} style={{ flex: 1, padding: '18px 24px', borderRadius: '16px', background: colors.cardSecondary, border: `2px solid ${colors.cardBorder}`, color: colors.textMain, fontWeight: 800 }} placeholder="Ej: 120363024508212345@g.us" />
                                    {waGroups.length > 0 && (
                                        <select
                                            onChange={(e) => {
                                                if (e.target.value) setAppSettingsState({ ...appSettingsState, whatsapp_group_id: e.target.value });
                                            }}
                                            style={{ maxWidth: '40px', padding: '0 12px', borderRadius: '16px', background: colors.cardSecondary, border: `2px solid ${colors.cardBorder}`, color: colors.textMain, fontWeight: 800, cursor: 'pointer' }}
                                        >
                                            <option value="">📋</option>
                                            {waGroups.map(g => (
                                                <option key={g.id} value={g.id}>
                                                    {g.isAdmin ? '👑 ' : ''}{g.name || 'Sin Nombre'} ({g.participantCount}) {!g.isAdmin ? '(Sin Admin)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                {waGroups.length === 0 && waStatus === 'connected' && <p style={{ fontSize: '0.7rem', color: colors.textMuted, marginTop: '6px' }}>No se encontraron grupos.</p>}
                                {appSettingsState.whatsapp_group_id && waGroups.find(g => g.id === appSettingsState.whatsapp_group_id && !g.isAdmin) && (
                                    <p style={{ fontSize: '0.7rem', color: colors.danger, marginTop: '6px', fontWeight: 800 }}>⚠️ El bot no es admin en este grupo. Las invitaciones fallarán.</p>
                                )}

                                {appSettingsState.whatsapp_group_id && (
                                    <div style={{ marginTop: '12px' }}>
                                        <button
                                            onClick={handleSyncGroup}
                                            disabled={syncStatus.status !== 'idle' && syncStatus.status !== 'complete'}
                                            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: colors.cardSecondary, border: `2px solid ${colors.primary}`, color: colors.primary, fontWeight: 900, cursor: 'pointer', opacity: syncStatus.status !== 'idle' ? 0.7 : 1 }}
                                        >
                                            {syncStatus.status === 'idle' ? '🔄 SINCRONIZAR INTEGRANTES' : '⏳ SINCRONIZANDO...'}
                                        </button>
                                        {syncStatus.status !== 'idle' && (
                                            <div style={{ marginTop: '8px' }}>
                                                <p style={{ fontSize: '0.75rem', color: colors.textMuted, marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>{syncStatus.message}</span>
                                                    {syncStatus.total > 0 && <span>{Math.round((syncStatus.current / syncStatus.total) * 100)}%</span>}
                                                </p>
                                                {syncStatus.total > 0 && (
                                                    <div style={{ width: '100%', height: '6px', backgroundColor: colors.cardBorder, borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${(syncStatus.current / syncStatus.total) * 100}%`, height: '100%', backgroundColor: colors.accent, transition: 'width 0.3s ease' }}></div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 950, color: colors.textMuted, display: 'block', marginBottom: '12px', textTransform: 'uppercase' }}>Prompt de la IA (Conocimiento Base)</label>
                                <textarea rows={4} value={appSettingsState.ai_faq_prompt} onChange={(e) => setAppSettingsState({ ...appSettingsState, ai_faq_prompt: e.target.value })} style={{ width: '100%', padding: '18px 24px', borderRadius: '16px', background: colors.cardSecondary, border: `2px solid ${colors.cardBorder}`, color: colors.textMain, fontWeight: 500, fontFamily: 'inherit', resize: 'vertical' }} placeholder="Define el tono y las reglas de respuesta de la IA..." />
                            </div>
                            <button onClick={handleUpdateAppSettings} style={{ width: '100%', padding: '20px', borderRadius: '20px', background: colors.accent, color: colors.bg, border: 'none', fontWeight: 950, fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)' }}>💾 GUARDAR AJUSTES GLOBALES</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', background: colors.cardSecondary, borderRadius: '24px', padding: '32px', border: `1px solid ${colors.cardBorder}` }}>
                            {waStatus === 'connected' ? (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
                                    <h4 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>¡BOT CONECTADO!</h4>
                                    <p style={{ color: colors.textMuted, marginTop: '12px' }}>El bot de WhatsApp está en línea y procesando mensajes.</p>
                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
                                        <button onClick={handleWaReconnect} style={{ padding: '12px 24px', borderRadius: '12px', border: `2px solid ${colors.danger}`, background: 'transparent', color: colors.danger, fontWeight: 900, cursor: 'pointer' }}>FORZAR RECONEXIÓN</button>
                                        <button onClick={handleWaResetSession} style={{ padding: '12px 24px', borderRadius: '12px', background: colors.danger, border: 'none', color: 'white', fontWeight: 900, cursor: 'pointer' }}>🗑️ LIMPIAR SESIÓN</button>
                                    </div>
                                </div>
                            ) : waQr ? (
                                <div style={{ textAlign: 'center' }}>
                                    <h4 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', fontWeight: 900 }}>ESCANEA EL CÓDIGO QR</h4>
                                    <img src={waQr} alt="WhatsApp QR" style={{ width: '250px', height: '250px', borderRadius: '16px', border: `8px solid white` }} />
                                    <p style={{ color: colors.textMuted, marginTop: '20px', fontSize: '0.85rem' }}>Abre WhatsApp {'>'} Dispositivos vinculados {'>'} Vincular un dispositivo</p>
                                    <button onClick={handleWaReconnect} style={{ marginTop: '20px', padding: '12px 24px', borderRadius: '12px', background: colors.cardBorder, color: colors.textMain, border: 'none', fontWeight: 900, cursor: 'pointer' }}>GENERAR NUEVO QR</button>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏳</div>
                                    <h4 style={{ margin: 0, fontWeight: 900 }}>{waStatus === 'connecting' ? 'CONECTANDO...' : 'DESCONECTADO'}</h4>
                                    <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>DESCONECTADO</h4>
                                    <p style={{ color: colors.textMuted, marginTop: '12px' }}>Cargando estado...</p>
                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
                                        <button onClick={handleWaReconnect} style={{ padding: '12px 24px', borderRadius: '12px', background: colors.primary, color: 'white', border: 'none', fontWeight: 900, cursor: 'pointer' }}>CONECTAR</button>
                                        <button onClick={handleWaResetSession} style={{ padding: '12px 24px', borderRadius: '12px', background: colors.danger, border: 'none', color: 'white', fontWeight: 900, cursor: 'pointer' }}>🗑️ LIMPIAR SESIÓN</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ backgroundColor: colors.card, borderRadius: '32px', border: `1px solid ${colors.cardBorder}`, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                    <div style={{ padding: '32px 40px', borderBottom: `1px solid ${colors.cardBorder}` }}>
                        <h3 style={{ marginTop: 0, marginBottom: '8px', fontWeight: 900, fontSize: '1.5rem' }}>🎯 Configuración por Arena</h3>
                        <p style={{ margin: 0, color: colors.textMuted, fontSize: '0.9rem' }}>Ajusta el % de victoria objetivo del bot en cada arena. El sistema se auto-equilibra.</p>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                            <thead>
                                <tr style={{ backgroundColor: colors.cardSecondary }}>
                                    {['Modo', 'Arena', 'Win Rate Objetivo', 'Partidas', 'Victorias/Derrotas', 'Win Rate Actual', 'Comportamiento', 'Estado'].map(h => (
                                        <th key={h} style={{ padding: '24px 32px', fontSize: '0.8rem', color: colors.textMuted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px', textAlign: 'left' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {['casual', 'ranked'].map(mode =>
                                    [10, 50, 100, 500, 1000].map(stake => {
                                        const stats = getStatsForArena(mode, stake);
                                        const config = getConfigForArena(mode, stake);
                                        const winRateColor = getWinRateColor(stats.current_win_rate, config.target_win_rate);
                                        const diff = Math.abs(stats.current_win_rate - config.target_win_rate);
                                        return (
                                            <tr key={`${mode}-${stake}`} style={{ borderBottom: `1px solid ${colors.cardBorder}` }}>
                                                <td style={{ padding: '20px 32px' }}>
                                                    <span style={{ padding: '6px 14px', borderRadius: '20px', background: mode === 'casual' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(6, 182, 212, 0.1)', color: mode === 'casual' ? colors.coins : colors.gems, fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase' }}>{mode === 'casual' ? '🪙 Casual' : '💎 Ranked'}</span>
                                                </td>
                                                <td style={{ padding: '20px 32px', fontWeight: 900, fontSize: '1.1rem' }}>{stake} {mode === 'casual' ? 'Coins' : 'Gems'}</td>
                                                <td style={{ padding: '20px 32px' }}>
                                                    <input type="number" min="0" max="100" step="0.1" value={config.target_win_rate} onChange={(e) => handleUpdateArenaConfig(mode, stake, Number(e.target.value))} style={{ width: '100px', padding: '10px', borderRadius: '12px', background: colors.cardSecondary, border: `2px solid ${colors.primary}`, color: colors.textMain, fontWeight: 900, textAlign: 'center' }} />
                                                    <span style={{ marginLeft: '8px', fontWeight: 900 }}>%</span>
                                                </td>
                                                <td style={{ padding: '20px 32px', color: colors.textMuted }}>{stats.total_games}</td>
                                                <td style={{ padding: '20px 32px' }}>
                                                    <div style={{ fontWeight: 800 }}><span style={{ color: colors.accent }}>{stats.total_wins}W</span> / <span style={{ color: colors.danger }}>{stats.total_losses}L</span></div>
                                                </td>
                                                <td style={{ padding: '20px 32px' }}><div style={{ fontWeight: 900, fontSize: '1.2rem', color: winRateColor }}>{stats.current_win_rate.toFixed(1)}%</div></td>
                                                <td style={{ padding: '20px 32px' }}>
                                                    <div
                                                        onClick={() => handleUpdateArenaConfig(mode, stake, config.target_win_rate, !config.is_random)}
                                                        style={{
                                                            padding: '8px 16px',
                                                            borderRadius: '12px',
                                                            background: config.is_random ? 'rgba(255, 68, 102, 0.1)' : 'rgba(0, 255, 136, 0.1)',
                                                            color: config.is_random ? colors.danger : colors.accent,
                                                            border: `1px solid ${config.is_random ? colors.danger : colors.accent}`,
                                                            fontSize: '0.75rem',
                                                            fontWeight: 900,
                                                            cursor: 'pointer',
                                                            textAlign: 'center',
                                                            transition: '0.3s'
                                                        }}
                                                    >
                                                        {config.is_random ? '🎲 RANDOM' : '🧠 SMART'}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '20px 32px' }}>
                                                    {diff <= 5 ? (<span style={{ color: colors.accent, fontWeight: 900 }}>✅ Óptimo</span>) : diff <= 10 ? (<span style={{ color: '#fbbf24', fontWeight: 900 }}>⚠️ Ajustando</span>) : (<span style={{ color: colors.danger, fontWeight: 900 }}>❌ Lejos</span>)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                    <div style={{ backgroundColor: colors.card, borderRadius: '24px', border: `1px solid ${colors.cardBorder}`, padding: '32px' }}>
                        <h4 style={{ marginTop: 0, fontWeight: 900, color: colors.accent }}>💡 Cómo Funciona</h4>
                        <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                            <li>El bot mantiene un 50% de victoria <strong>por arena</strong>, no por jugador</li>
                            <li>Si el win rate está bajo, jugará más agresivo</li>
                            <li>Si está alto, dejará ganar al jugador</li>
                            <li>El ajuste es automático y adaptativo</li>
                        </ul>
                    </div>
                    <div style={{ backgroundColor: colors.card, borderRadius: '24px', border: `1px solid ${colors.cardBorder}`, padding: '32px' }}>
                        <h4 style={{ marginTop: 0, fontWeight: 900, color: colors.primary }}>⚡ Estado Actual</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bot Activo:</span><strong style={{ color: botConfig.enabled ? colors.accent : colors.danger }}>{botConfig.enabled ? 'SÍ' : 'NO'}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tiempo Espera:</span><strong>{botConfig.lobby_wait_seconds}s</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Partidas Totales:</span><strong>{botArenaStats.reduce((acc, s) => acc + s.total_games, 0)}</strong></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };


    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: colors.bg, color: colors.textMain, overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>

            <SignedOut>
                <div style={{ position: 'fixed', inset: 0, background: '#0a0f1d', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', color: 'white' }}>
                    <h1 style={{ fontWeight: 950, fontSize: '2.5rem' }}>SEQUENCE ADMIN</h1>
                    <p style={{ opacity: 0.7 }}>Inicia sesión para acceder al panel de control</p>
                    <SignInButton mode="modal">
                        <button style={{ padding: '16px 40px', borderRadius: '16px', background: colors.primary, color: 'white', border: 'none', fontWeight: 950, cursor: 'pointer', fontSize: '1.1rem' }}>ACCEDER AHORA</button>
                    </SignInButton>
                </div>
            </SignedOut>

            <SignedIn>
                <aside style={{ width: isSidebarOpen ? '320px' : '0px', backgroundColor: colors.sidebar, borderRight: `1px solid ${colors.cardBorder}`, transition: 'all 0.4s ease', display: 'flex', flexDirection: 'column', overflow: 'hidden', whiteSpace: 'nowrap', zIndex: 500 }}>
                    <div style={{ padding: '40px', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: colors.primary, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950, fontSize: '1.5rem', boxShadow: '0 12px 24px rgba(59, 130, 246, 0.4)' }}>S</div>
                        <span style={{ fontWeight: 950, fontSize: '1.8rem' }}>Sequence</span>
                    </div>

                    <nav style={{ flex: 1, padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                            { id: 'dashboard', label: 'Monitor Live', icon: Icons.Dashboard },
                            { id: 'users', label: 'Jugadores', icon: Icons.Users },
                            { id: 'economy', label: 'Econom&iacute;a', icon: Icons.Economy },
                            { id: 'botcontrol', label: '🤖 Bot Control', icon: Icons.Dashboard },
                        ].map(item => (
                            <div
                                key={item.id}
                                onClick={() => { setActiveView(item.id as View); if (window.innerWidth <= 1024) setSidebarOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 24px', borderRadius: '24px', cursor: 'pointer',
                                    backgroundColor: activeView === item.id ? colors.sidebarActiveBg : 'transparent',
                                    color: activeView === item.id ? colors.primary : colors.textMuted,
                                    fontWeight: 900, transition: '0.3s'
                                }}
                            >
                                <item.icon /> <span>{item.label}</span>
                            </div>
                        ))}
                    </nav>

                    <div style={{ padding: '24px', borderTop: `1px solid ${colors.cardBorder}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <a href="https://wa.me/573146959639" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '18px', borderRadius: '24px', backgroundColor: '#10b981', color: 'white', textDecoration: 'none', fontWeight: 900, textAlign: 'center', justifyContent: 'center' }}>💬 CANAL CAJEROS</a>
                        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ padding: '16px', borderRadius: '24px', border: `2px solid ${colors.cardBorder}`, background: 'none', color: colors.textMain, fontWeight: 900, cursor: 'pointer' }}>{theme === 'dark' ? '☀️ CLARO' : '🌙 OSCURO'}</button>
                    </div>
                </aside>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <header style={{ height: '100px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 48px', borderBottom: `1px solid ${colors.cardBorder}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <button onClick={() => setSidebarOpen(!isSidebarOpen)} style={{ background: 'none', border: 'none', color: colors.textMain, cursor: 'pointer' }}><Icons.Menu /></button>
                            <div style={{ fontWeight: 950, fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '2px', opacity: 0.5 }}>PANEL / <span style={{ color: colors.primary }}>{activeView}</span></div>
                        </div>
                        <button onClick={fetchData} style={{ padding: '14px 28px', borderRadius: '18px', background: colors.primary, color: 'white', border: 'none', fontWeight: 950, cursor: 'pointer' }}>{loading ? '...' : 'SINCRONIZAR'}</button>
                    </header>

                    <main style={{ flex: 1, overflowY: 'auto', padding: '48px', WebkitOverflowScrolling: 'touch' }}>
                        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                            {activeView === 'dashboard' && renderDashboard()}
                            {activeView === 'users' && renderUsers()}
                            {activeView === 'economy' && renderEconomy()}
                            {activeView === 'botcontrol' && renderBotControl()}
                        </div>
                    </main>
                </div>
            </SignedIn>

            {/* MODALS */}
            {editModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ backgroundColor: colors.card, width: '100%', maxWidth: '480px', borderRadius: '40px', border: `1px solid ${colors.cardBorder}` }}>
                        <div style={{ padding: '32px', borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontWeight: 950, fontSize: '1.5rem' }}>Perfil Jugador</h3>
                            <button onClick={() => setEditModalOpen(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer' }}><Icons.Close /></button>
                        </div>
                        <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 950, color: colors.textMuted, display: 'block', marginBottom: '10px' }}>NOMBRE</label>
                                <input type="text" value={editData.username} onChange={(e) => setEditData({ ...editData, username: e.target.value })} style={{ width: '100%', padding: '18px', borderRadius: '16px', background: colors.cardSecondary, border: 'none', color: colors.textMain, fontWeight: 800 }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 950, color: colors.textMuted, display: 'block', marginBottom: '10px' }}>RANGOS</label>
                                <select value={editData.rank} onChange={(e) => setEditData({ ...editData, rank: e.target.value })} style={{ width: '100%', padding: '18px', borderRadius: '16px', background: colors.cardSecondary, border: 'none', color: colors.textMain, fontWeight: 800 }}>
                                    {['BRONCE', 'PLATA', 'ORO', 'PLATINO', 'DIAMANTE', 'MAESTRO'].map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <button onClick={handleUpdateProfile} style={{ width: '100%', padding: '20px', borderRadius: '20px', backgroundColor: colors.primary, color: 'white', border: 'none', fontWeight: 950, cursor: 'pointer' }}>ACTUALIZAR</button>
                        </div>
                    </div>
                </div>
            )}

            {transferModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ backgroundColor: colors.card, width: '100%', maxWidth: '480px', borderRadius: '40px', border: `1px solid ${colors.cardBorder}` }}>
                        <div style={{ padding: '32px', borderBottom: `1px solid ${colors.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontWeight: 950, fontSize: '1.5rem' }}>Ajuste de Balance</h3>
                            <button onClick={() => setTransferModalOpen(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer' }}><Icons.Close /></button>
                        </div>
                        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setTransferData({ ...transferData, operation: 'add' })} style={{ flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: transferData.operation === 'add' ? colors.accent : colors.cardSecondary, color: 'white', border: 'none', fontWeight: 900 }}>D&eacute;pito (+)</button>
                                <button onClick={() => setTransferData({ ...transferData, operation: 'subtract' })} style={{ flex: 1, padding: '14px', borderRadius: '14px', backgroundColor: transferData.operation === 'subtract' ? colors.danger : colors.cardSecondary, color: 'white', border: 'none', fontWeight: 900 }}>Retiro (-)</button>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setTransferData({ ...transferData, type: 'coins' })} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: `2px solid ${transferData.type === 'coins' ? colors.coins : 'transparent'}`, background: colors.cardSecondary, color: colors.coins, fontWeight: 900 }}>Metales 🪙</button>
                                <button onClick={() => setTransferData({ ...transferData, type: 'gems' })} style={{ flex: 1, padding: '14px', borderRadius: '14px', border: `2px solid ${transferData.type === 'gems' ? colors.gems : 'transparent'}`, background: colors.cardSecondary, color: colors.gems, fontWeight: 900 }}>Gemas 💎</button>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: 950, color: colors.textMuted, display: 'block', marginBottom: '10px' }}>CANTIDAD</label>
                                <input type="number" min="0" value={transferData.amount} onChange={(e) => setTransferData({ ...transferData, amount: Number(e.target.value) })} style={{ width: '100%', padding: '18px', borderRadius: '16px', background: colors.cardSecondary, border: 'none', color: colors.textMain, fontWeight: 950, fontSize: '1.5rem', textAlign: 'center' }} />
                            </div>
                            <button
                                disabled={!transferData.amount}
                                onClick={handleTransfer}
                                style={{ width: '100%', padding: '20px', borderRadius: '20px', backgroundColor: transferData.operation === 'add' ? colors.accent : colors.danger, color: 'white', border: 'none', fontWeight: 950, fontSize: '1.1rem', cursor: 'pointer', opacity: transferData.amount ? 1 : 0.5 }}
                            >CONFIRMAR TRANSACCI&Oacute;N</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
        body { margin: 0; padding: 0; overflow: hidden; height: 100vh; width: 100vw; background: #0a0f1d; }
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        ::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #4b5563; }
        .admin-pulse { width: 10px; height: 10px; background: #10b981; border-radius: 50%; display: inline-block; animation: pulse 2s infinite; margin-right: 8px; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
      `}</style>
        </div>
    );
}
