const { createClerkClient } = require('@clerk/clerk-sdk-node');

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function authMiddleware(socket, next) {
    try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication error: Token missing'));

        const payload = await clerkClient.verifyToken(token);

        if (!payload) {
            console.error('[SERVER_AUTH] Token verification failed for socket:', socket.id);
            return next(new Error('Authentication error: Invalid token'));
        }

        socket.userId = payload.sub;
        console.log('[SERVER_AUTH] User authenticated via JWT:', socket.userId);
        next();
    } catch (err) {
        console.error('[SERVER_AUTH] Socket Auth Error:', err.message);
        next(new Error('Authentication error'));
    }
}

module.exports = {
    clerkClient,
    authMiddleware
};
