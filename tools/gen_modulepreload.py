#!/usr/bin/env python3
"""Regenerate the <link rel="modulepreload"> block in index.html.

Why: the game is ~120 separate ES modules. Without hints the browser discovers them one
import-level at a time (a slow waterfall on phones). Preloading the whole static import
graph lets it download them all in parallel. Run from the project root after adding or
removing JS files:   python3 tools/gen_modulepreload.py
"""
import os, re
ENTRIES = ["js/main.js", "js/ui/hud.js", "js/core/sanity.js", "js/pwa.js"]
SCENES  = ["js/scenes/drive.js", "js/scenes/city.js"]      # first scenes the game opens
START, END = "<!-- modulepreload:start -->", "<!-- modulepreload:end -->"
IMPORTMAP = {"three": "vendor/three/three.module.min.js", "three/addons/": "vendor/three/addons/"}
seen, order = set(), []
def visit(f):
    f = os.path.normpath(f)
    if f in seen or not os.path.exists(f): return
    seen.add(f); order.append(f)
    s = re.sub(r"/\*.*?\*/", "", open(f, encoding="utf-8", errors="replace").read(), flags=re.S)
    for m in re.finditer(r"(?:^|[;\n}])\s*(?:import|export)\s*(?:[^\"';]*?\s+from\s*)?[\"']([^\"']+)[\"']", s):
        spec = m.group(1)
        if spec.startswith("."): visit(os.path.join(os.path.dirname(f), spec))
        elif spec == "three": visit(IMPORTMAP["three"])
        elif spec.startswith("three/addons/"): visit(IMPORTMAP["three/addons/"] + spec[len("three/addons/"):])
for e in ENTRIES + SCENES: visit(e)
links = "\n".join('<link rel="modulepreload" href="%s">' % p.replace(os.sep, "/") for p in order if p.endswith(".js"))
html = open("index.html", encoding="utf-8").read()
block = START + "\n" + links + "\n" + END
if START in html:
    html = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: block, html, flags=re.S)
else:  # first run: put it right after the import map
    html = re.sub(r"(<script type=\"importmap\">.*?</script>)", lambda m: m.group(1) + "\n" + block, html, count=1, flags=re.S)
open("index.html", "w", encoding="utf-8").write(html)
print(len(order), "modules preloaded")
