'use client';

import { Friendship, SocialProfile } from '@/lib/types';
import { User } from 'lucide-react';

interface FriendItemProps {
    friendship: Friendship;
    currentUserId: string;
    onChallenge: (friendId: string) => void;
}

export const FriendItem = ({ friendship, currentUserId, onChallenge }: FriendItemProps) => {
    // Determine which profile is the friend (the one that isn't the current user)
    const friend = friendship.user_id_1 === currentUserId ? friendship.profiles_2 : friendship.profiles_1;

    return (
        <div className="friend-item-container">
            <div className="friend-info">
                <div className="friend-avatar-container">
                    <div className="friend-avatar">
                        {friend.imageUrl ? (
                            <img src={friend.imageUrl} alt={friend.username} className="avatar-img" />
                        ) : (
                            <User className="text-white/40" size={20} />
                        )}
                    </div>
                    {/* Status indicator */}
                    <div className={`friend-status-dot ${friend.is_online ? 'online' : 'offline'}`} />
                </div>
                <div className="friend-details">
                    <span className="name">{friend.username}</span>
                    <span className="status-text">{friend.is_online ? 'En línea' : 'Desconectado'}</span>
                </div>
            </div>

            {friend.is_online && (
                <button
                    onClick={() => onChallenge(friend.id)}
                    className="challenge-btn-social"
                >
                    RETAR
                </button>
            )}
        </div>
    );
};
