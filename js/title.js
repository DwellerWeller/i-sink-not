import * as game from './game.js';

var main_song = new Audio('sound/i sink not - song 2.mp3');
main_song.addEventListener('timeupdate', function(){
    var buffer = .44;
    if(this.currentTime > this.duration - buffer){
        this.currentTime = 7.211;
        this.play();
    }
});

export function setUp(canvasEl) {
    canvasEl.onclick = function() { onClick(canvasEl) };

    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.fillText('click anywhere to start', 100, 100);
}

function onClick(canvasEl) {
    main_song.play();
    tearDown(canvasEl);
    game.setUp(canvasEl);
}

function tearDown(canvasEl) {
    canvasEl.onClick = null;
}