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
    debug = false;
    gameRunning = true;
    paused = false;
    floodRate = 0;
    floodAmount = 0;
    shipDraught = 10;
    distanceTraveled = 0;

    // A higher-resolution version of distanceTraveled.  It won't match exactly though,
    // since it's for rendering the background.  It just has to look reasonably nice.
    bgDistanceTraveled = 0;

    speed = 0;
    speedBoost = 0;
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

function getWaterBob(offset = 0, magnitude = 5) {
    const timeElapsed = performance.now() - firstFrame;
    return magnitude * Math.sin((timeElapsed + offset) / 250);
}

const isPointInBox = (x, y, box) => !(x < box.x || x > box.x + box.width || y < box.y || y > box.y + box.height);

class Button extends Entity {
    static SIZE = 50;
    static MARGIN = 20;

    constructor(index, icon, cost, startCallback, endCallback) {
        super();
        this.icon = icon;
        this.cost = cost;
        this.startCallback = startCallback;
        this.endCallback = endCallback;

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
        state.currentCallback = this.endCallback;

        if (this.startCallback)
            this.startCallback();
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
    var xpos = state.bgDistanceTraveled * 100 * speed % img.width;
    ctx.save();
    ctx.translate(-xpos, 0);
    for (var i = 0; i < numImages; i++) {
     ctx.drawImage(img, i * img.width * 1, y_offset);
    }
    ctx.restore();
    const timeSinceLastFrame = Math.min(performance.now() - previousFrame, 1000);
    state.bgDistanceTraveled += timeSinceLastFrame * ((state.speed + state.speedBoost) / 1000);
}

class GameController extends Entity {
    tick(timeSinceLastTick) {
        const timeElapsed = performance.now() - firstFrame;
        // lose condition
        // TODO: don't hard code the water height here
        if (state.shipHeight < state.shipDraught) {
            state.gameRunning = false;
            tearDown(canvasEl);

            end.setUp(canvasEl, state.distanceTraveled, state.timeElapsed);
            return;
        }

        // handle cooldowns and actions
        state.cooldown = Math.max(0, state.cooldown - timeSinceLastTick);
        if (state.cooldown == 0 && state.currentCallback) {
            state.currentCallback();
            state.currentCallback = null;
        }

        const stats = state.ship.getStats();
        state.speed = stats.speed || 0;
        state.floodRate = stats.floodRate || 0;

        state.distanceTraveled += timeSinceLastTick * ((state.speed + state.speedBoost) / 100);
        state.floodAmount += timeSinceLastTick * (state.floodRate / 100) + 0.1;
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
    static canBuildAt(x, y) { return true; }

    constructor(ship, x, y) {
        super();
        this.ship = ship;
        // x and y here are coordinates in the ship's grid, not relative to canvas!
        this.x = x;
        this.y = y;
    }

    get wet() {
        return this.y * SHIP_MODULE_HEIGHT < state.shipDraught;
    }

    getStats() {
        return {};
    }

    updateDisplay() {}
}

class HullModule extends ShipModule {
    spriteSheet = shipSpriteSheet;
    renderTopHull = false;
    renderRightHull = false;

    constructor(ship, x, y) {
        super(ship, x, y);
        this.state = 'normal';
        this.updateDisplay();
    }

    static canBuildAt(modX, modY) {
        // we can only be built on top of other hull modules (or at the bottom)
        if (modY == 0) {
            return true;
        }

        const moduleBelow = state.ship.modules[modY-1][modX];
        return moduleBelow && moduleBelow.constructor.name == 'HullModule';
    }

    tick(timeSinceLastTick) {
        if (!this.wet)
            return;

        if (this.state == 'normal') {
            if (Math.random() < 0.01) {
                this.state = 'leaking';
            }
        }
    }

    getStats() {
        return {
            floodRate: this.state == 'normal' ? 0 : 1,
        }
    }

    onClick(x, y) {
        if (this.state == 'leaking') {
            this.state = 'repairing';

            state.cooldown = 1000;
            state.currentCallback = () => {
                this.state = 'normal';
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

        if (this.renderRightHull) {
            const sprite = this.spriteSheet.sprites.side_hull;
            if (sprite) {
                sprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
            }
        }

        if (this.state == 'leaking') {
            ctx.fillStyle = 'rgba(0, 0, 255, .2)';
            ctx.fillRect(0, -SHIP_MODULE_HEIGHT, SHIP_MODULE_WIDTH, SHIP_MODULE_HEIGHT);
        } else if (this.state == 'repairing') {
            ctx.fillStyle = 'rgba(255, 255, 0, .2)';
            ctx.fillRect(0, -SHIP_MODULE_HEIGHT, SHIP_MODULE_WIDTH, SHIP_MODULE_HEIGHT);
        }
    }

    updateDisplay() {
        this.renderTopHull = !!this.ship.getModule(this.x, this.y + 1, HullModule);
        this.renderRightHull = !!this.ship.getModule(this.x + 1, this.y, HullModule);
    }
}

class ConstructionModule extends ShipModule {
    render() {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, -SHIP_MODULE_HEIGHT, SHIP_MODULE_WIDTH, SHIP_MODULE_HEIGHT);
    }
}

class SailModule extends ShipModule {
    spriteSheet = shipSpriteSheet;

    static canBuildAt(modX, modY) {
        // TODO: this is just notional stuff for testing the logic, feel free to change how sails work

        // cannot build at the root
        if (modY == 0) {
            return false;
        }

        // must be on top of a hull
        const moduleBelow = state.ship.modules[modY-1][modX];
        return moduleBelow && moduleBelow.constructor.name == 'HullModule';
    }

    getStats() {
        return {
            speed: 1,
        }
    }

    render() {
        if (this.spriteSheet.sprites.sail) {
            this.spriteSheet.sprites.sail.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
        }
    }
}

const moduleTypes = [HullModule, SailModule];

class ModuleBuilder extends Entity {
    constructor(ship, modX, modY) {
        super();
        this.ship = ship;
        this.modX = modX;
        this.modY = modY;
    }

    onClick(x, y) {
        const menuEl = document.createElement('div');
        menuEl.id = 'module-menu';
        menuEl.onclick = (ev) => {
            if (ev.target.moduleType) {
                state.cooldown = 1000;
                this.ship.addModule(this.modX, this.modY, ConstructionModule);
                state.currentCallback = () => {
                    this.ship.addModule(this.modX, this.modY, ev.target.moduleType);
                };
            } else if (ev.target.id != 'cancel') {
                return;
            }

            menuEl.remove();
            state.paused = false;
        };

        let buildingAllowed = false;
        for (const moduleType of moduleTypes) {
            if (moduleType.canBuildAt(this.modX, this.modY)) {
                const moduleEl = document.createElement('button');
                moduleEl.moduleType = moduleType;
                moduleEl.textContent = moduleType.name;
                menuEl.appendChild(moduleEl);
                buildingAllowed = true;
            }
        }

        if (!buildingAllowed) {
            return;
        }

        const cancelEl = document.createElement('button');
        cancelEl.id = 'cancel';
        cancelEl.textContent = '🚫';
        menuEl.appendChild(cancelEl);

        state.paused = true;
        document.body.appendChild(menuEl);
    }
}

class Ship extends Entity {
    columns = 4;
    rows = 1;

    modules = [];

    constructor() {
        super();
        const ship = this;
        this.box = {
            // position is anchored to the bottom left corner of the ship
            x: SHIP_MODULE_WIDTH,
            get y() { return CANVAS_HEIGHT - WATER_HEIGHT + state.shipDraught },
            get width() { return ship.columns * SHIP_MODULE_WIDTH },
            get height() { return ship.modules.length * SHIP_MODULE_HEIGHT },
        }
    }

    tick(timeSinceLastTick) {
        for (const [modY, row] of this.modules.entries()) {
            // underwater modules don't tick
            if ((modY+1) * SHIP_MODULE_HEIGHT < state.shipDraught) {
                continue;
            }

            for (const module of row) {
                if (module) {
                    module.tick(timeSinceLastTick);
                }
            }
        }
    }

    render(now) {
        ctx.save();
        ctx.translate(0, getWaterBob(250, 3));

        const { box } = this;

        ctx.strokeStyle = 'red';
        ctx.strokeRect(0, -box.height, box.width, box.height);

        let y = this.rows;
        while (y-->0) {
            const row = this.modules[y];
            let x = this.columns;
            while (x-->0) {
                const translateX = box.x + (x * SHIP_MODULE_WIDTH);
                const translateY = box.y + (y * -SHIP_MODULE_HEIGHT);

                ctx.translate(translateX, translateY);
                
                const module = row ? row[x] : null;
                // debug
                state.debug && ctx.fillText(`${x}, ${y}`, 0, -SHIP_MODULE_HEIGHT);
                if (module) {
                    module.render(now);
                } else if (state.debug) {
                    // debug
                    ctx.strokeStyle = 'white';
                    ctx.strokeRect(0, -SHIP_MODULE_HEIGHT, SHIP_MODULE_HEIGHT, SHIP_MODULE_WIDTH);
                }
                ctx.translate(-translateX, -translateY);
            }
        }

        ctx.restore();
    }

    checkClick(mouseX, mouseY) {
        const { x, y } = this.box;

        console.log(`checking click at ${mouseX} ${mouseY}`);

        const moduleBox = { x: 0, y: 0, width: SHIP_MODULE_WIDTH, height: SHIP_MODULE_HEIGHT };

        for (let modY = 0; modY < this.rows; modY++) {
            const row = this.modules[modY];

            // can't click on stuff that's underwater
            if ((modY+1) * SHIP_MODULE_HEIGHT < state.shipDraught) {
                continue;
            }

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

    getStats() {
        const stats = {};
        for (const [modY, row] of this.modules.entries()) {
            if ((modY+1) * SHIP_MODULE_HEIGHT < state.shipDraught)
                continue;

            for (const [modX, module] of row.entries()) {
                if (!module) continue;
                const moduleStats = module.getStats();
                for (const key in moduleStats) {
                    stats[key] = (stats[key] || 0) + moduleStats[key];
                }
            }
        }
        return stats;
    }

    addModule(x, y, ModuleClass) {
        if (y + 1 >= this.rows) this.rows = y + 2;

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
        ctx.fillRect(0, CANVAS_HEIGHT - WATER_HEIGHT + getWaterBob(), CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}

class DebugDisplay extends Entity {
    constructor() {
        super();
        this.stateKeys = Object.keys(state);
        this.stateKeys.push('shipHeight');
    }
    render() {
        if (!state.debug) return;
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
    const timeSinceLastTick = Math.min(now - previousTick, 1000);

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
        new Button(0, '🪣', 1000, null, () => {state.floodAmount = Math.max(0, state.floodAmount - 2)}),
        new Button(1, '🧹', 1000, () => {state.speedBoost = 1}, () => {state.speedBoost = 0}),
        new Button(2, '🐛', 1, () => {
            state.debug = !state.debug;
        }),
    );

    document.addEventListener('keydown', ev => {
        if (state.debug) {
            if (ev.code == 'Space') {
                state.paused = !state.paused;
            }
        }
    });

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
