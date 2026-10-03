# -*- coding: utf-8 -*-
"""
研途秘典 · 音效文件生成（真实 WAV 文件，替换实时合成）
依赖：numpy（已随环境提供）；标准库 wave 写出 16-bit/44.1kHz 单声道
运行：python scripts/make_sounds.py
设计：点击(click) / 抽牌(draw) / 翻牌(flip) / 揭示(reveal) / 结果(result)
"""
import os
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "sounds")


def env_exp(t, tau):
    return np.exp(-t / tau)


def env_ar(t, attack=0.005):
    """快速起音 + 指数衰减包络"""
    e = np.ones_like(t)
    a = int(attack * SR)
    if a > 0:
        e[:a] = np.linspace(0.0, 1.0, a)
    return e


def write_wav(name, samples):
    samples = np.asarray(samples, dtype=np.float64)
    peak = np.max(np.abs(samples)) or 1.0
    samples = samples / peak * 0.72
    fade = int(0.004 * SR)
    if fade > 0 and len(samples) > 2 * fade:
        samples[:fade] *= np.linspace(0, 1, fade)
        samples[-fade:] *= np.linspace(1, 0, fade)
    pcm = np.clip(samples, -1.0, 1.0)
    pcm = (pcm * 32767).astype("<i2")
    path = os.path.join(OUT, name + ".wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("  %-10s %.2fs  %.0f KB" % (name, len(samples) / SR, os.path.getsize(path) / 1024))


def make_click():
    t = np.arange(int(SR * 0.07)) / SR
    f = 950 * np.exp(-t * 22) + 620
    phase = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(phase) * env_exp(t, 0.018)
    tick = np.sin(2 * np.pi * 4500 * t) * env_exp(t, 0.0022) * 0.25
    return body + tick


def one_pole(x, a_array):
    y = np.empty_like(x)
    prev = 0.0
    for i in range(len(x)):
        prev = prev + a_array[i] * (x[i] - prev)
        y[i] = prev
    return y


def make_draw():
    n = int(SR * 0.45)
    t = np.arange(n) / SR
    noise = np.random.default_rng(7).uniform(-1, 1, n)
    # 时变低通：先开（快速刷过）后收
    a = np.clip(0.05 + 0.45 * np.sin(np.pi * np.minimum(t / 0.45, 1.0)) ** 1.5, 0.02, 0.55)
    body = one_pole(noise, a)
    env = np.minimum(t / 0.05, 1.0) * np.minimum((0.45 - t) / 0.12, 1.0)
    env = np.clip(env, 0, 1)
    return body * env * 0.9


def make_flip():
    n = int(SR * 0.32)
    t = np.arange(n) / SR
    rng = np.random.default_rng(13)
    noise = rng.uniform(-1, 1, n)
    a = np.clip(0.02 + 0.5 * np.minimum(t / 0.12, 1.0), 0.02, 0.55)
    swish = one_pole(noise, a)
    swish_env = np.minimum(t / 0.012, 1.0) * env_exp(t, 0.05)
    # 低沉的「啪」
    delay = int(SR * 0.06)
    thock_t = t[delay:] - t[delay]
    thock = np.zeros(n)
    thock[delay:] = np.sin(2 * np.pi * (230 - 60 * thock_t / max(thock_t[-1], 1e-9)) * thock_t) * env_exp(thock_t, 0.03)
    return swish * swish_env * 0.7 + thock * 0.8


def make_reveal():
    t = np.arange(int(SR * 1.15)) / SR
    partials = [(880.0, 1.00), (1756.0, 0.45), (2647.0, 0.18), (3527.0, 0.07)]
    out = np.zeros_like(t)
    for freq, amp in partials:
        out += amp * np.sin(2 * np.pi * freq * t) * env_ar(t, 0.004) * env_exp(t, 0.38)
    return out


def make_result():
    t = np.arange(int(SR * 2.0)) / SR
    notes = [(523.25, 0.00), (659.25, 0.18), (783.99, 0.36), (1046.50, 0.54)]
    out = np.zeros_like(t)
    for freq, start in notes:
        tt = t - start
        tt = np.maximum(tt, 0)
        seg = np.sin(2 * np.pi * freq * tt) * env_ar(tt, 0.006) * env_exp(tt, 0.55)
        seg += 0.25 * np.sin(2 * np.pi * freq * 2 * tt) * env_ar(tt, 0.006) * env_exp(tt, 0.4)
        out += seg
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    print("generating sounds -> assets/sounds/")
    write_wav("click", make_click())
    write_wav("draw", make_draw())
    write_wav("flip", make_flip())
    write_wav("reveal", make_reveal())
    write_wav("result", make_result())
    print("done.")


if __name__ == "__main__":
    main()
