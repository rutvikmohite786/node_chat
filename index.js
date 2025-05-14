const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

// --- Data Stores ---
const queue = [];
const pairedUsers = {};      // socket.id -> room
const roomMembers = {};      // room -> [socket1, socket2]
const userData = {};         // socket.id -> { name, avatar }

io.on('connection', (socket) => {
    console.log(`🔌 Connected: ${socket.id}`);

    // Step 1: Save user info
    socket.on('user_info', ({ name, avatar }) => {
        userData[socket.id] = { name, avatar };
        queue.push(socket);
        tryToPair(); // attempt to pair once user info is in
    });

    // Step 2: Messaging
    socket.on('encrypted_message', ({ room, encrypted, timestamp }) => {
        const actualRoom = pairedUsers[socket.id];
        if (!actualRoom || actualRoom !== room) {
            console.log(`⚠️ Unauthorized message attempt from ${socket.id}`);
            return;
        }
        socket.to(actualRoom).emit('receive_encrypted', { encrypted, from: socket.id, timestamp });
        socket.to(actualRoom).emit('delivered', socket.id);
    });

    socket.on('seen', (room, senderId) => {
        socket.to(room).emit('seen_by_partner', senderId);
    });

    socket.on('typing', (room, name) => {
        socket.to(room).emit('partner_typing', name);
    });

    // Step 3: Disconnection
    socket.on('disconnect', () => {
        const room = pairedUsers[socket.id];
        if (room) {
            socket.to(room).emit('partner_disconnected', socket.id);

            // Clean up both users from room
            roomMembers[room]?.forEach(id => delete pairedUsers[id]);
            delete roomMembers[room];
        }

        // Remove from queue
        const index = queue.findIndex(s => s.id === socket.id);
        if (index !== -1) queue.splice(index, 1);

        // Remove user data
        delete userData[socket.id];
        console.log(`❌ Disconnected: ${socket.id}`);
    });
});

// Pairing function
function tryToPair() {
    while (queue.length >= 2) {
        const user1 = queue.shift();
        const user2 = queue.shift();

        const room = uuidv4(); // secure room
        user1.join(room);
        user2.join(room);

        pairedUsers[user1.id] = room;
        pairedUsers[user2.id] = room;
        roomMembers[room] = [user1.id, user2.id];

        // Send room and partner info to each user
        user1.emit('room_created', {
            room,
            partner: userData[user2.id]
        });

        user2.emit('room_created', {
            room,
            partner: userData[user1.id]
        });

        console.log(`🛋️ Paired: ${user1.id} <-> ${user2.id} in room ${room}`);
    }
}

server.listen(PORT, () => {
    console.log(`🚀 Server listening at http://localhost:${PORT}`);
});
