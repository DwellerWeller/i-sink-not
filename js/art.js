
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
shipSpriteSheet.createSprite('hull', 34, 824, 184, 146, 28, 8);
shipSpriteSheet.createSprite('top_hull', 34, 628, 185, 116, 28, 15);
shipSpriteSheet.createSprite('side_hull', 318, 872, 84, 74, -130, -46);
shipSpriteSheet.createSprite('busted_hull', 233, 629, 184, 146, 28, 8);
shipSpriteSheet.createSprite('scaffolding', 430, 852, 165, 112, 20, -20);
shipSpriteSheet.createSprite('propeller', 61, 63, 79, 199, -60, 66);
shipSpriteSheet.createSprite('sail', 279, 37, 145, 225, 8, 98);
shipSpriteSheet.createSprite('steam_puff', 513, 59, 64, 71, 32, 35);
shipSpriteSheet.createSprite('water_spray', 500, 203, 94, 143, 47, 72);
shipSpriteSheet.createSprite('boiler', 48, 321, 161, 262, 14, 128);
shipSpriteSheet.createSprite('fin_sail', 254, 315, 151, 215, 0, 70);
shipSpriteSheet.createSprite('bucket_icon', 507, 375, 76, 76);
shipSpriteSheet.createSprite('hammer_icon', 502, 504, 80, 86);
shipSpriteSheet.createSprite('oar_icon', 505, 632, 75, 79);
shipSpriteSheet.createSprite('wind_1', 630, 315, 139, 30);
shipSpriteSheet.createSprite('wind_2', 633, 361, 134, 33);
shipSpriteSheet.createSprite('wind_3', 641, 401, 123, 30);
shipSpriteSheet.createSprite('wind_4', 643, 438, 122, 37);
shipSpriteSheet.createSprite('propeller_blur_1', 609, 58, 61, 202, -50, 68);
shipSpriteSheet.createSprite('propeller_blur_2', 689, 60, 61, 202, -50, 68);
shipSpriteSheet.createSprite('bit_screw', 640, 528, 12, 12);
shipSpriteSheet.createSprite('bit_plate', 665, 525, 13, 16);
shipSpriteSheet.createSprite('bit_brick', 688, 523, 18, 15);
shipSpriteSheet.createSprite('bit_wood', 650, 545, 18, 12);
shipSpriteSheet.createSprite('bit_coin', 683, 544, 13, 13);


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

export { shipSpriteSheet };
