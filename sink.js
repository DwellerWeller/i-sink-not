let waterLevel = 0;
let floodRate = 1;
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
                this.stateEl.textContent = 'ready';

                this.callback();

                for (const inputEl of document.querySelectorAll('input')) {
                    inputEl.disabled = false;
                }

                this.cooldownEl.value = 0;
            }
        }
    }
}

const machinesEl = document.getElementById('machines');
class Autobaler {
    constructor() {
        this.elapsed = 0;
        this.procTime = 2000;

        this.progressEl = document.createElement('progress');
        this.progressEl.value = 0;
        this.progressEl.max = 100;

        const rowEl = document.createElement('tr');
        const nameEl = document.createElement('td');
        const stateEl = document.createElement('td');
        nameEl.textContent = '🤖';
        stateEl.appendChild(this.progressEl);
        rowEl.appendChild(nameEl);
        rowEl.appendChild(stateEl);
        machinesEl.appendChild(rowEl);
    }

    tick(elapsed) {
        this.elapsed += elapsed;
        this.progressEl.value = Math.round((this.elapsed / this.procTime) * 100);

        if (this.elapsed >= this.procTime) {
            if (waterLevel > 0) {
                waterLevel -= 1;
            }
            
            this.elapsed = 0;
        }
    }
}


const player = new Player();
const tickers = [player];


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
    player.act('repairing', 1000, () => {
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
    player.act('baleing', 1000, () => {
        if (waterLevel > 0) {
            waterLevel -= 1;
        }
        bucketEl.value = '🪣';
    });
});

const oarEl = document.getElementById('oar');
oarEl.addEventListener('click', ev => {
    oarEl.value = '🍥';
    player.act('rowing', 500, () => {
        speed += 1;
        oarEl.value = '🧹';
    });
});

const buildAutobalerEl = document.getElementById('autobaler');
buildAutobalerEl.addEventListener('click', ev => {
    buildAutobalerEl.value = '🍥';
    player.act('building autobaler', 5000, () => {
        buildAutobalerEl.remove();
        tickers.push(new Autobaler());
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
    for (const ticker of tickers) {
        ticker.tick(TICK_INTERVAL);
    }

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