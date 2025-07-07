const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Utility for conditional logging (completely silent in production)
const logger = {
    info: (message, ...args) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log(message, ...args);
        }
    },
    warn: (message, ...args) => {
        if (process.env.NODE_ENV !== 'production') {
            console.warn(message, ...args);
        }
    },
    error: (message, ...args) => {
        // Only log critical errors in production
        if (process.env.NODE_ENV !== 'production' || message.includes('CRITICAL')) {
            console.error(message, ...args);
        }
    }
};

// Create Express app
const app = express();
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? '*' // Allow any origin in production - you can limit this to your Vercel app domain
        : ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
}));

// Basic route for health checks
app.get('/', (req, res) => {
    res.send('Socket.IO server is running');
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with CORS configuration
const io = new Server(server, {
    path: '/socket.io',
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? '*' // Allow any origin in production since we're already filtering at the Express level
            : ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
    },
    allowEIO3: true,
    transports: ['polling', 'websocket']
});

// Store active user connections
const connectedUsers = new Map();

// Socket.IO connection handler
io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Store the user in connected users map
    const userId = socket.handshake.auth.userId;
    if (userId) {
        logger.info(`User ${userId} connected with socket ${socket.id}`);
        connectedUsers.set(userId, socket.id);
    } else {
        logger.warn('Socket connected without user ID in auth data');
    }

    // Handle authentication events
    socket.on('authenticate', (data) => {
        if (data.userId) {
            logger.info(`User ${data.userId} authenticated with socket ${socket.id}`);
            connectedUsers.set(data.userId, socket.id);
        }
    });

    // Handle joining channel
    socket.on('joinChannel', (channelId) => {
        const roomName = `channel:${channelId}`;
        socket.join(roomName);
        logger.info(`Socket ${socket.id} joined channel ${channelId}`);
    });

    // Handle leaving channel
    socket.on('leaveChannel', (channelId) => {
        const roomName = `channel:${channelId}`;
        socket.leave(roomName);
        logger.info(`Socket ${socket.id} left channel ${channelId}`);
    });

    // Handle sending messages
    socket.on('sendMessage', ({ channelId, content }) => {
        try {
            logger.info(`Message in channel ${channelId}: ${content.substring(0, 20)}${content.length > 20 ? '...' : ''}`);

            // Create a temporary message object
            const tempMessage = {
                id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                content,
                channelId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                userId: userId || socket.id,
                user: {
                    id: userId || socket.id,
                    name: socket.handshake.auth.name,
                    image: socket.handshake.auth.image
                }
            };

            // Broadcast to everyone in the channel
            socket.to(`channel:${channelId}`).emit('newMessage', tempMessage);
        } catch (error) {
            logger.error('Error processing message:', error);
        }
    });

    // Handle typing indicators
    socket.on('typing', ({ channelId }) => {
        socket.to(`channel:${channelId}`).emit('typing', {
            channelId,
            userId: userId || socket.id,
            userName: socket.handshake.auth.name
        });
    });

    // Handle stop typing
    socket.on('stopTyping', ({ channelId }) => {
        socket.to(`channel:${channelId}`).emit('stopTyping', {
            channelId,
            userId: userId || socket.id
        });
    });

    // Handle call signaling
    socket.on('callUser', (data) => {
        const receiverSocketId = connectedUsers.get(data.to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('callOffer', {
                from: userId,
                to: data.to,
                channelId: data.channelId,
                signal: data.signal,
                callType: data.callType,
                caller: {
                    id: userId,
                    name: socket.handshake.auth.name,
                    image: socket.handshake.auth.image
                }
            });
        }
    });

    socket.on('answerCall', (data) => {
        const callerSocketId = connectedUsers.get(data.to);
        if (callerSocketId) {
            io.to(callerSocketId).emit('callAnswer', {
                from: userId,
                to: data.to,
                signal: data.signal
            });
        }
    });

    socket.on('rejectCall', (data) => {
        const callerSocketId = connectedUsers.get(data.to);
        if (callerSocketId) {
            io.to(callerSocketId).emit('callRejected', {
                from: userId,
                to: data.to,
                reason: data.reason
            });
        }
    });

    socket.on('endCall', (data) => {
        const receiverSocketId = connectedUsers.get(data.to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('callEnded', {
                from: userId,
                to: data.to,
                reason: data.reason
            });
        }
    });

    socket.on('sendIceCandidate', (data) => {
        const receiverSocketId = connectedUsers.get(data.to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('iceCandidate', {
                from: userId,
                to: data.to,
                candidate: data.candidate
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
        if (userId && connectedUsers.get(userId) === socket.id) {
            connectedUsers.delete(userId);
        }
    });
});

// Set port
const PORT = process.env.PORT || 4000;

// Start server
server.listen(PORT, () => {
    logger.info(`Socket.IO server running on port ${PORT}`);
});
