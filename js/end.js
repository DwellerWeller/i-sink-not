import * as game from "./game.js";

export function setUp(canvasEl, distanceTraveled) {
    canvasEl.onclick = function() { onClick(canvasEl) };

    console.log('setting up');
    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.fillText(`blub blub. you made it ${Math.floor(distanceTraveled)} meters. click to try again`, 100, 100);
}

function onClick(canvasEl) {
    tearDown(canvasEl);
    console.log('ok now another')
    game.setUp(canvasEl);
}

function tearDown(canvasEl) {
    canvasEl.onClick = null;
}