function loadImage(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.addEventListener('load', () => {
            resolve(img);
        });
        img.src = url;
    });
}

class Sprite {
    constructor(spriteSheet, name, x, y, width, height, anchorX, anchorY) {
        this.spriteSheet = spriteSheet;
        this.name = name;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.anchorX = anchorX;
        this.anchorY = anchorY;
    }

    draw(ctx, x, y, width, height) {
        if (!this.spriteSheet.img) return;
        ctx.drawImage(
            this.spriteSheet.img,
            // source (spritesheet) location
            this.x,
            this.y,
            this.width,
            this.height,
            // destination (canvas) location
            x - this.anchorX,
            y - this.anchorY,
            width || this.width,
            height || this.height,
        );
    }
}

class SpriteSheet {
    constructor(src) {
        this.src = src;
        this.sprites = {};
        loadImage(src).then(img => this.img = img);
    }

    createSprite(name, x, y, width, height, anchorX = 0, anchorY = 0) {
        const sprite = new Sprite(this, name, x, y, width, height, anchorX, anchorY);
        this.sprites[name] = sprite;
        return sprite;
    }

    getAllSprites() {
        return Object.values(this.sprites);
    }
}

export class AnimatedSpriteController {
    constructor(sprites, createdAt, playbackSpeed = 125) {
        this.sprites = sprites;
        this.createdAt = createdAt;
        this.playbackSpeed = playbackSpeed;
    }
    
    draw(ctx, x, y, width, height) {
        const totalTime = performance.now() - this.createdAt;
        const frames = this.sprites.length;
        const frameNumber = Math.floor(totalTime/ this.playbackSpeed);
        const i = frameNumber % frames;
        this.sprites[i].draw(ctx, x, y, width, height);
    }
}

class SpriteController {
    constructor(spriteSheets) {
        this.spriteSheets = spriteSheets;

        // defining out of the object constructor below so this is bound correctly;
        const get = (obj, prop) => {
            for (let spriteSheet of this.spriteSheets) {
                if (prop in spriteSheet.sprites) return spriteSheet.sprites[prop];
            }
        }

        this.sprites = new Proxy({}, { get });
    }
}

const shipSpriteSheet = new SpriteSheet('art/ship-spritesheet.png');

// currently getting these numbers semi-manually by uploading the spritesheet to http://www.spritecow.com/
// shipSpriteSheet.createSprite('hull', 42, 824, 184, 146, 28, 8);
// shipSpriteSheet.createSprite('top_hull', 34, 628, 185, 116, 28, 15);
// shipSpriteSheet.createSprite('side_hull', 304, 872, 98, 94, 98, -44);
shipSpriteSheet.createSprite('busted_hull', 233, 629, 184, 146, 28, 8);
shipSpriteSheet.createSprite('scaffolding', 430, 852, 165, 112, 20, -20);
shipSpriteSheet.createSprite('propeller', 67, 63, 79, 199, 10, 66);
shipSpriteSheet.createSprite('sail', 173, 43, 145, 225, -16, 98);
shipSpriteSheet.createSprite('steam_puff', 513, 59, 64, 71, 32, 35);
shipSpriteSheet.createSprite('smoke_puff', 415, 302, 64, 71, 32, 35);
shipSpriteSheet.createSprite('water_spray', 500, 203, 94, 143, 47, 72);
shipSpriteSheet.createSprite('boiler', 37, 443, 176, 136, 30, 6);
shipSpriteSheet.createSprite('boiler_lit_window', 235, 545, 52, 56, -8, -52);
shipSpriteSheet.createSprite('smoke_stack', 613, 26, 144, 262, 10, 120);
shipSpriteSheet.createSprite('fin_sail', 240, 315, 151, 215, 20, 70);
shipSpriteSheet.createSprite('bucket_icon', 507, 375, 76, 76, 38, 38);
shipSpriteSheet.createSprite('hammer_icon', 502, 504, 80, 86, 40, 43);
shipSpriteSheet.createSprite('watch_icon', 408, 517, 85, 64, 42, 32);
shipSpriteSheet.createSprite('oar_icon', 505, 632, 75, 79, 37, 39);
shipSpriteSheet.createSprite('wind_1', 630, 315, 139, 30);
shipSpriteSheet.createSprite('wind_2', 633, 361, 134, 33);
shipSpriteSheet.createSprite('wind_3', 641, 401, 123, 30);
shipSpriteSheet.createSprite('wind_4', 643, 438, 122, 37);
shipSpriteSheet.createSprite('propeller_blur_1', 339, 60, 61, 202, -20, 68);
shipSpriteSheet.createSprite('propeller_blur_2', 419, 58, 61, 202, -20, 68);
shipSpriteSheet.createSprite('bit_screw', 640, 528, 12, 12);
shipSpriteSheet.createSprite('bit_plate', 665, 525, 13, 16);
shipSpriteSheet.createSprite('bit_brick', 688, 523, 18, 15);
shipSpriteSheet.createSprite('bit_wood', 650, 545, 18, 12);
shipSpriteSheet.createSprite('bit_coin', 683, 544, 13, 13);
shipSpriteSheet.createSprite('bit_bubble', 708, 543, 11, 11);
shipSpriteSheet.createSprite('bit_fish', 718, 525, 17, 11);
shipSpriteSheet.createSprite('balloon_base', 869, 817, 134, 152, 10, 18);
shipSpriteSheet.createSprite('balloon_top', 607, 742, 251, 239, 60, 160);
shipSpriteSheet.createSprite('castle', 799, 309, 195, 175, 32, 32);
shipSpriteSheet.createSprite('square_outline', 737, 600, 116, 119, -8, -8);
shipSpriteSheet.createSprite('square_bg', 611, 598, 113, 117, -8, -8);
shipSpriteSheet.createSprite('icon_bg', 459, 757, 72, 74, 36, 37);

const shipSpriteSheet2 = new SpriteSheet('art/ship-spritesheet-2.png');

shipSpriteSheet2.createSprite('figurehead', 13, 10, 55, 123);
shipSpriteSheet2.createSprite('support_right', 81, 6, 150, 142);
shipSpriteSheet2.createSprite('support_left', 248, 10, 150, 142);
shipSpriteSheet2.createSprite('wing_background', 416, 5, 215, 151);
shipSpriteSheet2.createSprite('wing_foreground', 415, 175, 215, 161);
shipSpriteSheet2.createSprite('keel', 16, 164, 122, 45);
shipSpriteSheet2.createSprite('top_hull', 17, 220, 185, 121, 30, 26);
shipSpriteSheet2.createSprite('hull', 12, 354, 184, 138, 28, 8);
shipSpriteSheet2.createSprite('half_hull', 11, 510, 184, 102, 28, 8);
shipSpriteSheet2.createSprite('side_hull', 230, 177, 115, 105, 85, -40);
shipSpriteSheet2.createSprite('vertical_hull_connect', 234, 311, 126, 29);
shipSpriteSheet2.createSprite('wires_down_right', 230, 369, 108, 95);

const parallaxBgRed = loadImage('art/parallax bg red.png').then(img => images.parallaxBgRed = img);
const parallaxBgOrange = loadImage('art/parallax bg orange.png').then(img => images.parallaxBgOrange = img);
const parallaxBgYellow = loadImage('art/parallax bg yellow.png').then(img => images.parallaxBgYellow = img);
const wavesImg = loadImage('art/waves.png').then(img => images.wavesImg = img);
const playImg = loadImage('art/play.png').then(img => images.playImg = img);

export const images = {};

export const imageLoader = Promise.all([parallaxBgOrange, parallaxBgRed, parallaxBgYellow, wavesImg, playImg]);

// window.parallaxBgRed = parallaxBgRed;
// window.parallaxBgOrange = parallaxBgOrange;
// window.parallaxBgYellow = parallaxBgYellow;
// window.wavesImg = wavesImg;
// window.playImg = playImg;

export const islandSpriteSheet = new SpriteSheet('art/island-spritesheet.png');

islandSpriteSheet.createSprite('small_1', 606, 593, 146, 67);
islandSpriteSheet.createSprite('small_2', 807, 591, 110, 69);
islandSpriteSheet.createSprite('medium_1', 719, 416, 257, 116);
islandSpriteSheet.createSprite('medium_2', 685, 707, 241, 77);
islandSpriteSheet.createSprite('large_1', 628, 871, 374, 102);


export const spriteController = new SpriteController([
    shipSpriteSheet,
    shipSpriteSheet2,
    islandSpriteSheet,
]);

window.spriteController = spriteController;
