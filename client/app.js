const API_URL = 'http://localhost:8002/api';
let currentSystem = '';
let selectedGame = null;
let allGames = [];
let userFavorites = new Set();
let recentGames = [];

const SYSTEM_CORES = {
    'Nintendo Entertainment System': { core: 'nes', ext: '.nes' },
    'Super Nintendo Entertainment System': { core: 'snes', ext: '.smc' },
    'Nintendo Game Boy Advance': { core: 'gba', ext: '.gba' },
    'Nintendo Gameboy': { core: 'gb', ext: '.gb' },
    'Nintendo Gameboy Color': { core: 'gbc', ext: '.gbc' },
    'Sega Genesis': { core: 'genesis', ext: '.gen' },
    'Nintendo 64': { core: 'n64', ext: '.n64' },
    'MAME': { core: 'mame', ext: '.zip' },
    'Sega Master System': { core: 'sms', ext: '.sms' },
    'Sega Game Gear': { core: 'gamegear', ext: '.gg' },
    'Atari 2600': { core: 'stella', ext: '.a26' },
    'Atari 7800': { core: 'prosystem', ext: '.a78' },
    'Sony PlayStation': { core: 'pcsx_rearmed', ext: '.bin' },
    'Nintendo DS': { core: 'desmume', ext: '.nds' },
    // NEW CORES
    'Amstrad CPC': { core: 'caprice32', ext: '.dsk' },
    'Amstrad GX4000': { core: 'caprice32', ext: '.cpr' },
    'Atari 5200': { core: 'atari800', ext: '.bin' },
    'Atari Jaguar': { core: 'virtualjaguar', ext: '.j64' },
    'Atari Lynx': { core: 'handy', ext: '.lnx' },
    'Bandai WonderSwan Color': { core: 'beetle-wswan', ext: '.wsc' },
    'ColecoVision': { core: 'bluemsx', ext: '.col' },
    'Commodore 64': { core: 'vice_x64', ext: '.d64' },
    'GCE Vectrex': { core: 'vecx', ext: '.vec' },
    'Magnavox Odyssey 2': { core: 'o2em', ext: '.bin' },
    'Microsoft MSX': { core: 'bluemsx', ext: '.rom' },
    'Microsoft MSX2': { core: 'bluemsx', ext: '.rom' },
    'NEC PC Engine': { core: 'beetle-pce-fast', ext: '.pce' },
    'Neo Geo': { core: 'fbneo', ext: '.zip' },
    'Neo Geo Pocket': { core: 'mednafen_ngp', ext: '.ngp' },
    'Neo Geo Pocket Color': { core: 'mednafen_ngp', ext: '.ngc' },
    'Nintendo Famicom': { core: 'fceumm', ext: '.nes' },
    'Nintendo Virtual Boy': { core: 'mednafen_vb', ext: '.vb' },
    'Panasonic 3DO': { core: 'opera', ext: '.iso' },
    'Sega 32X': { core: 'picodrive', ext: '.bin' },
    'Sega CD': { core: 'genesis_plus_gx', ext: '.chd' },
    'Sega SG-1000': { core: 'genesis_plus_gx', ext: '.sg' },
    'Sega Saturn': { core: 'yabause', ext: '.chd' },
    'Sega Dreamcast': { core: 'flycast', ext: '.chd' },
    'Nintendo GameCube': { core: 'dolphin', ext: '.gcz' },
    'Sony PSP': { core: 'ppsspp', ext: '.iso' },
    'Sony Playstation': { core: 'pcsx_rearmed', ext: '.bin' },
    'Sharp X68000': { core: 'px68k', ext: '.dim' },
    'ZX Spectrum': { core: 'fuse', ext: '.tap' }
};




// DOM Elements (Lazy loaded or checked)
const getEl = (id) => document.getElementById(id);

// Initialize
async function init() {
    try {
        await runTerminalBoot();
        await loadFavorites();
        await loadRecents();
        await loadSystems();
        setupEventListeners();
        startNeuralClock();
        initTicker();
    } catch (err) {
        console.error('Initialization failed:', err);
    }
}

async function runTerminalBoot() {
    const boot = document.getElementById('terminal-boot');
    const text = boot.querySelector('.boot-text');
    boot.classList.remove('hidden');

    const lines = [
        '> Initializing Retro Launcher...',
        '> Loading systems...',
        '> Ready!'
    ];

    for (const line of lines) {
        const p = document.createElement('p');
        text.appendChild(p);
        for (const char of line) {
            p.textContent += char;
            await new Promise(r => setTimeout(r, 15));
        }
        await new Promise(r => setTimeout(r, 150));
    }

    await new Promise(r => setTimeout(r, 300));
    boot.classList.add('hidden');
}

async function loadFavorites() {
    try {
        const response = await fetch(`${API_URL}/favorites`);
        const data = await response.json();
        userFavorites = new Set(data.favorites);
    } catch (err) {
        console.error('Failed to load favorites:', err);
    }
}

async function loadRecents() {
    try {
        const response = await fetch(`${API_URL}/recents`);
        const data = await response.json();
        recentGames = data.recents;
    } catch (err) {
        console.error('Failed to load recents:', err);
    }
}

async function loadSystems() {
    const systemList = getEl('system-list');
    if (!systemList) return;

    try {
        const response = await fetch(`${API_URL}/systems`);
        const data = await response.json();

        // Keep the recents item, add systems after it
        const recentsItem = document.getElementById('system-recents');
        systemList.innerHTML = '';
        if (recentsItem) {
            systemList.appendChild(recentsItem);
        }

        data.systems.forEach(system => {
            const li = document.createElement('li');
            li.className = 'system-item';
            li.textContent = system;
            li.addEventListener('click', () => selectSystem(system));
            systemList.appendChild(li);
        });
    } catch (err) {
        console.error('Failed to load systems:', err);
    }
}

async function selectSystem(system) {
    currentSystem = system;
    const titleEl = getEl('current-system-title');
    if (titleEl) titleEl.textContent = system.toUpperCase();

    const systemListItems = document.querySelectorAll('#system-list li');
    const activeLi = Array.from(systemListItems).find(li => li.textContent === system);

    systemListItems.forEach(li => {
        if (li.classList) li.classList.remove('active');
    });
    if (activeLi && activeLi.classList) activeLi.classList.add('active');

    await loadGames(system);
}

async function selectRecents() {
    currentSystem = 'RECENTS';
    const titleEl = getEl('current-system-title');
    if (titleEl) titleEl.textContent = 'RECENTLY_PLAYED';

    document.querySelectorAll('#system-list li').forEach(li => {
        if (li.classList) li.classList.remove('active');
    });
    const recentsLi = getEl('system-recents');
    if (recentsLi) recentsLi.classList.add('active');

    displayGames(recentGames);
}

async function loadGames(system) {
    const gameGrid = getEl('game-grid');
    if (gameGrid) gameGrid.innerHTML = '<div class="placeholder-msg">SCANNING_DATA_STREAM...</div>';
    try {
        const response = await fetch(`${API_URL}/games/${system}`);
        const data = await response.json();
        allGames = data.games;
        displayGames(allGames);
    } catch (err) {
        console.error('Failed to load games:', err);
        if (gameGrid) gameGrid.innerHTML = '<div class="placeholder-msg">ERROR_FETCHING_GAMES</div>';
    }
}

function displayGames(games) {
    const gameGrid = getEl('game-grid');
    if (!gameGrid) return;

    gameGrid.innerHTML = '';
    gameGrid.classList.remove('stagger-in');
    void gameGrid.offsetWidth; // Force reflow
    gameGrid.classList.add('stagger-in');

    games.forEach((game, index) => {
        const card = document.createElement('div');
        card.className = 'game-card';
        // Set staggered delay using CSS variable
        card.style.setProperty('--delay', index);

        const artwork = document.createElement('div');
        artwork.className = 'artwork';
        const imgUrl = `${API_URL}/media/${encodeURIComponent(currentSystem)}/Images/Wheel/${encodeURIComponent(game.name)}`;
        artwork.style.backgroundImage = `url('${imgUrl}')`;
        artwork.textContent = '🎮'; // Emoji fallback

        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = game.name;

        card.appendChild(artwork);
        card.appendChild(title);

        if (userFavorites.has(`${currentSystem}|${game.name}`)) {
            card.classList.add('is-favorite');
        }

        card.addEventListener('click', () => selectGame(game));

        gameGrid.appendChild(card);
    });
}

function selectGame(game) {
    selectedGame = game;
    const executeBtn = getEl('execute-btn');
    const launchNativeBtn = getEl('launch-native-btn');
    const gameDetails = getEl('game-details');

    if (executeBtn) executeBtn.disabled = false;
    if (launchNativeBtn) launchNativeBtn.disabled = false;

    const artworkUrl = `${API_URL}/media/${encodeURIComponent(currentSystem)}/Images/Artwork3D/${encodeURIComponent(game.name)}`;
    const videoUrl = `${API_URL}/media/${encodeURIComponent(currentSystem)}/Video/${encodeURIComponent(game.name)}`;

    gameDetails.innerHTML = `
        <div class="game-info">
            <div class="media-container">
                <video id="game-preview" autoplay loop muted class="detail-video" src="${videoUrl}" onerror="this.style.display='none'"></video>
                <div class="detail-artwork" style="background-image: url('${artworkUrl}')"></div>
            </div>
            <h2>${game.name}</h2>
            <div class="meta-grid">
                <p><strong>MANUFACTURER:</strong> <span>${game.manufacturer || 'UNKNOWN'}</span></p>
                <p><strong>YEAR:</strong> <span>${game.year || 'UNKNOWN'}</span></p>
                <p><strong>GENRE:</strong> <span>${game.genre || 'RETRO'}</span></p>
                <p><strong>RATING:</strong> <span>${game.rating || 'N/A'}</span></p>
            </div>
            <hr style="margin: 15px 0; border: 0; border-top: 1px solid var(--border-color);">
            <p class="description">${game.description || 'MEMORY_CORRUPTION... NO_DATA_AVAILABLE'}</p>
        </div>
    `;

    // Try to play video if it exists
    const video = document.getElementById('game-preview');
    if (video) {
        video.onloadeddata = () => {
            const artwork = document.querySelector('.detail-artwork');
            if (artwork) artwork.style.opacity = '0.3';
        };
    }

    updateFavoriteButton();
}

function updateFavoriteButton() {
    if (!selectedGame) return;
    const favoriteBtn = getEl('favorite-btn');
    if (!favoriteBtn) return;

    const isFav = userFavorites.has(`${currentSystem}|${selectedGame.name}`);
    // Just toggle the active class, keep the ♥ icon
    favoriteBtn.classList.toggle('active', isFav);
}

async function toggleFavorite() {
    if (!selectedGame) return;
    try {
        const response = await fetch(`${API_URL}/favorites/toggle/${encodeURIComponent(currentSystem)}/${encodeURIComponent(selectedGame.name)}`, {
            method: 'POST'
        });
        const data = await response.json();

        const favId = `${currentSystem}|${selectedGame.name}`;
        if (data.status === 'added') {
            userFavorites.add(favId);
        } else {
            userFavorites.delete(favId);
        }

        updateFavoriteButton();
        // Update grid item if visible
        const cards = document.querySelectorAll('.game-card');
        cards.forEach(card => {
            if (card.querySelector('.title').textContent === selectedGame.name) {
                card.classList.toggle('is-favorite', data.status === 'added');
            }
        });
    } catch (err) {
        console.error('Toggle favorite failed:', err);
    }
}

function setupEventListeners() {
    const searchInput = getEl('game-search');
    const executeBtn = getEl('execute-btn');
    const launchNativeBtn = getEl('launch-native-btn');
    const favoriteBtn = getEl('favorite-btn');
    const recentsBtn = getEl('system-recents');
    const closeEmuBtn = getEl('close-emu');
    const gameGrid = getEl('game-grid');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (gameGrid) gameGrid.style.opacity = '0.5';

            clearTimeout(window.searchTimeout);
            window.searchTimeout = setTimeout(() => {
                const filtered = allGames.filter(g => g.name.toLowerCase().includes(query));
                displayGames(filtered);
                if (gameGrid) gameGrid.style.opacity = '1';
            }, 150);
        });
    }

    if (executeBtn) {
        executeBtn.addEventListener('click', () => {
            if (selectedGame) runEmulator(selectedGame);
        });
    }

    if (launchNativeBtn) {
        launchNativeBtn.addEventListener('click', () => {
            if (selectedGame) launchNativeGame(selectedGame);
        });
    }

    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', toggleFavorite);
    }

    if (recentsBtn) {
        recentsBtn.addEventListener('click', selectRecents);
    }

    if (closeEmuBtn) {
        closeEmuBtn.addEventListener('click', () => {
            const container = getEl('emulator-container');
            const target = getEl('emulator-target');
            if (container) container.classList.add('hidden');
            if (target) target.innerHTML = '';
        });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT') return;

        if (e.key.toLowerCase() === 'f' && selectedGame) {
            toggleFavorite();
        }
        if (e.key === 'Enter' && selectedGame) {
            if (selectedGame) runEmulator(selectedGame);
        }
        if (e.key === 'Escape' && closeEmuBtn) {
            closeEmuBtn.click();
        }
    });
}

function runEmulator(game) {
    const emuContainer = document.getElementById('emulator-container');
    const emuTarget = document.getElementById('emulator-target');
    const emuTitle = document.getElementById('emu-title');
    const logs = document.getElementById('emu-logs');

    if (!emuContainer || !emuTarget) {
        console.error("Emulator UI elements not found");
        return;
    }

    emuContainer.classList.remove('hidden');
    emuTitle.textContent = `EXECUTING: ${game.name}`;

    logs.innerHTML = `
        <p>> Initializing Neural Processor...</p>
        <p>> System: ${currentSystem}</p>
        <p>> ROM: ${game.name}</p>
        <p>> Link Established. Enjoy the simulation.</p>
    `;

    // Clear previous emulator instance
    emuTarget.innerHTML = '';

    const systemConfig = SYSTEM_CORES[currentSystem] || { core: 'nes', ext: '.nes' };
    const romUrl = `${API_URL}/rom/${encodeURIComponent(currentSystem)}/${encodeURIComponent(selectedGame.name)}${systemConfig.ext}`;

    // Track as recent
    fetch(`${API_URL}/recents/track/${encodeURIComponent(currentSystem)}/${encodeURIComponent(selectedGame.name)}`, { method: 'POST' })
        .then(() => loadRecents());

    // EmulatorJS Integration - Improved Loading logic
    window.EJS_player = '#emulator-target';
    window.EJS_core = systemConfig.core;
    window.EJS_gameUrl = romUrl;
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/latest/data/';
    window.EJS_startOnLoaded = true;

    // Clean up existing loader to force fresh initialization
    const existingLoader = document.querySelector('script[src*="loader.js"]');
    if (existingLoader) existingLoader.remove();

    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/latest/data/loader.js';
    document.body.appendChild(script);
}

async function launchNativeGame(game) {
    console.log(`🎮 LAUNCH_NATIVE triggered for ${game.name}`);
    console.log(`System: ${currentSystem}`);

    try {
        const response = await fetch(`${API_URL}/launch/${encodeURIComponent(currentSystem)}/${encodeURIComponent(game.name)}`, {
            method: 'POST'
        });
        const data = await response.json();

        console.log('Launch response:', data);

        if (data.status === 'launched') {
            console.log('✅ Native launch successful:', data.command);

            // Show user feedback
            const launchBtn = getEl('launch-native-btn');
            if (launchBtn) {
                const originalText = launchBtn.textContent;
                launchBtn.textContent = '✓ Launched!';
                setTimeout(() => launchBtn.textContent = originalText, 2000);
            }

            // Track as recent
            fetch(`${API_URL}/recents/track/${encodeURIComponent(currentSystem)}/${encodeURIComponent(game.name)}`, { method: 'POST' })
                .then(() => loadRecents());
        } else {
            console.error('Launch failed:', data);
            alert(`Launch failed: ${data.detail || 'Unknown error'}`);
        }
    } catch (err) {
        console.error('❌ Native launch failed:', err);
        alert('Failed to launch game. Check console for details.');
    }
}

function startNeuralClock() {
    const dateEl = document.getElementById('neural-date');
    const loadEl = document.getElementById('neural-load');
    if (!dateEl || !loadEl) return;

    setInterval(() => {
        const now = new Date();
        const hexTime = now.getHours().toString(16).padStart(2, '0') + ':' +
            now.getMinutes().toString(16).padStart(2, '0') + ':' +
            now.getSeconds().toString(16).padStart(2, '0');
        dateEl.textContent = `HEX_TIME: ${hexTime.toUpperCase()}`;

        if (Math.random() > 0.8) {
            const load = Math.floor(Math.random() * 20) + 5;
            loadEl.textContent = `LOAD: ${load}%`;
        }
    }, 1000);
}

function initTicker() {
    const ticker = document.getElementById('system-ticker');
    if (!ticker) return;

    const messages = [
        "RETRO_MATRIX_STABLE...",
        "DATA_CORRUPTION_DETECTED... AUTO_REPAIR_ENGAGED...",
        "NEURAL_LINK_LATENCY: 12ms...",
        "VINTAGE_SILICON_WAKE_UP...",
        "WARNING: NOSTALGIA_OVERLOAD_IMMINENT...",
        "SCANNING_DEEP_WEB_FOR_ROM_FRAGMENTS...",
        "DWAYNE_ADMIN_ACCESS_VERIFIED..."
    ];

    let i = 0;
    setInterval(() => {
        ticker.style.opacity = '0';
        setTimeout(() => {
            ticker.textContent = messages[i];
            ticker.style.opacity = '0.8';
            i = (i + 1) % messages.length;
        }, 500);
    }, 5000);
}


// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

