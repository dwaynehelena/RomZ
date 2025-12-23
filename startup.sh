#!/bin/bash

# --- Cyberpunk Aesthetics ---
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}=================================================="
echo -e "      NEURAL_LINK.V1 // SYSTEM_INITIALIZER       "
echo -e "==================================================${NC}"

# --- Flag Parsing ---
LAUNCH_TERMINAL=false
for arg in "$@"; do
    if [ "$arg" == "--terminal" ]; then
        LAUNCH_TERMINAL=true
    fi
done

# If --terminal is requested and we're not already in the Terminal Arcade
if [ "$LAUNCH_TERMINAL" == "true" ] && [ "$TERMINAL_ARCADE_ACTIVE" != "1" ]; then
    echo -e "${MAGENTA}> Launching TERMINAL_ARCADE interface...${NC}"
    export TERMINAL_ARCADE_ACTIVE=1
    # Use the full path to the binary inside the .app bundle
    /Applications/cool-retro-term.app/Contents/MacOS/cool-retro-term -e "$0" &
    exit 0
fi


# 1. SHUTDOWN PHASE
echo -e "\n${MAGENTA}[1/3] TERMINATING_EXISTING_PROCESSES...${NC}"
PIDS=$(pgrep -f "python3 server/main.py")
if [ -z "$PIDS" ]; then
    echo -e "> No active neural links found."
else
    echo -e "> Found active nodes: $PIDS"
    kill $PIDS 2>/dev/null
    sleep 1
    echo -e "> Termination sequence complete."
fi

# Kill anything on port 8000
PORT_PID=$(lsof -t -i:8000)
if [ ! -z "$PORT_PID" ]; then
    echo -e "> Port 8000 occupied by PID: $PORT_PID. Flushing..."
    kill -9 $PORT_PID 2>/dev/null
fi

# 2. HEALTH CHECK PHASE
echo -e "\n${MAGENTA}[2/3] SCANNING_CORE_COMPONENTS...${NC}"

check_status() {
    if [ $? -eq 0 ]; then
        echo -e "> $1: ${GREEN}OPERATIONAL${NC}"
    else
        echo -e "> $1: ${RED}CRITICAL_FAILURE${NC}"
        EXIT_CODE=1
    fi
}

EXIT_CODE=0

# Check Backend
[ -f "server/main.py" ]
check_status "BACKEND_CORE (server/main.py)"

# Check Frontend
[ -f "client/index.html" ]
check_status "FRONTEND_UI (client/index.html)"

# Check ROM Volume
ROM_PATH="/Volumes/2TB/2024.Android.Shield.Retro.Console.Mod.v1-MarkyMarc"
[ -d "$ROM_PATH" ]
check_status "ROM_DATA_STREAM ($ROM_PATH)"

# Check Retro Software
[ -d "/Applications/cool-retro-term.app" ]
check_status "RETRO_TERMINAL (/Applications/cool-retro-term.app)"

[ -d "/Applications/RetroArch.app" ]
check_status "RETROARCH_CORE (/Applications/RetroArch.app)"

if [ $EXIT_CODE -ne 0 ]; then
    echo -e "\n${RED}!!! SYSTEM_ERROR: HEALTH_CHECK_FAILED !!!${NC}"
    echo -e "${RED}Please check volume mounts and file integrity.${NC}"
    exit 1
fi

# 3. STARTUP PHASE
echo -e "\n${MAGENTA}[3/3] ESTABLISHING_UPLINK...${NC}"
echo -e "> Launching FastAPI neural processor..."

# Navigate to project root if not already there (assuming script is run from project root)
PROJECT_DIR=$(pwd)

# Start in background and redirect output
nohup python3 server/main.py > server_log.txt 2>&1 &

# Wait and verify via port
echo -e "> Waiting for port 8000 to open..."
for i in {1..10}; do
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
        break
    fi
    sleep 1
done

NEW_PORT_PID=$(lsof -t -i:8000)

if [ ! -z "$NEW_PORT_PID" ]; then
    echo -e "${GREEN}> Uplink Established! PID: $NEW_PORT_PID${NC}"
    echo -e "> Access neural interface at: ${CYAN}http://localhost:8000${NC}"
    
    # Auto-launch dashboard
    echo -e "${MAGENTA}> Launching neural interface in browser...${NC}"
    open "http://localhost:8000"
    
    echo -e "=================================================="
else
    echo -e "${RED}> Uplink Failed. Check server_log.txt for data corruption.${NC}"
    exit 1
fi
