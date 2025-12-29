import time
from playwright.sync_api import sync_playwright

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Start server in background
        import subprocess
        server = subprocess.Popen(["/home/jules/.pyenv/versions/3.12.12/bin/python", "server/main.py"], env={"CLIENT_DIR": "/app/client", "ROM_BASE_PATH": "/roms", "CONFIG_PATH": "/config"})
        time.sleep(5) # Wait for startup

        try:
            page.goto("http://localhost:8000")
            page.wait_for_selector(".app-layout", timeout=10000)

            # Verify Cyberpunk branding
            assert "CYBERDECK" in page.content()

            # Screenshot Library
            page.screenshot(path="screenshots/library_view.png")
            print("Library View Screenshot taken")

            # Navigate to Store
            page.click('[data-view="store-browse"]')
            page.wait_for_selector("#store-grid")
            time.sleep(1)
            page.screenshot(path="screenshots/store_view.png")
            print("Store View Screenshot taken")

        finally:
            server.terminate()
            browser.close()

if __name__ == "__main__":
    verify_frontend()
