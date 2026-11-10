#!/usr/bin/env python3
"""Render the Clinton Tech splash (branding/clinton-tech-splash.png, 2732x2732).
Content stays inside the centre ~1400px so Android centre-crop never cuts it."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, os
W = 2732; SS = 2
BG_IN, BG_OUT = (16, 30, 24), (5, 9, 7)
OR1, OR2 = (255, 214, 10), (255, 92, 0)
FONT = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"
FONT_M = "/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf"
if not os.path.exists(FONT_M): FONT_M = FONT

# background: radial gradient + faint dot grid
bg = Image.new("RGB", (W, W), BG_OUT)
px = Image.radial_gradient("L").resize((W, W))          # 0 centre -> 255 edge
bg = Image.composite(Image.new("RGB", (W, W), BG_OUT), Image.new("RGB", (W, W), BG_IN), px.point(lambda v: min(255, int(v * 1.15))))
d = ImageDraw.Draw(bg, "RGBA")
for gx in range(110, W, 110):
    for gy in range(110, W, 110):
        r = math.hypot(gx - W/2, gy - W/2) / (W/2)
        a = int(max(0, 34 * (1 - r)))
        if a: d.ellipse([gx-3, gy-3, gx+3, gy+3], fill=(255, 255, 255, a))

# mark mask (supersampled)
S = W * SS
m = Image.new("L", (S, S), 0); md = ImageDraw.Draw(m)
cx, cy = S // 2, int(S * 0.40)
R, T = 235 * SS, 58 * SS
def pol(a, r=R): return cx + r*math.cos(math.radians(a)), cy + r*math.sin(math.radians(a))
# C ring (gap on the right)
box = [cx-R-T//2, cy-R-T//2, cx+R+T//2, cy+R+T//2]
md.arc(box, 42, 318, fill=255, width=T)
for a in (42, 318):
    x, y = pol(a); md.ellipse([x-T//2, y-T//2, x+T//2, y+T//2], fill=255)
# circuit traces from the gap
tw = 26 * SS
for a, ln in ((318, 190), (42, 190)):
    x, y = pol(a); x1 = x + ln*SS
    md.line([x, y, x1, y], fill=255, width=tw)
    r = 34*SS; md.ellipse([x1-r, y-r, x1+r, y+r], fill=255)
    r2 = 15*SS; md.ellipse([x1-r2, y-r2, x1+r2, y+r2], fill=0)
x0 = cx + 40*SS; x1 = cx + R + 230*SS
md.line([x0, cy, x1, cy], fill=255, width=tw)
r = 34*SS; md.ellipse([x1-r, cy-r, x1+r, cy+r], fill=255)
r2 = 15*SS; md.ellipse([x1-r2, cy-r2, x1+r2, cy+r2], fill=0)
md.ellipse([cx-46*SS, cy-46*SS, cx+46*SS, cy+46*SS], fill=255)   # core
# hexagon frame (thin)
hx = [pol(a, 520*SS) for a in range(30, 390, 60)]
md.line(hx + [hx[0]], fill=255, width=12*SS, joint="curve")
m = m.resize((W, W), Image.LANCZOS)

# orange gradient fill + glow
grad = Image.new("RGB", (W, W)); gd = ImageDraw.Draw(grad)
for y in range(W):
    t = y / W
    gd.line([0, y, W, y], fill=tuple(int(OR1[i] + (OR2[i]-OR1[i]) * min(1, max(0, (t-0.2)/0.4))) for i in range(3)))
glow = m.filter(ImageFilter.GaussianBlur(60)).point(lambda v: int(v * 0.55))
bg.paste(Image.new("RGB", (W, W), OR2), (0, 0), glow)
bg.paste(grad, (0, 0), m)

# wordmark
d = ImageDraw.Draw(bg)
def tracked(text, font, y, fill, track, x_center=W//2, parts=None):
    widths = [d.textlength(ch, font=font) for ch in text]
    total = sum(widths) + track * (len(text) - 1)
    x = x_center - total / 2
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=font, fill=fill); x += w + track
big = ImageFont.truetype(FONT, 150)
wc, wt = "CLINTON", "TECH"
track = 34
wcw = sum(d.textlength(c, font=big) for c in wc) + track*(len(wc)-1)
wtw = sum(d.textlength(c, font=big) for c in wt) + track*(len(wt)-1)
gap = 80
x = W/2 - (wcw + gap + wtw)/2; y = int(W*0.40) + 650
for ch in wc:
    d.text((x, y), ch, font=big, fill=(244, 248, 245)); x += d.textlength(ch, font=big) + track
x += gap - track
for ch in wt:
    d.text((x, y), ch, font=big, fill=(255, 156, 26)); x += d.textlength(ch, font=big) + track
# rule + tagline
ry = y + 235
d.line([W/2-170, ry, W/2+170, ry], fill=(255, 156, 26, 255), width=6)
tag = ImageFont.truetype(FONT_M, 52)
tracked("PRESENTS", tag, ry + 40, (150, 168, 158), 26)

bg.save("branding/clinton-tech-splash.png", optimize=True)
print("ok", bg.size)
