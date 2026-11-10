#!/usr/bin/env python3
"""Regenerate precache.json (the offline file list the service worker installs).
Run from the project root after adding/removing files:  python3 tools/build_precache.py
"""
import json, os
EXT = {".js",".css",".html",".json",".svg",".png",".webmanifest",".mp3",".wav",".jpg",".jpeg",".webp",".glb",".woff2"}
SKIP_DIRS = {"branding", "tools", "node_modules", ".git", "dist"}
SKIP_FILES = {"precache.json", "package.json", "sw.js", "lines.example.json"}
out = []
for root, dirs, files in os.walk("."):
    dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith("."))
    for f in sorted(files):
        if f in SKIP_FILES or os.path.splitext(f)[1].lower() not in EXT: continue
        out.append(os.path.join(root, f)[2:].replace(os.sep, "/"))
out.sort()
json.dump({"files": out}, open("precache.json", "w"), indent=0)
print(len(out), "files ->", "precache.json")
