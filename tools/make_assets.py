#!/usr/bin/env python3
"""Rush Track asset pipeline.

Renders the game's 2D art as crisp PNGs (4x supersampled) from vector
primitives — the same approach the web build used, so the Android game and
the web build share one art direction. Pure Pillow, no external assets.

Run:  python3 tools/make_assets.py
"""
import math
import os
import shutil

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, "game", "assets")
SS = 4  # supersample factor


def canvas(w, h, ss=SS):
    img = Image.new("RGBA", (w * ss, h * ss), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img), ss


def finish(img, ss=SS, out_w=None, out_h=None):
    w, h = img.size
    out = img.resize((w // ss, h // ss), Image.LANCZOS)
    if out_w and out_h:
        out = out.resize((out_w, out_h), Image.LANCZOS)
    return out


def rrect(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def poly(d, pts, fill=None, outline=None, width=1):
    d.polygon(pts, fill=fill, outline=outline, width=width)


def line(d, a, b, fill, w=1):
    d.line([a, b], fill=fill, width=w)


def circle(d, c, r, fill=None, outline=None, width=1):
    d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=fill, outline=outline, width=width)


def arc(d, c, r, a0, a1, fill, w=2):
    d.arc([c[0] - r, c[1] - r, c[0] + r, c[1] + r], a0, a1, fill=fill, width=w)


# ===================================================================== LOGO
def make_logo():
    W, H = 1600, 520
    # Work at 2x then downsample for crisp antialiasing.
    S = 2
    big = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    fpath = os.path.join(ROOT, "game", "assets", "fonts", "TitanOne.ttf")
    font = ImageFont.truetype(fpath, 200 * S)
    cx = W * S // 2

    def txt(x, y, s_, fill):
        d.text((x * S, y * S), s_, font=font, fill=fill, anchor="mm")

    # Drop shadows (offset dark copies, drawn first).
    txt(cx / S + 9, 142 + 9, "RUSH", (12, 14, 26, 230))
    txt(cx / S + 9, 348 + 9, "TRACK", (120, 44, 0, 230))
    # Main wordmark.
    txt(cx / S, 142, "RUSH", (255, 255, 255, 255))
    txt(cx / S, 348, "TRACK", (255, 122, 20, 255))

    # Thin keyline between words.
    d.line([330 * S, 246 * S, 1270 * S, 246 * S], fill=(255, 255, 255, 150), width=4 * S)

    # Swoosh under the wordmark.
    poly(d, [(180 * S, 448 * S), (1420 * S, 410 * S), (1420 * S, 432 * S), (180 * S, 474 * S)],
         fill=(255, 122, 20, 235))
    # Speed lines.
    for x0, y0, x1, y1, w in [(90, 440, 150, 434, 6), (60, 470, 120, 466, 5), (1480, 420, 1560, 414, 6)]:
        line(d, (x0 * S, y0 * S), (x1 * S, y1 * S), (255, 255, 255, 220), w * S)
    # Checkered flag accent.
    fx, fy, fs = 1380 * S, 300 * S, 24 * S
    for r in range(3):
        for c in range(4):
            col = (255, 255, 255, 255) if (r + c) % 2 == 0 else (15, 18, 30, 255)
            poly(d, [(fx + c * fs, fy + r * fs), (fx + (c + 1) * fs, fy + r * fs),
                     (fx + (c + 1) * fs + 6 * S, fy + r * fs + fs), (fx + c * fs + 6 * S, fy + r * fs + fs)],
                 fill=col)
    line(d, ((fx - 26 * S), fy + 78 * S), (fx - 26 * S, fy - 30 * S), (255, 255, 255, 235), 7 * S)

    # Subtle forward skew for speed (right side shifts up slightly).
    img = big.transform((W * S, H * S), Image.AFFINE, (1, 0, -20, -0.10, 1, 0), resample=Image.BICUBIC)
    img = img.resize((W, H), Image.LANCZOS)
    out = os.path.join(ASSETS, "ui", "logo.png")
    img.save(out)
    print("wrote", out)


# ====================================================================== COIN
def make_coin():
    S = 128
    img, d, ss = canvas(S, S)
    c = (S * ss) // 2
    R = int(S * ss * 0.46)
    circle(d, (c, c), R, fill=(214, 148, 20, 255))                       # rim
    circle(d, (c, c), int(R * 0.82), fill=(255, 200, 60, 255))           # face
    circle(d, (c, c), int(R * 0.62), fill=(255, 178, 30, 255))           # inner ring
    circle(d, (c, c), int(R * 0.56), fill=(255, 208, 74, 255))
    # bolt emblem
    b = int(R * 0.30)
    pts = [(c + int(b*0.15), c - b), (c - b, c + int(b*0.25)), (c - int(b*0.15), c + int(b*0.25)),
           (c - int(b*0.3), c + b), (c + b, c - int(b*0.25)), (c + int(b*0.15), c - int(b*0.25))]
    poly(d, pts, fill=(120, 70, 8, 255))
    # shine
    arc(d, (c, c), int(R * 0.9), 200, 300, (255, 240, 180, 235), int(ss * 5))
    img2 = finish(img)
    out = os.path.join(ASSETS, "ui", "icon_coin.png")
    img2.save(out)
    print("wrote", out)


# ====================================================================== FUEL
def make_fuel():
    S = 128
    img, d, ss = canvas(S, S)
    u = S * ss / 128.0
    # jerrycan body
    rrect(d, (22 * u, 30 * u, 106 * u, 118 * u), 12 * u, fill=(224, 62, 44, 255))
    rrect(d, (28 * u, 36 * u, 100 * u, 112 * u), 9 * u, fill=(244, 92, 60, 255))
    # cap + spout
    rrect(d, (66 * u, 12 * u, 92 * u, 34 * u), 6 * u, fill=(190, 44, 32, 255))
    rrect(d, (88 * u, 14 * u, 108 * u, 26 * u), 5 * u, fill=(190, 44, 32, 255))
    rrect(d, (70 * u, 8 * u, 88 * u, 16 * u), 4 * u, fill=(230, 230, 235, 255))
    # grip ridges
    for i in range(3):
        y = (52 + i * 16) * u
        line(d, (34 * u, y), (96 * u, y), (190, 44, 32, 255), int(5 * u))
    # drop emblem
    poly(d, [(64 * u, 60 * u), (78 * u, 84 * u), (78 * u, 100 * u), (50 * u, 100 * u), (50 * u, 84 * u)],
         fill=(255, 235, 220, 255))
    poly(d, [(64 * u, 68 * u), (73 * u, 85 * u), (73 * u, 96 * u), (55 * u, 96 * u), (55 * u, 85 * u)],
         fill=(224, 62, 44, 255))
    # shine
    line(d, (30 * u, 42 * u), (46 * u, 36 * u), (255, 200, 180, 160), int(6 * u))
    img2 = finish(img)
    out = os.path.join(ASSETS, "ui", "icon_fuel.png")
    img2.save(out)
    print("wrote", out)


# ===================================================================== WHEEL
def make_wheel():
    S = 128
    img, d, ss = canvas(S, S)
    c = (S * ss) // 2
    R = int(S * ss * 0.48)
    circle(d, (c, c), R, fill=(24, 26, 32, 255))                 # tire
    circle(d, (c, c), int(R * 0.92), fill=(40, 44, 54, 255))     # tire inner
    circle(d, (c, c), int(R * 0.55), fill=(168, 176, 190, 255))  # rim
    circle(d, (c, c), int(R * 0.48), fill=(120, 128, 144, 255))
    # tread notches
    for i in range(12):
        a = i * math.tau / 12
        x0 = c + math.cos(a) * R * 0.98
        y0 = c + math.sin(a) * R * 0.98
        x1 = c + math.cos(a) * R * 0.82
        y1 = c + math.sin(a) * R * 0.82
        line(d, (x0, y0), (x1, y1), (16, 18, 24, 255), int(ss * 4))
    # spokes
    for i in range(5):
        a = i * math.tau / 5 - math.pi / 2
        x1 = c + math.cos(a) * R * 0.42
        y1 = c + math.sin(a) * R * 0.42
        line(d, (c, c), (x1, y1), (226, 232, 242, 255), int(ss * 5))
    circle(d, (c, c), int(R * 0.16), fill=(244, 246, 250, 255))  # hub
    circle(d, (c, c), int(R * 0.07), fill=(90, 96, 110, 255))
    img2 = finish(img)
    out = os.path.join(ASSETS, "vehicles", "wheel.png")
    img2.save(out)
    print("wrote", out)


# ==================================================================== DRIVER
def make_driver():
    """Origin at hip center. Canvas 48x72 (world ~24x36px at 0.5 scale... see vehicle.gd)."""
    W, H = 48, 72
    img, d, ss = canvas(W, H)
    u = W * ss / 48.0
    # coordinate: hip at (24, 46) local
    hx, hy = 24 * u, 46 * u
    # legs
    line(d, (hx - 6 * u, hy), (hx - 10 * u, hy + 18 * u), (38, 42, 56, 255), int(7 * u))
    line(d, (hx + 6 * u, hy), (hx + 10 * u, hy + 18 * u), (38, 42, 56, 255), int(7 * u))
    circle(d, (hx - 10 * u, hy + 19 * u), 4 * u, fill=(20, 22, 28, 255))
    circle(d, (hx + 10 * u, hy + 19 * u), 4 * u, fill=(20, 22, 28, 255))
    # torso (racing suit)
    rrect(d, (hx - 9 * u, hy - 16 * u, hx + 9 * u, hy + 4 * u), 6 * u, fill=(255, 122, 20, 255))
    rrect(d, (hx - 9 * u, hy - 16 * u, hx + 9 * u, hy - 8 * u), 6 * u, fill=(255, 150, 60, 255))
    line(d, (hx, hy - 15 * u), (hx, hy + 2 * u), (240, 240, 245, 255), int(3 * u))  # zipper
    # arms to steering
    line(d, (hx - 8 * u, hy - 12 * u), (hx - 13 * u, hy - 20 * u), (255, 122, 20, 255), int(6 * u))
    line(d, (hx + 8 * u, hy - 12 * u), (hx + 13 * u, hy - 20 * u), (255, 122, 20, 255), int(6 * u))
    # helmet
    circle(d, (hx, hy - 26 * u), 11 * u, fill=(245, 247, 250, 255))
    circle(d, (hx, hy - 26 * u), 11 * u, outline=(180, 186, 198, 255), width=int(2 * u))
    # visor
    rrect(d, (hx - 8 * u, hy - 30 * u, hx + 10 * u, hy - 22 * u), 4 * u, fill=(40, 70, 110, 255))
    arc(d, (hx, hy - 26 * u), 11 * u, 300, 60, (255, 122, 20, 255), int(3 * u))  # helmet stripe
    img2 = finish(img)
    out = os.path.join(ASSETS, "characters", "driver.png")
    img2.save(out)
    print("wrote", out)


# ================================================================= VEHICLES
def _shading(d, box, top, bottom, r=6):
    w = box[2] - box[0]
    h = box[3] - box[1]
    n = 8
    for i in range(n):
        t = i / (n - 1)
        c1 = tuple(int(top[j] + (bottom[j] - top[j]) * t) for j in range(3))
        y0 = box[1] + h * i / n
        y1 = box[1] + h * (i + 1) / n + 1
        rrect(d, (box[0], y0, box[2], y1), r, fill=(c1[0], c1[1], c1[2], 255))


def make_buggy():
    """46 wide x 20 tall (world px at 1:1). Chassis center = canvas center."""
    W, H = 92, 48
    img, d, ss = canvas(W, H)
    u = W * ss / 92.0
    cx, cy = 46 * u, 20 * u
    # chassis
    body_pts = [(-21 * u, 4 * u + cy), (-19 * u, -3 * u + cy), (-7 * u, -6 * u + cy),
                (15 * u, -6 * u + cy), (21 * u, -2 * u + cy), (21 * u, 5 * u + cy),
                (17 * u, 8 * u + cy), (-17 * u, 8 * u + cy)]
    _shading(d, (-21 * u, -6 * u + cy, 21 * u, 8 * u + cy), (255, 168, 48), (196, 96, 8))
    poly(d, body_pts, outline=(120, 58, 4, 255), width=int(2 * u))
    # hood stripe
    poly(d, [(2 * u + cx, -5 * u + cy), (10 * u + cx, -5 * u + cy), (20 * u + cx, -1 * u + cy),
             (12 * u + cx, -1 * u + cy)], fill=(250, 250, 252, 235))
    # roll cage
    arc(d, (cx, cy - 4 * u), 13 * u, 180, 360, (40, 44, 56, 255), int(3.4 * u))
    line(d, (cx - 12 * u, cy - 4 * u), (cx - 14 * u, cy + 4 * u), (40, 44, 56, 255), int(3 * u))
    line(d, (cx + 12 * u, cy - 4 * u), (cx + 14 * u, cy + 4 * u), (40, 44, 56, 255), int(3 * u))
    # seat
    rrect(d, (cx - 6 * u, cy - 3 * u, cx + 2 * u, cy + 5 * u), 3 * u, fill=(52, 56, 70, 255))
    # rear wing
    rrect(d, (cx - 22 * u, cy - 9 * u, cx - 12 * u, cy - 6 * u), 2 * u, fill=(40, 44, 56, 255))
    line(d, (cx - 16 * u, cy - 6 * u), (cx - 16 * u, cy - 2 * u), (40, 44, 56, 255), int(2.5 * u))
    # headlights
    circle(d, (cx + 20 * u, cy - 1 * u), 2.2 * u, fill=(255, 240, 170, 255))
    circle(d, (cx - 20 * u, cy + 1 * u), 2 * u, fill=(255, 90, 60, 255))
    # fender flares over wheel wells
    arc(d, (cx - 14 * u, cy + 8 * u), 8 * u, 180, 360, (120, 58, 4, 255), int(3 * u))
    arc(d, (cx + 14 * u, cy + 8 * u), 8 * u, 180, 360, (120, 58, 4, 255), int(3 * u))
    img2 = finish(img)
    out = os.path.join(ASSETS, "vehicles", "buggy_body.png")
    img2.save(out)
    print("wrote", out)


def make_mauler():
    W, H = 92, 56
    img, d, ss = canvas(W, H)
    u = W * ss / 92.0
    cx, cy = 46 * u, 24 * u
    # big fenders (monster truck)
    for fx in (-17 * u, 17 * u):
        arc(d, (cx + fx, cy + 6 * u), 13 * u, 180, 360, (26, 28, 36, 255), int(6 * u))
    # body
    _shading(d, (-20 * u, cy - 10 * u, 20 * u, cy + 6 * u), (255, 118, 40), (190, 66, 12))
    body_pts = [(-20 * u, cy + 4 * u), (-20 * u, cy - 6 * u), (-14 * u, cy - 10 * u),
                (6 * u, cy - 11 * u), (20 * u, cy - 6 * u), (20 * u, cy + 4 * u)]
    poly(d, body_pts, outline=(110, 40, 4, 255), width=int(2 * u))
    # cabin window
    poly(d, [(-12 * u, cy - 10 * u), (-4 * u, cy - 14 * u), (8 * u, cy - 14 * u),
             (12 * u, cy - 10 * u)], fill=(150, 200, 235, 255))
    poly(d, [(-12 * u, cy - 10 * u), (-4 * u, cy - 14 * u), (0 * u, cy - 14 * u), (-6 * u, cy - 10 * u)],
         fill=(200, 225, 245, 255))
    # grill
    for i in range(4):
        x = (13 + i * 2) * u
        line(d, (cx + x, cy - 6 * u), (cx + x, cy + 2 * u), (110, 40, 4, 255), int(1.6 * u))
    # number plate
    rrect(d, (cx - 6 * u, cy - 8 * u, cx + 4 * u, cy + 0 * u), 2 * u, fill=(245, 246, 250, 240))
    # stripe
    line(d, (cx - 19 * u, cy + 2 * u), (cx + 19 * u, cy + 2 * u), (250, 250, 252, 200), int(2 * u))
    # lights
    circle(d, (cx + 19 * u, cy - 4 * u), 2 * u, fill=(255, 240, 170, 255))
    circle(d, (cx - 19 * u, cy + 1 * u), 2 * u, fill=(255, 90, 60, 255))
    img2 = finish(img)
    out = os.path.join(ASSETS, "vehicles", "mauler_body.png")
    img2.save(out)
    print("wrote", out)


def make_vortex():
    W, H = 96, 44
    img, d, ss = canvas(W, H)
    u = W * ss / 96.0
    cx, cy = 48 * u, 19 * u
    # low rally body
    _shading(d, (-22 * u, cy - 6 * u, 22 * u, cy + 6 * u), (72, 214, 232), (20, 140, 168))
    body_pts = [(-22 * u, cy + 5 * u), (-22 * u, cy - 2 * u), (-16 * u, cy - 5 * u),
                (-8 * u, cy - 8 * u), (8 * u, cy - 8 * u), (18 * u, cy - 3 * u),
                (22 * u, cy), (22 * u, cy + 5 * u)]
    poly(d, body_pts, outline=(8, 90, 110, 255), width=int(2 * u))
    # window
    poly(d, [(-7 * u, cy - 7 * u), (0 * u, cy - 10 * u), (8 * u, cy - 10 * u), (7 * u, cy - 7 * u)],
         fill=(160, 220, 245, 255))
    # number circle + 7
    circle(d, (cx - 2 * u, cy - 1 * u), 5.5 * u, fill=(248, 249, 252, 250))
    font = ImageFont.truetype(os.path.join(ROOT, "game", "assets", "fonts", "Nunito-Black.ttf"), int(9 * u))
    d.text((cx - 2 * u, cy - 1 * u), "7", font=font, fill=(16, 20, 32, 255), anchor="mm")
    # livery stripe
    line(d, (cx - 21 * u, cy + 2 * u), (cx + 21 * u, cy + 2 * u), (250, 250, 252, 220), int(2.4 * u))
    # rear wing
    rrect(d, (cx - 24 * u, cy - 10 * u, cx - 13 * u, cy - 8 * u), 1.6 * u, fill=(30, 34, 46, 255))
    line(d, (cx - 18 * u, cy - 8 * u), (cx - 18 * u, cy - 4 * u), (30, 34, 46, 255), int(2 * u))
    # splitter
    rrect(d, (cx + 14 * u, cy + 4 * u, cx + 23 * u, cy + 6.5 * u), 1.4 * u, fill=(30, 34, 46, 255))
    # lights
    circle(d, (cx + 21 * u, cy - 1 * u), 2 * u, fill=(255, 250, 200, 255))
    circle(d, (cx - 21 * u, cy + 1 * u), 1.8 * u, fill=(255, 80, 60, 255))
    img2 = finish(img)
    out = os.path.join(ASSETS, "vehicles", "vortex_body.png")
    img2.save(out)
    print("wrote", out)


# ===================================================================== ICON
def make_icon():
    # Reuse the web build's designed icon (same art direction).
    src = os.path.join(ROOT, "assets", "img", "icon-512.png")
    dst = os.path.join(ROOT, "game", "icon.png")
    shutil.copyfile(src, dst)
    print("wrote", dst)


def main():
    for sub in ("ui", "vehicles", "characters", "fonts"):
        os.makedirs(os.path.join(ASSETS, sub), exist_ok=True)
    make_logo()
    make_coin()
    make_fuel()
    make_wheel()
    make_driver()
    make_buggy()
    make_mauler()
    make_vortex()
    make_icon()
    print("ALL ASSETS OK")


if __name__ == "__main__":
    main()
