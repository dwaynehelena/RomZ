const API_BASE = '/api';

// State
let appState = {
    currentView: 'library-all',
    systems: [],
    libraryGames: [],
    storePlatforms: [],
    storeGames: [],
    favorites: new Set(),
    activeDownloads: {}, // task_id -> data
    currentSystemFilter: null
};

// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
    initClock();
    await loadInitialData();
    setupEventListeners();
    startDownloadPoller();
});

function initClock() {
    const clockEl = document.getElementById('clock');
    setInterval(() => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    }, 1000);
}

async function loadInitialData() {
    try {
        // Load Systems for Library
        const sysRes = await fetch(`${API_BASE}/systems`);
        const sysData = await sysRes.json();
        appState.systems = sysData.systems || [];
        renderSystemList();

        // Load Store Platforms
        const storeRes = await fetch(`${API_BASE}/store/platforms`);
        const storeData = await storeRes.json();
        appState.storePlatforms = storeData.platforms || [];
        renderStorePlatformSelect();

        // Load Favorites
        const favRes = await fetch(`${API_BASE}/favorites`);
        const favData = await favRes.json();
        appState.favorites = new Set(favData.favorites || []);

        // Initial Load of All Games (optional, might be heavy)
        // For now, let's load the first system if available or just wait for user
        if (appState.systems.length > 0) {
           await loadLibraryGames(appState.systems[0]);
        }
    } catch (e) {
        console.error("Init Error:", e);
        showToast("Initialization Failed: " + e.message, "error");
    }
}

// --- Rendering ---

function renderSystemList() {
    const container = document.getElementById('system-list-container');
    container.innerHTML = '';

    appState.systems.forEach(sys => {
        const div = document.createElement('div');
        div.className = 'nav-item';
        div.innerHTML = `<span>🕹️</span> ${sys}`; // Simple icon
        div.onclick = () => {
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            div.classList.add('active');
            switchView('library-all');
            loadLibraryGames(sys);
        };
        container.appendChild(div);
    });
}

function renderStorePlatformSelect() {
    const select = document.getElementById('store-platform-select');
    select.innerHTML = '<option value="">Select Platform...</option>';

    // Sort alphabetically
    appState.storePlatforms.sort((a,b) => a.name.localeCompare(b.name));

    appState.storePlatforms.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name; // Use name as ID for now based on API
        opt.textContent = p.name;
        select.appendChild(opt);
    });
}

// --- Navigation ---

function setupEventListeners() {
    // Sidebar Navigation
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            switchView(view);

            // Highlight active
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Store Platform Change
    document.getElementById('store-platform-select').addEventListener('change', (e) => {
        const platform = e.target.value;
        if (platform) {
            loadStoreGames(platform);
        }
    });

    // Search
    document.getElementById('global-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        filterGrid(query);
    });
}

function switchView(viewName) {
    appState.currentView = viewName;

    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));

    // Show target
    if (viewName.startsWith('library')) {
        document.getElementById('view-library').classList.add('active');
        if (viewName === 'library-favorites') {
             // Filter current library for favorites or re-fetch all favorites?
             // Simplified: just re-render current grid with filter
             renderLibraryGrid(appState.libraryGames.filter(g => appState.favorites.has(`${appState.currentSystemFilter}|${g.name}`)));
             document.getElementById('library-title').textContent = "FAVORITES";
        } else if (viewName === 'library-recents') {
             loadRecents();
        } else {
             renderLibraryGrid(appState.libraryGames);
             document.getElementById('library-title').textContent = appState.currentSystemFilter ? appState.currentSystemFilter.toUpperCase() : "ALL GAMES";
        }
    } else if (viewName.startsWith('store')) {
        document.getElementById('view-store').classList.add('active');
    }
}

// --- Library Logic ---

async function loadLibraryGames(system) {
    appState.currentSystemFilter = system;
    document.getElementById('library-title').textContent = `LOADING ${system.toUpperCase()}...`;

    try {
        const res = await fetch(`${API_BASE}/games/${encodeURIComponent(system)}`);
        const data = await res.json();
        appState.libraryGames = data.games || [];
        renderLibraryGrid(appState.libraryGames);
        document.getElementById('library-title').textContent = system.toUpperCase();
    } catch (e) {
        console.error("Load Games Error:", e);
    }
}

async function loadRecents() {
    document.getElementById('library-title').textContent = "RECENTS";
    try {
        const res = await fetch(`${API_BASE}/recents`);
        const data = await res.json();
        // Recents structure is diff, need to map or handle
        // For simplicity, let's just show them as simple cards
        renderLibraryGrid(data.recents.map(r => ({ name: r.name, system: r.system })));
    } catch(e) { console.error(e); }
}

function renderLibraryGrid(games) {
    const grid = document.getElementById('library-grid');
    grid.innerHTML = '';

    if (games.length === 0) {
        grid.innerHTML = '<div style="color: #666; grid-column: 1/-1; text-align: center;">NO DATA FOUND</div>';
        return;
    }

    games.forEach(game => {
        const card = document.createElement('div');
        card.className = 'game-card';
        // Add click to play
        // Card click handler

        // Image (Placeholder or valid)
        // Note: API for media not fully implemented yet, relying on CSS fallback
        const imgDiv = document.createElement('div');
        imgDiv.className = 'card-image';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'card-content';
        contentDiv.innerHTML = `
            <div class="card-title" title="${game.name}">${game.name}</div>
            <div class="card-subtitle">${appState.currentSystemFilter || game.system || 'UNK'}</div>
            <div class="card-actions" style="margin-top:8px; display:flex; gap:8px;">
                <button class="action-btn web-btn" style="flex:1; background:var(--md-sys-color-primary); border:none; border-radius:4px; padding:4px; cursor:pointer;">WEB</button>
                <button class="action-btn local-btn" style="flex:1; background:var(--md-sys-color-surface); border:1px solid #444; color:white; border-radius:4px; padding:4px; cursor:pointer;">LOCAL</button>
            </div>
        `;

        card.appendChild(imgDiv);
        card.appendChild(contentDiv);

        // Bind events
        card.querySelector('.web-btn').onclick = (e) => { e.stopPropagation(); launchEmulator(game); };
        card.querySelector('.local-btn').onclick = (e) => { e.stopPropagation(); launchNativeGame(game); };

        grid.appendChild(card);
    });
}

async function launchNativeGame(game) {
    const system = appState.currentSystemFilter || game.system;
    try {
        showToast(`Launching ${game.name} locally...`);
        const res = await fetch(`${API_BASE}/launch/${encodeURIComponent(system)}/${encodeURIComponent(game.name)}`, { method: 'POST' });
        const data = await res.json();
        if (data.status === 'launched') {
            showToast('Game Launched!', 'success');
        } else {
            showToast('Launch Failed', 'error');
        }
    } catch (e) {
        showToast('Connection Error', 'error');
    }
}

function filterGrid(query) {
    if (appState.currentView.startsWith('library')) {
        const filtered = appState.libraryGames.filter(g => g.name.toLowerCase().includes(query));
        renderLibraryGrid(filtered);
    } else if (appState.currentView === 'store-browse') {
        const filtered = appState.storeGames.filter(g => g.name.toLowerCase().includes(query));
        renderStoreGrid(filtered);
    }
}

// --- Store Logic ---

async function loadStoreGames(platform) {
    const grid = document.getElementById('store-grid');
    grid.innerHTML = '<div style="color: var(--md-sys-color-primary); grid-column: 1/-1; text-align: center;">ACCESSING NEURAL NET...</div>';

    try {
        const res = await fetch(`${API_BASE}/store/games/${encodeURIComponent(platform)}`);
        const data = await res.json();
        appState.storeGames = data.games || [];
        renderStoreGrid(appState.storeGames);
    } catch (e) {
        grid.innerHTML = `<div style="color: red; grid-column: 1/-1; text-align: center;">CONNECTION FAILED: ${e.message}</div>`;
    }
}

function renderStoreGrid(games) {
    const grid = document.getElementById('store-grid');
    grid.innerHTML = '';

    if (games.length === 0) {
        grid.innerHTML = '<div style="color: #666; grid-column: 1/-1; text-align: center;">NO TITLES FOUND</div>';
        return;
    }

    // Limit to first 100 to avoid DOM overload
    games.slice(0, 100).forEach(game => {
        const card = document.createElement('div');
        card.className = 'store-card';

        const h3 = document.createElement('h3');
        h3.textContent = game.name;
        h3.title = game.name;

        const info = document.createElement('div');
        info.style.fontSize = '12px';
        info.style.color = '#888';
        info.textContent = `${game.size || '? MB'} • ${game.region || 'W'}`;

        const btn = document.createElement('button');
        btn.className = 'download-btn';
        btn.textContent = 'DOWNLOAD';
        btn.onclick = () => triggerDownload(game, btn);

        card.appendChild(h3);
        card.appendChild(info);
        card.appendChild(btn);
        grid.appendChild(card);
    });
}

async function triggerDownload(game, btnElement) {
    const platformSelect = document.getElementById('store-platform-select');
    const platform = platformSelect.value;

    btnElement.textContent = 'QUEUING...';
    btnElement.disabled = true;
    btnElement.classList.add('downloading');

    try {
        const res = await fetch(`${API_BASE}/store/download`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                url: game.url,
                game_name: game.name,
                platform: platform
            })
        });
        const data = await res.json();

        if (data.status === 'queued') {
            showToast(`Queued: ${game.name}`);
            btnElement.textContent = 'QUEUED';
        } else {
            showToast('Download Failed', 'error');
            btnElement.textContent = 'ERROR';
            btnElement.disabled = false;
        }
    } catch (e) {
        console.error(e);
        btnElement.textContent = 'ERROR';
        btnElement.disabled = false;
    }
}

// --- Download Management ---

function startDownloadPoller() {
    setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/store/tasks`);
            const data = await res.json();
            const tasks = data.tasks || [];

            // Update active downloads state
            // Logic to update toast or UI would go here.
            // For now, let's just update the toast if there's an active download

            const active = tasks.find(t => t.task_id === 'active' || t.status === 'Downloading');
            if (active) {
                updateDownloadToast(active);
            }
        } catch (e) {
            // silent fail
        }
    }, 1000);
}

let activeToast = null;

function updateDownloadToast(task) {
    const container = document.getElementById('toast-container');

    // Check if we already have a toast for active download
    let toast = document.getElementById('active-download-toast');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'active-download-toast';
        toast.className = 'toast';
        container.appendChild(toast);
    }

    const pct = Math.round(task.progress || 0);
    const speed = task.speed ? `${task.speed.toFixed(1)} MB/s` : '';

    toast.innerHTML = `
        <div style="width: 100%">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <strong>Downloading: ${task.game_name}</strong>
                <span>${pct}%</span>
            </div>
            <div style="font-size:12px; color:#aaa;">${speed}</div>
            <div class="toast-progress">
                <div class="toast-bar" style="width: ${pct}%"></div>
            </div>
        </div>
    `;
}

function showToast(message, type='info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type === 'error') toast.style.borderLeftColor = 'var(--md-sys-color-error)';

    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    // Remove after 3s
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Emulator ---

function launchEmulator(game) {
    const overlay = document.getElementById('emulator-overlay');
    const target = document.getElementById('emulator-target');
    const title = document.getElementById('emu-game-title');

    title.textContent = `RUNNING: ${game.name.toUpperCase()}`;
    overlay.style.display = 'flex';

    // Determine core based on system
    const system = appState.currentSystemFilter || game.system;

    const SYSTEM_CORES = {
        'Nintendo Entertainment System': 'nes',
        'Super Nintendo Entertainment System': 'snes',
        'Nintendo Game Boy Advance': 'gba',
        'Nintendo Gameboy': 'gb',
        'Nintendo Gameboy Color': 'gbc',
        'Sega Genesis': 'segaMD',
        'Nintendo 64': 'n64',
        'MAME': 'mame',
        'Sega Master System': 'sms',
        'Sega Game Gear': 'gamegear',
        'Atari 2600': 'atari2600',
        'Atari 7800': 'atari7800',
        'Sony PlayStation': 'psx',
        'Nintendo DS': 'nds',
        'Amstrad CPC': 'cpc',
        'Atari 5200': 'atari5200',
        'Atari Jaguar': 'jaguar',
        'Atari Lynx': 'lynx',
        'Bandai WonderSwan Color': 'wonderswan',
        'ColecoVision': 'colecovision',
        'Commodore 64': 'c64',
        'GCE Vectrex': 'vectrex',
        'Magnavox Odyssey 2': 'odyssey2',
        'Microsoft MSX': 'msx',
        'Microsoft MSX2': 'msx',
        'NEC PC Engine': 'pce',
        'Neo Geo': 'neogeo',
        'Neo Geo Pocket': 'ngp',
        'Neo Geo Pocket Color': 'ngc',
        'Nintendo Famicom': 'nes',
        'Nintendo Virtual Boy': 'vb',
        'Panasonic 3DO': '3do',
        'Sega 32X': '32x',
        'Sega CD': 'segacd',
        'Sega Saturn': 'saturn',
        'Sega Dreamcast': 'dreamcast',
        'Nintendo GameCube': 'gamecube',
        'Sony PSP': 'psp',
        'ZX Spectrum': 'spectrum'
    };

    // Try precise match then lowercase match
    let core = SYSTEM_CORES[system] || SYSTEM_CORES[Object.keys(SYSTEM_CORES).find(k => k.toLowerCase() === system.toLowerCase())];

    if (!core) {
        // Fallback or try to guess from folder name
        if (system.toLowerCase().includes('nes')) core = 'nes';
        else if (system.toLowerCase().includes('snes')) core = 'snes';
        else core = 'nes'; // Ultimate fallback
    }

    // Construct ROM URL (Handle extension logic if needed by EmulatorJS loader, but usually URL is enough)
    const romUrl = `${API_BASE}/rom/${encodeURIComponent(system)}/${encodeURIComponent(game.name)}`;

    // Inject EmulatorJS
    target.innerHTML = '';
    window.EJS_player = '#emulator-target';
    window.EJS_core = core;
    window.EJS_gameUrl = romUrl;
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/latest/data/';
    window.EJS_startOnLoaded = true;

    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/latest/data/loader.js';
    target.appendChild(script);
}

function closeEmulator() {
    const overlay = document.getElementById('emulator-overlay');
    const target = document.getElementById('emulator-target');
    overlay.style.display = 'none';
    target.innerHTML = ''; // Kill emulator
    // Reload recents potentially
}

function toggleFullscreen() {
    const el = document.getElementById('emulator-overlay');
    if (!document.fullscreenElement) {
        el.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}
