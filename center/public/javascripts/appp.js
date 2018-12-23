var enemy;
var map;

var socket;

$(document).ready(()=>{
    socket = io.connect('http://localhost:3030');
    socket.on('connect', () => {
    });

    socket.on("enemy_data", (msg) => {
        enemy = msg;
    });

    socket.on("map_data", (msg) => {
        map = msg;
    });
});

function appp() {
    socket.json.emit('switch');
}