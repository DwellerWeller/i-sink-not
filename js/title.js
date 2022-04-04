import * as game from './game.js';
import * as sound from './sound.js';


export function setUp(canvasEl) {
    canvasEl.onclick = function() { onClick(canvasEl) };

    const ctx = canvasEl.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

    ctx.drawImage(window.playImg, canvasEl.width/2 - window.playImg.width/2, canvasEl.height/2 - window.playImg.height/2);

    ctx.fillStyle = '#666';
    ctx.font = '28px sans-serif';
    const message = 'Click to start';
    const textMetrics = ctx.measureText(message);
    ctx.fillText(message, canvasEl.width/2 - textMetrics.width/2, canvasEl.height/2 + window.playImg.height/2 + 25 + textMetrics.actualBoundingBoxAscent)
}

function onClick(canvasEl) {
	// Show title screen
	sound.theme_song.play();
    const ctx = canvasEl.getContext('2d');
	game.setUp(canvasEl);
}

function tearDown(canvasEl) {
    canvasEl.onClick = null;
}