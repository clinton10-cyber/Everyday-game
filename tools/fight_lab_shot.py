#!/usr/bin/env python3
"""Render tools/fight-lab.html with headless Chromium and save contact sheets.
usage: python3 tools/fight_lab_shot.py OUTDIR [moves,comma,separated] [cols]"""
import sys, json, threading, http.server, socketserver, functools, os
from playwright.sync_api import sync_playwright
out = sys.argv[1]; moves = sys.argv[2] if len(sys.argv) > 2 else ""; cols = sys.argv[3] if len(sys.argv) > 3 else "8"
gap = sys.argv[4] if len(sys.argv) > 4 else ""
os.makedirs(out, exist_ok=True)
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root)
H.log_message = lambda *a, **k: None
srv = socketserver.TCPServer(("127.0.0.1", 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1000, "height": 800})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(f"http://127.0.0.1:{port}/tools/fight-lab.html?cols={cols}" + (f"&gap={gap}" if gap else "") + (f"&moves={moves}" if moves else ""))
    try: pg.wait_for_function("window.__done===true", timeout=120000)
    except Exception as e: print("TIMEOUT", e, errs[:5]); b.close(); sys.exit(1)
    dims = pg.evaluate("[document.getElementById('c').width, document.getElementById('c').height]")
    pg.set_viewport_size({"width": dims[0], "height": dims[1]})
    pg.screenshot(path=os.path.join(out, "sheet.png"), full_page=True)
    json.dump(pg.evaluate("window.__contact"), open(os.path.join(out, "contact.json"), "w"), indent=1)
    c = json.load(open(os.path.join(out, "contact.json")))
    for k, v in c.items(): print(f"{k:12s} gap {v['reachGap']:.2f}  dist {v['dist']:.2f}  dz {v.get('dz')}  dy {v['dy']}  ({v['part']})")
    b.close()
