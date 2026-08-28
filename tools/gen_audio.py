#!/usr/bin/env python3
"""Rush Track audio pipeline.

Pure-python 16-bit WAV synthesizer (no numpy): renders the game's music
themes, biome ambience beds, engine loop and all SFX. Godot re-compresses
these to OGG automatically on Android export.

Run:  python3 tools/gen_audio.py
"""
import math
import os
import random
import struct
import wave

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "game", "assets", "audio")


def n_samples(seconds):
    return int(round(seconds * SR))


class Buf:
    def __init__(self, seconds, channels=1):
        self.n = n_samples(seconds)
        self.ch = channels
        self.d = [0.0] * (self.n * channels)

    def mono(self, fn):
        for i in range(self.n):
            v = fn(i / SR, i)
            for c in range(self.ch):
                self.d[i * self.ch + c] += v

    def at(self, c, i, v):
        if 0 <= i < self.n:
            self.d[i * self.ch + c] += v

    def render(self):
        out = bytearray()
        for i in range(0, len(self.d), self.ch):
            for c in range(self.ch):
                v = max(-1.0, min(1.0, self.d[i + c]))
                out += struct.pack("<h", int(v * 32000))
        return bytes(out)


def write_wav(path, buf):
    with wave.open(path, "wb") as w:
        w.setnchannels(buf.ch)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(buf.render())
    print("wrote", os.path.relpath(path, ROOT), round(os.path.getsize(path) / 1024), "KB")


def waves(fn, waveset, vol=1.0):
    """fn(t) -> amp; waveset: list of (freq, amp, phase)."""
    out = []
    for t in range(fn):
        v = 0.0
        for f, a, ph in waveset:
            v += a * math.sin(2 * math.pi * f * t / SR + ph)
        out.append(v * vol)
    return out


def waveforms(samples, kinds):
    """kinds: list of (kind, amp). kind in sine|square|saw|tri"""
    n = len(samples)
    for kind, amp in kinds:
        for i in range(n):
            t = samples[i]
            if kind == "sine":
                v = math.sin(t)
            elif kind == "square":
                v = 1.0 if math.sin(t) >= 0 else -1.0
            elif kind == "saw":
                v = 2.0 * ((t / (2 * math.pi)) % 1.0) - 1.0
            elif kind == "tri":
                v = 2 / math.pi * (2 * math.asin(math.sin(t)))
            samples[i] += v * amp
    return samples


def env_ad(n, a, d, s=0.0, r=0.0, sustain_t=0.0):
    a = min(a, n)
    r = min(r, max(n - a, 0))
    d = min(d, max(n - a, 0))
    out = []
    for i in range(n):
        if i < a:
            e = i / a
        elif i < a + d:
            e = 1.0 - (1.0 - s) * (i - a) / max(d, 1)
        elif i < n - r:
            e = s
        else:
            e = s * (n - i) / max(r, 1)
        out.append(e)
    return out


def add_tone(buf, start_s, dur_s, freq, vol=0.5, kinds=(("sine", 1.0)),
             attack=0.005, release=0.08, sweep_to=None, ch=0):
    n0 = int(start_s * SR)
    n = n_samples(dur_s)
    phase = 0.0
    e = env_ad(n, int(attack * SR), int((dur_s - attack - release) * SR), 0.0,
               int(release * SR))
    for i in range(n):
        f = freq if sweep_to is None else freq + (sweep_to - freq) * (i / n)
        phase += 2 * math.pi * f / SR
        v = 0.0
        for kind, amp in kinds:
            if kind == "sine":
                v += amp * math.sin(phase)
            elif kind == "square":
                v += amp * (0.5 if math.sin(phase) >= 0 else -0.5)
            elif kind == "saw":
                v += amp * (2.0 * ((phase / (2 * math.pi)) % 1.0) - 1.0)
            elif kind == "tri":
                v += amp * (2 / math.pi) * math.asin(math.sin(phase))
        buf.at(ch, n0 + i, v * e[i] * vol)


def add_noise(buf, start_s, dur_s, vol=0.5, lowpass=0.5, ch=0, sweep_lp=None,
              attack=0.005, release=0.05):
    n0 = int(start_s * SR)
    n = n_samples(dur_s)
    lp_state = 0.0
    alpha = lowpass
    e = env_ad(n, int(attack * SR), 1, 1.0, int(release * SR))
    for i in range(n):
        a = lowpass if sweep_lp is None else lowpass + (sweep_lp - lowpass) * (i / n)
        x = random.uniform(-1, 1)
        lp_state += a * (x - lp_state)
        buf.at(ch, n0 + i, lp_state * 2.0 * e[i] * vol)


def soft_clip(x):
    return math.tanh(x * 1.2) / math.tanh(1.2)


# ================================================================ SFX
def sfx_coin():
    b = Buf(0.35)
    add_tone(b, 0.0, 0.16, 1318.5, 0.5, (("sine", 1.0), ("sine", 0.25)), 0.002, 0.12)
    add_tone(b, 0.06, 0.28, 1760.0, 0.5, (("sine", 1.0), ("sine", 0.2)), 0.002, 0.24)
    add_noise(b, 0.0, 0.05, 0.12, 0.9, release=0.03)
    return b


def sfx_pop():
    b = Buf(0.18)
    add_tone(b, 0.0, 0.12, 520, 0.5, (("sine", 1.0),), 0.002, 0.1, sweep_to=980)
    add_noise(b, 0.0, 0.04, 0.15, 0.8, release=0.03)
    return b


def sfx_fuel():
    b = Buf(0.5)
    for i, f in enumerate([330, 415, 523]):
        add_tone(b, i * 0.09, 0.08, f, 0.4, (("sine", 1.0),), 0.003, 0.05)
    add_tone(b, 0.3, 0.16, 660, 0.45, (("square", 0.4), ("sine", 0.6)), 0.004, 0.12)
    return b


def sfx_click():
    b = Buf(0.07)
    add_noise(b, 0.0, 0.03, 0.5, 0.3, release=0.02)
    add_tone(b, 0.0, 0.04, 1800, 0.2, (("sine", 1.0),), 0.001, 0.03)
    return b


def sfx_hover():
    b = Buf(0.05)
    add_noise(b, 0.0, 0.02, 0.22, 0.35, release=0.015)
    return b


def sfx_whoosh():
    b = Buf(0.5)
    add_noise(b, 0.0, 0.45, 0.5, 0.15, sweep_lp=0.6, attack=0.08, release=0.2)
    return b


def sfx_land():
    b = Buf(0.4)
    add_tone(b, 0.0, 0.22, 70, 0.7, (("sine", 1.0),), 0.002, 0.18, sweep_to=42)
    add_noise(b, 0.0, 0.12, 0.35, 0.35, release=0.08)
    return b


def sfx_crash():
    b = Buf(0.9)
    add_noise(b, 0.0, 0.5, 0.8, 0.7, sweep_lp=0.15, attack=0.002, release=0.3)
    add_tone(b, 0.0, 0.5, 58, 0.9, (("sine", 1.0), ("square", 0.2)), 0.002, 0.4, sweep_to=30)
    for i in range(10):
        t = 0.02 + random.random() * 0.35
        add_tone(b, t, 0.05, random.uniform(180, 700), 0.2, (("square", 1.0),), 0.001, 0.04)
    return b


def sfx_flip():
    b = Buf(0.55)
    add_tone(b, 0.0, 0.4, 280, 0.4, (("sine", 1.0),), 0.01, 0.2, sweep_to=920)
    add_tone(b, 0.3, 0.25, 1568, 0.3, (("sine", 1.0), ("sine", 0.3)), 0.004, 0.2)
    return b


def sfx_unlock():
    b = Buf(0.7)
    for i, f in enumerate([523.3, 659.3, 784.0]):
        add_tone(b, i * 0.11, 0.22, f, 0.4, (("square", 0.35), ("sine", 0.65)), 0.004, 0.16)
    return b


def sfx_best():
    b = Buf(0.9)
    for i, f in enumerate([523.3, 659.3, 784.0, 1046.5]):
        add_tone(b, i * 0.12, 0.26, f, 0.4, (("square", 0.3), ("sine", 0.7)), 0.004, 0.2)
    return b


def sfx_beep():
    b = Buf(0.18)
    add_tone(b, 0.0, 0.15, 880, 0.4, (("square", 0.5), ("sine", 0.5)), 0.004, 0.08)
    return b


def sfx_go():
    b = Buf(0.5)
    add_tone(b, 0.0, 0.45, 1318.5, 0.42, (("square", 0.5), ("sine", 0.5)), 0.004, 0.3)
    return b


def sfx_sad():
    b = Buf(1.0)
    for i, f in enumerate([440.0, 349.2, 293.7]):
        add_tone(b, i * 0.22, 0.3, f, 0.35, (("tri", 1.0),), 0.01, 0.22)
    return b


def sfx_cash():
    b = Buf(0.6)
    for i in range(8):
        t = i * 0.03
        add_noise(b, t, 0.03, 0.15, 0.8, release=0.02)
    add_tone(b, 0.05, 0.2, 1318.5, 0.4, (("sine", 1.0),), 0.002, 0.16)
    add_tone(b, 0.18, 0.35, 1760.0, 0.4, (("sine", 1.0),), 0.002, 0.3)
    return b


def sfx_denied():
    b = Buf(0.3)
    add_tone(b, 0.0, 0.25, 130, 0.4, (("square", 1.0),), 0.004, 0.15)
    add_tone(b, 0.0, 0.25, 98, 0.3, (("square", 0.6),), 0.004, 0.15)
    return b


def sfx_tick():
    b = Buf(0.05)
    add_tone(b, 0.0, 0.03, 2100, 0.3, (("sine", 1.0),), 0.001, 0.02)
    return b


def sfx_pennant():
    b = Buf(0.6)
    add_noise(b, 0.0, 0.25, 0.3, 0.2, sweep_lp=0.5, attack=0.02, release=0.15)
    add_tone(b, 0.12, 0.4, 1046.5, 0.3, (("sine", 1.0),), 0.004, 0.35)
    return b


# =============================================================== ENGINE
def engine_loop():
    # 1.2 s, exactly 66 cycles of 55 Hz -> sample-accurate loop.
    secs = 1.2
    n = n_samples(secs)
    b = Buf(secs)
    for i in range(n):
        t = i / SR
        ph = 2 * math.pi * 55.0 * t
        # saw + octave + sub, slight wobble for life
        saw = 2.0 * (((ph) / (2 * math.pi)) % 1.0) - 1.0
        sq = 1.0 if math.sin(ph * 2.0) >= 0 else -1.0
        sub = math.sin(ph)
        wobble = 1.0 + 0.06 * math.sin(2 * math.pi * 2.5 * t)
        v = 0.5 * saw * wobble + 0.22 * sq + 0.5 * sub
        # exhaust crackle
        if random.random() < 0.012:
            v += random.uniform(-0.4, 0.4)
        b.at(0, i, v * 0.5)
    return b


# ================================================================ MUSIC
def menu_theme():
    """Chill 96 BPM loop: 8 bars of Am F C G, pluck arps + pad + soft kit."""
    bpm = 96.0
    beat = 60.0 / bpm
    bar = beat * 4
    secs = bar * 8
    b = Buf(secs, channels=2)
    chords = [
        (220.0, 261.63, 329.63),   # Am
        (174.61, 220.0, 261.63),   # F
        (261.63, 329.63, 392.0),   # C
        (196.0, 246.94, 293.66),   # G
    ]
    rng = random.Random(7)
    for bar_i in range(8):
        ch = chords[bar_i % 4]
        t0 = bar_i * bar
        # pad: whole-bar chord, soft
        for f in ch:
            add_tone(b, t0, bar * 0.98, f, 0.10, (("sine", 1.0), ("tri", 0.4)), 0.4, 0.4, ch=0)
            add_tone(b, t0, bar * 0.98, f, 0.10, (("sine", 1.0), ("tri", 0.4)), 0.4, 0.4, ch=1)
        # pluck arps: 8th notes
        arp = [ch[0] * 2, ch[1] * 2, ch[2] * 2, ch[1] * 2, ch[0] * 2, ch[2] * 2, ch[1] * 2, ch[2] * 4]
        for i, f in enumerate(arp):
            add_tone(b, t0 + i * beat / 2, 0.22, f, 0.16, (("sine", 1.0), ("tri", 0.3)), 0.004, 0.15)
        # soft kick on 1 and 3, hat on offbeats
        for k in [0, 2]:
            for c in (0, 1):
                add_tone(b, t0 + k * beat, 0.14, 120, 0.4, (("sine", 1.0),), 0.002, 0.1, sweep_to=55, ch=c)
        for i in range(4):
            add_noise(b, t0 + (i + 0.5) * beat, 0.05, 0.10, 0.8, release=0.03)
    return b


def run_theme():
    """Driving 128 BPM synthwave loop: 8 bars, Am F C G. Bass + kit + arps."""
    bpm = 128.0
    beat = 60.0 / bpm
    bar = beat * 4
    secs = bar * 8
    b = Buf(secs, channels=2)
    chords = [
        (110.0, 130.81, 164.81),   # A1 A2 D3 (Am)
        (87.31, 110.0, 130.81),    # F
        (130.81, 164.81, 196.0),   # C
        (98.0, 123.47, 146.83),    # G
    ]
    arp_sets = [
        [220, 261.63, 329.63, 261.63],
        [174.61, 220, 261.63, 220],
        [261.63, 329.63, 392, 329.63],
        [196, 246.94, 293.66, 246.94],
    ]
    for bar_i in range(8):
        t0 = bar_i * bar
        root, f2, f3 = chords[bar_i % 4]
        # 8th-note saw bass
        for i in range(8):
            f = root * (2 if i % 2 else 1)
            for c in (0, 1):
                add_tone(b, t0 + i * beat / 2, beat * 0.42, f, 0.30,
                         (("saw", 0.6), ("square", 0.25)), 0.004, 0.06, ch=c)
        # four-on-floor kick
        for k in range(4):
            for c in (0, 1):
                add_tone(b, t0 + k * beat, 0.16, 150, 0.65, (("sine", 1.0),), 0.002, 0.12,
                         sweep_to=48, ch=c)
        # offbeat open hats
        for i in range(4):
            add_noise(b, t0 + (i + 0.5) * beat, 0.09, 0.22, 0.85, release=0.05)
        # square arps (16ths, offbeat accent)
        arp = arp_sets[bar_i % 4]
        for i in range(8):
            f = arp[i % 4] * (2 if i >= 4 else 1)
            vol = 0.14 if i % 2 else 0.10
            add_tone(b, t0 + i * beat / 2, beat * 0.3, f, vol, (("square", 0.5), ("sine", 0.3)),
                     0.003, 0.1, ch=0 if i % 2 else 1)
        # pad stab on bar starts
        for f in (root * 4, f2 * 4, f3 * 4):
            add_tone(b, t0, beat * 1.8, f, 0.08, (("sine", 1.0),), 0.05, 0.5)
    return b


# ============================================================== AMBIENCE
def amb_birds():
    secs = 20
    b = Buf(secs)
    # soft wind bed
    add_noise(b, 0.0, secs, 0.05, 0.2)
    rng = random.Random(11)
    t = 0.5
    while t < secs - 1:
        # chirp: quick freq-swept blips
        f0 = rng.uniform(2200, 4200)
        nch = rng.randint(2, 5)
        tt = t
        for _ in range(nch):
            add_tone(b, tt, 0.07, f0, 0.16, (("sine", 1.0),), 0.01, 0.05,
                     sweep_to=f0 * rng.uniform(1.15, 1.5))
            tt += 0.09 + rng.random() * 0.05
        t += 1.5 + rng.random() * 3.5
    return b


def _wind(secs, seed, vol=0.25, lp=0.12):
    b = Buf(secs)
    n0 = 0
    n = n_samples(secs)
    state = 0.0
    rng = random.Random(seed)
    gusts = [(rng.random() * secs, 2 + rng.random() * 4, 0.5 + rng.random() * 0.5)
             for _ in range(3)]
    for i in range(n):
        t = i / SR
        gust = 1.0
        for gt, gd, gv in gusts:
            d = abs(t - gt)
            if d < gd:
                gust += gv * (1.0 - d / gd)
        x = rng.uniform(-1, 1)
        state += lp * (x - state)
        b.at(0, i, state * 2.2 * vol * gust)
    return b


def amb_wind():
    return _wind(20, 21, vol=0.3, lp=0.1)


def amb_arctic():
    return _wind(20, 33, vol=0.38, lp=0.06)


def amb_city():
    secs = 20
    b = Buf(secs)
    n = n_samples(secs)
    # low traffic hum
    for i in range(n):
        t = i / SR
        v = 0.5 * math.sin(2 * math.pi * 55 * t) + 0.3 * math.sin(2 * math.pi * 110 * t)
        v *= 0.10 * (1.0 + 0.25 * math.sin(2 * math.pi * 0.13 * t))
        b.at(0, i, v)
    rng = random.Random(44)
    # distant pass-bys
    for _ in range(3):
        t0 = rng.uniform(1, secs - 6)
        n0 = int(t0 * SR)
        m = n_samples(4.0)
        for i in range(m):
            t = i / SR
            env = math.sin(math.pi * i / m) ** 2
            f = 180 + 220 * (i / m)
            x = rng.uniform(-1, 1)
            b.at(0, n0 + i, math.sin(2 * math.pi * f * t) * 0.12 * env)
    # distant siren
    t0 = 6.0
    for i in range(n_samples(5.0)):
        t = i / SR
        f = 600 + 300 * math.sin(2 * math.pi * 0.7 * t)
        env = math.sin(math.pi * i / n_samples(5.0))
        b.at(0, int(t0 * SR) + i, math.sin(2 * math.pi * f * t) * 0.05 * env)
    return b


def main():
    os.makedirs(OUT, exist_ok=True)
    random.seed(20260827)
    write_wav(os.path.join(OUT, "menu_theme.wav"), menu_theme())
    write_wav(os.path.join(OUT, "run_theme.wav"), run_theme())
    write_wav(os.path.join(OUT, "amb_birds.wav"), amb_birds())
    write_wav(os.path.join(OUT, "amb_wind.wav"), amb_wind())
    write_wav(os.path.join(OUT, "amb_city.wav"), amb_city())
    write_wav(os.path.join(OUT, "amb_arctic.wav"), amb_arctic())
    write_wav(os.path.join(OUT, "engine_loop.wav"), engine_loop())
    for name, fn in [
        ("sfx_coin", sfx_coin), ("sfx_pop", sfx_pop), ("sfx_fuel", sfx_fuel),
        ("sfx_click", sfx_click), ("sfx_hover", sfx_hover), ("sfx_whoosh", sfx_whoosh),
        ("sfx_land", sfx_land), ("sfx_crash", sfx_crash), ("sfx_flip", sfx_flip),
        ("sfx_unlock", sfx_unlock), ("sfx_best", sfx_best), ("sfx_beep", sfx_beep),
        ("sfx_go", sfx_go), ("sfx_sad", sfx_sad), ("sfx_cash", sfx_cash),
        ("sfx_denied", sfx_denied), ("sfx_tick", sfx_tick), ("sfx_pennant", sfx_pennant),
    ]:
        write_wav(os.path.join(OUT, name + ".wav"), fn())
    print("ALL AUDIO OK")


if __name__ == "__main__":
    main()
