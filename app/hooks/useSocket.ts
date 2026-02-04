import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@clerk/nextjs';

export const useSocket = () => {
    const { getToken, sessionId, isSignedIn } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        if (!isSignedIn || !sessionId) return;

        let socketIo: Socket | null = null;
        let isCleaningUp = false;

        const connectSocket = async () => {
            try {
                const token = await getToken();
                if (isCleaningUp) return;

                console.log('[SOCKET_INFO] Initializing stable connection...', { sessionId });

                const isLocalEnv = process.env.NEXT_PUBLIC_SOCKET_URL?.includes('localhost');
                const socketUrl = (!isLocalEnv && process.env.NEXT_PUBLIC_SOCKET_URL)
                    ? process.env.NEXT_PUBLIC_SOCKET_URL
                    : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

                socketIo = io(socketUrl, {
                    auth: { token, sessionId },
                    transports: ['websocket'],
                    reconnection: true,
                    reconnectionAttempts: 5,
                    forceNew: false // CRITICAL: Reuse connection if possible
                });

                setSocket(socketIo);

                socketIo.on('connect', () => {
                    console.log('%[SOCKET_INFO] CONNECTED ONCE', 'color: green');
                });

                socketIo.on('disconnect', (reason) => {
                    console.warn('[SOCKET_INFO] Disconnected:', reason);
                    // If it was a 'io server disconnect', it means we got kicked by a new session
                    // We don't want to auto-reconnect here if it was intentional
                });

                socketIo.on('connect_error', async (error) => {
                    console.error('[SOCKET_INFO] error:', error.message);
                    if (error.message === 'Authentication error' || error.message === 'Invalid token') {
                        const newToken = await getToken();
                        if (socketIo) {
                            socketIo.auth = { token: newToken, sessionId };
                            socketIo.connect();
                        }
                    }
                });
            } catch (err) {
                console.error('[SOCKET_INFO] Setup error:', err);
            }
        };

        connectSocket();

        return () => {
            isCleaningUp = true;
            if (socketIo) {
                console.log('[SOCKET_INFO] Cleaning up socket...');
                socketIo.disconnect();
            }
        };
    }, [isSignedIn, sessionId]); // Removed getToken from dependencies

    return socket;
};
