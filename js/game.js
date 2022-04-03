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
    floodRate = 0;
    floodAmount = 0;
    shipDraught = 10;
    distanceTraveled = 0;
    speed = 0;
    cooldown = 0;
    currentCallback = null;
    timeElapsed = 0;
    
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

function drawParallax(img, speed, y_offset) {
    var numImages = Math.ceil(CANVAS_WIDTH / img.width) + 1;
    var xpos = performance.now() * speed * -1 % img.width;
    ctx.save();
    ctx.translate(-xpos, 0);
    for (var i = 0; i < numImages; i++) {
     ctx.drawImage(img, i * img.width * -1, y_offset);
    }
    ctx.restore();
}

class GameController extends Entity {
    tick(timeSinceLastTick) {
        // lose condition
        // TODO: don't hard code the water height here
        if (state.shipHeight < state.shipDraught) {
            state.gameRunning = false;
            tearDown(canvasEl);

            const timeElapsed = performance.now() - firstFrame;
            end.setUp(canvasEl, state.distanceTraveled, state.timeElapsed);
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

        // bg parallax
        drawParallax(window.parallaxBgYellow, .01, -200);
        drawParallax(window.parallaxBgOrange, .05, -400);
        drawParallax(window.parallaxBgRed, .1, -800);

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
    updateDisplay() {}
}

class HullModule extends ShipModule {
    spriteSheet = shipSpriteSheet;
    renderTopHull = false;

    constructor(ship, x, y) {
        super();
        this.state = 'normal';
        this.ship = ship;
        // x and y here are coordinates in the ship's grid, not relative to canvas!
        this.x = x;
        this.y = y;
        this.updateDisplay();
    }

    tick(timeSinceLastTick) {
        if (this.state == 'normal') {
            if (Math.random() < 0.01) {
                console.log('sprang a leak!');
                this.state = 'leaking';
                state.floodRate += 1;
            }
        }
    }

    onClick(x, y) {
        if (this.state == 'leaking') {
            this.state = 'repairing';

            state.cooldown = 1000;
            state.currentCallback = () => {
                this.state = 'normal';
                state.floodRate = Math.max(0, state.floodRate - 1);
            };
        }
    }

    render() {
        const sprite = this.spriteSheet.sprites.hull;
        if (sprite) {
            sprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
        }

        if (this.renderTopHull) {
            const sprite = this.spriteSheet.sprites.top_hull;
            if (sprite) {
                sprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
            }
        }

        if (this.state == 'leaking') {
            ctx.fillStyle = 'rgba(0, 0, 255, .2)';
            ctx.fillRect(0, 0, SHIP_MODULE_WIDTH, SHIP_MODULE_HEIGHT);
        } else if (this.state == 'repairing') {
            ctx.fillStyle = 'rgba(255, 255, 0, .2)';
            ctx.fillRect(0, 0, SHIP_MODULE_WIDTH, SHIP_MODULE_HEIGHT);
        }
    }

    updateDisplay() {
        const hullAbove = this.ship.getModule(this.x, this.y + 1, HullModule);
        if (hullAbove) {
            this.renderTopHull = true;
        }
    }
}

const moduleTypes = [HullModule];

class ModuleBuilder extends Entity {
    constructor(ship, modX, modY) {
        super();
        this.ship = ship;
        this.modX = modX;
        this.modY = modY;
    }

    onClick(x, y) {
        state.paused = true;

        const menuEl = document.createElement('div');
        menuEl.id = 'module-menu';
        menuEl.onclick = (ev) => {
            if (ev.target.moduleType) {
                this.ship.addModule(this.modX, this.modY, ev.target.moduleType);
                state.cooldown = 1000;
            } else if (ev.target.id != 'cancel') {
                return;
            }

            menuEl.remove();
            state.paused = false;
        };
        for (const moduleType of moduleTypes) {
            const moduleEl = document.createElement('button');
            moduleEl.moduleType = moduleType;
            moduleEl.textContent = moduleType.name;
            menuEl.appendChild(moduleEl);
        }
        const cancelEl = document.createElement('button');
        cancelEl.id = 'cancel';
        cancelEl.textContent = '🚫';
        menuEl.appendChild(cancelEl);

        document.body.appendChild(menuEl);
    }
}

class Ship extends Entity {
    columns = 4;
    rows = 4;

    modules = [];

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
        for (const row of this.modules) {
            for (const module of row) {
                if (module) {
                    module.tick(timeSinceLastTick);
                }
            }
        }
    }

    render(now) {
        ctx.save();

        const { box } = this;

        ctx.translate(box.x, box.y);
        ctx.strokeStyle = 'red';
        ctx.strokeRect(0, -box.height, box.width, box.height);

        ctx.translate(-SHIP_MODULE_WIDTH, 0);
        for (let y = 0; y < this.rows; y++) {
            const row = this.modules[y];

            for (let x = 0; x < this.columns; x++) {
                ctx.translate(SHIP_MODULE_WIDTH, 0);

                const module = row ? row[x] : null;
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
            ctx.translate(this.columns * -SHIP_MODULE_WIDTH, -SHIP_MODULE_HEIGHT);
        }

        ctx.restore();
    }

    checkClick(mouseX, mouseY) {
        const { x, y } = this.box;

        console.log(`checking click at ${mouseX} ${mouseY}`);

        const moduleBox = { x: 0, y: 0, width: SHIP_MODULE_WIDTH, height: SHIP_MODULE_HEIGHT };

        for (let modY = 0; modY < this.rows; modY++) {
            const row = this.modules[modY];

            for (let modX = 0; modX < this.columns; modX++) {
                moduleBox.x = x + (modX * SHIP_MODULE_WIDTH);
                moduleBox.y = y + ((modY + 1) * -SHIP_MODULE_HEIGHT);


                if (isPointInBox(mouseX, mouseY, moduleBox)) {
                    const module = row ? row[modX] : null;

                    if (module) {
                        console.log(`clicked on module in position ${modX}, ${modY}`);
                        return module;
                    } else {
                        // can only build when adjacent to something else
                        if ((modX > 0 && row && row[modX-1]) || // someone to our left
                            (modX < this.columns-1 && row && row[modX+1]) || // someone to our right
                            (modY > 0 && this.modules[modY-1] && this.modules[modY-1][modX]) // someone below
                            ) {
                            return new ModuleBuilder(this, modX, modY);
                        }
                    }
                }
            }
        }
    }

    addModule(x, y, ModuleClass) {
        if (!this.modules[y]) this.modules[y] = [];
        this.modules[y][x] = new ModuleClass(this, x, y);

        this.updateModule(x - 1, y);
        this.updateModule(x + 1, y);
        this.updateModule(x, y - 1);
        this.updateModule(x, y + 1);
    }

    updateModule(x, y) {
        const module = this.getModule(x, y);
        if (module) module.updateDisplay();
    }

    getModule(x, y, ModuleClass = undefined) {
        if (!this.modules[y]) return;
        const module = this.modules[y][x];
        if (!module) return;
        if (ModuleClass && !(module instanceof ModuleClass)) return;
        return module;
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
    constructor() {
        super();
        this.stateKeys = Object.keys(state);
        this.stateKeys.push('shipHeight');
    }
    render() {
        ctx.fillStyle = 'black';
        ctx.font = '24px sans-serif';

        let offsetY = 50;
        for (let key of this.stateKeys) {
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

        state.timeElapsed += timeSinceLastTick;
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

    ship.addModule(1, 0, HullModule);

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
