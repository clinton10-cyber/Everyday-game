#!/usr/bin/env python3
"""Render tools/lie-lab.html: python3 tools/lie_lab_shot.py OUTDIR [cases,comma,separated]"""
import sys, os, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
out = sys.argv[1]; cases = sys.argv[2] if len(sys.argv) > 2 else ""
os.makedirs(out, exist_ok=True)
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root); H.log_message = lambda *a, **k: None
srv = socketserver.TCPServer(("127.0.0.1", 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 900, "height": 800}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"http://127.0.0.1:{port}/tools/lie-lab.html?" + (f"cases={cases}" if cases else "") + (f"&downY={os.environ['DOWNY']}" if os.environ.get("DOWNY") else ""))
    pg.wait_for_function("window.__done===true", timeout=90000)
    d = pg.evaluate("[document.getElementById('c').width, document.getElementById('c').height]")
    pg.set_viewport_size({"width": d[0], "height": d[1]}); pg.screenshot(path=os.path.join(out, "lie.png"), full_page=True)
    for k, v in pg.evaluate("window.__lie").items(): print(f"{k:14s} lowest y = {v['float']:+.3f} [{v.get('lowObj')}]  joints y: " + " ".join(f"{a}={b}" for a, b in v['parts'].items()))
    print(json.dumps(pg.evaluate("window.__dbg"), indent=0)[:1500])
    print("errors:", errs[:3]); b.close()
