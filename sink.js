const canvasEl = document.getElementById('game');
const CANVAS_WIDTH = canvasEl.width;
const CANVAS_HEIGHT = canvasEl.height;

function loadImage(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.addEventListener('load', () => {
            resolve(img);
        });
        img.src = url;
    });
}

class Player {
    constructor() {

    }

    async load() {

    }

    tick() {

    }

    render(ctx, timeSinceLastFrame) {

    }
}

class Ship {
    constructor() {
        this.image = null;
    }

    async load() {
        this.image = await loadImage('art/ship-hull.png');
    }

    tick() {

    }

    render(ctx, timeSinceLastFrame) {
        ctx.drawImage(this.image, 100, 250);
    }
}


class Water {
    constructor() {
        this.animationTime = 0;
    }

    async load() {

    }

    tick() {
        
    }

    render(ctx, timeSinceLastFrame) {
        this.animationTime += timeSinceLastFrame;

        const height = CANVAS_HEIGHT - 150 - 5 * Math.sin(this.animationTime / 1000 * Math.PI);
        ctx.fillStyle = 'rgba(0, 0, 255, .5)';
        ctx.fillRect(0, height, CANVAS_WIDTH, CANVAS_HEIGHT-height);
    }
}


const player = new Player();
const water = new Water();
const ship = new Ship();

function load() {
    return Promise.all([
        player.load(),
        water.load(),
        ship.load(),
    ]);
}
await load();

const TICK_RATE = 100;
function tick() {
    player.tick(TICK_RATE); 
    water.tick(TICK_RATE);
    ship.tick(TICK_RATE);
}
setInterval(tick, TICK_RATE);

const canvasContext = canvasEl.getContext('2d');
let previousFrame = performance.now();
function render(now) {
    const timeSinceLastFrame = now - previousFrame;

    canvasContext.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ship.render(canvasContext, timeSinceLastFrame);
    water.render(canvasContext, timeSinceLastFrame);

    previousFrame = now;
    requestAnimationFrame(render);
}
render(performance.now());