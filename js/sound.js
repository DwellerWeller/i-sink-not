export var building  = new Audio('sound/building.mp3');
building.volume = 0.70;

export var repairing  = new Audio('sound/repairing.mp3');
repairing.volume = 0.70;

export var repairing  = new Audio('sound/repairing.mp3');
>>>>>>> parent of 1c153d6... Attempt to seamlessly loop the main song.

export var breaking  = new Audio('sound/breaking.mp3');
breaking.volume = 0.70;

export var confirm  = new Audio('sound/confirm.mp3');
confirm.volume = 0.70;

export var cancel  = new Audio('sound/cancel.mp3');
cancel.volume = 0.50

export var row  = new Audio('sound/row.mp3');
row.volume = 0.70;

export var bucket  = new Audio('sound/bucket.mp3');
bucket.volume = 0.70;

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

export var gameover  = new Audio('sound/gameover.mp3');