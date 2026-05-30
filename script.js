// Returns true if time is day mode
function isDay(hour) {
    return hour >= 6 && hour < 18;
}

// Applies the time mode changes
// 'animate' is bool on whether to animate change between modes, false when initialized
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

        // requestAnimationFrame defers execution to just before the next paint.
        // Double-nesting it ensures the first frame (with opacity:0 / initial state)
        // has been fully committed to the screen before we unlock CSS transitions —
        // otherwise the browser might batch the class add and the transition toggle
        // into the same frame and skip the animation entirely.
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


// ─── Pokemon Spawner ─────────────────────────────────────────────────────────

const POKEMON_SPEED = 0.3;   // px per animation frame (~30 px/s at 60 fps)
const SHINY_CHANCE  = 0.02;  // 2% per spawn
const SPRITE_SIZE   = 96;    // rendered width in px (used for spawn boundary maths)

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

// All currently live Pokemon: { element, dirElement, img, name, shiny, xOffset, dir, state, roamAt }
const activePokemon = [];
let rafId = null;

// Builds the local asset path for a sprite
// state is either 'idle' or 'roaming' (maps to idle/walk gif)
function getSpriteUrl(name, shiny, state) {
    const variant   = shiny ? 'shiny' : 'default';
    const animation = state === 'roaming' ? 'walk' : 'idle';
    // Build sprite url
    return `./assets/images/sprites/${name}/${variant}_${animation}_8fps.gif`;
}

/**
 * Spawns a single Pokemon on screen.
 * @param {object}  pokemon  - a Pokemon data object from one of the pools { name }
 * @param {boolean} grounded - if true, spawn is locked to the bottom of the viewport
 * @param {boolean} shiny    - if true, use the shiny sprite variant
 */
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

    // --- Build the three-layer DOM structure ---

    // Layer 1: entity — position, opacity, and translateX movement
    const entity = document.createElement('div');
    entity.className     = 'pokemon-entity';
    entity.style.left    = spawnX + 'px';
    entity.style.top     = spawnY + 'px';
    entity.style.opacity = '0';

    // Layer 2: dir — horizontally flips the sprite to face the direction of travel
    const dirElement = document.createElement('div');
    dirElement.className       = 'pokemon-dir';
    dirElement.style.transform = `scaleX(${dir})`;

    // Layer 3: img — starts on the idle gif, swapped to walk gif when roaming begins
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

    // Sit idle for 1–5 s before roaming
    const roamAt = Date.now() + 1000 + Math.random() * 4000;

    activePokemon.push({
        element: entity, dirElement, img,
        name: pokemon.name, shiny,
        xOffset: 0, dir,
        state: 'idle', roamAt,
    });
}

/**
 * Picks 4–7 random Pokemon from the correct pool and spawns them.
 * Also handles clearing any existing Pokemon on a mode switch.
 * @param {boolean} dayMode - true = use the day pool
 */
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

// Fades out every active Pokemon, removes them from the DOM, then runs the callback
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

// Shared RAF loop — advances all roaming Pokemon one step each frame
function rafLoop() {
    const now = Date.now();

    for (const p of activePokemon) {
        // Idle → roaming: swap to walk gif once the timer expires
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

    rafId = requestAnimationFrame(rafLoop);
}


// ─── Initialize every script on load ────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    applyTimeMode(false);   // snap to correct mode, animate is false
    scheduleNextSwitch();   // queue switch
    startClock();           // start live clock
    spawnGroup(document.body.classList.contains('day-mode')); // initial Pokemon
});


// ─── Metal Pipe ──────────────────────────────────────────────────────────────

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
