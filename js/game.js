import * as end from './end.js';
import * as sound from './sound.js';

import { shipSpriteSheet, AnimatedSpriteController } from './art.js';

let canvasEl;
let ctx;
let CANVAS_WIDTH, CANVAS_HEIGHT;

const BUTTON_SIZE = 50;
const BUTTON_MARGIN = 20;

const DEFAULT_WATER_HEIGHT = 100;
let currentWaterHeight = 100;

const vectorLength = vec => Math.sqrt((vec.x ** 2) + (vec.y ** 2));

const normalizeVector = vec => {
    const l = vectorLength(vec);
    vec.x /= l;
    vec.y /= l;
    return vec;
}

const addVectors = (vecA, vecB) => {
    vecA.x += vecB.x;
    vecA.y += vecB.y;
    return vecA;
}

const scaleVector = (vec, scalar) => {
    vec.x *= scalar;
    vec.y *= scalar;
    return vec;
}

const cloneVector = ({ x, y }) => ({ x, y });

const VECTOR_UP = { x: 0, y: -1 };
const VECTOR_DOWN = { x: 0, y: 1 };

class Entity {
    visible = true;
    updating = true;
    alive = true;
    zIndex = 0;
    canClickWhilePaused = false;

    render(timeSinceLastTick) {}
    tick(now) {}
    // return *entity reference* if this entity should be "clicked" at position x, y
    checkClick(x, y) { return null; }
    // callback for when this entity is clicked
    onClick(x, y) {}

    onMouseOver() {}
    onMouseOut() {}
}

const entities = [];

/* game state */

class State {
    debug = false;
    gameRunning = true;
    paused = false;
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

    hoveredEntity = null;
    
    constructor(ship) {
        this.ship = ship;
    }

    get shipHeight() {
        let height = 0;
        for (const row of this.ship.modules) {
            let nonNullModuleSeen = false;
            for (const module of row) {
                if (module.constructor.name != 'NullModule') {
                    nonNullModuleSeen = true;
                    break;
                }
            }

            if (nonNullModuleSeen) {
                height += SHIP_MODULE_HEIGHT;
            }
        }
        return height;
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
        this.hovered = false;

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

    onMouseOver() {
        this.hovered = true;
        canvasEl.style.cursor = 'pointer';
    }

    onMouseOut() {
        this.hovered = false;
        canvasEl.style.cursor = 'default';
    }

    render() {
        const { x, y, width, height } = this.box;
        ctx.fillStyle = state.cooldown > 0 ? 'grey' : this.hovered ? 'white' : 'cornsilk';
        ctx.fillRect(x, y, width, height);
        ctx.strokeText(this.icon, x + 10, y + 36);
    }
}

/**************/

function isEntityInteractive(entity) {
    if (state.paused && !entity.canClickWhilePaused) return false;
    if (!entity.updating) return false;
    return true;
}

function onClick(ev) {
    // can't do any buttons while in cooldown
    if (state.cooldown > 0) {
        return;
    }

    const x = ev.offsetX;
    const y = ev.offsetY;

    for (let entity of entities) {
        if (isEntityInteractive(entity)) {
            let res = entity.checkClick(x, y);
            if (res) {
                res.onClick(x, y);
                return;
            }
        }
    }
}

function onMouseMove(ev) {
    const x = ev.offsetX;
    const y = ev.offsetY;

    if (state.hoveredEntity && !state.hoveredEntity.alive) {
        state.hoveredEntity = null;
    }
    
    let newHoveredEntity = null;
    for (let entity of entities) {
        if (isEntityInteractive(entity)) {
            let res = entity.checkClick(x, y);
            if (res) {
                newHoveredEntity = res;
                break;
            }
        }
    }

    if (newHoveredEntity != state.hoveredEntity) {
        if (state.hoveredEntity) {
            state.hoveredEntity.onMouseOut();
        }

        state.hoveredEntity = newHoveredEntity;

        if (state.hoveredEntity) {
            state.hoveredEntity.onMouseOver();
        }
    }
}

function drawParallax(img, speed, x_offset, y_offset) {
    var numImages = Math.ceil(CANVAS_WIDTH / (img.width + x_offset)) + 1;
    var xpos = state.bgDistanceTraveled * 100 * speed % img.width;
    ctx.save();
    ctx.translate(-xpos, 0);
    for (var i = 0; i < numImages; i++) {
     ctx.drawImage(img, i * img.width * 1 + x_offset, y_offset);
    }
    ctx.restore();
    const timeSinceLastFrame = Math.min(performance.now() - previousFrame, 1000);
    state.bgDistanceTraveled += timeSinceLastFrame * ((state.speed + state.speedBoost) / 1000);
}

class GameController extends Entity {
    tick(timeSinceLastTick) {
        const timeElapsed = performance.now() - firstFrame;
        // lose condition
        if (state.shipHeight < state.shipDraught && state.gameRunning) {
            // TODO: if the top row of modules is all NullModule don't count it
            state.gameRunning = false;
            sound.gameover.play();
            entities.push(new GameOverScreen(state.distanceTraveled, state.timeElapsed));
        }

        if (!state.gameRunning) return;

        // TODO just move this logic into the ship entity
        if (!state.ship.updating) return;

        // handle cooldowns and actions
        state.cooldown = Math.max(0, state.cooldown - timeSinceLastTick);
        if (state.cooldown == 0 && state.currentCallback) {
            state.currentCallback();
            state.currentCallback = null;
        }

        const stats = state.ship.getStats();
        state.speed = stats.speed || 0;

        state.distanceTraveled += timeSinceLastTick/100 * (state.speed + state.speedBoost);
        state.shipDraught += timeSinceLastTick/100 * (stats.weight - (stats.buoyancy || 0));
    }

    render(now) {
        // world
        ctx.fillStyle = 'skyblue';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // bg parallax
        drawParallax(window.parallaxBgYellow, .01, 0, -200);
        drawParallax(window.parallaxBgOrange, .03, 0, -400);
        drawParallax(window.parallaxBgRed, .05, 0, -800);

        // TODO move into separate entity
        if (!state.ship.updating) return;
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
    solid = true;
    sprite = null;

    weight = 5;

    static canBuildAt(x, y) { return true; }

    constructor(ship, x, y) {
        super();
        this.ship = ship;
        // x and y here are coordinates in the ship's grid, not relative to canvas!
        this.x = x;
        this.y = y;
    }

    get percentSubmerged() {
        return Math.max(0, Math.min(1, (state.shipDraught - (this.y * SHIP_MODULE_HEIGHT)) / SHIP_MODULE_HEIGHT));
    }

    getStats() {
        return {};
    }

    updateDisplay() {}

    render() {
        const sprite = this.sprite || this.constructor.sprite;
        if (sprite) {
            sprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
        }
    }
}

class HullModule extends ShipModule {
    static sprite = shipSpriteSheet.sprites.hull;

    sprite = HullModule.sprite;

    defaultSprite = shipSpriteSheet.sprites.hull;
    bustedSprite = shipSpriteSheet.sprites.busted_hull;
    topHullSprite = shipSpriteSheet.sprites.top_hull;
    sideHullSprite = shipSpriteSheet.sprites.side_hull;

    renderTopHull = false;
    renderRightHull = false;

    floodAmount = 0;
    buoyancy = 20;

    constructor(ship, x, y) {
        super(ship, x, y);
        this.state = 'normal';
        this.updateDisplay();
    }

    static canBuildAt(modX, modY) {
        // we can only be built on top of other hull modules (or at the bottom)
        if (modY == 0) {
            if (modX > 0) {
                if (state.ship.getModule(modX-1, modY).solid)
                    return true;
            }

            if (modX < state.ship.columns-1) {
                if (state.ship.getModule(modX+1, modY).solid)
                    return true;
            }

            return false;
        }

        const moduleBelow = state.ship.getModule(modX, modY - 1);
        return moduleBelow && moduleBelow.solid;
    }

    tick(timeSinceLastTick, now) {
        if (!this.percentSubmerged > 0)
            return;

        if (Math.random() < .5) {
            const spriteX = this.ship.box.x + (this.x * SHIP_MODULE_WIDTH) + (Math.random() * SHIP_MODULE_WIDTH);
            const spriteY = CANVAS_HEIGHT - currentWaterHeight + getWaterBob();
            entities.push(
                new SprayParticle(now + 600, spriteX, spriteY),
            );
        }

        if (this.state == 'normal') {
            if (Math.random() < 0.005) {
                sound.breaking.play();
                this.state = 'leaking';
            }
        } else {
            this.floodAmount = Math.min(this.buoyancy, this.floodAmount + timeSinceLastTick/1000 * 2);
        }
    }

    getStats() {
        const percentSubmerged = this.percentSubmerged;
        return {
            'buoyancy': percentSubmerged > 0 ? this.buoyancy * percentSubmerged - this.floodAmount: 0,
        }
    }

    onClick(x, y) {
        if (this.state == 'leaking') {
            sound.repairing.play();
            this.state = 'repairing';

            state.cooldown = 1000;
            state.currentCallback = () => {
                this.state = 'normal';
            };
        }
    }

    render() {
        this.sprite = this.state !== 'normal' ? this.bustedSprite : this.defaultSprite;
        super.render();

        if (this.renderTopHull) {
            if (this.topHullSprite) {
                this.topHullSprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
            }
        }

        if (this.renderRightHull) {
            if (this.sideHullSprite) {
                this.sideHullSprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
            }
        }

        if (this.state == 'repairing') {
            ctx.fillStyle = 'rgba(255, 255, 0, .2)';
            ctx.fillRect(0, -SHIP_MODULE_HEIGHT, SHIP_MODULE_WIDTH, SHIP_MODULE_HEIGHT);
        }
    }

    updateDisplay() {
        const moduleAbove = this.ship.getModule(this.x, this.y + 1);
        this.renderTopHull = moduleAbove && moduleAbove.solid;
        this.renderRightHull = !!this.ship.getModule(this.x + 1, this.y, HullModule);
    }
}

class NullModule extends ShipModule {
    weight = 0;
    solid = false;

    constructor(ship, x, y) {
        super(ship, x, y);
        this.buildOptions = [];
    }

    onMouseOver() {
        const buildOptions = [];
        for (const moduleType of moduleTypes) {
            if (moduleType.canBuildAt(this.x, this.y)) {
                buildOptions.push(moduleType);
            }
        }
        this.buildOptions = buildOptions;

        if (this.buildOptions.length > 0) {
            canvasEl.style.cursor = 'pointer';
        }
    }

    onMouseOut() {
        this.buildOptions = [];
        canvasEl.style.cursor = 'default';
    }

    onClick(x, y) {
        if (this.buildOptions.length == 0) {
            return;
        }

        sound.confirm.play();
        const menuEl = document.createElement('div');
        menuEl.id = 'module-menu';
        menuEl.onclick = (ev) => {
            if (ev.target.moduleType) {
                sound.building.play();
                state.cooldown = 1000;
                this.ship.addModule(this.x, this.y, ConstructionModule);
                state.currentCallback = () => {
                    this.ship.addModule(this.x, this.y, ev.target.moduleType);
                };
            } else if (ev.target.id != 'cancel') {
                return;
            } else if (ev.target.id == 'cancel') {
                sound.cancel.play();
            }

            menuEl.remove();
            state.paused = false;
        };

        for (const moduleType of this.buildOptions) {
            const moduleEl = document.createElement('button');
            const sprite = moduleType.sprite;
            moduleEl.moduleType = moduleType;
            moduleEl.style.position = 'relative';
            moduleEl.style.overflow = 'hidden';
 
            if (sprite) {
                const div = document.createElement('div');
                div.style.background = `url(${sprite.spriteSheet.src}) no-repeat -${sprite.x}px -${sprite.y}px`;
                div.style.width = sprite.width + 'px';
                div.style.height = sprite.height + 'px';
                div.style.position = 'absolute';
                div.style.transform = 'translate(-50%, -50%) scale(.5)';
                div.style.transformOrigin = 'center';
                div.style.top = '50%';
                div.style.left = '50%';
                div.style.pointerEvents = 'none';

                moduleEl.appendChild(div);
            } else {
                moduleEl.textContent = moduleType.name;
            }

            menuEl.appendChild(moduleEl);
        }

        const cancelEl = document.createElement('button');
        cancelEl.id = 'cancel';
        cancelEl.textContent = '🚫';
        menuEl.appendChild(cancelEl);

        state.paused = true;
        document.body.appendChild(menuEl);
    }

    render() {
        if (state.cooldown == 0 && this.buildOptions.length > 0) {
            ctx.fillStyle = 'rgba(255, 255, 0, .5)';
            ctx.fillRect(0, -SHIP_MODULE_HEIGHT, SHIP_MODULE_WIDTH, SHIP_MODULE_HEIGHT);
        }

        if (state.debug) {
            ctx.strokeStyle = 'white';
            ctx.strokeRect(0, -SHIP_MODULE_HEIGHT, SHIP_MODULE_HEIGHT, SHIP_MODULE_WIDTH);
        }
    }
}

class ConstructionModule extends ShipModule {
    static sprite = shipSpriteSheet.sprites.scaffolding;
    solid = false;
}

class SailModule extends ShipModule {
    static sprite = shipSpriteSheet.sprites.sail;

    solid = false;
    weight = 1.5;

    static canBuildAt(modX, modY) {
        // TODO: this is just notional stuff for testing the logic, feel free to change how sails work

        // cannot build at the root
        if (modY == 0) {
            return false;
        }

        // must be on top of a solid module
        const moduleBelow = state.ship.getModule(modX, modY-1);
        return moduleBelow && moduleBelow.solid;
    }

    getStats() {
        return {
            speed: this.percentSubmerged < .5 ? 1 : 0,
        }
    }
}

class BoilerModule extends ShipModule {
    static sprite = shipSpriteSheet.sprites.boiler;

    weight = 10;

    static canBuildAt(modX, modY) {
        if (modX == 0) {
            // don't allow building at the back where there's no room for a propellor
            return false;
        }

        const moduleBelow = state.ship.getModule(modX, modY - 1);
        return moduleBelow && moduleBelow.solid;
    }
}

class PropellerModule extends ShipModule {
    static sprite = shipSpriteSheet.sprites.propeller;

    static blurSprites = [
        shipSpriteSheet.sprites.propeller_blur_1,
        shipSpriteSheet.sprites.propeller_blur_2,
    ];

    blurSprite = new AnimatedSpriteController(PropellerModule.blurSprites, performance.now());

    solid = false;

    weight = 2;

    static canBuildAt(modX, modY) {
        const moduleRight = state.ship.getModule(modX + 1, modY);
        return moduleRight && moduleRight.constructor.name == 'BoilerModule';
    }

    getStats() {
        return {
            speed: this.percentSubmerged < .5 ? 5 : 0,
        }
    }

    render() {
        super.render();
        if (this.percentSubmerged < .5) {
            this.blurSprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
        }
    }
}

class FinSailModule extends ShipModule {
    static sprite = shipSpriteSheet.sprites.fin_sail;
    solid = false;

    weight = 2.5;

    static canBuildAt(modX, modY) {
        const moduleLeft = state.ship.getModule(modX - 1, modY);
        return moduleLeft && moduleLeft.solid;
    }

    getStats() {
        return {
            speed: this.percentSubmerged < .5 ? .5 : 0,
        }
    }
}

const moduleTypes = [HullModule, SailModule, BoilerModule, PropellerModule, FinSailModule];


class Ship extends Entity {
    columns = 4;
    rows = 1;

    modules = [];

    constructor() {
        super();
        const ship = this;
        this.box = {
            // position is anchored to the bottom left corner of the ship
            x: SHIP_MODULE_WIDTH*2,
            get y() { return CANVAS_HEIGHT - currentWaterHeight + state.shipDraught },
            get width() { return ship.columns * SHIP_MODULE_WIDTH },
            get height() { return ship.modules.length * SHIP_MODULE_HEIGHT },
        }
    }

    tick(timeSinceLastTick, now) {
        for (const [modY, row] of this.modules.entries()) {
            // underwater modules don't tick
            if ((modY+1) * SHIP_MODULE_HEIGHT < state.shipDraught) {
                continue;
            }

            for (const module of row) {
                if (module) {
                    module.tick(timeSinceLastTick, now);
                }
            }
        }
    }

    render(now) {
        ctx.save();
        ctx.translate(0, getWaterBob(250, 3));

        const { box } = this;

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
                }
                ctx.translate(-translateX, -translateY);
            }
        }

        ctx.restore();
    }

    checkClick(mouseX, mouseY) {
        if (!state.gameRunning) return;
        const { x, y } = this.box;

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
                    return module;
                }
            }
        }
    }

    getStats() {
        const stats = {weight: 0};
        for (const [modY, row] of this.modules.entries()) {

            for (const [modX, module] of row.entries()) {
                stats.weight += module.weight;
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

        for (let yOffset = 0; yOffset < 2; yOffset++) {
            if (!this.modules[y+yOffset]) {
                const newRow = [];
                for (let i = 0; i<this.columns; i++) {
                    newRow.push(new NullModule(this, i, y+yOffset));
                }
                this.modules[y+yOffset] = newRow;
            }
        }
        this.modules[y][x] = new ModuleClass(this, x, y);

        this.updateModule(x - 1, y);
        this.updateModule(x + 1, y);
        this.updateModule(x, y - 1);
        this.updateModule(x, y + 1);

        const spriteX = this.box.x + (x * SHIP_MODULE_WIDTH);
        const spriteY = this.box.y + (y * -SHIP_MODULE_HEIGHT);

        entities.push(
            new SteamParticle(performance.now() + 1000, spriteX, spriteY),
        );
    }

    updateModule(x, y) {
        const module = this.getModule(x, y);
        if (module) module.updateDisplay();
    }

    getModule(x, y, ModuleClass = undefined) {
        if (!this.modules[y]) return;
        const module = this.modules[y][x];
        if (ModuleClass && !(module instanceof ModuleClass)) return;
        return module;
    }
}

class Water extends Entity {
    constructor(height, alpha, parallaxSpeed, x_offset) {
        super();
        this.height = height;
        this.alpha = alpha;
        this.parallaxSpeed = parallaxSpeed;
        this.x_offset = x_offset;
    }

    render(now) {
        ctx.globalAlpha = this.alpha;
        const yPosition = CANVAS_HEIGHT - this.height - 75 - currentWaterHeight + getWaterBob();
        drawParallax(window.wavesImg, this.parallaxSpeed, this.x_offset, yPosition);
        const imgHeight = wavesImg.height;
        if (yPosition + imgHeight < CANVAS_HEIGHT) {
            ctx.fillStyle = '#96b3d1';
            ctx.fillRect(0, Math.max(0, yPosition + imgHeight), CANVAS_WIDTH, CANVAS_HEIGHT);
        }
        ctx.globalAlpha = 1;
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

class Particle extends Entity {
    speed = 5;
    forceVector = VECTOR_UP;
    direction = cloneVector(VECTOR_UP);
    sprite = null;
    
    constructor(liveUntil, x, y) {
        super();
        this.created = performance.now();
        this.liveUntil = liveUntil;
        this.x = x;
        this.y = y;
    }

    tick(deltaT, t) {
        if (t > this.liveUntil) {
            this.alive = false;
            return;
        }

        const move = scaleVector(this.direction, this.speed);
        addVectors(this, move);

        this.direction = normalizeVector(
            addVectors(
                this.direction,
                this.forceVector,
            ),
        );
    }

    render(t) {
        if (!this.sprite) return;
        if (!this.alive || t > this.liveUntil) return;

        const currentT = t - this.created;
        const targetT = this.liveUntil - this.created;
        ctx.globalAlpha = 1 - (currentT / targetT);
        this.sprite.draw(ctx, this.x, this.y);
        ctx.globalAlpha = 1;
    }
}

class SteamParticle extends Particle {
    sprite = shipSpriteSheet.sprites.steam_puff;

    direction = normalizeVector({
        x: (Math.random() * 2) - 1,
        y: (Math.random() * 2) - 1,
    });
}

class SprayParticle extends Particle {
    sprite = shipSpriteSheet.sprites.water_spray;
    forceVector = VECTOR_DOWN;
    speed = 10;

    direction = normalizeVector({
        x: -Math.random(),
        y: -1,
    });
}

let previousTick;
let tickTimer;

function tick() {
    const now = performance.now();
    const timeSinceLastTick = Math.min(now - previousTick, 1000);

    if (!state.paused) {
        let livingEntities = 0;
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            if (!entity.alive) continue;
            if (entity.updating) entity.tick(timeSinceLastTick, now);
            entities[livingEntities] = entity;
            livingEntities++;
        }
        
        entities.length = livingEntities;
        state.timeElapsed += timeSinceLastTick;
    }

    previousTick = now;
}

let firstFrame;
let previousFrame;

function render(now) {
    entities.sort((a, b) => a.zIndex - b.zIndex);

    for (let entity of entities) {
        if (entity.visible) entity.render(now);
    }

    previousFrame = now;
    requestAnimationFrame(render);
}

function bezier(t)
{
    return 1 - (t * t * (3.0 - 2.0 * t));
}

class TitleScreen extends Entity {
    zIndex = 1000;
    canClickWhilePaused = true;
    fadeStart = 0;
    fadeUntil = 0;

    checkClick(x, y) { return this; }

    onClick(x, y) {
        if (this.fadeStart) return;

        this.fadeStart = performance.now();
        this.fadeUntil = this.fadeStart + 500;
    }

    tick(deltaT, now) {
        if (!this.fadeStart || now < this.fadeUntil) return;

        this.alive = false;

        // Fade out title music, start main music
        var current_t = 0.0;
        var interval = 0.2;
        var fade_time = 3.0;
        var fadeAudio = setInterval(function () {
            if (sound.theme_song.volume > 0.0) {
                sound.theme_song.volume = bezier(current_t);
            }
            current_t += interval / fade_time;
            if (sound.theme_song.volume <= 0.0) {
                sound.theme_song.pause();
                clearInterval(fadeAudio);
                setTimeout(function () {sound.main_song.play();}, 1000)
            }
        }, interval * 1000);

        state.ship.updating = true;

        entities.push(new DebugDisplay());
        entities.push(
            new Button(0, '🪣', 1000, () => { sound.bucket.play() }, () => {
                for (const row of state.ship.modules) {
                    for (const module of row) {
                        if (module && module.constructor.name == 'HullModule') {
                            if (module.percentSubmerged < 1) {
                                module.floodAmount = Math.max(0, module.floodAmount-1);
                            }
                        }
                    }
                }
            }),
            new Button(1, '🧹', 1000, () => {state.speedBoost = 1; sound.row.play()}, () => {state.speedBoost = 0}),
            new Button(2, '🐛', 1, () => {
                state.debug = !state.debug;
            }),
        );
    }

    render(now) {
        ctx.save();

        if (this.fadeStart) {
            const fadeTime = Math.min(now, this.fadeUntil) - this.fadeStart;
            const fadeProgress = fadeTime / (this.fadeUntil - this.fadeStart);
            ctx.globalAlpha = 1 - fadeProgress;
        }

        const fontStack =  `'Book Antiqua', Palatino, 'Palatino Linotype', 'Palatino LT STD', Georgia, serif`;
        ctx.fillStyle = '#242738';
	    ctx.textAlign = "center";
        ctx.font = `87pt ${fontStack}`;
        let text = 'I Sink Not';
        let textMetrics = ctx.measureText(text);
        let yPosition = CANVAS_WIDTH / 5;
	    ctx.fillText(text, CANVAS_WIDTH / 2, yPosition);
        ctx.font = `24pt ${fontStack}`;

        yPosition += textMetrics.actualBoundingBoxAscent + 15;
        text = 'A Ludum Dare game by';
        textMetrics = ctx.measureText(text);
        ctx.fillText(text, CANVAS_WIDTH / 2, yPosition);
        
        yPosition += textMetrics.actualBoundingBoxAscent + 15;
        text = 'Dan Ellis, Matt Lee, and Neil Williams';
        ctx.fillText(text, CANVAS_WIDTH / 2, yPosition);
        
        yPosition += (textMetrics.actualBoundingBoxAscent + 15) * 3;
        ctx.fillText('Click anywhere to start', CANVAS_WIDTH / 2, yPosition);

        ctx.restore();
    }
}

class GameOverScreen extends Entity {
    zIndex = 1000;
    canClickWhilePaused = true;

    constructor(distanceTraveled, timeElapsed) {
        super();
        this.distanceTraveled = distanceTraveled;
        this.timeElapsed = timeElapsed;
    }

    tick() {
        currentWaterHeight += 5;
    }

    checkClick(x, y) { return this; }

    render() {
        ctx.fillStyle = 'black';
        ctx.fillText(`blub blub. you made it ${Math.floor(this.distanceTraveled)} meters and stayed afloat ${Math.floor(this.timeElapsed / 1000)} seconds`, 100, 100);
        ctx.fillText('click anywhere to try again', 100, 200);
    }

    onClick() {
        this.alive = false;
        currentWaterHeight = DEFAULT_WATER_HEIGHT;
        setUp(canvasEl);
    }
}

/**************/

export function setUp(canvasEl_) {
    canvasEl = canvasEl_;
    CANVAS_WIDTH = canvasEl.width;
    CANVAS_HEIGHT = canvasEl.height;

    const ship = new Ship();

    ship.updating = false;

    state = new State(ship);

    ctx = canvasEl.getContext('2d');

    entities.length = 0;

    entities.push(new GameController());
    entities.push(new TitleScreen());

    document.addEventListener('keydown', ev => {
        if (state.debug) {
            if (ev.code == 'Space') {
                state.paused = !state.paused;
            }
        }
    });

    ship.addModule(1, 0, HullModule);

    entities.push(new Water(10, 1, .1, 0));

    entities.push(ship);

    const foregroundWater = new Water(0, .9, .15, -150);
    foregroundWater.zIndex = 100;
    entities.push(foregroundWater);

    const now = performance.now();
    previousTick = now;
    tickTimer = setInterval(tick, 100);

    firstFrame = now;
    previousFrame = firstFrame;
    render(firstFrame);

    canvasEl.onclick = onClick;
    canvasEl.onmousemove = onMouseMove;
}

function tearDown(canvasEl) {
    clearInterval(tickTimer);
    canvasEl.onclick = null;
    canvasEl.onmousemove = null;
}

window._debug = {
    get state() { return state },
    entities,
}

export function pause() {
    state.paused = true;
}

export function play() {
    state.paused = false;
}
