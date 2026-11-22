#!/usr/bin/env python3
"""Record every fight move from tools/fight-lab.html as slow-motion mp4 clips (side + front view) and one reel.
usage: python3 tools/fight_lab_video.py OUTDIR [moves,comma,separated] [slowdown=2]"""
import sys, os, threading, http.server, socketserver, functools, subprocess, io, shutil
from playwright.sync_api import sync_playwright
from PIL import Image
out = sys.argv[1]; moves = sys.argv[2] if len(sys.argv) > 2 else ""; slow = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0
os.makedirs(out, exist_ok=True); tmp = os.path.join(out, "_frames"); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root); H.log_message = lambda *a, **k: None
srv = socketserver.TCPServer(("127.0.0.1", 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
clips = []
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 560, "height": 420})
    pg.goto(f"http://127.0.0.1:{port}/tools/fight-lab.html?video=1&w=560&h=420" + (f"&moves={moves}" if moves else ""))
    pg.wait_for_function("window.__done===true", timeout=60000)
    names = pg.evaluate("window.__fl.names"); cv = pg.locator("body")
    for name in names:
        d = os.path.join(tmp, name); os.makedirs(d); pg.evaluate(f"window.__fl.begin('{name}')")
        n = 0; more = True
        while more and n < 200:
            more = pg.evaluate("window.__fl.step()")
            ims = []
            for v in ("side", "front"):
                pg.evaluate(f"window.__fl.draw('{v}')")
                ims.append(Image.open(io.BytesIO(pg.screenshot(clip={"x": 0, "y": 0, "width": 560, "height": 420}))).convert("RGB"))
            w = Image.new("RGB", (1120, 420)); w.paste(ims[0], (0, 0)); w.paste(ims[1], (560, 0))
            w.save(os.path.join(d, f"{n:04d}.png")); n += 1
        for k in range(10): shutil.copy(os.path.join(d, f"{n-1:04d}.png"), os.path.join(d, f"{n+k:04d}.png"))   # hold last pose
        fps = 60.0 / slow
        mp4 = os.path.join(out, f"{name}.mp4")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", os.path.join(d, "%04d.png"), "-pix_fmt", "yuv420p", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", mp4], check=True)
        clips.append(mp4); print("recorded", name, n, "frames")
    b.close()
lst = os.path.join(out, "_list.txt"); open(lst, "w").write("".join(f"file '{c}'\n" for c in clips))
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", os.path.join(out, "ALL-MOVES-reel.mp4")], check=True)
shutil.rmtree(tmp, ignore_errors=True)
