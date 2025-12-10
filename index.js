
var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server, {
    cors: {
        origin: "http://13.49.69.114",
        methods: ["GET", "POST"]
    }
});

const users = {};
server.listen(3000);
var arry = []
var join_user = []
io.on('connection', async function (socket) {

    console.log("Server Running...");
    arry = []

    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
        console.log(socket.id);
        arry.push(socket.id)
        //io.to(socket.id).emit('message', 'for your eyes only');
    }

    function removeDuplicates(arry) {
        return arry.filter((item,
            index) => arry.indexOf(item) === index);
    }
    console.log(removeDuplicates(arry));

    for (let i = 0; i < arry.length / 2; i++) {
        let room_name = 'room' + 'id' + i
        let a = io.sockets.adapter.rooms.get(room_name)

        if (join_user.includes(socket.id) == false) {
            console.log(i)
            if (a) {
                if (a.size < 2) {
                    socket.join(room_name);
                    join_user.push(socket.id)
                    console.log('enter')
                    io.to(room_name).emit('creatroom', room_name);
                }
            } else {
                socket.join(room_name);
                io.to(room_name).emit('creatroom', room_name);
                join_user.push(socket.id)
            }
        }
    }

    console.log(socket['rooms'])

    socket.on('sendmes', function (roomname,message,socket_id) {
        io.to(roomname).emit("sendmessage",message,socket_id);
    });

    socket.on('disconnect', function () {
        console.log('User: ' + users[socket.id] + ' dishconnected');
        io.emit('user_disconnected', users[socket.id]);
        delete users[socket.id];
    });

    socket.on('connect_error', function (err) {
        console.log(err.message);
    });

});
io.on('connect_error', function (err) {
    console.log('this is error-- ' + err.message);
});

