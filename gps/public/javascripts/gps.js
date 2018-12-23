var socket;

var enemies;
var maps;

var app_running = false;

$(document).ready(()=>{
    socket = io.connect('http://localhost:3030');
    socket.on('connect', () => {
        socket.json.emit('connected_gps');
        init(socket);
    });

    socket.on("enemy_data", (msg) => {
        enemies = msg;
    });

    socket.on("map_data", (msg) => {
        maps = msg;
    });

    socket.on("change", () => {
        app_running = !app_running;
    });

});

class Base
{
    constructor(base)
    {
        this.x = base.x;
        this.y = base.y;
        this.enemies = 0;
    }
}

class Tank
{
    constructor()
    {
        this.onMission = false;
        this.position = 0;
        this.path = [];

        this.assignPath = this.assignPath.bind(this);
        this.moveForward = this.moveForward.bind(this);
    }

    assignPath(map)
    {
        $('#log').append("Calculating next mission");
        let current_max = 0;
        let current_dest = 0;
        for (let i = 0; i < map.length; i++)
        {
            if (map.bases[i].enemies/map.dijkstra[this.position][i] > current_max)
            {
                current_max = map.bases[i].enemies / map.dijkstra[this.position][i];
                current_dest = i;
            }
        }
        $('#log').append("Mission assigned. Calculating path");

        this.path[0] = current_dest;
        while (this.path[0] !== this.position)
        {
            this.path.unshift();
            this.path[0] = map.bases[this.path[1]].from;
        }
        this.path.shift();
        this.onMission = true;
        $('#log').append("Path calculated");
    }

    moveForward()
    {
        this.position = this.path[0];
        this.path.unshift();
    }
}

class Enemy
{
    constructor(data)
    {
        this.x =  data.x;
        this.y =  data.y;
        this.isAlive = data.alive;
        this.belongs = data.num_base;

        this.respawn = this.respawn.bind(this);
    }

    respawn(data)
    {
        this.x = data.x;
        this.y = data.y;
        this.isAlive = true;
        this.belongs = data.num_base;
        $('#log').append("New enemy located");
    }
}

class Karta {

    constructor(data, enemies)
    {
        this.enemies = [];
        this.bases = [];

        this.spawnBases = this.spawnBases.bind(this);
        this.spawnEnemies = this.spawnEnemies.bind(this);
        this.dijkstrify = this.dijkstrify.bind(this);
        this.sectorClear = this.sectorClear.bind(this);
        this.createDijkstra = this.createDijkstra.bind(this);

        this.spawnEnemies(enemies);
        this.spawnBases(data.base);
        this.initial = data.initial;
        this.dijkstra = [];
        for (let i=0; i<this.initial.length; i++)
            this.dijkstra[i] = [];
    }

    spawnEnemies(data)
    {
        for (let i = 0; i < data.length; i++)
        {
            this.enemies[i] = new Enemy(data[i]);
        }
    }

    spawnBases(data)
    {
        for (let i = 0; i < data.length; i++)
        {
            this.bases[i] = new Base(data[i]);
        }
    }

    dijkstrify() {
        for (let j = 0; j < this.dijkstra.length; j++) {
            for (let i = 0;  i< this.dijkstra.length; i++) {
                if (i !== j) {
                    for (let k = 0; k < this.dijkstra.length; k++) {
                        if (j !== k) {
                            if (this.dijkstra[i][k] * this.dijkstra[i][j] * this.dijkstra[j][k] > 0) {
                                if (this.dijkstra[i][k] > this.dijkstra[i][j] + this.dijkstra[j][k]) {
                                    this.dijkstra[i][k] = this.dijkstra[i][j] + this.dijkstra[j][k];
                                    this.bases[k].from = j;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    sectorClear(sector)
    {
        for (let i = 0; i < this.enemies.length; i++)
        {
            if (this.enemies[i].belongs === sector)
            {
                this.enemies[i].isAlive = false;
                socket.json.emit('set_enemy_2', this.enemies)
            }
        }
        $('#log').append("Sector " + sector + "clear!");
    }

    createDijkstra()
    {
        for (let i = 0; i < this.initial.length; i++)
        {
            for (let j = 0; j < this.initial.length; j++)
            {
                this.dijkstra[i][j] = this.initial[i][j]*distance(this.bases[i], this.bases[j])
            }
        }
    }
}

async function init(socket)
{
    if (app_running) {
        socket.json.emit('get_map');
        socket.json.emit('get_enemy');
        await sleep(500);
        let map = new Karta(maps, enemies);
        map.createDijkstra();
        let tank = new Tank();
        task(map, tank, socket);
    }
    else {
        setTimeout(function () {
            init(socket);
        }, 100);
    }
}

async function task(map, tank, socket) {
    map.dijkstrify();
    tank.assignPath(map);
    while (tank.path.length !== 1)
    {
        tank.moveForward();
        console.log("Moved to base " + tank.path[0]);
        /*тут танк едет*/
    }
    map.sectorClear(tank.position);
    socket.json.emit('get_enemy');
    for (let i = 0; i < map.enemies.length; i++)
    {
        if (!map.enemies[i].isAlive) map.enemies[i].respawn(enemies[i]);
    }
    await sleep(2000);
    init(socket);
}

function distance(enemy, base) {
    return Math.sqrt(((enemy.x - base.x)^2) + ((enemy.y - base.y)^2))
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}