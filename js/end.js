import * as game from "./game.js";

export function setUp(canvasEl, distanceTraveled, timeElapsed) {
    canvasEl.onclick = function() { onClick(canvasEl) };

    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.fillText(`blub blub. you made it ${Math.floor(distanceTraveled)} meters and stayed afloat ${Math.floor(timeElapsed / 1000)} seconds`, 100, 100);
    ctx.fillText('click anywhere to try again', 100, 200);
}

function onClick(canvasEl) {
    tearDown(canvasEl);
    game.setUp(canvasEl);
}

function tearDown(canvasEl) {
    canvasEl.onClick = null;
}