
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
    constructor(img, x, y, width, height, anchorX, anchorY) {
        this.img = img;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.anchorX = anchorX;
        this.anchorY = anchorY;
    }

    draw(ctx, x, y, width, height) {
        ctx.drawImage(
            this.img,
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

    constructor(img) {
        this.img = img;
    }

    createSprite(name, x, y, width, height, anchorX = 0, anchorY = 0) {
        const sprite = new Sprite(this.img, x, y, width, height, anchorX, anchorY);
        this.sprites[name] = sprite;
        return sprite;
    }
}

const shipSpriteSheetImg = await loadImage('art/ship-spritesheet.png');

export const shipSpriteSheet = new SpriteSheet(shipSpriteSheetImg);

// currently getting these numbers semi-manually by uploading the spritesheet to http://www.spritecow.com/
shipSpriteSheet.createSprite('hull', 34, 824, 184, 146, 28, 8);
shipSpriteSheet.createSprite('top_hull', 34, 628, 185, 116, 28, 15);
shipSpriteSheet.createSprite('side_hull', 318, 872, 84, 74);
shipSpriteSheet.createSprite('propeller', 61, 63, 79, 199);
shipSpriteSheet.createSprite('sail', 279, 37, 145, 225, 8, 98);
shipSpriteSheet.createSprite('steam_puff', 513, 59, 64, 71);
shipSpriteSheet.createSprite('boiler', 48, 321, 161, 262);
shipSpriteSheet.createSprite('fin_sail', 254, 315, 151, 215);

window.shipSpriteSheet = shipSpriteSheet;

const parallaxBgRed = await loadImage('art/parallax bg red.png');

window.parallaxBgRed = parallaxBgRed;

const parallaxBgOrange = await loadImage('art/parallax bg orange.png');

window.parallaxBgOrange = parallaxBgOrange;

const parallaxBgYellow = await loadImage('art/parallax bg yellow.png');

window.parallaxBgYellow = parallaxBgYellow;