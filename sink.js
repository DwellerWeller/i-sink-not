let waterLevel = 0;
let floodRate = 0;
let speed = 0;
let distanceTraveled = 0;

let timeToSpend = 0;
let timeElapsed = 0;

const DRAG = .1;
const TICK_INTERVAL = 100;



class Player {
    constructor() {
        this.busy = false;

        this.timeElapsed = undefined;
        this.timeRequired = undefined;
        this.callback = undefined;

        this.stateEl = document.getElementById('state');
        this.cooldownEl = document.getElementById('cooldown');
    }

    act(description, costInMilliseconds, callback) {
        if (this.busy) {
            return;
        }

        this.busy = true;
        this.timeElapsed = 0;
        this.timeRequired = costInMilliseconds;
        this.callback = callback;

        this.stateEl.textContent = `${description}...`;
        for (const inputEl of document.querySelectorAll('input')) {
            inputEl.disabled = true;
        }
    }    

    tick(elapsed) {
        if (this.busy) {
            this.timeElapsed += elapsed;

            const timeRemaining = this.timeRequired - this.timeElapsed;
            this.cooldownEl.value = (1 - (timeRemaining / this.timeRequired)) * 100;

            if (timeRemaining <= 0) {
                this.busy = false;
                this.stateEl.textContent = 'Ready';

                this.callback();

                for (const inputEl of document.querySelectorAll('input')) {
                    inputEl.disabled = false;
                }

                this.cooldownEl.value = 0;
            }
        }
    }
}


const player = new Player();


const hullTable =  document.getElementById('hull');
const hullEls = hullTable.querySelectorAll('input[type="button"]');
hullTable.addEventListener('click', ev => {
    const target = ev.target;
    if (target.tagName != 'INPUT') {
        return;
    }

    if (target.value != '💧') {
        return;
    }

    target.value = '🔧';
    player.act('Repairing', 1000, () => {
        floodRate -= 1;
        target.value = '🪵';
    });
});

const bucketEl = document.getElementById('bucket');
bucketEl.addEventListener('click', ev => {
    if (waterLevel <= 0) {
        return;
    }

    bucketEl.value = '🍥';
    player.act('Baleing', 1000, () => {
        if (waterLevel > 0) {
            waterLevel -= 1;
        }
        bucketEl.value = '🪣';
    });
});

const oarEl = document.getElementById('oar');
oarEl.addEventListener('click', ev => {
    oarEl.value = '🍥';
    player.act('Rowing', 500, () => {
        speed += 1;
        oarEl.value = '🧹';
    });
});

const floodEl = document.createElement('div');
floodEl.id = 'flood';
document.body.appendChild(floodEl);

const distanceEl = document.getElementById('distance');

function tick() {
    // if we sank we're done
    if (waterLevel >= 100) {
        alert('you sank my battleship');
        clearInterval(tickTimer);
    }

    // update game models
    waterLevel += floodRate
    distanceTraveled += speed;
    speed = Math.max(0, speed - DRAG);
    player.tick(TICK_INTERVAL);

    // spring a new leak
    if (Math.random() < 0.01) {  // TODO: accelerate later on?
        const newLeakIx = Math.floor(Math.random() * hullEls.length);
        const leakyHullEl = hullEls[newLeakIx];
        if (leakyHullEl.value = '🪵') {
            leakyHullEl.disabled = false;
            leakyHullEl.value = '💧';
            floodRate += 1;
        }
    }

    // update the ui
    floodEl.style.height = `${waterLevel}%`;
    distanceEl.textContent = Math.floor(distanceTraveled); 
}
const tickTimer = setInterval(tick, TICK_INTERVAL);