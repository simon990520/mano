'use client';

import { useState, useEffect } from 'react';
import { Friendship } from '@/lib/types';
import { FriendItem } from './FriendItem';
import { Users, UserPlus, X, RefreshCw, AlertCircle, Clock } from 'lucide-react';

interface SocialPanelProps {
    socket: any;
    currentUserId: string;
    isOpen: boolean;
    onClose: () => void;
    onChallenge: (friendId: string, username: string) => void;
    onPendingCountChange?: (count: number) => void;
    userBalance: { coins: number; gems: number };
}

export const SocialPanel = ({ socket, currentUserId, isOpen, onClose, onChallenge, onPendingCountChange }: SocialPanelProps) => {
    const [friends, setFriends] = useState<Friendship[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchUsername, setSearchUsername] = useState('');
    const [searchResults, setSearchResults] = useState<{ id: string, username: string }[]>([]);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        console.log('[SOCIAL_DEBUG] useEffect triggered', { hasSocket: !!socket, currentUserId });
        if (!socket || !currentUserId) {
            return;
        }

        const handleFriendsList = (list: Friendship[]) => {
            console.log('[SOCIAL_DEBUG] handleFriendsList received:', list.length, 'friends');
            setFriends(list);
            setLoading(false);

            const pendingCount = list.filter(f => f.status === 'pending' && f.user_id_2 === currentUserId).length;
            if (onPendingCountChange) onPendingCountChange(pendingCount);
        };

        const handleStatusChange = ({ userId, isOnline }: { userId: string, isOnline: boolean }) => {
            setFriends(prev => prev.map(f => {
                const profile1 = f.user_id_1 === userId ? { ...f.profiles_1, is_online: isOnline } : f.profiles_1;
                const profile2 = f.user_id_2 === userId ? { ...f.profiles_2, is_online: isOnline } : f.profiles_2;
                return { ...f, profiles_1: profile1, profiles_2: profile2 };
            }));
        };

        const handleNewRequest = () => {
            socket.emit('getFriends');
        };

        const handleSocialSuccess = (msg: string) => {
            setMessage({ text: msg, type: 'success' });
            setSearchUsername('');
            setTimeout(() => setMessage(null), 3000);
            socket.emit('getFriends');
        };

        const handleSocialError = (msg: string) => {
            setMessage({ text: msg, type: 'error' });
            setTimeout(() => setMessage(null), 3000);
        };

        const handleSearchResult = (results: any[]) => {
            setSearchResults(results);
            setIsSearching(false);
        };

        // Subscribe to all listeners
        socket.on('friendsList', handleFriendsList);
        socket.on('friendStatusChanged', handleStatusChange);
        socket.on('socialSuccess', handleSocialSuccess);
        socket.on('socialError', handleSocialError);
        socket.on('searchResult', handleSearchResult);
        socket.on('newFriendRequest', handleNewRequest);

        // Initial fetch
        socket.emit('getFriends');

        return () => {
            socket.off('friendsList', handleFriendsList);
            socket.off('friendStatusChanged', handleStatusChange);
            socket.off('socialSuccess', handleSocialSuccess);
            socket.off('socialError', handleSocialError);
            socket.off('searchResult', handleSearchResult);
            socket.off('newFriendRequest', handleNewRequest);
        };
    }, [socket, currentUserId]);

    // Live Search Effect
    useEffect(() => {
        if (!searchUsername.trim()) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(() => {
            setIsSearching(true);
            socket.emit('searchUsers', searchUsername.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [searchUsername, socket]);

    const handleSendRequest = (username: string) => {
        socket.emit('sendFriendRequest', username);
        setSearchUsername('');
        setSearchResults([]);
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchUsername.trim()) return;
        handleSendRequest(searchUsername.trim());
    };

    const handleAcceptRequest = (friendshipId: string) => {
        socket.emit('respondToFriendRequest', { friendshipId, accept: true });
    };

    const handleRejectRequest = (friendshipId: string) => {
        socket.emit('respondToFriendRequest', { friendshipId, accept: false });
    };

    const handleCancelSentRequest = (friendshipId: string) => {
        socket.emit('respondToFriendRequest', { friendshipId, accept: false });
    };

    // Move this check down so hooks always run
    // if (!isOpen) return null;

    const acceptedFriends = friends.filter(f => f.status === 'accepted');
    // Incoming: someone sent ME a request
    const incomingRequests = friends.filter(f => f.status === 'pending' && f.user_id_2 === currentUserId);
    // Outgoing: I sent someone a request
    const outgoingRequests = friends.filter(f => f.status === 'pending' && f.user_id_1 === currentUserId);

    if (!isOpen) return null;

    return (
        <div className={`social-panel-overlay ${isOpen ? 'open' : ''}`}>
            <div className={`social-panel ${isOpen ? 'open' : ''}`}>
                {/* Header */}
                <div className="social-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Users className="text-yellow-500" size={20} />
                        <h2>Social</h2>
                    </div>
                    <button onClick={onClose} className="social-close-btn">
                        <X size={20} />
                    </button>
                </div>

                {/* Search / Add Friend */}
                <div className="social-form-container">
                    <form onSubmit={handleFormSubmit} className="social-form">
                        <input
                            type="text"
                            placeholder="Buscar por usuario..."
                            value={searchUsername}
                            onChange={(e) => setSearchUsername(e.target.value)}
                            className="social-input"
                        />
                        <button type="submit" className="social-add-btn">
                            <UserPlus size={20} />
                        </button>

                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="search-results-overlay">
                                {searchResults.map(res => (
                                    <div key={res.id} className="search-result-item">
                                        <span>{res.username}</span>
                                        <button
                                            onClick={() => handleSendRequest(res.username)}
                                            style={{ background: '#eab308', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: 'black' }}
                                            title="Enviar solicitud"
                                        >
                                            <UserPlus size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </form>
                    {message && (
                        <div className={`social-message ${message.type}`}>
                            {message.type === 'error' && <AlertCircle size={14} />}
                            {message.text}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="social-content">

                    {/* INCOMING Pending Requests */}
                    {incomingRequests.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                            <h3 className="social-section-title">
                                <RefreshCw size={12} className="animate-spin-slow" />
                                Solicitudes Recibidas ({incomingRequests.length})
                            </h3>
                            {incomingRequests.map(req => {
                                const senderName = req.profiles_1?.username || 'Usuario desconocido';
                                return (
                                    <div key={req.id} className="pending-request-item">
                                        <span className="pending-user-name">{senderName}</span>
                                        <div className="request-actions">
                                            <button onClick={() => handleAcceptRequest(req.id)} className="action-btn accept">ACEPTAR</button>
                                            <button onClick={() => handleRejectRequest(req.id)} className="action-btn reject">✕</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* OUTGOING Sent Requests */}
                    {outgoingRequests.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                            <h3 className="social-section-title">
                                <Clock size={12} />
                                Solicitudes Enviadas ({outgoingRequests.length})
                            </h3>
                            {outgoingRequests.map(req => {
                                const targetName = req.profiles_2?.username || 'Usuario desconocido';
                                return (
                                    <div key={req.id} className="pending-request-item" style={{ borderColor: 'rgba(100, 116, 139, 0.3)', background: 'rgba(100, 116, 139, 0.05)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span className="pending-user-name">{targetName}</span>
                                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>Esperando respuesta...</span>
                                        </div>
                                        <button
                                            onClick={() => handleCancelSentRequest(req.id)}
                                            className="action-btn reject"
                                            title="Cancelar solicitud"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Friends List */}
                    <h3 className="social-section-title">
                        Mis Amigos ({acceptedFriends.length})
                    </h3>

                    {acceptedFriends.length > 0 ? (
                        acceptedFriends
                            .sort((a, b) => {
                                const friendA = a.user_id_1 === currentUserId ? a.profiles_2 : a.profiles_1;
                                const friendB = b.user_id_1 === currentUserId ? b.profiles_2 : b.profiles_1;
                                if (friendA.is_online && !friendB.is_online) return -1;
                                if (!friendA.is_online && friendB.is_online) return 1;
                                return 0;
                            })
                            .map(f => (
                                <FriendItem
                                    key={f.id}
                                    friendship={f}
                                    currentUserId={currentUserId}
                                    onChallenge={(id) => onChallenge(id, f.user_id_1 === currentUserId ? f.profiles_2.username : f.profiles_1.username)}
                                />
                            ))
                    ) : (
                        <div className="no-friends-container">
                            <Users size={48} style={{ margin: '0 auto 10px', display: 'block' }} />
                            <p className="no-friends-text">No tienes amigos añadidos</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="social-footer">
                    Invita a tus amigos para ganar juntos
                </div>
            </div>
        </div>
    );
};
