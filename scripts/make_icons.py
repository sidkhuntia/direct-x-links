#!/usr/bin/env python3
"""Generate the Chrome extension icons (16, 48, 128 px) as RGBA PNGs.

Standard library only (struct, zlib, os). Run with: python3 -I make_icons.py

Design: rounded-square #0f1419 background with transparent corners and a white
straight arrow pointing up-right. Anti-aliased by 4x4 supersampling.
"""
import os
import struct
import zlib

BG = (0x0F, 0x14, 0x19)
FG = (0xFF, 0xFF, 0xFF)
SIZES = (16, 48, 128)
SS = 4                 # supersampling per axis (SS*SS samples per pixel)

# All geometry is in unit coordinates (0..1, y pointing down), scaled by size.
CORNER_R = 0.22        # corner radius of the rounded square
SHAFT_W = 0.11         # shaft thickness
SHAFT_START = (0.28, 0.72)
SHAFT_END = (0.56, 0.44)
HEAD_TIP = (0.75, 0.25)
HEAD_BASE = (0.552, 0.448)
HEAD_WING = (0.12, 0.12)   # offset from base centre to each wing corner


def _cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def _in_triangle(px, py, a, b, c):
    p = (px, py)
    d1 = _cross(a, b, p)
    d2 = _cross(b, c, p)
    d3 = _cross(c, a, p)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def _dist_to_segment(px, py, a, b):
    ax, ay = a
    vx, vy = b[0] - ax, b[1] - ay
    wx, wy = px - ax, py - ay
    seg_len2 = vx * vx + vy * vy
    t = (wx * vx + wy * vy) / seg_len2
    t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)
    dx = ax + t * vx - px
    dy = ay + t * vy - py
    return (dx * dx + dy * dy) ** 0.5


def _in_rounded_square(px, py, size, r):
    if px < 0 or py < 0 or px > size or py > size:
        return False
    cx = min(max(px, r), size - r)
    cy = min(max(py, r), size - r)
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r


def render(size):
    """Return raw scanlines (filter byte + RGBA pixels) for a size x size icon."""
    r = CORNER_R * size
    half_shaft = SHAFT_W * size / 2.0
    shaft_a = (SHAFT_START[0] * size, SHAFT_START[1] * size)
    shaft_b = (SHAFT_END[0] * size, SHAFT_END[1] * size)
    tip = (HEAD_TIP[0] * size, HEAD_TIP[1] * size)
    base = (HEAD_BASE[0] * size, HEAD_BASE[1] * size)
    wx, wy = HEAD_WING[0] * size, HEAD_WING[1] * size
    wing_a = (base[0] + wx, base[1] + wy)
    wing_b = (base[0] - wx, base[1] - wy)
    n = SS * SS
    offsets = [(i + 0.5) / SS for i in range(SS)]

    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type: None
        for x in range(size):
            acc_r = acc_g = acc_b = 0
            covered = 0
            for oy in offsets:
                py = y + oy
                for ox in offsets:
                    px = x + ox
                    if not _in_rounded_square(px, py, size, r):
                        continue
                    if (_in_triangle(px, py, tip, wing_a, wing_b)
                            or _dist_to_segment(px, py, shaft_a, shaft_b) <= half_shaft):
                        col = FG
                    else:
                        col = BG
                    covered += 1
                    acc_r += col[0]
                    acc_g += col[1]
                    acc_b += col[2]
            if covered == 0:
                raw += b"\x00\x00\x00\x00"
            else:
                raw += bytes((
                    int(round(acc_r / covered)),
                    int(round(acc_g / covered)),
                    int(round(acc_b / covered)),
                    int(round(255.0 * covered / n)),
                ))
    return bytes(raw)


def _chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


def encode_png(size, raw_scanlines):
    signature = b"\x89PNG\r\n\x1a\n"
    # bit depth 8, colour type 6 (RGBA), compression 0, filter 0, interlace 0
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (signature
            + _chunk(b"IHDR", ihdr)
            + _chunk(b"IDAT", zlib.compress(raw_scanlines, 9))
            + _chunk(b"IEND", b""))


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.normpath(os.path.join(here, "..", "extension", "icons"))
    os.makedirs(out_dir, exist_ok=True)
    for size in SIZES:
        path = os.path.join(out_dir, "icon%d.png" % size)
        with open(path, "wb") as fh:
            fh.write(encode_png(size, render(size)))
        print("wrote", path)


if __name__ == "__main__":
    main()
