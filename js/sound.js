var sounds = {};

sounds['building'] = new Audio('sound/building.mp3');
sounds['building'].volume = 0.70;

sounds['repairing'] = new Audio('sound/repairing.mp3');
sounds['repairing'].volume = 0.70;

sounds['breaking'] = new Audio('sound/breaking.mp3');
sounds['breaking'].volume = 0.70;

sounds['confirm'] = new Audio('sound/confirm.mp3');
sounds['confirm'].volume = 0.70;

sounds['cancel'] = new Audio('sound/cancel.mp3');
sounds['cancel'].volume = 0.50

sounds['row'] = new Audio('sound/row.mp3');
sounds['row'] = 0.70;

sounds['bucket'] = new Audio('sound/bucket.mp3');
sounds['bucket'].volume = 0.70;

export var theme_song = new Audio('sound/i sink not - song 1 - title.mp3');
theme_song.addEventListener('timeupdate', function(){
    var buffer = .44;
    if(this.currentTime > this.duration - buffer){
        this.currentTime = 0;
        this.play();
    }
});

export var main_song = new Audio('sound/i sink not - song 2.mp3');
main_song.addEventListener('timeupdate', function(){
    var buffer = .44;
    if(this.currentTime > this.duration - buffer){
        this.currentTime = 7.211;
        this.play();
    }
});

sounds['gameover'] = new Audio('sound/gameover.mp3');

export function play(sound) {
	sounds[sound].currentTime = 0;
	sounds[sound].play();
}