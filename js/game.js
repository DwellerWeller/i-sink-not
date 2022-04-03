import * as end from './end.js';

import { shipSpriteSheet } from './art.js';

let canvasEl;
let ctx;
let CANVAS_WIDTH, CANVAS_HEIGHT;

const BUTTON_SIZE = 50;
const BUTTON_MARGIN = 20;

const WATER_HEIGHT = 100;

class Entity {
    visible = true;
    updating = true;

    render(timeSinceLastTick) {}
    tick(now) {}
    // return *entity reference* if this entity should be "clicked" at position x, y
    checkClick(x, y) { return null; }
    // callback for when this entity is clicked
    onClick(x, y) {}
}

const entities = [];

/* game state */

class State {
    gameRunning = true;
    paused = false;
    floodRate = 1;
    floodAmount = 0;
    shipDraught = 10;
    distanceTraveled = 0;
    speed = 0;
    cooldown = 0;
    currentCallback = null;
    
    constructor(ship) {
        this.ship = ship;
    }

    get shipHeight() {
        return this.ship.box.height;
    }
}

let state;

const isPointInBox = (x, y, box) => !(x < box.x || x > box.x + box.width || y < box.y || y > box.y + box.height);

class Button extends Entity {
    static SIZE = 50;
    static MARGIN = 20;

    constructor(index, icon, cost, callback) {
        super();
        this.icon = icon;
        this.cost = cost;
        this.callback = callback;

        this.box = {
            x: Button.MARGIN,
            y: Button.MARGIN + index * (Button.SIZE + Button.MARGIN),
            height: Button.SIZE,
            width: Button.SIZE,
        };
    }

    checkClick(x, y) {
        const { box } = this;
        if (isPointInBox(x, y, box)) {
            return this;
        }
    }

    onClick(x, y) {
        state.cooldown = this.cost;
        state.currentCallback = this.callback;
    }

    render() {
        const { x, y, width, height } = this.box;
        ctx.fillStyle = state.cooldown > 0 ? 'grey' : 'cornsilk';
        ctx.fillRect(x, y, width, height);
        ctx.strokeText(this.icon, x + 10, y + 36);
    }
}

class ModuleBuilder extends Entity {
    constructor(ship, modX, modY) {
        super();
        this.ship = ship;
        this.modX = modX;
        this.modY = modY;
    }

    onClick(x, y) {
        this.ship.modules[this.modY][this.modX] = new ShipModule();
    }
}

/**************/

function onClick(ev) {
    // can't do any buttons while in cooldown
    if (state.cooldown > 0) {
        return;
    }

    const x = ev.offsetX;
    const y = ev.offsetY;

    for (let entity of entities) {
        let res = entity.checkClick(x, y);
        if (res) {
            res.onClick(x, y);
            break;
        }
    }
}

class GameController extends Entity {
    tick(timeSinceLastTick) {
        // lose condition
        // TODO: don't hard code the water height here
        if (state.shipHeight - WATER_HEIGHT < state.shipDraught) {
            state.gameRunning = false;
            tearDown(canvasEl);

            const timeElapsed = performance.now() - firstFrame;
            end.setUp(canvasEl, state.distanceTraveled, timeElapsed);
            return;
        }

        // handle cooldowns and actions
        state.cooldown = Math.max(0, state.cooldown - timeSinceLastTick);
        if (state.cooldown == 0 && state.currentCallback) {
            state.currentCallback();
            state.currentCallback = null;
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

const SHIP_MODULE_HEIGHT = 128;
const SHIP_MODULE_WIDTH = 128;

class ShipModule extends Entity {
    spriteSheet = shipSpriteSheet;

    render() {
        const sprite = this.spriteSheet.sprites.hull;
        if (sprite) {
            sprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
        }
    }
}

class Ship extends Entity {
    columns = 4;

    modules = [[]];

    constructor() {
        super();
        const ship = this;
        this.box = {
            // position is anchored to the bottom left corner of the ship
            x: SHIP_MODULE_WIDTH,
            get y() { return CANVAS_HEIGHT - SHIP_MODULE_HEIGHT + state.shipDraught },
            get width() { return ship.columns * SHIP_MODULE_WIDTH },
            get height() { return ship.modules.length * SHIP_MODULE_HEIGHT },
        }
    }

    tick(timeSinceLastTick) {
    }

    render(now) {
        ctx.save();

        const { box } = this;

        ctx.translate(box.x, box.y);
        ctx.strokeStyle = 'red';
        ctx.strokeRect(0, -box.height, box.width, box.height);

        ctx.translate(-SHIP_MODULE_WIDTH, 0);
        for (let y = 0; y < this.modules.length; y++) {
            const row = this.modules[y];

            for (let x = 0; x < row.length; x++) {
                ctx.translate(SHIP_MODULE_WIDTH, 0);
                const module = row[x];
                // debug
                ctx.fillText(`${x}, ${y}`, 0, -SHIP_MODULE_HEIGHT);
                if (module) {
                    module.render(now);
                } else {
                    // debug
                    ctx.strokeStyle = 'white';
                    ctx.strokeRect(0, -SHIP_MODULE_HEIGHT, SHIP_MODULE_HEIGHT, SHIP_MODULE_WIDTH);
                }
            }
            ctx.translate(row.length * -SHIP_MODULE_WIDTH, -SHIP_MODULE_HEIGHT);
        }

        ctx.restore();
    }

    checkClick(mouseX, mouseY) {
        const { x, y } = this.box;

        console.log(`checking click at ${mouseX} ${mouseY}`);

        const moduleBox = { x: 0, y: 0, width: SHIP_MODULE_WIDTH, height: SHIP_MODULE_HEIGHT };

        for (let modY = 0; modY < this.modules.length; modY++) {
            const row = this.modules[modY];

            for (let modX = 0; modX < row.length; modX++) {
                moduleBox.x = x + (modX * SHIP_MODULE_WIDTH);
                moduleBox.y = y + ((modY + 1) * -SHIP_MODULE_HEIGHT);


                if (isPointInBox(mouseX, mouseY, moduleBox)) {
                    const module = row[modX];

                    if (module) {
                        console.log(`clicked on module in position ${modX}, ${modY}`);
                        return module;
                    } else {
                        // can only build when adjacent to something else
                        if ((modX > 0 && row[modX-1]) || // someone to our left
                            (modX < row.length-1 && row[modX+1]) || // someone to our right
                            (modY > 0 && this.modules[modY-1][modX]) // someone below
                            ) {
                            return new ModuleBuilder(this, modX, modY);
                        }
                    }
                }
            }
        }
    }
}

class Water extends Entity {
    render(now) {
        // water
        ctx.fillStyle = 'rgba(0, 0, 128, .7)';
        ctx.fillRect(0, CANVAS_HEIGHT - WATER_HEIGHT - 5 * Math.sin((now - firstFrame) / 250), CANVAS_WIDTH, CANVAS_HEIGHT);
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
            if (typeof val === 'function') val = '<callback>';
            const text = `${key} = ${val}`;
            const textMetrics = ctx.measureText(text);
            offsetY += Math.floor(textMetrics.actualBoundingBoxAscent);
            ctx.fillText(text, Math.floor(CANVAS_WIDTH - textMetrics.width) - 10, offsetY);
        }
    }
}

let previousTick;
let tickTimer;

function tick() {
    const now = performance.now();
    const timeSinceLastTick = now - previousTick;

    if (!state.paused) {
        for (let entity of entities) {
            if (entity.updating) entity.tick(timeSinceLastTick);
        }
    }

    previousTick = now;
}

let firstFrame;
let previousFrame;

function render(now) {
    if (!state.gameRunning) 
        return;

    for (let entity of entities) {
        if (entity.visible) entity.render(now);
    }

    previousFrame = now;
    requestAnimationFrame(render);
}

/**************/

export function setUp(canvasEl_) {
    canvasEl = canvasEl_;
    CANVAS_WIDTH = canvasEl.width;
    CANVAS_HEIGHT = canvasEl.height;

    const ship = new Ship();

    state = new State(ship);

    ctx = canvasEl.getContext('2d');

    entities.length = 0;

    entities.push(new GameController());
    entities.push(new DebugDisplay());

    entities.push(
        new Button(0, '🪣', 1000, () => {state.floodAmount = Math.max(0, state.floodAmount - 1)}),
        new Button(1, '🧹', 1000, () => {state.speed = Math.min(state.speed + 1, 5)}),
    );

    ship.modules = [
        [null, new ShipModule(), null, null],
        [null, null, null, null],
        [null, null, null, null],
        [null, null, null, null],
    ];

    entities.push(ship);

    entities.push(new Water());

    const now = performance.now();
    previousTick = now;
    tickTimer = setInterval(tick, 100);

    firstFrame = now;
    previousFrame = firstFrame;
    render(firstFrame);

    canvasEl.onclick = onClick;
}

function tearDown(canvasEl) {
    clearInterval(tickTimer);
    canvasEl.onclick = null;
}

window._debug = {
    get state() { return state },
    entities,
}
