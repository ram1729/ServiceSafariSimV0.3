"""Headless visual smoke test: drives the app in Chromium (SwiftShader WebGL),
captures screenshots of every screen and fails on console/page errors.

  python3 tests/visual_check.py http://localhost:8080 out_dir [venue_index ...]
"""
import sys, os, time
from playwright.sync_api import sync_playwright

url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080'
out = sys.argv[2] if len(sys.argv) > 2 else 'shots'
venues = [int(v) for v in sys.argv[3:]] or [0]
os.makedirs(out, exist_ok=True)
errors = []

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1400, 'height': 860})
    pg.set_default_timeout(180000)
    pg.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type in ('error',) and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.goto(url + '/index.html')
    pg.wait_for_timeout(800)
    pg.screenshot(path=f'{out}/01_start.png')
    pg.click('input[value="50"]')
    pg.click('.btn-run')
    pg.wait_for_selector('#sim-screen', state='visible', timeout=120000)
    pg.wait_for_timeout(4000)
    pg.screenshot(path=f'{out}/02_grid.png')
    for vi in venues:
        pg.click(f'#grid-container .cell:nth-of-type({vi + 1}) .cell-view', force=True)
        pg.wait_for_timeout(3500)
        pg.screenshot(path=f'{out}/03_detail_v{vi}_iso.png')
        pg.keyboard.press('3'); pg.wait_for_timeout(2500)
        pg.screenshot(path=f'{out}/04_detail_v{vi}_street.png')
        if os.environ.get('SHORT'):
            pg.keyboard.press('Escape'); pg.wait_for_timeout(1200); continue
        pg.keyboard.press('f'); pg.wait_for_timeout(3000)
        pg.screenshot(path=f'{out}/05_detail_v{vi}_follow.png')
        pg.keyboard.press('f'); pg.keyboard.press('2'); pg.keyboard.press('c'); pg.wait_for_timeout(2500)
        pg.screenshot(path=f'{out}/06_detail_v{vi}_top_cutaway.png')
        pg.keyboard.press('c'); pg.keyboard.press('1')
        pg.click('.db-events button:has-text("SURPRISE DELIGHT")'); pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{out}/07_detail_v{vi}_delight.png')
        pg.click('.db-events button:has-text("EMERGENCY DRILL")'); pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{out}/08_detail_v{vi}_drill.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(1200)
    pg.screenshot(path=f'{out}/09_grid_after.png')
    pg.click('.btn-end'); pg.wait_for_timeout(800)
    pg.screenshot(path=f'{out}/10_report.png', full_page=True)
    fps = pg.evaluate('App.tickCount')
    b.close()

print('ticks run:', fps)
for e in errors: print(e)
sys.exit(1 if errors else 0)
