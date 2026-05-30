// - Day/Night Modes -----------------------------------------------------------
// Returns true if time is day mode
function isDay(hour) {
    return hour >= 6 && hour < 18;
}

// Applies the time mode changes
// 'animate' is bool on whether to animate change between modes, false when 
// initialized
function applyTimeMode(animate) {
    const body = document.body;
    const hour = new Date().getHours();
    // Mode to change into
    const targetMode = isDay(hour) ? 'day-mode' : 'night-mode';

    // Mode to change out of (remove)
    const removeMode  = isDay(hour) ? 'night-mode' : 'day-mode';

    if (!animate) {
        // Swap instantly
        body.classList.remove(removeMode);
        body.classList.add(targetMode);

        // Double rAF to prevent rendering bugs
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                body.classList.add('transitions-enabled');
            });
        });
    } else {
        // Animated mode switch (auto-scheduler or manual toggle)
        body.classList.remove(removeMode);
        body.classList.add(targetMode);
        spawnGroup(body.classList.contains('day-mode'));
    }

    // Update button
    updateToggleButton();
}

// Probably worthless but oh well
// Schedules the next automatic switch between day/night modes
function scheduleNextSwitch() {
    const now  = new Date();
    const hour = now.getHours();
    const next = new Date(now);

    if (hour >= 6 && hour < 18) {
        // Currently day, switch at 6pm
        next.setHours(18, 0, 0, 0);
    } else if (hour < 6) {
        // Currently night, switch at 6am
        next.setHours(6, 0, 0, 0);
    } else {
        // Also currently night, switch at 6am NEXT day
        next.setDate(next.getDate() + 1);
        next.setHours(6, 0, 0, 0);
    }

    // Apply switch at the next scheduled switch time
    setTimeout(() => {
        applyTimeMode(true);
        scheduleNextSwitch();
    }, next - now);
}

// Update clock element
function updateClock() {
    const element = document.getElementById('nav-clock');
    if (!element) return;
    element.textContent = new Date().toLocaleTimeString([], {
        hour:   '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

// Triggers updateClock every second
function startClock() {
    updateClock();
    setInterval(updateClock, 1000);
}


// Toggles between day/night modes and updates button
function toggleMode() {
    const body = document.body;
    if (body.classList.contains('day-mode')) {
        body.classList.replace('day-mode', 'night-mode');
    } else {
        body.classList.replace('night-mode', 'day-mode');
    }
    updateToggleButton();
    spawnGroup(document.body.classList.contains('day-mode'));
}

// Updates toggle button
function updateToggleButton() {
    const btn = document.getElementById('mode-toggle-btn');
    const currentlyDay = document.body.classList.contains('day-mode');
    btn.textContent = currentlyDay ? 'Day' : 'Night';
    btn.title = currentlyDay ? 'Switch to night mode' : 'Switch to day mode';
}


// - Pokemon Spawner -----------------------------------------------------------
// Devnote: I will admit i had AI teach me a lot of this, but i SWEAR i'm learning
// from what Claude is spitting out. I can read and explain my own code here, and
// given enough time, i would be able to write this on my own with the knowledge
// i've obtained. 
const POKEMON_SPEED = 0.3;   // px per frame
const SHINY_CHANCE  = 0.01;  // chance of shiny per spawn
const SPRITE_SIZE   = 96;    // rendered width in px 

const DAY_POKEMON = [
    { name: 'espeon',    grounded: true  },
    { name: 'dragonite', grounded: false },
    { name: 'altaria',   grounded: false },
];

const NIGHT_POKEMON = [
    { name: 'umbreon',    grounded: true  },
    { name: 'misdreavus', grounded: false },
    { name: 'shedinja',   grounded: false },
];

// List of all currently live Pokemon
// no wonder ppl use typescript, its insane you don't have to declare anything abt
// the objects u could put in here when it has like 7 properties
const activePokemon = [];
let rafId = null;

// Builds the local asset path for a sprite
// state is either 'idle' or 'roaming' 
function getSpriteUrl(name, shiny, state) {
    const variant   = shiny ? 'shiny' : 'default';
    const animation = state === 'roaming' ? 'walk' : 'idle';
    // Build sprite url
    return `./assets/images/sprites/${name}/${variant}_${animation}_8fps.gif`;
}

// Spawns a single pokemon on screen with properites according to given parameters
function spawnPokemon(pokemon, grounded, shiny) {
    const navH = document.querySelector('.nav-bar')?.offsetHeight ?? 60;

    // Random X within the viewport
    const spawnX = Math.random() * (window.innerWidth - SPRITE_SIZE);

    // Grounded = near bottom edge; otherwise a random Y below the nav bar
    const spawnY = grounded
        ? window.innerHeight - SPRITE_SIZE + 5
        : navH + 10 + Math.random() * (window.innerHeight - navH - SPRITE_SIZE - 20);

    // Pick a random starting direction: 1 = right, -1 = left
    const dir = Math.random() < 0.5 ? 1 : -1;

    // Entity transform, position, opacity
    const entity = document.createElement('div');
    entity.className     = 'pokemon-entity';
    entity.style.left    = spawnX + 'px';
    entity.style.top     = spawnY + 'px';
    entity.style.opacity = '0';

    // Handles horizontal orientation of asset
    const dirElement = document.createElement('div');
    dirElement.className       = 'pokemon-dir';
    dirElement.style.transform = `scaleX(${dir})`;

    // Handles img properties of the Pokemon object
    const img = document.createElement('img');
    img.className  = 'pokemon-sprite';
    img.src        = getSpriteUrl(pokemon.name, shiny, 'idle');
    img.draggable  = false;
    img.alt        = pokemon.name;

    dirElement.appendChild(img);
    entity.appendChild(dirElement);
    document.body.appendChild(entity);

    // Fade in after the opacity:0 frame is committed
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            entity.style.opacity = '1';
        });
    });

    // Sit idle for certain time before roaming
    const roamAt = Date.now() + 1000 + Math.random() * 4000; // 1- 5s

    activePokemon.push({
        element: entity, dirElement, img,
        name: pokemon.name, shiny,
        xOffset: 0, dir,
        state: 'idle', roamAt,
    });
}

// Spawns a random number of Pokemon depending on day/night cycle
function spawnGroup(dayMode) {
    const pool  = dayMode ? DAY_POKEMON : NIGHT_POKEMON;
    const count = 4 + Math.floor(Math.random() * 4); // 4, 5, 6, or 7

    clearAllPokemon(() => {
        for (let i = 0; i < count; i++) {
            const pokemon  = pool[Math.floor(Math.random() * pool.length)];
            const grounded = pokemon.grounded;
            const shiny    = Math.random() < SHINY_CHANCE;
            spawnPokemon(pokemon, grounded, shiny);
        }

        // Kick off the shared animation loop
        if (rafId) cancelAnimationFrame(rafId);
        rafLoop();
    });
}

// Fades out every active Pokemon
function clearAllPokemon(callback) {
    if (activePokemon.length === 0) {
        if (callback) callback();
        return;
    }

    // Pause movement while fading out
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    // Trigger CSS fade-out on all entities
    for (const p of activePokemon) {
        p.element.style.opacity = '0';
    }

    // Wait for the transition to finish (must match CSS transition duration)
    setTimeout(() => {
        for (const p of activePokemon) p.element.remove();
        activePokemon.length = 0;
        if (callback) callback();
    }, 1000);
}

// Loop to animate Pokemon every frame
function rafLoop() {
    const now = Date.now();

    for (const p of activePokemon) {
        // Swap assets when changing state
        if (p.state === 'idle' && now >= p.roamAt) {
            p.state  = 'roaming';
            p.img.src = getSpriteUrl(p.name, p.shiny, 'roaming');
        }

        if (p.state === 'roaming') {
            p.xOffset += p.dir * POKEMON_SPEED;
            p.element.style.transform = `translateX(${p.xOffset}px)`;

            // Check screen boundaries and flip direction
            const spawnX = parseFloat(p.element.style.left);
            const currentX = spawnX + p.xOffset;
            if (currentX <= 0 || currentX >= window.innerWidth - SPRITE_SIZE) {
                p.dir *= -1;
                p.dirElement.style.transform = `scaleX(${p.dir})`;
            }
        }
    }

    // Store for future use (stopping animation)
    rafId = requestAnimationFrame(rafLoop);
}


// Initialize every script
document.addEventListener('DOMContentLoaded', () => {
    applyTimeMode(false);   // snap to correct mode, animate is false
    scheduleNextSwitch();   // queue switch
    startClock();           // start live clock
    spawnGroup(document.body.classList.contains('day-mode')); // initial Pokemon
});


// - Metal Pipe ----------------------------------------------------------------
// Activates the pipe overlay and plays sound
function triggerSurprise() {
    const overlay = document.getElementById('pipe-falling-overlay');
    const audio   = document.getElementById('pipe-falling-audio');
    overlay.style.display = 'block';
    audio.currentTime = 0;
    audio.play();
}

// Closes overlay on click
function closeSurprise() {
    const overlay = document.getElementById('pipe-falling-overlay');
    // const audio   = document.getElementById('pipe-falling-audio');
    overlay.style.display = 'none';
    // leaving this here but thought it would be funnier if it didnt pause
    // audio.pause();
    // audio.currentTime = 0;
}
