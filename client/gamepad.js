// Gamepad Control Logic for Retro CyberDeck

const GamepadController = {
    connected: false,
    gamepadIndex: null,
    pollingInterval: null,

    // Mapping (Standard XInput)
    BUTTONS: {
        A: 0,
        B: 1,
        X: 2,
        Y: 3,
        LB: 4,
        RB: 5,
        LT: 6,
        RT: 7,
        SELECT: 8,
        START: 9,
        L3: 10,
        R3: 11,
        UP: 12,
        DOWN: 13,
        LEFT: 14,
        RIGHT: 15
    },

    init() {
        window.addEventListener("gamepadconnected", (e) => {
            console.log("Gamepad connected:", e.gamepad.id);
            this.connected = true;
            this.gamepadIndex = e.gamepad.index;
            this.startPolling();
            showToast("🎮 Gamepad Connected");
        });

        window.addEventListener("gamepaddisconnected", (e) => {
            console.log("Gamepad disconnected");
            this.connected = false;
            this.stopPolling();
            showToast("🎮 Gamepad Disconnected");
        });
    },

    startPolling() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(() => this.poll(), 100); // 100ms poll rate for UI nav
    },

    stopPolling() {
        clearInterval(this.pollingInterval);
    },

    poll() {
        const gp = navigator.getGamepads()[this.gamepadIndex];
        if (!gp) return;

        // Navigation Logic
        // Simple D-pad mapping to arrow keys event dispatching

        if (gp.buttons[this.BUTTONS.DOWN].pressed) {
            this.dispatchKey('ArrowDown');
        } else if (gp.buttons[this.BUTTONS.UP].pressed) {
            this.dispatchKey('ArrowUp');
        } else if (gp.buttons[this.BUTTONS.LEFT].pressed) {
            this.dispatchKey('ArrowLeft');
        } else if (gp.buttons[this.BUTTONS.RIGHT].pressed) {
            this.dispatchKey('ArrowRight');
        } else if (gp.buttons[this.BUTTONS.A].pressed) {
            this.dispatchKey('Enter');
        } else if (gp.buttons[this.BUTTONS.B].pressed) {
            // Back / Escape logic
            // If emulator is open, close it?
            // If in store, go back?
            this.dispatchKey('Escape');
        }
    },

    dispatchKey(key) {
        // Debounce simple
        if (this.lastPressed && Date.now() - this.lastPressed < 200) return;
        this.lastPressed = Date.now();

        // Dispatch synthetic event for app.js to handle or default browser focus nav
        // We rely on default focus navigation for now
        const active = document.activeElement;

        // Custom handling for grid navigation if needed
        // For now, let's just simulate key events
        const event = new KeyboardEvent('keydown', { key: key, bubbles: true });
        document.dispatchEvent(event);

        // Manual focus moving logic could go here
    }
};

GamepadController.init();
