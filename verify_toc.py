import time
from playwright.sync_api import sync_playwright

def verify_toc():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        # Wait for server to start
        max_retries = 10
        for i in range(max_retries):
            try:
                page.goto("http://localhost:5173", timeout=3000)
                break
            except:
                time.sleep(1)

        # Initial state (Split view)
        page.screenshot(path="/home/jules/verification/initial_split.png")

        # Switch to Preview Mode
        page.get_by_role("button", name="Xem trước").click()
        time.sleep(1) # Animation wait

        # Check for TOC existence
        # The TOC header is "Mục lục"
        toc_header = page.get_by_text("Mục lục")
        if toc_header.is_visible():
            print("TOC is visible in Preview mode.")
        else:
            print("TOC is NOT visible in Preview mode.")

        # Take screenshot of Preview Mode with TOC
        page.screenshot(path="/home/jules/verification/preview_with_toc.png")

        # Switch back to Split view to ensure TOC is gone
        page.get_by_role("button", name="Song song").click()
        time.sleep(1)
        page.screenshot(path="/home/jules/verification/back_to_split.png")

        browser.close()

if __name__ == "__main__":
    verify_toc()
