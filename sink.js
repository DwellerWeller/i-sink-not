let waterLevel = 0;
let floodRate = 0;
let speed = 0;
let distanceTraveled = 0;

let timeToSpend = 0;
let timeElapsed = 0;

const cooldownEl = document.getElementById('cooldown');
const stateEl = document.getElementById('state');

const floodEl = document.createElement('div');
floodEl.id = 'flood';
document.body.appendChild(floodEl);

const hullTable =  document.getElementById('hull');
const hullEls = hullTable.querySelectorAll('input[type="button"]');

hullTable.addEventListener('click', ev => {
    const target = ev.target;
    if (target.tagName != 'INPUT') {
        return;
    }

    if (timeToSpend > 0) {
        return;
    }

    if (target.value != '💧') {
        return;
    }

    target.value = '🪵';

    stateEl.textContent = 'repairing';
    timeToSpend = 1000;
    timeElapsed = 0;
    floodRate -= 1;
    target.classList.add('in-progress');
});

const bucketEl = document.getElementById('bucket');
bucketEl.addEventListener('click', ev => {
    if (timeToSpend > 0) {
        return;
    }

    stateEl.textContent = 'baleing';
    timeToSpend = 1000;
    timeElapsed = 0;
    waterLevel -= 1;
    bucketEl.classList.add('in-progress');
});

function tick() {
    // if we sank we're done
    if (waterLevel >= 100) {
        alert('you sank my battleship');
        clearInterval(tickTimer);
    }

    // update game models
    waterLevel += floodRate;
    if (timeToSpend > 0) {
        timeElapsed += 100;

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

    if (timeElapsed != 0 && timeElapsed >= timeToSpend) {
        timeElapsed = 0;
        timeToSpend = 0;
        for(const el of document.querySelectorAll('.in-progress')) {
            el.classList.remove('in-progress');
        }
        stateEl.textContent = 'ready';
    }

    // update the ui
    floodEl.style.height = `${waterLevel}%`;
    
}
const tickTimer = setInterval(tick, 100);