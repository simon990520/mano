import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@clerk/nextjs';

export const useSocket = () => {
    const { getToken, sessionId, isSignedIn } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        if (!isSignedIn || !sessionId) return;

        let socketIo: Socket;

        const connectSocket = async () => {
            const token = await getToken();
            console.log('[SOCKET_INFO] Initializing connection...', { hasToken: !!token, sessionId });

            const isLocalEnv = process.env.NEXT_PUBLIC_SOCKET_URL?.includes('localhost');
            const socketUrl = (!isLocalEnv && process.env.NEXT_PUBLIC_SOCKET_URL)
                ? process.env.NEXT_PUBLIC_SOCKET_URL
                : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

            console.log('[SOCKET_INFO] Connecting to:', socketUrl);

            socketIo = io(socketUrl, {
                auth: { token, sessionId },
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 5
            });

            setSocket(socketIo);

            socketIo.on('connect', () => {
                console.log('%c[SOCKET_INFO] CONNECTED SUCCESSFULLY!', 'color: #00ff00; font-weight: bold;');
            });

            socketIo.on('disconnect', (reason) => {
                console.warn('[SOCKET_INFO] Disconnected:', reason);
            });

            socketIo.on('connect_error', async (error) => {
                console.error('%c[SOCKET_INFO] CONNECTION ERROR:', 'color: #ff0000; font-weight: bold;', error.message);
                if (error.message === 'Authentication error' || error.message === 'Invalid token') {
                    const newToken = await getToken();
                    socketIo.auth = { token: newToken, sessionId };
                    socketIo.connect();
                }
            });
        };

        connectSocket();

        return () => {
            if (socketIo) socketIo.disconnect();
        };
    }, [isSignedIn, sessionId, getToken]);

    return socket;
};
