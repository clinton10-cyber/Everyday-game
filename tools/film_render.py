#!/usr/bin/env python3
"""Render a scripted Everyday story to MP4 (frame-exact, 30 fps, no on-screen text).
usage: python3 tools/film_render.py STORY_ID OUT.mp4 [w=1280] [h=720] [fps=30] [only_act=-1] [still_times=a:t,a:t]
   STILLS: with env STILLS="act:progress,act:progress" writes PNG stills next to OUT instead of a video."""
import sys, os, threading, http.server, socketserver, functools, subprocess, time
from playwright.sync_api import sync_playwright
story, out = sys.argv[1], sys.argv[2]
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1280; H = int(sys.argv[4]) if len(sys.argv) > 4 else 720
FPS = int(sys.argv[5]) if len(sys.argv) > 5 else 30; ONLY = int(sys.argv[6]) if len(sys.argv) > 6 else -1
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Hd = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root); Hd.log_message = lambda *a, **k: None
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Hd); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": W, "height": H})
    pg.on("pageerror", lambda e: print("PAGEERR", e)); pg.on("console", lambda m: print("C", m.text[:200]) if m.type == "error" else None)
    pg.goto(f"http://127.0.0.1:{port}/tools/film-render.html?story={story}&w={W}&h={H}")
    pg.wait_for_function("window.__ready===true", timeout=180000)
    info = pg.evaluate("window.__story"); print(info)
    stills = os.environ.get("STILLS")
    if stills:
        for k, it in enumerate(stills.split(",")):
            a, pr = it.split(":"); pg.evaluate(f"window.__film.scrub({int(a)},{float(pr)})")
            pg.screenshot(path=f"{os.path.splitext(out)[0]}_{a}_{pr}.png")
        b.close(); sys.exit(0)
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "veryfast", "-movflags", "+faststart", out], stdin=subprocess.PIPE)
    acts = range(info["acts"]) if ONLY < 0 else [ONLY]; n = 0; t0 = time.time(); dt = 1.0 / FPS
    for a in acts:
        pg.evaluate(f"window.__film.scrub({a},0)")
        frames = int(round(info["durations"][a] * FPS))
        for f in range(frames):
            pg.evaluate(f"window.__film.advance({dt})" if f else "0")
            ff.stdin.write(pg.screenshot(type="jpeg", quality=93)); n += 1
            if n % 60 == 0: print("frame", n, "act", a, round(time.time() - t0), "s", flush=True)
    ff.stdin.close(); ff.wait(); b.close(); print("done", n, "frames", round(time.time() - t0), "s ->", out)
