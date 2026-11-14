#!/usr/bin/env python3
"""
Bake fire / explosion / smoke flipbooks with a small 2D stable-fluids simulation (Jos Stam style):
semi-Lagrangian advection, pressure projection, buoyancy from temperature and vorticity confinement.

Output: public/assets/fx/flip_<name>.png — 8×8 frames of 128 px (1024×1024), premultiplied RGBA:
  fire      — looping flame (emissive colour, alpha = 0 → additive glow)
  explosion — one-shot fireball that cools into rolling smoke (emissive + lit smoke)
  smoke     — one-shot billowing puff, self-shadowed from above (lit grey)
  dust      — one-shot low dust burst (warmer, softer)
Run: python3 tools/bake-flipbooks.py
"""
import numpy as np
from scipy.ndimage import map_coordinates, gaussian_filter
from PIL import Image
import os, sys

N = 128          # simulation & frame resolution
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'fx')
rng = np.random.default_rng(7)
Y, X = np.mgrid[0:N, 0:N].astype(np.float64)


def advect(f, u, v, dt):
    x = X - dt * u
    y = Y - dt * v
    return map_coordinates(f, [y, x], order=1, mode='constant', cval=0.0)


def project(u, v, iters=40):
    div = np.zeros_like(u)
    div[1:-1, 1:-1] = -0.5 * (u[1:-1, 2:] - u[1:-1, :-2] + v[2:, 1:-1] - v[:-2, 1:-1])
    p = np.zeros_like(u)
    for _ in range(iters):
        p[1:-1, 1:-1] = (div[1:-1, 1:-1] + p[1:-1, 2:] + p[1:-1, :-2] + p[2:, 1:-1] + p[:-2, 1:-1]) / 4.0
    u[1:-1, 1:-1] -= 0.5 * (p[1:-1, 2:] - p[1:-1, :-2])
    v[1:-1, 1:-1] -= 0.5 * (p[2:, 1:-1] - p[:-2, 1:-1])
    return u, v


def vorticity(u, v, eps, dt):
    w = np.zeros_like(u)
    w[1:-1, 1:-1] = 0.5 * (v[1:-1, 2:] - v[1:-1, :-2] - u[2:, 1:-1] + u[:-2, 1:-1])
    aw = np.abs(w)
    gx = np.zeros_like(u); gy = np.zeros_like(u)
    gx[1:-1, 1:-1] = 0.5 * (aw[1:-1, 2:] - aw[1:-1, :-2])
    gy[1:-1, 1:-1] = 0.5 * (aw[2:, 1:-1] - aw[:-2, 1:-1])
    l = np.sqrt(gx * gx + gy * gy) + 1e-6
    gx /= l; gy /= l
    u += dt * eps * gy * w
    v -= dt * eps * gx * w
    return u, v


def noise(scale, seed):
    r = np.random.default_rng(seed).standard_normal((N, N))
    n = gaussian_filter(r, scale)
    return n / (np.abs(n).max() + 1e-9)


class Sim:
    def __init__(self, buoy=1.0, cool=0.97, dissolve=0.992, vort=6.0):
        self.u = np.zeros((N, N)); self.v = np.zeros((N, N))
        self.d = np.zeros((N, N)); self.t = np.zeros((N, N))
        self.buoy, self.cool, self.dissolve, self.vort = buoy, cool, dissolve, vort

    def step(self, dt=1.0):
        # image rows grow downward, so "up" is negative v
        self.v -= dt * self.buoy * self.t * 0.12
        self.u, self.v = vorticity(self.u, self.v, self.vort, dt)
        self.u, self.v = project(self.u, self.v)
        u0, v0 = self.u.copy(), self.v.copy()
        self.u = advect(u0, u0, v0, dt); self.v = advect(v0, u0, v0, dt)
        self.u, self.v = project(self.u, self.v)
        np.clip(self.u, -3.5, 3.5, out=self.u); np.clip(self.v, -3.5, 3.5, out=self.v)
        self.d = advect(self.d, self.u, self.v, dt) * self.dissolve
        self.t = advect(self.t, self.u, self.v, dt) * self.cool
        # soft walls so nothing piles up at the frame border
        edge = np.minimum(np.minimum(X, N - 1 - X), np.minimum(Y, N - 1 - Y))
        k = np.clip(edge / 8.0, 0, 1)
        self.d *= k; self.t *= k; self.u *= k; self.v *= k


def fire_color(t):
    """Blackbody-ish ramp: deep red → orange → yellow → white."""
    t = np.clip(t, 0, 1.6)
    r = np.clip(t * 2.2, 0, 1)
    g = np.clip((t - 0.25) * 1.7, 0, 1)
    b = np.clip((t - 0.75) * 1.6, 0, 1)
    return np.stack([r, g ** 1.2, b ** 1.4], -1)


def lit_smoke(d, light=(0.55, -1.0), absorb=0.9, base=(0.55, 0.53, 0.5), amb=0.35):
    """Self-shadowed smoke: march toward the light accumulating density."""
    a = 1.0 - np.exp(-d * absorb)
    sh = np.zeros_like(d)
    lx, ly = light
    acc = np.zeros_like(d)
    for s in range(1, 20):
        acc += map_coordinates(d, [Y + ly * s * 1.6, X + lx * s * 1.6], order=1, mode='constant')
    sh = np.exp(-acc * 0.12)
    shade = amb + (1 - amb) * sh
    col = np.stack([shade * base[0], shade * base[1], shade * base[2]], -1)
    return col, a


def sheet(frames, name):
    S = 8
    img = np.zeros((N * S, N * S, 4), dtype=np.float64)
    for i, f in enumerate(frames[:S * S]):
        r, c = divmod(i, S)
        img[r * N:(r + 1) * N, c * N:(c + 1) * N] = f
    out = (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(out, 'RGBA').save(os.path.join(OUT, f'flip_{name}.png'), optimize=True)
    print('wrote', name)


def radial_mask():
    r = np.sqrt((X - N / 2) ** 2 + (Y - N / 2) ** 2) / (N / 2)
    return np.clip((1.0 - r) / 0.18, 0, 1)


MASK = radial_mask()


def bake_fire(name='fire', sources=((0.5, 22),), cool=0.968, gain=1.15):
    sim = Sim(buoy=2.6, cool=cool, dissolve=0.97, vort=1.4)
    raw = []
    for step in range(60 + 128 * 2):
        # flickering source at the bottom centre
        n = noise(3, step)
        mask = sum(np.exp(-(((X - N * fx) / w) ** 2) - (((Y - (N - 16)) / 9.0) ** 2)) * (0.8 + 0.4 * np.sin(step * 0.07 + k * 2.1) ** 2) for k, (fx, w) in enumerate(sources))
        sim.t += mask * (0.6 + 0.4 * np.clip(n, -1, 1)) * 0.2
        sim.d += mask * 0.1
        sim.u += mask * n * 0.25
        sim.step(0.9)
        if step >= 60 and (step - 60) % 2 == 0:
            raw.append(sim.t.copy())
    M = 64
    frames = []
    for i in range(M):
        w = i / M
        t = raw[i + M] * (1 - w) + raw[i] * w  # cross-fade for a seamless loop
        col = fire_color(t * gain)
        a = np.clip(t * 1.6, 0, 1) * MASK
        rgb = col * a[..., None]
        frames.append(np.dstack([rgb, np.zeros_like(a)]))  # alpha 0 → purely additive
    sheet(frames, name)


def bake_explosion():
    sim = Sim(buoy=1.4, cool=0.975, dissolve=0.997, vort=1.6)
    cx, cy = N / 2, N / 2 + 8
    r2 = ((X - cx) ** 2 + (Y - cy) ** 2) / (22.0 ** 2)
    blob = np.exp(-r2 * 1.4) * (0.7 + 0.3 * noise(2.5, 99))
    sim.t += blob * 2.4; sim.d += blob * 3.0
    dx, dy = X - cx, Y - cy; l = np.sqrt(dx * dx + dy * dy) + 1e-3
    push = np.exp(-r2 * 0.5) * 2.4 * (0.7 + 0.3 * noise(4, 5))
    sim.u += dx / l * push; sim.v += dy / l * push
    frames = []
    for step in range(64 * 3):
        sim.step(0.85)
        if step % 3 == 0:
            emit = fire_color(sim.t * 0.9) * np.clip(sim.t * 1.3, 0, 1)[..., None]
            col, a = lit_smoke(sim.d * 1.8, base=(0.45, 0.41, 0.38), amb=0.3)
            a = a * MASK * 0.5
            k = step / 192.0
            rgb = col * a[..., None] * (0.35 + 0.65 * k) + emit * MASK[..., None]
            frames.append(np.dstack([rgb, a]))
    # fade the tail so the last frame is empty
    for i in range(48, 64):
        frames[i] = frames[i] * (1 - (i - 48) / 16.0)
    sheet(frames, 'explosion')


def bake_smoke(name='smoke', base=(0.6, 0.58, 0.55), buoy=1.0, seed=3):
    sim = Sim(buoy=buoy, cool=0.97, dissolve=0.997, vort=1.0)
    cx, cy = N / 2, N / 2 + 18
    r2 = ((X - cx) ** 2 + (Y - cy) ** 2) / (20.0 ** 2)
    sim.d += np.exp(-r2) * (0.7 + 0.3 * noise(2, seed)) * 2.2
    sim.t += np.exp(-r2) * 0.9
    dx, dy = X - cx, Y - cy; l = np.sqrt(dx * dx + dy * dy) + 1e-3
    push = np.exp(-r2 * 0.6) * 1.8
    sim.u += dx / l * push + noise(5, seed + 1) * 0.25; sim.v += dy / l * push * 0.5
    frames = []
    for step in range(64 * 3):
        sim.step(0.9)
        if step % 3 == 0:
            col, a = lit_smoke(sim.d, base=base)
            a = a * MASK
            frames.append(np.dstack([col * a[..., None], a]))
    for i in range(40, 64):
        frames[i] = frames[i] * (1 - (i - 40) / 24.0)
    sheet(frames, name)


if __name__ == '__main__':
    which = sys.argv[1:] or ['fire', 'blaze', 'explosion', 'smoke', 'dust']
    if 'fire' in which: bake_fire()
    if 'blaze' in which: bake_fire('blaze', ((0.3, 13), (0.5, 17), (0.7, 13)), cool=0.95, gain=0.95)
    if 'explosion' in which: bake_explosion()
    if 'smoke' in which: bake_smoke()
    if 'dust' in which: bake_smoke('dust', base=(0.62, 0.52, 0.42), buoy=0.35, seed=11)
