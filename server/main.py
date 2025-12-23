import os
import json
import subprocess
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List, Dict, Optional, Set
import xmltodict

app = FastAPI(title="Cyberpunk Retro API")

FAVORITES_FILE = os.path.join(os.path.dirname(__file__), "favorites.json")
RECENTS_FILE = os.path.join(os.path.dirname(__file__), "recents.json")

def load_favorites() -> Set[str]:
    if os.path.exists(FAVORITES_FILE):
        try:
            with open(FAVORITES_FILE, "r") as f:
                return set(json.load(f))
        except:
            return set()
    return set()

def save_favorites(favorites: Set[str]):
    with open(FAVORITES_FILE, "w") as f:
        json.dump(list(favorites), f)

def load_recents() -> List[str]:
    if os.path.exists(RECENTS_FILE):
        try:
            with open(RECENTS_FILE, "r") as f:
                return json.load(f)
        except:
            return []
    return []

def save_recents(recents: List[str]):
    # Keep only top 20 recents
    with open(RECENTS_FILE, "w") as f:
        json.dump(recents[:20], f)

# Enable CORS and Performance Headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    return response

# Configuration from Environment
BASE_PATH = os.getenv("ROM_BASE_PATH", "/Volumes/2TB/2024.Android.Shield.Retro.Console.Mod.v1-MarkyMarc/HSunkyBunch/Hyperspin")
CLIENT_DIR = os.getenv("CLIENT_DIR", "/Volumes/FATTY2/RomZ/client")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))



@app.get("/api/systems")
async def get_systems():
    try:
        systems_path = os.path.join(BASE_PATH, "Emulators")
        systems = [d for d in os.listdir(systems_path) if os.path.isdir(os.path.join(systems_path, d))]
        return {"systems": sorted(systems)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/games/{system}")
async def get_games(system: str):
    db_path = os.path.join(BASE_PATH, "Databases", system, f"{system}.xml")
    if not os.path.exists(db_path):
        # Fallback to listing ROM directory if XML doesn't exist
        rom_dir = os.path.join(BASE_PATH, "Emulators", system, "roms")
        if not os.path.exists(rom_dir):
            return {"games": []}
        games = []
        for f in os.listdir(rom_dir):
            if f.endswith(('.nes', '.sfc', '.smc', '.gba', '.gb', '.gbc', '.bin', '.gen', '.zip')):
                games.append({"name": f, "description": f, "path": f})
        return {"games": sorted(games, key=lambda x: x['name'])}

    try:
        with open(db_path, "r", encoding="utf-8") as f:
            data = xmltodict.parse(f.read())
            
        menu = data.get("menu", {})
        game_list = menu.get("game", [])
        
        # Ensure game_list is a list
        if isinstance(game_list, dict):
            game_list = [game_list]
            
        games = []
        for g in game_list:
            games.append({
                "name": g.get("@name"),
                "description": g.get("description"),
                "manufacturer": g.get("manufacturer"),
                "year": g.get("year"),
                "genre": g.get("genre"),
                "rating": g.get("rating")
            })
            
        return {"games": games}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/rom/{system}/{game_name}")
async def get_rom(system: str, game_name: str):
    system_rom_dir = os.path.join(BASE_PATH, "Emulators", system, "roms")
    if not os.path.exists(system_rom_dir):
        # Try without "roms" subfolder
        system_rom_dir = os.path.join(BASE_PATH, "Emulators", system)
        if not os.path.exists(system_rom_dir):
            raise HTTPException(status_code=404, detail="System ROM directory not found")

    # Strip extension if provided (EmulatorJS often appends one)
    base_name = game_name
    # Common extensions to strip
    extensions = [
        '.zip', '.nes', '.sfc', '.smc', '.gba', '.gb', '.gbc', '.bin', '.gen', 
        '.n64', '.z64', '.v64', '.md', '.iso', '.pbp', '.cue', '.dsk', '.cpr', 
        '.j64', '.lnx', '.chd', '.a26', '.a52', '.a78', '.col', '.vec', '.rom', 
        '.pce', '.sg', '.tap', '.fds', '.wsc', '.vb', '.ngp', '.ngc', '.gcz', '.rvz'
    ]


    for ext in extensions:
        if game_name.lower().endswith(ext):
            base_name = game_name[:-len(ext)]
            break

    # Look for the file (case insensitive match)
    files = sorted(os.listdir(system_rom_dir))
    
    # 1. Exact match with stripped base
    for f in files:
        f_base = os.path.splitext(f)[0].lower()
        if f_base == base_name.lower():
            return FileResponse(os.path.join(system_rom_dir, f))
    
    # 2. Match with original game_name (if it had an extension that wasn't stripped)
    for f in files:
        if f.lower() == game_name.lower():
            return FileResponse(os.path.join(system_rom_dir, f))

    # 3. Fuzzy match: base name is in the filename
    for f in files:
        if base_name.lower() in f.lower():
            return FileResponse(os.path.join(system_rom_dir, f))
            
    raise HTTPException(status_code=404, detail=f"ROM file not found for {game_name}")

@app.get("/api/media/{system}/{media_type:path}/{game_name}")
async def get_media(system: str, media_type: str, game_name: str):
    # Construct full media directory path
    system_media_dir = os.path.join(BASE_PATH, "Media", system)
    
    # Possible variations for media_type
    search_paths = [os.path.join(system_media_dir, media_type)]
    
    # Add common fallbacks
    if "Artwork3D" in media_type:
        search_paths.append(os.path.join(system_media_dir, "Images", "Artwork3"))
        search_paths.append(os.path.join(system_media_dir, "Images", "Artwork2"))
        search_paths.append(os.path.join(system_media_dir, "Images", "Artwork1"))
    elif "Wheel" in media_type:
        search_paths.append(os.path.join(system_media_dir, "Wheel"))
    elif "Video" in media_type:
        # Check both Images/Video and just Video
        search_paths.append(os.path.join(system_media_dir, "Video"))

    print(f"DEBUG: Requesting media for {system} - {media_type} - {game_name}")
    
    for media_dir in search_paths:
        if not os.path.exists(media_dir):
            continue
            
        print(f"DEBUG: Searching in {media_dir}")
        # Case insensitive search
        try:
            files = os.listdir(media_dir)
            for f in files:
                name_without_ext = os.path.splitext(f)[0]
                if name_without_ext.lower() == game_name.lower():
                    return FileResponse(os.path.join(media_dir, f))
        except Exception as e:
            print(f"ERROR: listing media dir {media_dir}: {e}")

    raise HTTPException(status_code=404, detail=f"Media file not found for {game_name} in system {system}")


@app.get("/api/favorites")
async def get_favorites_list():
    return {"favorites": list(load_favorites())}

@app.post("/api/favorites/toggle/{system}/{game_name}")
async def toggle_favorite(system: str, game_name: str):
    fav_id = f"{system}|{game_name}"
    favorites = load_favorites()
    if fav_id in favorites:
        favorites.remove(fav_id)
        status = "removed"
    else:
        favorites.add(fav_id)
        status = "added"
    save_favorites(favorites)
    return {"status": status, "game": game_name}

@app.get("/api/recents")
async def get_recents_list():
    recents = load_recents()
    # Format: "system|game_name|timestamp" or just "system|game_name"
    # We'll return detailed objects for the frontend
    result = []
    for entry in recents:
        try:
            system, game_name = entry.split("|")
            result.append({"system": system, "name": game_name})
        except:
            continue
    return {"recents": result}

@app.post("/api/recents/track/{system}/{game_name}")
async def track_recent_game(system: str, game_name: str):
    entry = f"{system}|{game_name}"
    recents = load_recents()
    
    # Remove if already exists to move to top
    if entry in recents:
        recents.remove(entry)
    
    recents.insert(0, entry)
    save_recents(recents)
    return {"status": "tracked", "game": game_name}

@app.post("/api/launch/{system}/{game_name}")
async def launch_game(system: str, game_name: str):
    # System to RetroArch core mapping
    CORE_MAP = {
        'MAME': 'mame_libretro.dylib',
        'Nintendo Entertainment System': 'fceumm_libretro.dylib',
        'Super Nintendo Entertainment System': 'snes9x_libretro.dylib',
        'Nintendo Game Boy Advance': 'mgba_libretro.dylib',
        'Nintendo Gameboy': 'gambatte_libretro.dylib',
        'Nintendo Gameboy Color': 'gambatte_libretro.dylib',
        'Sega Genesis': 'genesis_plus_gx_libretro.dylib',
        'Nintendo 64': 'mupen64plus_next_libretro.dylib',
        'Sega Master System': 'genesis_plus_gx_libretro.dylib',
        'Sega Game Gear': 'genesis_plus_gx_libretro.dylib',
        'Atari 2600': 'stella_libretro.dylib',
        'Atari 7800': 'prosystem_libretro.dylib',
        'Sony PlayStation': 'pcsx_rearmed_libretro.dylib',
        'Nintendo DS': 'desmume_libretro.dylib',
        'Amstrad CPC': 'cap32_libretro.dylib',
        'Amstrad GX4000': 'cap32_libretro.dylib',
        'Atari 5200': 'atari800_libretro.dylib',
        'Atari Jaguar': 'virtualjaguar_libretro.dylib',
        'Atari Lynx': 'handy_libretro.dylib',
        'Bandai WonderSwan Color': 'mednafen_wswan_libretro.dylib',
        'ColecoVision': 'bluemsx_libretro.dylib',
        'Commodore 64': 'vice_x64_libretro.dylib',
        'GCE Vectrex': 'vecx_libretro.dylib',
        'Magnavox Odyssey 2': 'o2em_libretro.dylib',
        'Microsoft MSX': 'bluemsx_libretro.dylib',
        'Microsoft MSX2': 'bluemsx_libretro.dylib',
        'NEC PC Engine': 'mednafen_pce_fast_libretro.dylib',
        'Neo Geo': 'fbneo_libretro.dylib',
        'Neo Geo Pocket': 'mednafen_ngp_libretro.dylib',
        'Neo Geo Pocket Color': 'mednafen_ngp_libretro.dylib',
        'Nintendo Famicom': 'fceumm_libretro.dylib',
        'Nintendo Virtual Boy': 'mednafen_vb_libretro.dylib',
        'Panasonic 3DO': 'opera_libretro.dylib',
        'Sega 32X': 'picodrive_libretro.dylib',
        'Sega CD': 'genesis_plus_gx_libretro.dylib',
        'Sega SG-1000': 'genesis_plus_gx_libretro.dylib',
        'Sega Saturn': 'yabause_libretro.dylib',
        'Sega Dreamcast': 'flycast_libretro.dylib',
        'Nintendo GameCube': 'dolphin_libretro.dylib',
        'Sony PSP': 'ppsspp_libretro.dylib',
        'Sony Playstation': 'pcsx_rearmed_libretro.dylib',
        'Sharp X68000': 'px68k_libretro.dylib',
        'ZX Spectrum': 'fuse_libretro.dylib'
    }
    
    # Get the ROM path
    system_rom_dir = os.path.join(BASE_PATH, "Emulators", system, "roms")
    if not os.path.exists(system_rom_dir):
        system_rom_dir = os.path.join(BASE_PATH, "Emulators", system)
    
    if not os.path.exists(system_rom_dir):
        raise HTTPException(status_code=404, detail="System ROM directory not found")

    # Find the actual ROM file
    rom_file = None
    files = sorted(os.listdir(system_rom_dir))
    
    base_name = game_name
    extensions = ['.zip', '.nes', '.sfc', '.smc', '.gba', '.gb', '.gbc', '.bin', '.gen', '.n64', '.z64', '.v64', '.md', '.iso', '.pbp', '.cue', '.chd', '.gcz', '.rvz', '.dsk', '.dim']
    for ext in extensions:
        if game_name.lower().endswith(ext):
            base_name = game_name[:-len(ext)]
            break

    for f in files:
        f_base = os.path.splitext(f)[0].lower()
        if f_base == base_name.lower() or f.lower() == game_name.lower() or base_name.lower() in f.lower():
            rom_file = os.path.join(system_rom_dir, f)
            break
            
    if not rom_file:
        raise HTTPException(status_code=404, detail=f"ROM file not found for {game_name}")

    try:
        # Get the core for this system
        core_name = CORE_MAP.get(system)
        cores_dir = os.path.expanduser("~/Library/Application Support/RetroArch/cores")
        
        if core_name and os.path.exists(os.path.join(cores_dir, core_name)):
            # Launch with specific core in fullscreen
            core_path = os.path.join(cores_dir, core_name)
            cmd = ["/Applications/RetroArch.app/Contents/MacOS/RetroArch", "-f", "-L", core_path, rom_file]
            subprocess.Popen(cmd)
            return {"status": "launched", "game": game_name, "core": core_name, "command": " ".join(cmd)}
        else:
            # Fallback to GUI mode if core not found
            cmd = ["open", "-a", "RetroArch", rom_file]
            subprocess.Popen(cmd)
            return {"status": "launched", "game": game_name, "mode": "gui_fallback", "rom_path": rom_file}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to launch RetroArch: {str(e)}")

@app.get("/api/v1/system/status")
async def get_system_status():
    return {
        "status": "operational",
        "version": "1.0.0",
        "neural_link": "stable"
    }
@app.websocket("/ws")
@app.websocket("/api/v1/ws")
async def websocket_endpoint(websocket):
    # Fallback to prevent AssertionError in uvicorn/starlette when clients try to connect to non-WS endpoints
    await websocket.accept()
    try:
        while True:
            await websocket.receive_text()
    except:
        pass

# Serve client files
app.mount("/", StaticFiles(directory=CLIENT_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
