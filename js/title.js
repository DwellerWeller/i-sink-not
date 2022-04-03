import * as game from './game.js';

var theme_song = new Audio('sound/i sink not - song 1 - title.mp3');
theme_song.addEventListener('timeupdate', function(){
    var buffer = .44;
    if(this.currentTime > this.duration - buffer){
        this.currentTime = 0;
        this.play();
    }
});

var main_song = new Audio('sound/i sink not - song 2.mp3');
main_song.addEventListener('timeupdate', function(){
    var buffer = .44;
    if(this.currentTime > this.duration - buffer){
        this.currentTime = 7.211;
        this.play();
    }
});

function bezier(t)
{
    return 1 - (t * t * (3.0 - 2.0 * t));
}

export function setUp(canvasEl) {
    canvasEl.onclick = function() { onClick(canvasEl) };

    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.fillText('click anywhere to start', 100, 100);
}

var showing_title_screen = false;
var game_started = false;

function onClick(canvasEl) {

	// Show title screen
	if (!showing_title_screen && !game_started) {
		theme_song.play();
	    const ctx = canvasEl.getContext('2d');
	    
		showing_title_screen = true;
		game.setUp(canvasEl);
	}

	// Start game
	else if (showing_title_screen && !game_started){

		// Fade out title music, start main music
		var current_t = 0.0;
		var interval = 0.2;
		var fade_time = 3.0;
		var fadeAudio = setInterval(function () {
	        if (theme_song.volume > 0.0) {
	            theme_song.volume = bezier(current_t);
	        }
	        current_t += interval / fade_time;
	        if (theme_song.volume <= 0.0) {
	        	theme_song.pause();
	            clearInterval(fadeAudio);
	            setTimeout(function () {main_song.play();}, 1000)
	        }
	    }, interval * 1000);

	    // Start the game
	    showing_title_screen = false;
	    game_started = true;
		tearDown(canvasEl);
	    game.play();
	}

}

function tearDown(canvasEl) {
    canvasEl.onClick = null;
}