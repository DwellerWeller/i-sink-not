const canvasEl = document.getElementById('game');
const ctx = canvasEl.getContext('2d');
const CANVAS_WIDTH = canvasEl.width;
const CANVAS_HEIGHT = canvasEl.height;

const BUTTON_SIZE = 50;
const BUTTON_MARGIN = 20;

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
let floodRate = 1;
let floodAmount = 0;

let shipDraught = 10;
let shipHeight = shipImage.height;

let distanceTraveled = 0;
let speed = 0;

let cooldown = 0;
let currentCallback = null;

const buttons = [
    {icon: '🪣', cost: 1000, callback: () => {floodAmount = Math.max(0, floodAmount - 1)}},
    {icon: '🧹', cost: 1000, callback: () => {speed = Math.min(speed + 1, 5)}},
];
/**************/

canvasEl.addEventListener('click', function(ev) {
    // can't do any buttons while in cooldown
    if (cooldown > 0) {
        return;
    }

    const x = ev.offsetX;
    if (x >= BUTTON_MARGIN && x <= (BUTTON_MARGIN + BUTTON_SIZE)) {
        const y = ev.offsetY;

        let currentY = BUTTON_MARGIN;
        for (const button of buttons) {
            if (y < currentY) {
                break;
            }

            if (y < currentY + BUTTON_SIZE) {
                cooldown = button.cost;
                currentCallback = button.callback;
                return;
            }

            currentY += BUTTON_SIZE + BUTTON_MARGIN;
        }
    }

    // TODO: clicks on the hull
});

let previousTick = performance.now();
function tick() {
    const now = performance.now();
    const timeSinceLastTick = now - previousTick;

    // lose condition
    // TODO: don't hard code the water height here
    if (shipHeight - 100 < shipDraught) {
        alert('you sank my battleship');
        clearInterval(tickTimer);
        return;
    }

    // handle cooldowns and actions
    cooldown = Math.max(0, cooldown - timeSinceLastTick);
    if (cooldown == 0 && currentCallback) {
        currentCallback();
        currentCallback = null;
    }

    distanceTraveled += timeSinceLastTick * (speed / 100);
    speed = Math.max(0, speed - .1); // TODO: make this a function of draught
    floodAmount += timeSinceLastTick * (floodRate / 100);
    shipDraught = floodAmount + 10; // TODO: smarter

    previousTick = now;
}
const tickTimer = setInterval(tick, 100);

const firstFrame = performance.now();
let previousFrame = firstFrame;
function render(now) {
    // world
    ctx.fillStyle = 'skyblue';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // distance
    ctx.fillStyle = 'white';
    ctx.font = '32px sans-serif';
    const distanceText = `${Math.floor(distanceTraveled)}m`;
    const textMetrics = ctx.measureText(distanceText);
    ctx.fillText(distanceText, Math.floor(CANVAS_WIDTH - textMetrics.width) - 10, Math.floor(textMetrics.actualBoundingBoxAscent) + 10);

    // buttons
    let currentY = BUTTON_MARGIN;
    ctx.fillStyle = cooldown > 0 ? 'grey' : 'cornsilk';
    for (const button of buttons) {
        ctx.fillRect(BUTTON_MARGIN, currentY, BUTTON_SIZE, BUTTON_SIZE);
        ctx.strokeText(button.icon, BUTTON_MARGIN + 10, currentY + 36);
        currentY += BUTTON_SIZE + BUTTON_MARGIN;
    }

    // ship
    ctx.drawImage(shipImage, 100, CANVAS_HEIGHT - shipHeight + shipDraught);

    // water
    ctx.fillStyle = 'rgba(0, 0, 128, .7)';
    ctx.fillRect(0, CANVAS_HEIGHT - 100 - 5 * Math.sin((now - firstFrame) / 250), CANVAS_WIDTH, CANVAS_HEIGHT);

    previousFrame = now;
    requestAnimationFrame(render);
}
render(performance.now());