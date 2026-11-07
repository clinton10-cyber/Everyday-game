#!/usr/bin/env python3
"""Voice wiring helper.  Run from the project root:  python3 tools/voice_sheet.py

1. Reads every NPC line from js/core/npcs.js.
2. Writes assets/audio/voice/SCRIPT.md  - the exact text to record, with file names.
3. Writes assets/audio/voice/lines.json - text <-> file pairs. A "file" is only
   listed if that mp3 really exists in assets/audio/voice/, so un-recorded lines
   are simply spoken by the device voice (same text as the bubble).
Record  voice/<role>_NN.mp3  (NN = number in SCRIPT.md), re-run this script, done.
"""
import re, json, os
src = open("js/core/npcs.js", encoding="utf-8").read()
roles = {}
d = re.search(r"const DIALOGUE = \{(.*?)\n\};", src, re.S).group(1)
for m in re.finditer(r"(\w+):\s*\[(.*?)\],?\s*(?=\n\s*\w+:\s*\[|\Z)", d, re.S):
    roles[m.group(1)] = re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(2))
for m in re.finditer(r"(\w+):\s*\{ label:\s*\"[^\"]+\",\s*mood:\s*\"wander\",\s*dialogue: \[(.*?)\] \}", src, re.S):
    roles[m.group(1)] = re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(2))
vdir = "assets/audio/voice"
os.makedirs(vdir, exist_ok=True)

# --- transcripts of the recordings (what each mp3 SAYS). Existing entries are kept,
# so corrections made in tools/voice_check.html are never overwritten.
sfx = open("js/core/sfx.js", encoding="utf-8").read()
say = {}
blk = re.search(r"const SAY = \{(.*?)\n\};", sfx, re.S).group(1)
for m in re.finditer(r"(\w+):\s*\[(.*?)\]", blk):
    say[m.group(1)] = re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(2))
tpath = f"{vdir}/transcripts.json"
trans = json.load(open(tpath, encoding="utf-8")) if os.path.exists(tpath) else {}
for fn in sorted(os.listdir(vdir)):
    m = re.match(r"(.+)_(\d+)\.mp3$", fn)
    if not m or fn in trans: continue
    key, n = m.group(1), int(m.group(2))
    if key in say and n - 1 < len(say[key]): trans[fn] = say[key][n - 1]
json.dump(trans, open(tpath, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

def recorded(role):
    """greet_<role>_N.mp3 files that have a transcript -> lines.json entries"""
    out = []
    for fn in sorted(os.listdir(vdir)):
        if re.match(rf"greet_{role}_\d+\.mp3$", fn) and trans.get(fn):
            out.append({"text": trans[fn], "file": fn})
    return out
lines, sheet, have = {}, ["# Voice script - record each line exactly as written\n"], 0
for role, texts in roles.items():
    sheet.append(f"\n## {role}\n")
    lines[role] = recorded(role)
    seen = {e["text"].lower() for e in lines[role]}
    for i, t in enumerate(texts, 1):
        t = t.encode().decode("unicode_escape") if "\\" in t else t
        fn = f"{role}_{i:02d}.mp3"
        ok = os.path.exists(os.path.join(vdir, fn))
        have += ok
        sheet.append(f"- `{fn}` {'[ok]' if ok else '[missing]'} - {t}")
        e = {"text": t}
        if ok: e["file"] = fn
        if t.lower() not in seen: lines[role].append(e)
open(f"{vdir}/SCRIPT.md", "w", encoding="utf-8").write("\n".join(sheet) + "\n")
json.dump(lines, open(f"{vdir}/lines.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(sum(len(v) for v in lines.values()), "lines,", have, "recorded ->", vdir + "/lines.json")
