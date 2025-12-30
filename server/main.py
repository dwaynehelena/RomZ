import os
import sys
import json
import asyncio
import subprocess
import threading
import logging
from typing import List, Dict, Optional, Set, Any
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import xmltodict

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("retro-api")

# Ensure server directory is in path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# --- RGSX Integration Imports ---
try:
    from rgsx import config as rgsx_config
    from rgsx import network as rgsx_network
    from rgsx import utils as rgsx_utils
    from rgsx.rgsx_settings import get_sources_zip_url
    from rgsx.utils import extract_data, load_sources
except ImportError as e:
    logger.error(f"Failed to import RGSX modules: {e}")
    # Minimal mocks if RGSX fails to load
    class MockConfig:
        GAMES_FOLDER = "/config/games"
        SAVE_FOLDER = "/config"
        OTA_data_ZIP = ""
        download_queue = []
        download_progress = {}
        history = []
    rgsx_config = MockConfig()

app = FastAPI(title="Cyberpunk Retro API")

# --- Configuration & Paths ---
BASE_PATH = os.getenv("ROM_BASE_PATH", "/roms")
CONFIG_PATH = os.getenv("CONFIG_PATH", "/config")
CLIENT_DIR = os.getenv("CLIENT_DIR", "/app/client")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

FAVORITES_FILE = os.path.join(CONFIG_PATH, "favorites.json")
RECENTS_FILE = os.path.join(CONFIG_PATH, "recents.json")

# Ensure config directories exist
os.makedirs(CONFIG_PATH, exist_ok=True)
os.makedirs(BASE_PATH, exist_ok=True)

# --- Models ---
class DownloadRequest(BaseModel):
    url: str
    game_name: str
    platform: str

# --- RGSX Startup Logic ---
@app.on_event("startup")
async def startup_event():
    """Initializes RGSX data (downloads games.zip if needed) on server startup."""
    logger.info("Server Startup: Initializing RGSX...")

    # 1. Check if we need to download game lists
    games_folder = getattr(rgsx_config, 'GAMES_FOLDER', '/config/games')
    try:
        if not os.path.exists(games_folder) or not os.listdir(games_folder):
            logger.info("RGSX: Game lists missing. Downloading games.zip...")
            asyncio.create_task(update_rgsx_data())
        else:
            logger.info("RGSX: Game lists found.")
    except Exception as e:
        logger.error(f"Error checking game lists: {e}")

    # Start the download queue worker
    if hasattr(rgsx_network, 'download_queue_worker'):
        threading.Thread(target=rgsx_network.download_queue_worker, daemon=True).start()

async def update_rgsx_data():
    """Downloads and extracts the RGSX game database."""
    try:
        zip_url = rgsx_config.OTA_data_ZIP
        # Verify if we have a custom source
        custom_url = get_sources_zip_url(zip_url) if 'get_sources_zip_url' in globals() else zip_url
        if custom_url:
            zip_url = custom_url

        zip_path = os.path.join(rgsx_config.SAVE_FOLDER, "data_download.zip")

        logger.info(f"Downloading RGSX data from {zip_url}...")

        import requests
        with requests.get(zip_url, stream=True, timeout=60) as r:
            r.raise_for_status()
            with open(zip_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)

        logger.info("Extracting RGSX data...")
        success, msg = extract_data(zip_path, rgsx_config.SAVE_FOLDER, zip_url)
        if success:
            logger.info(f"RGSX Data Updated: {msg}")
            if os.path.exists(zip_path):
                os.remove(zip_path)
        else:
            logger.error(f"RGSX Extraction Failed: {msg}")

    except Exception as e:
        logger.error(f"Failed to update RGSX data: {e}")

# --- Helper Functions ---
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
    with open(RECENTS_FILE, "w") as f:
        json.dump(recents[:20], f)

# --- Middleware ---
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

# --- API Endpoints: Library ---

@app.get("/api/systems")
async def get_systems():
    try:
        # Scan /roms directory
        systems = []
        if os.path.exists(BASE_PATH):
            for d in os.listdir(BASE_PATH):
                full_path = os.path.join(BASE_PATH, d)
                if os.path.isdir(full_path) and not d.startswith('.'):
                    if any(os.path.isfile(os.path.join(full_path, f)) for f in os.listdir(full_path)):
                         systems.append(d)
        return {"systems": sorted(systems)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/games/{system}")
async def get_games(system: str):
    rom_dir = os.path.join(BASE_PATH, system)
    if not os.path.exists(rom_dir):
        rom_dir = os.path.join(BASE_PATH, "Emulators", system, "roms")
        if not os.path.exists(rom_dir):
             return {"games": []}

    games = []
    try:
        valid_exts = ('.zip', '.nes', '.sfc', '.smc', '.gba', '.gb', '.gbc', '.bin', '.gen',
                      '.n64', '.z64', '.v64', '.md', '.iso', '.pbp', '.cue', '.chd', '.gcz', '.rvz', '.dsk', '.dim')
        
        for f in os.listdir(rom_dir):
            if f.lower().endswith(valid_exts):
                games.append({
                    "name": f,
                    "description": f,
                    "path": f
                })
        return {"games": sorted(games, key=lambda x: x['name'])}
    except Exception as e:
        logger.error(f"Error listing games for {system}: {e}")
        return {"games": []}

@app.get("/api/rom/{system}/{game_name}")
async def get_rom(system: str, game_name: str):
    search_dirs = [
        os.path.join(BASE_PATH, system),
        os.path.join(BASE_PATH, "Emulators", system, "roms")
    ]
    
    base_name = os.path.splitext(game_name)[0]
    
    for d in search_dirs:
        if not os.path.exists(d): continue
        for f in os.listdir(d):
            if f == game_name or os.path.splitext(f)[0] == base_name:
                return FileResponse(os.path.join(d, f))

    raise HTTPException(status_code=404, detail="ROM not found")

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
    result = []
    for entry in recents:
        try:
            parts = entry.split("|")
            if len(parts) >= 2:
                result.append({"system": parts[0], "name": parts[1]})
        except:
            continue
    return {"recents": result}

@app.post("/api/recents/track/{system}/{game_name}")
async def track_recent_game(system: str, game_name: str):
    entry = f"{system}|{game_name}"
    recents = load_recents()
    if entry in recents:
        recents.remove(entry)
    recents.insert(0, entry)
    save_recents(recents)
    return {"status": "tracked", "game": game_name}

@app.post("/api/launch/{system}/{game_name}")
async def launch_game(system: str, game_name: str):
    # Try local launch logic
    try:
        # Resolve ROM path
        rom_path = None
        search_dirs = [
            os.path.join(BASE_PATH, system),
            os.path.join(BASE_PATH, "Emulators", system, "roms")
        ]
        base_name = os.path.splitext(game_name)[0]
        for d in search_dirs:
            if not os.path.exists(d): continue
            for f in os.listdir(d):
                if f == game_name or os.path.splitext(f)[0] == base_name:
                    rom_path = os.path.join(d, f)
                    break
            if rom_path: break

        if not rom_path:
            raise HTTPException(status_code=404, detail="ROM not found")

        # Command to launch RetroArch (Adjust based on host OS if possible, or assume generic 'retroarch')
        # In Docker, this executes IN the container.
        # Ideally, we should communicate with the host, but here we assume a local setup or mapped socket.
        cmd = ["retroarch", "-L", f"{system}_libretro.so", rom_path]

        # Check if 'retroarch' is in path
        if shutil.which("retroarch"):
             subprocess.Popen(cmd)
             return {"status": "launched", "command": " ".join(cmd)}
        else:
             # Fallback: just try to open it (macOS/Linux)
             if sys.platform == "darwin":
                 subprocess.Popen(["open", "-a", "RetroArch", rom_path])
             else:
                 subprocess.Popen(["xdg-open", rom_path])
             return {"status": "launched", "mode": "fallback"}

    except Exception as e:
        logger.error(f"Launch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

import shutil

# --- API Endpoints: Store (RGSX) ---

@app.get("/api/store/platforms")
async def get_store_platforms():
    """Returns the list of systems available in RGSX."""
    try:
        sources = load_sources()
        platforms = []
        for s in sources:
            platforms.append({
                "id": s.get("id"),
                "name": s.get("platform_name"),
                "folder": s.get("folder") or s.get("dossier")
            })
        return {"platforms": platforms}
    except Exception as e:
        logger.error(f"Error loading store platforms: {e}")
        return {"platforms": [], "error": str(e)}

@app.get("/api/store/games/{platform_name}")
async def get_store_games(platform_name: str):
    """Returns the game list for a specific RGSX platform."""
    try:
        json_path = os.path.join(rgsx_config.GAMES_FOLDER, f"{platform_name}.json")
        if not os.path.exists(json_path):
            return {"games": [], "error": "Game list not found"}
            
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            games = []
            raw_list = data.get("game_list", []) if isinstance(data, dict) else data

            for g in raw_list:
                games.append({
                    "name": g.get("name"),
                    "url": g.get("url"),
                    "size": g.get("size", "Unknown"),
                    "region": g.get("region", "")
                })
            return {"games": games}
    except Exception as e:
        logger.error(f"Error loading store games for {platform_name}: {e}")
        return {"games": [], "error": str(e)}

@app.post("/api/store/download")
async def download_game(request: DownloadRequest, background_tasks: BackgroundTasks):
    """Initiates a download task."""
    try:
        import time
        task_id = str(int(time.time() * 1000))
        job = {
            "url": request.url,
            "game_name": request.game_name,
            "platform": request.platform,
            "task_id": task_id,
            "is_zip_non_supported": False
        }
        rgsx_config.download_queue.append(job)
        return {"status": "queued", "task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/store/tasks")
async def get_tasks():
    try:
        tasks = []
        for url, data in rgsx_config.download_progress.items():
            tasks.append({
                "task_id": "active",
                "game_name": data.get("game_name", "Unknown"),
                "platform": data.get("platform", ""),
                "status": data.get("status", "Downloading"),
                "progress": data.get("progress_percent", 0),
                "speed": data.get("speed", 0),
            })
        for i, job in enumerate(rgsx_config.download_queue):
            tasks.append({
                "task_id": job.get("task_id"),
                "game_name": job.get("game_name"),
                "status": "Queued"
            })
        return {"tasks": tasks}
    except Exception as e:
        return {"tasks": [], "error": str(e)}

@app.post("/api/store/cancel/{task_id}")
async def cancel_task(task_id: str):
    try:
        from rgsx.network import request_cancel
        success = request_cancel(task_id)
        rgsx_config.download_queue = [j for j in rgsx_config.download_queue if j.get("task_id") != task_id]
        return {"status": "cancelled", "success": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Serve client files (SPA catch-all could be better but static mount is fine for this structure)
app.mount("/", StaticFiles(directory=CLIENT_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
