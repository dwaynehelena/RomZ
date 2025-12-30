import os
import logging
import platform

# Headless mode for server - No Pygame
HEADLESS = True
pygame = None

# Version actuelle de l'application
app_version = "2.3.3.3"

def get_application_root():
    try:
        current_file = os.path.abspath(__file__)
        app_root = os.path.dirname(os.path.dirname(current_file))
        return app_root
    except NameError:
        return os.path.abspath(os.getcwd())

### CONSTANTES DES CHEMINS DE BASE - Server Mode
APP_FOLDER = os.path.dirname(os.path.abspath(__file__))
# Docker volumes
USERDATA_FOLDER = "/roms"
CONFIG_FOLDER = "/config"
SAVE_FOLDER = "/config"
DATA_FOLDER = "/roms"
ROMS_FOLDER = "/roms"

# Configuration du logging
logger = logging.getLogger(__name__)

# File d'attente de téléchargements
download_queue = []
download_active = False
download_progress = {}

# Log directory
log_dir = os.path.join(CONFIG_FOLDER, "logs")
log_file = os.path.join(log_dir, "RGSX.log")

# Paths
UPDATE_FOLDER = os.path.join(APP_FOLDER, "update")
LANGUAGES_FOLDER = os.path.join(APP_FOLDER, "languages")
IMAGES_FOLDER = os.path.join(SAVE_FOLDER, "images")
GAME_LISTS_FOLDER = os.path.join(SAVE_FOLDER, "games")
GAMES_FOLDER = GAME_LISTS_FOLDER
SOURCES_FILE = os.path.join(SAVE_FOLDER, "systems_list.json")
JSON_EXTENSIONS = os.path.join(SAVE_FOLDER, "rom_extensions.json")
HISTORY_PATH = os.path.join(SAVE_FOLDER, "history.json")
DOWNLOADED_GAMES_PATH = os.path.join(SAVE_FOLDER, "downloaded_games.json")
RGSX_SETTINGS_PATH = os.path.join(SAVE_FOLDER, "rgsx_settings.json")
API_KEY_1FICHIER_PATH = os.path.join(SAVE_FOLDER, "1FichierAPI.txt")
API_KEY_ALLDEBRID_PATH = os.path.join(SAVE_FOLDER, "AllDebridAPI.txt")
API_KEY_REALDEBRID_PATH = os.path.join(SAVE_FOLDER, "RealDebridAPI.txt")

# URL - GitHub Releases
GITHUB_REPO = "RetroGameSets/RGSX"
GITHUB_RELEASES_URL = f"https://github.com/{GITHUB_REPO}/releases"
OTA_UPDATE_ZIP = f"{GITHUB_RELEASES_URL}/latest/download/RGSX_update_latest.zip"
OTA_VERSION_ENDPOINT = "https://raw.githubusercontent.com/RetroGameSets/RGSX/refs/heads/main/version.json"
OTA_SERVER_URL = "https://retrogamesets.fr/softs/"
OTA_data_ZIP = os.path.join(OTA_SERVER_URL, "games.zip")

# Binaries (Dummy paths for server mode if tools aren't installed)
# In Dockerfile we should install unzip/7z
UNRAR_EXE = "unrar"
SEVEN_Z_EXE = "7z"
XISO_EXE = "extract-xiso"
PS3DEC_EXE = "ps3dec"
GAMELISTXML = os.path.join(ROMS_FOLDER, "gamelist.xml")

# System detection
OPERATING_SYSTEM = platform.system()
SYSTEM_INFO = {}

def get_batocera_system_info():
    pass # No-op for server

def init_font():
    pass

def init_footer_font():
    pass

# Dummy accessibility settings
accessibility_settings = {}
current_font_scale_index = 0
footer_font_scale_options = []
current_footer_font_scale_index = 0
font_scale_options = []
platform_dicts = []
history = []
downloaded_games = {}
music_enabled = False
current_music = None
music_folder = ""
music_files = []
controls_config = {}
menu_state = ""
needs_redraw = False
loading_progress = 0
current_loading_system = ""
popup_message = ""
popup_timer = 0
last_frame_time = 0
pending_restart_at = 0
