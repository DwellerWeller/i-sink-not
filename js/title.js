import * as game from './game.js';
import * as sound from './sound.js';


export function setUp(canvasEl) {
    canvasEl.onclick = function() { onClick(canvasEl) };

    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

    const fontSize = 120;
    ctx.fillStyle = '#ccc';
    ctx.font = `${fontSize}px sans-serif`;
    const textMetrics = ctx.measureText('➤');
    ctx.fillText('➤', canvasEl.width/2 - textMetrics.width/2, canvasEl.height/2 + fontSize/2);
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