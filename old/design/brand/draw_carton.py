#!/usr/bin/env python3
"""Faithful raster recreation of the reference milk-carton + bean mark.
Coordinates are mapped from the 850x850 reference onto a 1024 canvas.
"""
from PIL import Image, ImageDraw
import math

W, S = 1024, 2
C = W * S

INK = "#1C1B19"
SAGE = "#A9BFA6"
SAGE_LIGHT = "#C2D2BC"
SAGE_DARK = "#8FA98C"
SAND = "#D9BC8C"
CREAM = "#F6F1E6"
PAPER = "#FAF9F5"
PINE = "#2F5D57"

img = Image.new("RGBA", (C, C), (0, 0, 0, 0))
d = ImageDraw.Draw(img)


def P(points):
    return [(x * S, y * S) for x, y in points]


def poly(points, fill, outline=INK, width=13):
    d.polygon(P(points), fill=fill)
    if outline:
        d.line(P(points + [points[0]]), fill=outline, width=width * S, joint="curve")


def line(points, color=INK, width=13):
    d.line(P(points), fill=color, width=width * S, joint="curve")


def bezier(p0, p1, p2, p3, n=60):
    out = []
    for i in range(n + 1):
        t = i / n
        mt = 1 - t
        out.append((
            mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0],
            mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1],
        ))
    return out


# ---------------- carton body ----------------
# left side face
poly([(156, 361), (373, 361), (373, 940), (156, 916)], CREAM)
# vertical highlight on the side
d.rounded_rectangle((199 * S, 421 * S, 265 * S, 891 * S), radius=10 * S, fill=PAPER, outline=None)
# front face
poly([(373, 361), (831, 361), (831, 916), (373, 940)], SAGE_LIGHT)

# front wave: cream above, sand below
wave = bezier((831, 566), (650, 390), (500, 400), (373, 470))
poly([(373, 470)] + wave + [(831, 916), (373, 940)], SAND, None, 0)
# restore front outline
line([(373, 361), (831, 361), (831, 916), (373, 940), (373, 361)], INK, 13)

# ---------------- roof ----------------
# left roof (side of the gable)
poly([(156, 361), (259, 229), (373, 361)], SAGE)
# front roof trapezoid: wide top under the cap
poly([(373, 361), (259, 229), (723, 229), (831, 361)], SAGE_LIGHT)

# ---------------- top cap ----------------
# top face (shallow isometric box)
poly([(259, 145), (723, 145), (723, 170), (259, 170)], SAGE_LIGHT)
# front face of the cap
poly([(259, 170), (723, 170), (723, 229), (259, 229)], SAGE)
# cap band line
line([(259, 198), (723, 198)], INK, 9)

# ---------------- bean + circle ----------------
cx, cy, r = 602, 626, 126
d.ellipse(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S), outline=INK, width=12 * S)

L, B = 185, 95
ang = math.radians(38)
top, bot = [], []
n = 90
for i in range(n + 1):
    t = i / n
    half = (B / 2) * (math.sin(math.pi * t) ** 0.72)
    x = -L / 2 + L * t
    for sign, dest in ((-1, top), (1, bot)):
        y = sign * half
        xr = x * math.cos(ang) - y * math.sin(ang)
        yr = x * math.sin(ang) + y * math.cos(ang)
        dest.append((cx + xr, cy + yr))
bean = top + list(reversed(bot))
poly(bean, PINE, INK, 12)

# hatch lines (cream) clipped to the bean
mask = Image.new("L", (C, C), 0)
ImageDraw.Draw(mask).polygon(P(bean), fill=255)
hatch = Image.new("RGBA", (C, C), (0, 0, 0, 0))
hd = ImageDraw.Draw(hatch)
ax, ay = math.cos(ang), math.sin(ang)
px, py = -ay, ax
for off in (-40, -14, 14, 40):
    c0 = (cx + ax * off, cy + ay * off)
    hd.line(P([(c0[0] - px * 76, c0[1] - py * 76), (c0[0] + px * 76, c0[1] + py * 76)]), fill=INK, width=4 * S)
hm = Image.new("RGBA", (C, C), (0, 0, 0, 0))
hm.paste(hatch, (0, 0), mask)
img = Image.alpha_composite(img, hm)
d = ImageDraw.Draw(img)
d.line(P(bean + [bean[0]]), fill=INK, width=12 * S, joint="curve")

# coffee-bean central crease (clipped to the bean)
crease = bezier((cx - 58 * ax, cy - 58 * ay), (cx - 18 * ax, cy - 18 * ay), (cx + 18 * ax, cy + 18 * ay), (cx + 58 * ax, cy + 58 * ay))
cl = Image.new("RGBA", (C, C), (0, 0, 0, 0))
ImageDraw.Draw(cl).line(P(crease), fill=INK, width=4 * S)
clm = Image.new("RGBA", (C, C), (0, 0, 0, 0))
clm.paste(cl, (0, 0), mask)
img = Image.alpha_composite(img, clm)
d = ImageDraw.Draw(img)

# tapered stem from the upper-left bean tip toward the upper-left
tip = min(bean, key=lambda p: p[0] + p[1])
stem_pts = bezier((tip[0] + 4, tip[1] + 4), (tip[0] - 18, tip[1] - 18), (tip[0] - 40, tip[1] - 40), (tip[0] - 56, tip[1] - 54))
left, right = [], []
for i, (x, y) in enumerate(stem_pts):
    t = i / (len(stem_pts) - 1)
    half = max(1.0, 7.0 * (1 - t) ** 0.8)
    if i == 0:
        dx, dy = stem_pts[1][0] - x, stem_pts[1][1] - y
    else:
        dx, dy = x - stem_pts[i-1][0], y - stem_pts[i-1][1]
    ln = math.hypot(dx, dy) or 1
    nx, ny = -dy / ln, dx / ln
    left.append((x + nx * half, y + ny * half))
    right.append((x - nx * half, y - ny * half))
poly(left + list(reversed(right)), PINE, None, 0)

# front-left vertical edge and bottom edges
line([(373, 361), (373, 940)], INK, 13)
line([(156, 916), (373, 940)], INK, 13)
line([(373, 940), (831, 916)], INK, 13)

# ---------------- export ----------------
out = img.resize((W, W), Image.LANCZOS)
out.save("brand/logo-carton.png")
prev = Image.new("RGBA", (W, W), (250, 249, 245, 255))
prev.alpha_composite(out)
prev.convert("RGB").save("brand/logo-carton-preview.png")
print("wrote brand/logo-carton.png")
