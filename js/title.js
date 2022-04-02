import * as game from './game.js';

export function setUp(canvasEl) {
    canvasEl.onclick = function() { onClick(canvasEl) };

    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.fillText('click anywhere to start', 100, 100);
}

function onClick(canvasEl) {
    tearDown(canvasEl);
    game.setUp(canvasEl);
}

function tearDown(canvasEl) {
    canvasEl.onClick = null;
}