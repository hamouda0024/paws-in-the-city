#!/usr/bin/env python3
"""
Generates the Android launcher icon, adaptive foreground and splash screens
from code (no external assets, no fonts needed).

    python3 tools/make-icons.py
"""
import struct
import zlib
import pathlib
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"

FUR = np.array([232, 148, 79]) / 255
FUR_DARK = np.array([176, 99, 44]) / 255
CREAM = np.array([246, 227, 200]) / 255
PINK = np.array([226, 126, 138]) / 255
EYE = np.array([176, 224, 88]) / 255
INK = np.array([16, 20, 12]) / 255


def write_png(path, rgb):
    """rgb: float array (h, w, 3) in 0..1 -> RGBA PNG with alpha = 1."""
    h, w, _ = rgb.shape
    data = np.clip(rgb * 255, 0, 255).astype(np.uint8)
    alpha = np.full((h, w, 1), 255, dtype=np.uint8)
    rgba = np.concatenate([data, alpha], axis=2)
    raw = b"".join(b"\x00" + rgba[y].tobytes() for y in range(h))

    def chunk(tag, payload):
        return (struct.pack(">I", len(payload)) + tag + payload +
                struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n" +
           chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) +
           chunk(b"IDAT", zlib.compress(raw, 9)) +
           chunk(b"IEND", b""))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def blend(img, color, mask, alpha=1.0):
    a = (mask.astype(np.float32) * alpha)[..., None]
    img[:] = img * (1 - a) + color * a


def ellipse(xx, yy, cx, cy, rx, ry):
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0


def tri(xx, yy, p1, p2, p3):
    def edge(ax, ay, bx, by):
        return (xx - ax) * (by - ay) - (yy - ay) * (bx - ax)
    d1 = edge(p1[0], p1[1], p2[0], p2[1])
    d2 = edge(p2[0], p2[1], p3[0], p3[1])
    d3 = edge(p3[0], p3[1], p1[0], p1[1])
    neg = (d1 <= 0) & (d2 <= 0) & (d3 <= 0)
    pos = (d1 >= 0) & (d2 >= 0) & (d3 >= 0)
    return neg | pos


def seg_dist(xx, yy, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    t = np.clip(((xx - x1) * dx + (yy - y1) * dy) / (dx * dx + dy * dy + 1e-9), 0, 1)
    return np.hypot(xx - (x1 + t * dx), yy - (y1 + t * dy))


def render(size, scale=1.0, circle=False, with_bg=True, splash=False):
    """Render a square icon. `scale` shrinks the artwork (for adaptive safe zones)."""
    ss = 3  # supersampling
    n = size * ss
    # normalized grid
    g = (np.arange(n) + 0.5) / n
    xx, yy = np.meshgrid(g, g)
    # shrink/expand the artwork around the center
    ax = (xx - 0.5) / scale + 0.5
    ay = (yy - 0.5) / scale + 0.5

    img = np.ones((n, n, 3), dtype=np.float32)
    if with_bg:
        # Deep night gradient + warm pool at the bottom.
        t = yy[..., None]
        top = np.array([0.086, 0.133, 0.227])
        bottom = np.array([0.02, 0.035, 0.063])
        img[:] = top * (1 - t) + bottom * t
        glow = np.exp(-(((xx - 0.5) / 0.55) ** 2 + ((yy - 0.78) / 0.4) ** 2))
        img[:] = img + (np.array([1.0, 0.62, 0.28]) * glow[..., None] * 0.16)
        if circle:
            mask = (xx - 0.5) ** 2 + (yy - 0.5) ** 2 <= 0.5 ** 2
            img = img * mask[..., None] + np.zeros_like(img) * (1 - mask[..., None])
            img = np.clip(img, 0, 1)

        if splash:
            # Quiet floor line + moon for the splash screen.
            moon = ellipse(xx, yy, 0.74, 0.24, 0.045, 0.045)
            blend(img, np.array([0.82, 0.87, 1.0]), moon, 0.55)
            return img

    head = ellipse(ax, ay, 0.5, 0.575, 0.255, 0.215)
    ear_l = tri(ax, ay, (0.305, 0.42), (0.315, 0.175), (0.475, 0.365))
    ear_r = tri(ax, ay, (0.695, 0.42), (0.685, 0.175), (0.525, 0.365))
    body = head | ear_l | ear_r

    # Fur with a vertical shade so the silhouette has volume.
    shade = np.clip((ay - 0.42) / 0.42, 0, 1)[..., None]
    blend(img, FUR * (1 - shade) + FUR_DARK * shade, body)

    # Inner ears.
    in_l = tri(ax, ay, (0.345, 0.395), (0.352, 0.235), (0.45, 0.365))
    in_r = tri(ax, ay, (0.655, 0.395), (0.648, 0.235), (0.55, 0.365))
    blend(img, PINK, (in_l | in_r) & body, 0.85)

    # Muzzle patch.
    blend(img, CREAM, ellipse(ax, ay, 0.5, 0.655, 0.105, 0.085), 0.92)

    # Eyes.
    for ex in (0.412, 0.588):
        eye = ellipse(ax, ay, ex, 0.545, 0.052, 0.048)
        blend(img, EYE, eye)
        pupil = ellipse(ax, ay, ex + 0.004, 0.548, 0.014, 0.036)
        blend(img, INK, pupil)
        glint = ellipse(ax, ay, ex - 0.016, 0.53, 0.012, 0.012)
        blend(img, np.array([1.0, 1.0, 1.0]), glint, 0.9)

    # Nose + mouth.
    blend(img, PINK, tri(ax, ay, (0.474, 0.632), (0.526, 0.632), (0.5, 0.664)))
    mouth = (seg_dist(ax, ay, 0.5, 0.664, 0.5, 0.697) < 0.006) | \
            (seg_dist(ax, ay, 0.5, 0.697, 0.464, 0.712) < 0.006) | \
            (seg_dist(ax, ay, 0.5, 0.697, 0.536, 0.712) < 0.006)
    blend(img, np.array([0.35, 0.2, 0.15]), mouth, 0.8)

    # Whiskers.
    whisk = np.zeros_like(head)
    for (x1, y1, x2, y2) in [(0.44, 0.66, 0.245, 0.615), (0.44, 0.675, 0.235, 0.675),
                             (0.44, 0.69, 0.25, 0.735), (0.56, 0.66, 0.755, 0.615),
                             (0.56, 0.675, 0.765, 0.675), (0.56, 0.69, 0.75, 0.735)]:
        whisk |= seg_dist(ax, ay, x1, y1, x2, y2) < 0.0055
    blend(img, np.array([1.0, 0.96, 0.9]), whisk, 0.75)

    # Forehead tabby stripes.
    for i, sx in enumerate((0.45, 0.5, 0.55)):
        stripe = seg_dist(ax, ay, sx, 0.395, sx + (i - 1) * 0.012, 0.445) < 0.009
        blend(img, FUR_DARK, stripe & body, 0.9)

    # Rim light along the top-left of the head.
    rim = body & ellipse(ax, ay, 0.455, 0.5, 0.27, 0.24) & ~ellipse(ax, ay, 0.47, 0.51, 0.255, 0.225)
    blend(img, np.array([1.0, 0.87, 0.66]), rim, 0.35)

    # Downsample (box filter) for clean anti-aliasing.
    img = img.reshape(size, ss, size, ss, 3).mean(axis=(1, 3))
    return img


def main():
    sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for density, size in sizes.items():
        icon = render(size)
        write_png(RES / f"mipmap-{density}/ic_launcher.png", icon)
        write_png(RES / f"mipmap-{density}/ic_launcher_round.png", render(size, circle=True))
        # Adaptive foreground: artwork inset inside the 66% safe zone.
        write_png(RES / f"mipmap-{density}/ic_launcher_foreground.png",
                  render(size, scale=0.78, with_bg=False))

    # Splash screens (all densities/orientations share the same square artwork).
    splash = render(512, scale=0.55, splash=True)
    for d in sorted(RES.glob("drawable*")):
        if d.is_dir():
            write_png(d / "splash.png", splash)

    # Browser tab / PWA icon.
    write_png(ROOT / "www/icon-512.png", render(192))
    print("icons written")


if __name__ == "__main__":
    main()
