const canvasEl = document.getElementById('game');
const ctx = canvasEl.getContext('2d');
const CANVAS_WIDTH = canvasEl.width;
const CANVAS_HEIGHT = canvasEl.height;

const BUTTON_SIZE = 50;
const BUTTON_MARGIN = 20;

class Entity {
    render(timeSinceLastTick) {}
    tick(now) {}
    // return true if this entity should be "clicked" at position x, y
    checkClick(x, y) { return false; }
    // callback for when this entity is clicked
    onClick(x, y) {}
}

const entities = [];

function loadImage(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.addEventListener('load', () => {
            resolve(img);
        });
        img.src = url;
    });
}
const shipImage = await loadImage('art/ship-hull.png');

/* game state */

class State {
    floodRate = 1;
    floodAmount = 0;
    shipDraught = 10;
    shipHeight = shipImage.height;
    distanceTraveled = 0;
    speed = 0;
    cooldown = 0;
}

const state = new State;

let currentCallback = null;

class Button extends Entity {
    static SIZE = 50;
    static MARGIN = 20;

    static currentIndex = 0;

    constructor(icon, cost, callback) {
        super();
        this.icon = icon;
        this.cost = cost;
        this.callback = callback;

        this.box = {
            x: Button.MARGIN,
            y: Button.MARGIN + Button.currentIndex * (Button.SIZE + Button.MARGIN),
            height: Button.SIZE,
            width: Button.SIZE,
        };

        Button.currentIndex += 1;
    }

    checkClick(x, y) {
        const { box } = this;
        return !(x < box.x || x > box.x + box.width || y < box.y || y > box.y + box.height);
    }

    onClick(x, y) {
        state.cooldown = this.cost;
        currentCallback = this.callback;
    }

    render() {
        const { x, y, width, height } = this.box;
        ctx.fillStyle = state.cooldown > 0 ? 'grey' : 'cornsilk';
        ctx.fillRect(x, y, width, height);
        ctx.strokeText(this.icon, x + 10, y + 36);
    }
}

/**************/

canvasEl.addEventListener('click', function(ev) {
    // can't do any buttons while in cooldown
    if (state.cooldown > 0) {
        return;
    }

    const x = ev.offsetX;
    const y = ev.offsetY;

    for (let entity of entities) {
        if (entity.checkClick(x, y)) {
            entity.onClick(x, y);
            break;
        }
    }
});

class GameController extends Entity {
    tick(timeSinceLastTick) {
        // lose condition
        // TODO: don't hard code the water height here
        if (state.shipHeight - 100 < state.shipDraught) {
            alert('you sank my battleship');
            clearInterval(tickTimer);
            return;
        }

        // handle cooldowns and actions
        state.cooldown = Math.max(0, state.cooldown - timeSinceLastTick);
        if (state.cooldown == 0 && currentCallback) {
            currentCallback();
            currentCallback = null;
        }

        state.distanceTraveled += timeSinceLastTick * (state.speed / 100);
        state.speed = Math.max(0, state.speed - .1); // TODO: make this a function of draught
        state.floodAmount += timeSinceLastTick * (state.floodRate / 100);
        state.shipDraught = state.floodAmount + 10; // TODO: smarter
    }

    render(now) {
        // world
        ctx.fillStyle = 'skyblue';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // distance
        ctx.fillStyle = 'white';
        ctx.font = '32px sans-serif';
        const distanceText = `${Math.floor(state.distanceTraveled)}m`;
        const textMetrics = ctx.measureText(distanceText);
        ctx.fillText(distanceText, Math.floor(CANVAS_WIDTH - textMetrics.width) - 10, Math.floor(textMetrics.actualBoundingBoxAscent) + 10);
    }
}

const SHIP_MODULE_HEIGHT = 100;
const SHIP_MODULE_WIDTH = 100;

class ShipModule extends Entity {
    image = shipImage;

    render() {
        ctx.drawImage(this.image, 0, -SHIP_MODULE_HEIGHT, SHIP_MODULE_HEIGHT, SHIP_MODULE_WIDTH);
    }
}

class Ship extends Entity {
    columns = 4;

    modules = [[]];

    tick(timeSinceLastTick) {
    }

    render(now) {
        ctx.save();

        ctx.translate(SHIP_MODULE_WIDTH, CANVAS_HEIGHT - SHIP_MODULE_HEIGHT + state.shipDraught);

        for (let y = 0; y < this.modules.length; y++) {
            const row = this.modules[y];

            for (let x = 0; x < row.length; x++) {
                ctx.translate(x * SHIP_MODULE_WIDTH, 0);
                const module = row[x];
                // debug
                ctx.fillText(`${x}, ${y}`, 0, -SHIP_MODULE_HEIGHT);
                if (module) {
                    module.render(now);
                } else {
                    // debug
                    ctx.strokeRect(0, -SHIP_MODULE_HEIGHT, SHIP_MODULE_HEIGHT, SHIP_MODULE_WIDTH);
                }
                }
            ctx.translate((row.length - 1) * -SHIP_MODULE_WIDTH, -SHIP_MODULE_HEIGHT);
        }

        ctx.restore();
    }
}

class Water extends Entity {
    render(now) {
        // water
        ctx.fillStyle = 'rgba(0, 0, 128, .7)';
        ctx.fillRect(0, CANVAS_HEIGHT - 100 - 5 * Math.sin((now - firstFrame) / 250), CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}

class DebugDisplay extends Entity {
    render() {
        ctx.fillStyle = 'black';
        ctx.font = '24px sans-serif';

        let offsetY = 50;
        for (let key in state) {
            let val = state[key];
            if (typeof val === 'number') val = val.toFixed(2);
            const text = `${key} = ${val}`;
            const textMetrics = ctx.measureText(text);
            offsetY += Math.floor(textMetrics.actualBoundingBoxAscent);
            ctx.fillText(text, Math.floor(CANVAS_WIDTH - textMetrics.width) - 10, offsetY);
        }
    }
}

let previousTick = performance.now();
let tickTimer;

function tick() {
    const now = performance.now();
    const timeSinceLastTick = now - previousTick;

    for (let entity of entities) {
        entity.tick(timeSinceLastTick);
    }

    previousTick = now;
}

const firstFrame = performance.now();
let previousFrame = firstFrame;

function render(now) {
    for (let entity of entities) {
        entity.render(now);
    }

    previousFrame = now;
    requestAnimationFrame(render);
}

/**************/

entities.push(new GameController());
entities.push(new DebugDisplay());

entities.push(
    new Button('🪣', 1000, () => {state.floodAmount = Math.max(0, state.floodAmount - 1)}),
    new Button('🧹', 1000, () => () => {state.speed = Math.min(state.speed + 1, 5)}),
);

const ship = new Ship();
ship.modules = [
    [new ShipModule(), null],
    [null, new ShipModule()],
    [new ShipModule(), null],
];

entities.push(ship);

entities.push(new Water());

tickTimer = setInterval(tick, 100);
render(performance.now());
