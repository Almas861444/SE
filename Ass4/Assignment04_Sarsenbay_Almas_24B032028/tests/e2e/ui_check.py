#!/usr/bin/env python3
"""Optional real-browser UI check (Playwright + Chromium).
Setup:  pip install playwright && playwright install chromium
Run:    python3 tests/e2e/ui_check.py          (starts and stops the static server itself)
Also writes screenshots to evidence/screenshots/."""
import os, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHOTS = os.path.join(ROOT, "evidence", "screenshots"); os.makedirs(SHOTS, exist_ok=True)
PORT = os.environ.get("PORT", "8099"); URL = f"http://localhost:{PORT}/"
results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond))); print(("PASS" if cond else "FAIL"), "-", name, detail)

server = subprocess.Popen(["node", "final/server.js"], cwd=ROOT, env={**os.environ, "PORT": PORT}, stdout=subprocess.DEVNULL)
try:
    for _ in range(50):
        try: urllib.request.urlopen(URL); break
        except Exception: time.sleep(0.1)
    with sync_playwright() as p:
        browser = p.chromium.launch(); page = browser.new_page(viewport={"width": 1100, "height": 900})
        errors = []; page.on("pageerror", lambda e: errors.append(str(e))); page.on("console", lambda m: m.type == "error" and errors.append(m.text))
        page.goto(URL)
        room_ids = lambda: page.eval_on_selector_all('input[name="room"]', "els => els.map(e => e.value)")
        result = lambda: page.inner_text("#result")

        check("E1 page loads with all 5 catalog rooms", room_ids() == ["R101","R102","R201","R202","R301"], str(room_ids()))
        check("E2 equipment checkboxes are generated from the catalog", page.locator('input[name="equipment"]').count() == 5)

        page.fill("#attendees", "10"); page.check('input[value="projector"]')
        check("E3 capacity>=10 AND projector -> R101, R201, R202", room_ids() == ["R101","R201","R202"], str(room_ids()))
        check("E4 blocked room is visibly flagged", page.locator('.room[data-blocked="true"] .badge').inner_text() == "Blocked")

        page.check('input[value="R101"]', force=True); page.fill("#start", "10:30"); page.fill("#end", "11:30"); page.click("#check")
        check("E5 unsuccessful check: overlap is reported", "Not available" in result() and "Algorithms lecture" in result(), result().replace("\n"," | "))
        page.screenshot(path=os.path.join(SHOTS, "01-conflict-desktop.png"), full_page=True)

        page.uncheck('input[value="projector"]')
        page.check('input[value="R102"]', force=True)
        check("E6 room switch refreshes the result (R102 is free 10:30-11:30)", "Available" in result() and "Birch Seminar Room" in result(), result().replace("\n"," | "))
        page.screenshot(path=os.path.join(SHOTS, "02-available-after-room-switch.png"), full_page=True)

        page.check('input[value="R202"]', force=True)
        check("E7 switching to blocked room reports BLOCKED", "Room blocked" in result(), result().replace("\n"," | "))

        page.fill("#start", "09:00"); page.fill("#end", "12:00"); page.click("#check")
        check("E8 180-minute request is rejected as too long, even for the blocked room (AC2 precedes AC3)", "Booking too long" in result() and "180 minutes" in result(), result().replace("\n"," | "))
        page.check('input[value="R201"]', force=True)
        page.fill("#start", "09:00"); page.fill("#end", "11:01"); page.click("#check")
        check("E9 121-minute request is rejected (AC2 boundary)", "Booking too long" in result() and "121" in result(), result().replace("\n"," | "))
        page.fill("#end", "11:00"); page.click("#check")
        check("E10 exactly 120 minutes is accepted (AC2 boundary)", "Available" in result(), result().replace("\n"," | "))

        page.fill("#start", "8:30"); page.fill("#end", "9:30"); page.click("#check")
        check("E11 invalid time format shows a clear message (AC1/AC6)", "HH:MM" in result(), result().replace("\n"," | "))

        page.fill("#attendees", "500")
        check("E12 empty state when no room matches (F4)", "No rooms match" in page.inner_text("#rooms") and page.locator('input[name="room"]').count() == 0)
        page.screenshot(path=os.path.join(SHOTS, "03-empty-state.png"), full_page=True)
        page.click("#clear")
        check("E13 'Clear requirements' restores the full catalog", len(room_ids()) == 5)

        page.fill("#attendees", "abc")
        check("E14 invalid attendees shows a field error", "whole number" in page.inner_text("#req-error"))
        page.fill("#attendees", "")

        page.set_viewport_size({"width": 375, "height": 800}); page.reload()
        page.check('input[value="R301"]', force=True); page.fill("#start", "10:00"); page.fill("#end", "10:30"); page.click("#check")
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        check("E15 mobile 375px: no horizontal scrolling", overflow <= 0, f"overflow={overflow}px")
        check("E16 mobile layout is a single column", page.evaluate("getComputedStyle(document.querySelector('.layout')).gridTemplateColumns.split(' ').length") == 1)
        page.screenshot(path=os.path.join(SHOTS, "04-mobile-375px.png"), full_page=True)
        check("E17 no JavaScript/console errors during the whole run", not errors, str(errors))
        browser.close()
finally:
    server.terminate()
passed = sum(ok for _, ok in results)
print(f"\nBrowser UI checks: {passed}/{len(results)} passed")
sys.exit(0 if passed == len(results) else 1)
