import * as end from './end.js';
import * as sound from './sound.js';

import { spriteController, AnimatedSpriteController, images, islandSpriteSheet } from './art.js';

let canvasEl;
let ctx;
let CANVAS_WIDTH, CANVAS_HEIGHT;

const BUTTON_SIZE = 50;
const BUTTON_MARGIN = 20;

const DEFAULT_WATER_HEIGHT = 100;
let currentWaterHeight = DEFAULT_WATER_HEIGHT;

const FONT_STACK =  `'Book Antiqua', Palatino, 'Palatino Linotype', 'Palatino LT STD', Georgia, serif`;

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
const VECTOR_LEFT = { x: -1, y: 1 };

class Entity {
    constructor() {
        this.visible = true;
        this.updating = true;
        this.alive = true;
        this.zIndex = 0;
        this.canClickWhilePaused = false;
    }

    render(now) {}
    tick(timeSinceLastTick, now) {}
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
    constructor(ship) {
        this.debug = false;
        this.gameRunning = true;
        this.paused = false;
        this.paused_time = 0;
        this.shipDraught = 10;
        this.timeAfloat = 0;
        this.distanceTraveled = 0;
    
        // A higher-resolution version of distanceTraveled.  It won't match exactly though,
        // since it's for rendering the background.  It just has to look reasonably nice.
        this.bgDistanceTraveled = 0;
    
        this.speed = 0;
        this.cooldown = 0;
        this.currentCallback = null;
        this.timeElapsed = 0;
    
        this.hoveredEntity = null;
    
        this.currentMouseX = -1;
        this.currentMouseY = -1;
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

    get difficultyCoefficient() {
        // difficulty doubles for every:
        return Math.max(
            this.distanceTraveled / 1000 / 2,  // 2 kilometers, or
            this.timeElapsed / 1000 / 60 / 2,  // 2 minutes
        );
        // whichever is worse!
    }

    doPlayerAction(delay, callback) {
        this.cooldown = delay;
        this.currentCallback = callback;
        canvasEl.style.cursor = 'wait';
    }

    triggerSyntheticMouseMove() {
        onMouseMove(new MouseEvent('mousemove', {offsetX: this.currentMouseX, offsetY: this.currentMouseY}));
    }
}

let state;

function getWaterBob(offset = 0, magnitude = 5, interval = 250) {
    let now = state.paused ? state.paused_time : performance.now();
    const timeElapsed = now - firstFrame;
    return magnitude * Math.sin((timeElapsed + offset) / interval);
}

const isPointInBox = (x, y, box) => !(x < box.x || x > box.x + box.width || y < box.y || y > box.y + box.height);

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
                ev.stopPropagation();
                return;
            }
        }
    }
}

function onMouseMove(ev) {
    const x = ev.offsetX;
    const y = ev.offsetY;

    state.currentMouseX = x;
    state.currentMouseY = y;

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
    if (!state.paused) {
        const timeSinceLastFrame = Math.min(performance.now() - previousFrame, 1000);
        state.bgDistanceTraveled += timeSinceLastFrame * (state.speed / 1000);
    }
}

class GameController extends Entity {
    tick(timeSinceLastTick) {
        const timeElapsed = performance.now() - firstFrame;
        // lose condition
        if (state.shipHeight < state.shipDraught && state.gameRunning) {
            // TODO: if the top row of modules is all NullModule don't count it
            state.gameRunning = false;
            state.ship.updating = false;
            sound.play('gameover');
            entities.push(new GameOverScreen(state.timeElapsed));
        }

        if (!state.gameRunning) return;

        // TODO just move this logic into the ship entity
        if (!state.ship.updating) return;

        // handle cooldowns and actions
        state.cooldown = Math.max(0, state.cooldown - timeSinceLastTick);
        if (state.cooldown == 0 && state.currentCallback) {
            state.currentCallback();
            state.currentCallback = null;

            canvasEl.style.cursor = 'default';
            state.triggerSyntheticMouseMove();
        }

        const stats = state.ship.getStats();
        state.speed = stats.speed || 0;

        state.timeAfloat += timeSinceLastTick;
        state.distanceTraveled += timeSinceLastTick/100 * state.speed;
        state.shipDraught += timeSinceLastTick/100 * (stats.weight - (stats.buoyancy || 0));
    }

    render(now) {
        // world
        ctx.fillStyle = 'skyblue';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // bg parallax
        drawParallax(images.parallaxBgYellow, .01, 0, -200);
        drawParallax(images.parallaxBgOrange, .03, 0, -400);
        drawParallax(images.parallaxBgRed, .05, 0, -800);

        // TODO move into separate entity
        if (!state.ship.updating) return;
        if (!state.gameRunning) return;

        ctx.fillStyle = 'black';
        ctx.font = `32px ${FONT_STACK}`;
        ctx.textAlign = 'right';
        const textMargin = 10;
        
        
        
        // distance
        let verticalOffset = textMargin;
        const distanceIcon = spriteController.sprites.oar_icon;
        distanceIcon.draw(ctx, CANVAS_WIDTH - (distanceIcon.width/2 + textMargin), distanceIcon.height/2 + verticalOffset);
        const distanceText = `${Math.floor(state.distanceTraveled)}m`;
        const textMetrics = ctx.measureText(distanceText);
        ctx.fillText(distanceText, Math.floor(CANVAS_WIDTH - (distanceIcon.width + textMargin*2)) - textMargin, Math.floor(textMetrics.actualBoundingBoxAscent) + verticalOffset + 25);
        verticalOffset += distanceIcon.height + textMargin;
        
        // time
        const timeIcon = spriteController.sprites.watch_icon;
        timeIcon.draw(ctx, CANVAS_WIDTH - (timeIcon.width/2 + textMargin), timeIcon.height/2 + verticalOffset);
        const secondsAfloat = Math.floor(state.timeAfloat / 1000);
        const timeText = `${secondsAfloat}s`;
        const timeTextMetrics = ctx.measureText(timeText);
        ctx.fillText(timeText, Math.floor(CANVAS_WIDTH - (timeIcon.width + textMargin*2)), timeTextMetrics.actualBoundingBoxAscent + verticalOffset + 25);
        verticalOffset += timeIcon.height + textMargin;
        
        // modules
        const buildIcon = spriteController.sprites.hammer_icon;
        buildIcon.draw(ctx, CANVAS_WIDTH - (buildIcon.width/2 + textMargin), buildIcon.height/2 + verticalOffset);
        const buildText = state.ship.moduleCount;
        const buildTextMetrics = ctx.measureText(buildText);
        ctx.fillText(buildText, Math.floor(CANVAS_WIDTH - (buildIcon.width + textMargin*2)), buildTextMetrics.actualBoundingBoxAscent + verticalOffset + 35);


        // pause
        if (state.gameRunning && state.paused) {
            ctx.fillRect(15, 15, 10, 30);
            ctx.fillRect(35, 15, 10, 30);
        }

        ctx.textAlign = 'left';
    }
}

class Island extends Entity {
    constructor(sprite, startingPoint) {
        super();
        this.scale = 1.5;
        this.sprite = sprite;
        this.startingPoint = startingPoint;
    }
    
    render() {
        if (!this.alive) return;

        const { sprite, scale, startingPoint } = this;
        const xPos = CANVAS_WIDTH - ((state.bgDistanceTraveled - startingPoint) * 100 * .06);
        
        if (xPos <= 0 - sprite.width * scale) {
            this.alive = false;
        } else {
            sprite.draw(ctx, xPos, CANVAS_HEIGHT - currentWaterHeight - sprite.height + 20, sprite.width * scale, sprite.height * scale);
        }
    }
}

class IslandController extends Entity {
    constructor() {
        super();
        this.islands = islandSpriteSheet.getAllSprites();
        this.spawnInterval = 500;
        this.islandsSpawned = 0;
    }

    tick() {
        const intervals = Math.floor(state.distanceTraveled / this.spawnInterval);
        if (intervals > this.islandsSpawned) {
            this.islandsSpawned = intervals;
            const i = Math.floor(Math.random() * this.islands.length);
            entities.push(new Island(this.islands[i], state.bgDistanceTraveled));
        }
    }
}

const SHIP_MODULE_HEIGHT = 128;
const SHIP_MODULE_WIDTH = 128;

class ShipModule extends Entity {
    static canBuildAt(x, y) { return true; }

    get solid() {
        return this.constructor.solid;
    }

    
    constructor(ship, x, y) {
        super();
        this.sprite = null;
        this.icon = null;
        this.health = 10;
        this.ship = ship;
        // x and y here are coordinates in the ship's grid, not relative to canvas!
        this.x = x;
        this.y = y;
        this.damage = 0;

        this.damageLevel = 'normal';
        this.isBeingRepaired = false;
    }

    get weight() {
        return 5;
    }

    get fragility() {
        return 0;
    }

    get percentSubmerged() {
        return Math.max(0, Math.min(1, (state.shipDraught - (this.y * SHIP_MODULE_HEIGHT)) / SHIP_MODULE_HEIGHT));
    }

    get globalX() {
        return this.ship.box.x + (this.x * SHIP_MODULE_WIDTH);
    }

    get globalY() {
        return this.ship.box.y + (this.y * -SHIP_MODULE_HEIGHT);
    }

    getStats() {
        return {};
    }

    updateDisplay() {}

    onDamage() {}
    onBreak() {}
    onStartFix() {
        sound.play('repairing');
    }
    onFixed() {}

    tick(timeSinceLastTick) {
        this.icon = null;

        if (this.percentSubmerged > 0 && Math.random() < (timeSinceLastTick * state.speed / 1000)) {
            const spriteX = this.globalX + (Math.random() * SHIP_MODULE_WIDTH);
            const spriteY = CANVAS_HEIGHT - currentWaterHeight + getWaterBob();
            emitParticle(SprayParticle, 600, spriteX, spriteY);
        }

        if (this.fragility != 0) {
            if (Math.random() < timeSinceLastTick * .0005) {
                const boost = this.fragility * state.difficultyCoefficient * (timeSinceLastTick/25) * Math.random();
                this.damage = Math.min(this.health, this.damage + boost);
            }
            
            if (this.damageLevel != 'broken' && this.damage == this.health) {
                this.damageLevel = 'broken';
                this.onBreak();
            } else if (this.damageLevel == 'normal' && this.damage > this.health/2) {
                this.damageLevel = 'damaged';
                this.onDamage();
            } else if (this.damageLevel != 'normal' && this.damage == 0) {
                this.damageLevel = 'normal';
                this.onFixed();
            }
        }

        if (this.damageLevel === 'broken' && isEntityInteractive(this) && this.percentSubmerged < 1) {
            this.icon = spriteController.sprites.hammer_icon;
        }
    }

    onMouseOver() {
        if (this.damageLevel != 'normal') {
            canvasEl.style.cursor = 'pointer'; // TODO: wrench
        }
    }

    onMouseOut() {
        canvasEl.style.cursor = 'default';
    }

    onClick(x, y) {
        if (this.damageLevel != 'normal') {
            this.onStartFix();
            this.isBeingRepaired = true;
            state.doPlayerAction(1000, () => {
                this.damage = 0;
                this.isBeingRepaired = false;
                this.onFixed();
            });
        }
    }

    render() {
        const sprite = this.sprite || this.constructor.sprite;
        if (sprite) {
            sprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
        }
    }
}
ShipModule.solid = true;

class HullModule extends ShipModule { 
    constructor(ship, x, y) {
        super(ship, x, y);
        this.sprite = HullModule.sprite;
        this.defaultSprite = spriteController.sprites.hull;
        this.bustedSprite = spriteController.sprites.busted_hull;
        this.topHullSprite = spriteController.sprites.top_hull;
        this.sideHullSprite = spriteController.sprites.side_hull;
        this.renderTopHull = false;
        this.renderLeftHull = false;
        this.floodAmount = 0;
        this.buoyancy = 20;
        this.updateDisplay();
    }

    static canBuildAt(modX, modY) {        
        const moduleBelow = state.ship.getModule(modX, modY - 1);
        if (moduleBelow && moduleBelow.solid) return true;
        
        const left = state.ship.getModule(modX - 1, modY, HullModule);
        if (left && left.solid) return true;

        const right = state.ship.getModule(modX + 1, modY, HullModule);
        if (right && right.solid) return true;

        return false;
    }

    get fragility() {
        for (let i = -1; i < 2; i++) {
            for (let j = -1; j < 2; j++) {
                if (j == 0 || i == 0) { // don't count diagonals
                    if (i == 0 && j == 0) continue; // don't count self
                    const adjacentModule = this.ship.getModule(this.x + i, this.y + j);
                    if (adjacentModule && adjacentModule.constructor.name == 'CastleModule') {
                        return .5;
                    }
                }
            }
        }

        return 1;
    }

    tick(timeSinceLastTick, now) {
        if (!this.percentSubmerged > 0)
            return;

        super.tick(timeSinceLastTick, now);

        if (this.damageLevel == 'broken') {
            this.floodAmount = Math.min(this.buoyancy, this.floodAmount + timeSinceLastTick/1000 * 3);
        }
    }

    onDamage() {
        sound.play('breaking');
    }

    onFixed() {
        this.floodAmount = 0;
    }

    getStats() {
        const percentSubmerged = this.percentSubmerged;
        return {
            'buoyancy': percentSubmerged > 0 ? this.buoyancy * percentSubmerged - this.floodAmount: 0,
        }
    }

    render() {
        this.sprite = this.damageLevel != 'normal' ? this.bustedSprite : this.defaultSprite;
        super.render();

        if (this.renderTopHull) {
            if (this.topHullSprite) {
                this.topHullSprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
            }
        }
        
        // don't show indicator overlays during game over screen
        if (!this.ship.updating || !state.gameRunning) return;
        
        if (this.floodAmount > 0) {
            ctx.fillStyle = 'rgba(0, 0, 255, .5)';
            const percentFlooded = this.floodAmount / this.buoyancy;
            ctx.fillRect(0, Math.ceil(-SHIP_MODULE_HEIGHT * percentFlooded), SHIP_MODULE_WIDTH, Math.ceil(SHIP_MODULE_HEIGHT * percentFlooded));
        }
    }
    
    renderLate() {
        if (this.renderLeftHull) {
            if (this.sideHullSprite) {
                this.sideHullSprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
            }
        }
    }

    updateDisplay() {
        const moduleAbove = this.ship.getModule(this.x, this.y + 1);
        this.renderTopHull = moduleAbove && moduleAbove.solid;
        this.renderLeftHull = !!this.ship.getModule(this.x - 1, this.y, HullModule);
    }
}
HullModule.sprite = spriteController.sprites.hull;
HullModule.moduleName = 'Hull';
HullModule.description = 'Makes you float';

class NullModule extends ShipModule {
    constructor(ship, x, y) {
        super(ship, x, y);
        this.showOutline = false;
        this.showBackground = false;
        this.buildOptions = [];
        this.updateDisplay();
    }

    get weight() {
        return 0;
    }

    updateDisplay() {
        this.buildOptions.length = 0;
        for (const moduleType of moduleTypes) {
            if (this.ship.canBuildModule(this.x, this.y, moduleType)) {
                this.buildOptions.push(moduleType);
            }
        }
        this.showBackground = this.buildOptions.length > 0;
    }

    onMouseOver() {
        if (this.buildOptions.length > 0) {
            canvasEl.style.cursor = 'pointer';
            this.showOutline = true;
        }
    }

    onMouseOut() {
        canvasEl.style.cursor = 'default';
        this.showOutline = false;
    }

    onClick(x, y) {
        if (this.buildOptions.length == 0) {
            return;
        }

        sound.play('confirm');
        const menuEl = document.createElement('div');

        const headerEl = document.createElement('h1');
        headerEl.textContent = 'Construct a module';
        menuEl.appendChild(headerEl);

        menuEl.id = 'module-menu';

        const clickHandler = (ev) => {
            if (ev.target.moduleType) {
                sound.play('building');
                this.ship.addModule(this.x, this.y, ConstructionModule);

                state.doPlayerAction(1000, () => {
                    this.ship.addModule(this.x, this.y, ev.target.moduleType);
                });
            } else {
                sound.play('cancel');
            }

            menuEl.remove();
            document.body.removeEventListener('click', clickHandler);
            state.paused = false;
        };
        document.body.addEventListener('click', clickHandler);

        for (const moduleType of this.buildOptions) {
            const moduleEl = document.createElement('button');
            const sprite = moduleType.sprite;
            moduleEl.moduleType = moduleType;
 
            if (sprite) {
                const div = document.createElement('div');
                div.classList.add('icon');
                div.style.background = `url(${sprite.spriteSheet.src}) no-repeat -${sprite.x}px -${sprite.y}px`;
                div.style.width = sprite.width + 'px';
                div.style.height = sprite.height + 'px';

                moduleEl.innerHTML = `<p class="description"><b>${moduleType.moduleName}</b><br>${moduleType.description}</p>`;

                moduleEl.appendChild(div);
            } else {
                moduleEl.textContent = moduleType.name;
            }

            menuEl.appendChild(moduleEl);
        }

        const cancelEl = document.createElement('button');
        cancelEl.id = 'cancel';
        cancelEl.innerHTML = '<p class="description">Cancel</p>';
        menuEl.appendChild(cancelEl);

        state.paused = true;
        state.paused_time = performance.now();
        document.body.appendChild(menuEl);
    }

    render() {
        if (!state.ship.updating) return;
        if (!this.showBackground) return;

        super.render();

        if (state.cooldown == 0 && this.showOutline) {
            if (this.showOutline) {
                NullModule.outlineSprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
            }
        }

        if (state.debug) {
            ctx.strokeStyle = 'white';
            ctx.strokeRect(0, -SHIP_MODULE_HEIGHT, SHIP_MODULE_HEIGHT, SHIP_MODULE_WIDTH);
        }
    }

    tick() {}
}
NullModule.sprite = spriteController.sprites.square_bg;
NullModule.outlineSprite = spriteController.sprites.square_outline;
NullModule.solid = false;

class ConstructionModule extends ShipModule {
    tick() {
        if (Math.random() < .3) {
            const p = emitParticle(BitParticle, 700, this.globalX + Math.random() * SHIP_MODULE_WIDTH, this.globalY - (Math.random() * SHIP_MODULE_HEIGHT/2));
            p.sprite = ConstructionModule.BITS[Math.floor(Math.random() * ConstructionModule.BITS.length)];
        }
    }
}
ConstructionModule.sprite = spriteController.sprites.scaffolding;
ConstructionModule.solid = false;
ConstructionModule.BITS = [
    spriteController.sprites.bit_screw,
    spriteController.sprites.bit_wood,
    spriteController.sprites.bit_plate,
];

class SailModule extends ShipModule {
    get weight() {
        return 1.5;
    }

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
SailModule.sprite = spriteController.sprites.sail;
SailModule.moduleName = 'Sail';
SailModule.description = 'Makes you go';
SailModule.solid = false;

class BoilerModule extends ShipModule {
    constructor(ship, x, y) {
        super(ship, x, y);
        this.hasSmokeStack = null;
    }

    get weight() {
        return 10;
    }

    get fragility() {
        return this.hasSmokeStack ? .5 : 1;
    }

    static canBuildAt(modX, modY) { 
        const moduleBelow = state.ship.getModule(modX, modY - 1);
        return moduleBelow && moduleBelow.solid;
    }

    get emissionsClass() {
        return this.damageLevel == 'normal' ? BoilerSteamParticle : BoilerSmokeParticle;
    }
        
    tick(timeSinceLastTick, now) {
        if (this.percentSubmerged >= 1) {
            return;
        }

        super.tick(timeSinceLastTick, now);
        
        if (this.hasSmokeStack === null) {
            const moduleAbove = state.ship.getModule(this.x, this.y + 1);
            const moduleAboveType = moduleAbove && moduleAbove.constructor.name;
            if (moduleAboveType != 'NullModule' && moduleAboveType != 'ConstructionModule') {
                this.hasSmokeStack = moduleAbove.constructor.name == 'SmokeStackModule';
            }
        }

        if (this.isGeneratingSteam && !this.hasSmokeStack && Math.random() < timeSinceLastTick / 200) {
            emitParticle(this.emissionsClass, 1000, this.globalX + 30, this.globalY - (SHIP_MODULE_HEIGHT));
        }
    }

    onBreak() {
        sound.play('boiler-break');
    }

    get isGeneratingSteam() {
        if (this.percentSubmerged > .5)
            return false;

        return this.damageLevel != 'broken';
    }

    render() {
        super.render();

        // TODO: show damaged state
        if (this.isGeneratingSteam) {
            let bob = getWaterBob(0, 0.5, 32);
            BoilerModule.sprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT + bob);
            BoilerModule.windowSprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT + bob);
        }
    }
}
BoilerModule.sprite = spriteController.sprites.boiler;
BoilerModule.windowSprite = spriteController.sprites.boiler_lit_window;
BoilerModule.moduleName = 'Boiler';
BoilerModule.description = 'Provides steam for propellors and balloons';

class PropellerModule extends ShipModule {
    constructor(ship, x, y) {
        super(ship, x, y);
        this.blurSprite = new AnimatedSpriteController(PropellerModule.blurSprites, performance.now());
    }

    get weight() {
        return 2;
    }

    static canBuildAt(modX, modY) {
        const moduleLeft = state.ship.getModule(modX - 1, modY);
        return moduleLeft && moduleLeft.constructor.name == 'BoilerModule';
    }

    get isSpinning() {
        const boilerModule = state.ship.getModule(this.x - 1, this.y);
        return boilerModule && boilerModule.isGeneratingSteam;
    }

    getStats() {
        return {
            speed: this.isSpinning ? 5 : 0,
        }
    }

    render() {
        super.render();
        if (this.isSpinning) {
            this.blurSprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
        }
    }

    tick(timeSinceLastTick) {
        if (this.isSpinning && Math.random() < timeSinceLastTick / 200) {
            emitParticle(WindParticle, 1000, this.globalX - 80, this.globalY - (SHIP_MODULE_HEIGHT * 1.5 * Math.random()) - 30);
        }
    }
}
PropellerModule.sprite = spriteController.sprites.propeller;
PropellerModule.moduleName = 'Propellor';
PropellerModule.description = 'Makes you go <i>fast</i>. Must be attached to a functioning boiler';
PropellerModule.solid = false;

PropellerModule.blurSprites = [
    spriteController.sprites.propeller_blur_1,
    spriteController.sprites.propeller_blur_2,
];

class BalloonModule extends ShipModule {
    get isInflated() {
        const moduleBelow = this.ship.getModule(this.x, this.y - 1);
        return moduleBelow.isGeneratingSteam;
    }

    get weight() {
        return this.isInflated ? -10 : 1;
    }

    static canBuildAt(modX, modY) {
        const moduleBelow = state.ship.getModule(modX, modY - 1);
        return moduleBelow && moduleBelow.constructor.name == 'BoilerModule';
    }

    render() {
        BalloonModule.baseSprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT);
    }
    
    renderLate() {
        const inflationOffset = this.isInflated ? getWaterBob(0, 3, 400) : 48;
        BalloonModule.sprite.draw(ctx, 0, -SHIP_MODULE_HEIGHT + inflationOffset);
    }
}
BalloonModule.sprite = spriteController.sprites.balloon_top;
BalloonModule.baseSprite = spriteController.sprites.balloon_base;
BalloonModule.moduleName = 'Balloon';
BalloonModule.description = 'Makes you go <i>up</i>. Must be attached to a functioning boiler'
BalloonModule.solid = false;

class FinSailModule extends ShipModule {
    get weight() {
        return 2.5;
    }

    static canBuildAt(modX, modY) {
        const moduleRight = state.ship.getModule(modX + 1, modY);
        return moduleRight && moduleRight.solid && moduleRight.constructor !== SupportModule;
    }

    getStats() {
        return {
            speed: this.percentSubmerged < .5 ? .5 : 0,
        }
    }
}
FinSailModule.sprite = spriteController.sprites.fin_sail;
FinSailModule.solid = false;
FinSailModule.moduleName = 'Fin sail';
FinSailModule.description = 'Makes you go';

class CastleModule extends ShipModule {
    get weight() { return 20; }

    static canBuildAt(modX, modY) {
        const mod = state.ship.getModule(modX, modY - 1);
        return mod && mod.solid;
    }
}
CastleModule.sprite = spriteController.sprites.castle;
CastleModule.moduleName = 'Castle';
CastleModule.description = 'Reinforces adjacent hulls (and looks really cool)';

class SmokeStackModule extends ShipModule {    
    static canBuildAt(modX, modY) {
        const mod = state.ship.getModule(modX, modY - 1, BoilerModule);
        return mod && mod.solid;
    }
    
    constructor(ship, x, y) {
        super(ship, x, y);
        this.boiler = ship.getModule(x, y-1);
    }

    get weight() { return 8; }

    tick(timeSinceLastTick) {
        super.tick();

        if (this.boiler && this.boiler.isGeneratingSteam && Math.random() < timeSinceLastTick / 200) {
            emitParticle(this.boiler.emissionsClass, 1000, this.globalX + 30, this.globalY - (SHIP_MODULE_HEIGHT * 2));
        }
    }
}
SmokeStackModule.sprite = spriteController.sprites.smoke_stack;
SmokeStackModule.moduleName = 'Smoke Stack';
SmokeStackModule.description = 'Makes boilers more resilient';
SmokeStackModule.solid = false;

class SupportModule extends ShipModule {
    static canBuildAt(modX, modY) {
        const left = state.ship.getModule(modX - 1, modY);
        if (left && left.solid && left.constructor !== SupportModule) return true;
        const right = state.ship.getModule(modX + 1, modY);
        return right && right.solid && right.constructor !== SupportModule;
    }

    constructor(ship, x, y) {
        super(ship, x, y);
        const leftMod = ship.getModule(x - 1, y);
        this.isRightSupport = leftMod && leftMod.solid;
        this.sprite = this.isRightSupport ? SupportModule.sprite : SupportModule.leftSprite;
    }

    get weight() { return 1; }
}
SupportModule.sprite = spriteController.sprites.support_right;
SupportModule.leftSprite = spriteController.sprites.support_left;
SupportModule.moduleName = 'Structural Support';
SupportModule.description = 'Allows constructing even more ship modules!';
SupportModule.solid = true;

const moduleTypes = [HullModule, SailModule, BoilerModule, PropellerModule, FinSailModule, BalloonModule, CastleModule, SmokeStackModule, SupportModule];

class Ship extends Entity {
    constructor() {
        super();
        this.columns = 5;
        this.rows = 1;
        this.zIndex = 10;
        this.modules = [];
        const ship = this;
        this.box = {
            // position is anchored to the bottom left corner of the ship
            x: SHIP_MODULE_WIDTH / 2,
            get y() { return CANVAS_HEIGHT - currentWaterHeight + state.shipDraught },
            get width() { return ship.columns * SHIP_MODULE_WIDTH },
            get height() { return ship.modules.length * SHIP_MODULE_HEIGHT },
        }
    }

    tick(timeSinceLastTick, now) {
        for (const [modY, row] of this.modules.entries()) {
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
            for (let x = 0; x < this.columns; x++) {
                const translateX = box.x + (x * SHIP_MODULE_WIDTH);
                const translateY = box.y + (y * -SHIP_MODULE_HEIGHT);

                ctx.translate(translateX, translateY);
                
                const module = row ? row[x] : null;
                if (module) {
                    module.render(now);
                }
                if (state.debug) {
                    ctx.font = `24pt ${FONT_STACK}`;
                    ctx.fillStyle = 'white';
                    ctx.fillText(`${module.damage.toFixed(2)}`, 0, -SHIP_MODULE_HEIGHT);
                }
                ctx.translate(-translateX, -translateY);
            }
        }

        y = this.rows;
        while (y-->0) {
            const row = this.modules[y];
            if (!row) continue;
            for (let x = 0; x < this.columns; x++) {
                const shipModule = row[x];
                if (!shipModule || !shipModule.renderLate) continue;

                const { globalX, globalY } = shipModule;
                ctx.translate(globalX, globalY);
                
                shipModule.renderLate();
                ctx.translate(-globalX, -globalY);
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

    canBuildModule(x, y, ModuleClass) {
        if (ModuleClass.solid && (x === 0 || x === this.columns - 1)) {
            return false;
        }
        const res =  ModuleClass.canBuildAt(x, y);
        return res;
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

        const newModule = new ModuleClass(this, x, y);
        this.modules[y][x] = newModule;

        this.updateModule(x - 1, y);
        this.updateModule(x + 1, y);
        this.updateModule(x, y - 1);
        this.updateModule(x, y + 1);

        const { globalX, globalY } = newModule;
        for (let i = 0; i < 5; i++) {   
            emitParticle(SteamParticle, 1000, newModule.globalX + (i/5 * SHIP_MODULE_WIDTH), newModule.globalY);
        }
    }

    updateModule(x, y) {
        const module = this.getModule(x, y);
        if (module) module.updateDisplay();
    }

    get moduleCount() {
        let moduleCount = 0;
        for (const row of this.modules) {
            for (const module of row) {
                if (module.constructor.name != 'NullModule') {
                    moduleCount += 1;
                }
            }
        }
        return moduleCount;
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
        this.zIndex = 1;
        this.height = height;
        this.alpha = alpha;
        this.parallaxSpeed = parallaxSpeed;
        this.x_offset = x_offset;
    }

    render(now) {
        ctx.globalAlpha = this.alpha;
        const yPosition = CANVAS_HEIGHT - this.height - 75 - currentWaterHeight + getWaterBob();
        drawParallax(images.wavesImg, this.parallaxSpeed, this.x_offset, yPosition);
        const imgHeight = images.wavesImg.height;
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
        this.stateKeys.push('difficultyCoefficient');
    }
    render() {
        if (!state.debug) return;
        ctx.fillStyle = 'black';
        ctx.font = '24px sans-serif';

        let offsetY = 275;
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

class ShipUI extends Entity {
    constructor(ship) {
        super();
        this.zIndex = 200;
        this.ship = ship;
    }

    render() {
        if (!this.ship.updating || !state.gameRunning) return;

        for (let y = 0; y < this.ship.rows; y++) {
            for (let x = 0; x < this.ship.columns; x++) {
                const shipModule = this.ship.getModule(x, y);
                if (shipModule && shipModule.icon) {
                    const spriteX = shipModule.globalX + (SHIP_MODULE_WIDTH / 2);
                    const spriteY = shipModule.globalY - (SHIP_MODULE_HEIGHT / 2)
                    spriteController.sprites.icon_bg.draw(ctx, spriteX, spriteY);
                    shipModule.icon.draw(ctx, spriteX, spriteY);
                }
            }
        }
    }
}

function emitParticle(ParticleClass, life, x, y) {
    const p = new ParticleClass(performance.now() + life, x, y);
    entities.push(p);
    return p;
}

class Particle extends Entity {
    constructor(liveUntil, x, y) {
        super();
        this.speed = 3;
        this.forceVector = scaleVector(cloneVector(VECTOR_UP), .5);
        this.direction = cloneVector(VECTOR_UP);
        this.sprite = null;
        this.zIndex = 20;
        this.fade = 1;
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

        if (this.forceVector) {
            this.direction = normalizeVector(
                addVectors(
                    this.direction,
                    this.forceVector,
                ),
            );
        }
    }

    render(t) {
        if (!this.sprite) return;
        if (!this.alive || t > this.liveUntil) return;

        const currentT = t - this.created;
        const targetT = this.liveUntil - this.created;
        ctx.globalAlpha = 1 - ((currentT / targetT) * this.fade);
        this.sprite.draw(ctx, this.x, this.y);
        ctx.globalAlpha = 1;
    }
}


class BitParticle extends Particle {
    constructor(liveUntil, x, y) {
        super(liveUntil, x, y);
        this.forceVector = scaleVector(cloneVector(VECTOR_DOWN), .5);
        this.direction = normalizeVector({
            x: (Math.random() * 2) - 1,
            y: -1,
        });
        this.speed = 5;
        this.fade = 0;
    }
}

class SteamParticle extends Particle {
    constructor(liveUntil, x, y) {
        super(liveUntil, x, y);
        this.sprite = spriteController.sprites.steam_puff;
        this.direction = normalizeVector({
            x: (Math.random() * 2) - 1,
            y: (Math.random() * 2) - 1,
        });
    }

    tick(deltaT, t) {
        super.tick(deltaT, t);
        this.x -= state.speed;
    }
}

class BoilerSteamParticle extends SteamParticle {
    constructor(liveUntil, x, y) {
        super(liveUntil, x, y);
        this.direction = normalizeVector({
            x: (Math.random() * 2) - 1,
            y: -1,
        });
    }
}

class BoilerSmokeParticle extends BoilerSteamParticle {
    constructor(liveUntil, x, y) {
        super(liveUntil, x, y);
        this.sprite = spriteController.sprites.smoke_puff;
    }
}

class SprayParticle extends Particle {
    constructor(liveUntil, x, y) {
        super(liveUntil, x, y);
        this.sprite = spriteController.sprites.water_spray;
        this.forceVector = VECTOR_DOWN;
        this.speed = 5;
        this.direction = normalizeVector({
            x: -Math.random(),
            y: -1,
        });
    }
}

class WindParticle extends Particle {
    constructor(liveUntil, x, y) {
        super(liveUntil, x, y);
        this.sprite = new AnimatedSpriteController(WindParticle.sprites, performance.now());

        this.forceVector = null;
        this.direction = cloneVector(VECTOR_LEFT);
        this.speed = 1;
    }

    tick(deltaT, t) {
        super.tick(deltaT, t);
        this.x -= state.speed;
    }
}
WindParticle.sprites = [
    spriteController.sprites.wind_1,
    spriteController.sprites.wind_2,
    spriteController.sprites.wind_3,
    spriteController.sprites.wind_4,
];

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
    constructor() {
        super();
        this.zIndex = 1000;
        this.canClickWhilePaused = true;
        this.fadeStart = 0;
        this.fadeUntil = 0;
    }

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
    }

    render(now) {
        ctx.save();

        if (this.fadeStart) {
            const fadeTime = Math.min(now, this.fadeUntil) - this.fadeStart;
            const fadeProgress = fadeTime / (this.fadeUntil - this.fadeStart);
            ctx.globalAlpha = 1 - fadeProgress;
        }

        ctx.fillStyle = '#242738';
	    ctx.textAlign = "center";
        ctx.font = `87pt ${FONT_STACK}`;
        let text = 'I Sink Not';
        let textMetrics = ctx.measureText(text);
        let yPosition = CANVAS_WIDTH / 5;
	    ctx.fillText(text, CANVAS_WIDTH / 2, yPosition);
        ctx.font = `24pt ${FONT_STACK}`;

        yPosition += textMetrics.actualBoundingBoxAscent + 15;
        text = 'A game for Ludum Dare 50 by';
        textMetrics = ctx.measureText(text);
        ctx.fillText(text, CANVAS_WIDTH / 2, yPosition);
        
        yPosition += textMetrics.actualBoundingBoxAscent + 15;
        text = 'Dan Ellis, Matt Lee, and Neil Williams';
        ctx.fillText(text, CANVAS_WIDTH / 2, yPosition);
        
        yPosition += textMetrics.actualBoundingBoxAscent + 15;
        ctx.font = `italic 24pt ${FONT_STACK}`;
        text = '“Delay the inevitable”';
        ctx.fillText(text, CANVAS_WIDTH / 2, yPosition);

        yPosition += (textMetrics.actualBoundingBoxAscent + 15) * 2;
        ctx.font = `24pt ${FONT_STACK}`;
        ctx.fillText('Click anywhere to start', CANVAS_WIDTH / 2, yPosition);

        ctx.restore();
    }
}

class Fish extends Entity {
    constructor() {
        super();
        this.zIndex = 2000;

        this.depth = CANVAS_HEIGHT + currentWaterHeight + Fish.sprite.height;

        const direction = Math.random() < .5 ? -1 : 1; 
        this.speed = direction * (2 * Math.random() + 2);
        this.x = direction < 0 ? CANVAS_WIDTH + Fish.sprite.width : -Fish.sprite.width;
    }

    tick(deltaT) {
        if (this.depth - currentWaterHeight < Fish.sprite.height) {
            this.alive = false;
        } else if (this.x < -Fish.sprite.width || this.x > CANVAS_WIDTH + Fish.sprite.width) {
            this.alive = false;
        }
    }

    render(now) {
        const deltaT = now - previousFrame;
        this.x += this.speed * deltaT/100;

        if (this.speed > 0) {
            ctx.save();
            ctx.scale(-1, 1);
            Fish.sprite.draw(ctx, -this.x, this.depth - currentWaterHeight);
            ctx.restore();
        } else {
            Fish.sprite.draw(ctx, this.x, this.depth - currentWaterHeight);
        }
    }
}
Fish.sprite = spriteController.sprites.bit_fish;

class Bubble extends Entity {
    constructor() {
        super();
        
        this.zIndex = 2000;
        this.depth = CANVAS_HEIGHT + currentWaterHeight + Bubble.sprite.height;
        this.x = Math.random() * CANVAS_WIDTH;
    }

    tick(deltaT) {
        if (this.depth - currentWaterHeight < Bubble.sprite.height) {
            this.alive = false;
        }
    }

    render(now) {
        const deltaT = now - previousFrame;
        this.depth -= deltaT/10;

        Bubble.sprite.draw(ctx, this.x, this.depth - currentWaterHeight);
    }
}
Bubble.sprite = spriteController.sprites.bit_bubble;

class GameOverScreen extends Entity {
    constructor(timeElapsed) {
        super();
        this.zIndex = 1000;
        this.canClickWhilePaused = true;
        this.timeElapsed = timeElapsed;
        this.fishCountdown = 2 * 1000;
        this.bubbleCountdown = 3 * 1000;
        state.cooldown = 0;
    }

    checkClick(x, y) { return this; }

    tick(deltaT, now) {
        this.fishCountdown -= deltaT;
        if (this.fishCountdown < 0) {
            entities.push(new Fish());
            this.fishCountdown = Math.random() * 1000 * 2;
        }

        this.bubbleCountdown -= deltaT;
        if (this.bubbleCountdown < 0) {
            entities.push(new Bubble());
            this.bubbleCountdown = Math.random() * 1000 * 2;
        }
    }

    render(now) {
        const timeSinceLastFrame = now - previousFrame;
        currentWaterHeight += timeSinceLastFrame / 10;

        ctx.font = `36pt ${FONT_STACK}`;
        ctx.fillStyle = '#242738';
        ctx.textAlign = 'left';

        let yPos = 100;
        const margin = 10;

        const titleText = 'It was bound to happen'
        const titleMetrics = ctx.measureText(titleText);
        const leftEdge = CANVAS_WIDTH - titleMetrics.width - 25;
        ctx.fillText(titleText, leftEdge, yPos);
        yPos += titleMetrics.actualBoundingBoxAscent + margin;
        ctx.font = `24pt ${FONT_STACK}`;

        yPos += margin * 4;

        const timeText = `Time: ${Math.floor(this.timeElapsed / 1000)}s`;
        const timeMetrics = ctx.measureText(timeText);
        ctx.fillText(timeText, leftEdge, yPos);
        yPos += timeMetrics.actualBoundingBoxAscent + margin;

        const distanceText = `Distance: ${Math.floor(state.distanceTraveled)}m`;
        const distanceMetrics = ctx.measureText(distanceText);
        ctx.fillText(distanceText, leftEdge, yPos);
        yPos += distanceMetrics.actualBoundingBoxAscent + margin;

        const modulesText = `Modules: ${state.ship.moduleCount}`;
        const modulesMetrics = ctx.measureText(modulesText);
        ctx.fillText(modulesText, leftEdge, yPos);
        yPos += modulesMetrics.actualBoundingBoxAscent + margin;

        yPos += margin * 4;

        ctx.fillText('Click anywhere to try again', leftEdge, yPos);
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
        if (ev.code == 'Space' || ev.code == 'KeyP') {
            state.paused = !state.paused;
        } else if (ev.code == 'KeyD') {
            state.debug = !state.debug;
        }
    });

    ship.addModule(2, 0, HullModule);

    entities.push(new IslandController());
    entities.push(new Water(10, 1, .1, 0));

    entities.push(ship);
    entities.push(new ShipUI(ship));

    const foregroundWater = new Water(0, .5, .15, -150);
    foregroundWater.zIndex = 100;
    entities.push(foregroundWater);

    const now = performance.now();
    previousTick = now;
    tickTimer = setInterval(tick, 33);

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
