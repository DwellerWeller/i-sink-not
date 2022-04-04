
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
    sprites = {};

    constructor(src) {
        this.src = src;
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

const shipSpriteSheet = new SpriteSheet('art/ship-spritesheet.png');

// currently getting these numbers semi-manually by uploading the spritesheet to http://www.spritecow.com/
shipSpriteSheet.createSprite('hull', 42, 824, 184, 146, 28, 8);
shipSpriteSheet.createSprite('top_hull', 34, 628, 185, 116, 28, 15);
shipSpriteSheet.createSprite('side_hull', 304, 872, 98, 94, 98, -44);
shipSpriteSheet.createSprite('busted_hull', 233, 629, 184, 146, 28, 8);
shipSpriteSheet.createSprite('scaffolding', 430, 852, 165, 112, 20, -20);
shipSpriteSheet.createSprite('propeller', 67, 63, 79, 199, 10, 66);
shipSpriteSheet.createSprite('sail', 173, 43, 145, 225, -16, 98);
shipSpriteSheet.createSprite('steam_puff', 513, 59, 64, 71, 32, 35);
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

window.shipSpriteSheet = shipSpriteSheet;

const parallaxBgRed = await loadImage('art/parallax bg red.png');

window.parallaxBgRed = parallaxBgRed;

const parallaxBgOrange = await loadImage('art/parallax bg orange.png');

window.parallaxBgOrange = parallaxBgOrange;

const parallaxBgYellow = await loadImage('art/parallax bg yellow.png');

window.parallaxBgYellow = parallaxBgYellow;

const wavesImg = await loadImage('art/waves.png');

window.wavesImg = wavesImg;

const playImg = await loadImage('art/play.png');

window.playImg = playImg;

const islandSpriteSheet = new SpriteSheet('art/island-spritesheet.png');

islandSpriteSheet.createSprite('small_1', 606, 593, 146, 67);
islandSpriteSheet.createSprite('small_2', 807, 591, 110, 69);
islandSpriteSheet.createSprite('medium_1', 719, 416, 257, 116);
islandSpriteSheet.createSprite('medium_2', 685, 707, 241, 77);
islandSpriteSheet.createSprite('large_1', 628, 871, 374, 102);

window.islandSpriteSheet = islandSpriteSheet;

export { shipSpriteSheet, islandSpriteSheet };

