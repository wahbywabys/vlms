/**
 * Small synthesised sound effects for the safety simulator (Web Audio, no
 * files): a bang, an electrical zap, escaping steam, a fire whoosh, a metal
 * clang, an alarm, the welding arc's crackle, and a chime for a job done.
 */
type Sfx = 'bang' | 'zap' | 'hiss' | 'whoosh' | 'clang' | 'alarm' | 'arc' | 'ok' | 'step' | 'hum';

let ctx: AudioContext | null = null;
let muted = false;
export const setMuted = (m: boolean) => { muted = m; };

function ac() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noise(a: AudioContext, seconds: number) {
  const b = a.createBuffer(1, Math.ceil(a.sampleRate * seconds), a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource();
  s.buffer = b;
  return s;
}

function env(a: AudioContext, peak: number, attack: number, decay: number, at = a.currentTime) {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return g;
}

export function sfx(name: Sfx) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const out = a.destination;
  const filt = (type: BiquadFilterType, f: number, q = 1) => { const n = a.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  switch (name) {
    case 'bang': {
      const n = noise(a, 0.8); const f = filt('lowpass', 900); const g = env(a, 0.9, 0.005, 0.6);
      n.connect(f).connect(g).connect(out); n.start(t);
      const o = a.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.4);
      const g2 = env(a, 0.7, 0.005, 0.45); o.connect(g2).connect(out); o.start(t); o.stop(t + 0.5);
      break;
    }
    case 'clang': {
      for (const [fr, p] of [[523, 0.3], [1187, 0.2], [2210, 0.12]] as const) {
        const o = a.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
        const g = env(a, p, 0.003, 1.2); o.connect(g).connect(out); o.start(t); o.stop(t + 1.3);
      }
      break;
    }
    case 'zap': {
      const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(90, t);
      const lfo = a.createOscillator(); lfo.frequency.value = 37; const lg = a.createGain(); lg.gain.value = 60; lfo.connect(lg).connect(o.frequency);
      const g = env(a, 0.35, 0.01, 0.9); const n = noise(a, 1); const nf = filt('highpass', 2500); const ng = env(a, 0.4, 0.005, 0.7);
      o.connect(g).connect(out); n.connect(nf).connect(ng).connect(out);
      o.start(t); lfo.start(t); n.start(t); o.stop(t + 1); lfo.stop(t + 1);
      break;
    }
    case 'hiss': {
      const n = noise(a, 2.2); const f = filt('bandpass', 5000, 0.6); const g = env(a, 0.45, 0.05, 2.0);
      n.connect(f).connect(g).connect(out); n.start(t);
      break;
    }
    case 'whoosh': {
      const n = noise(a, 2.5); const f = filt('lowpass', 400); f.frequency.exponentialRampToValueAtTime(1600, t + 1.2);
      const g = env(a, 0.6, 0.3, 2.0); n.connect(f).connect(g).connect(out); n.start(t);
      break;
    }
    case 'arc': {
      const n = noise(a, 1.5); const f = filt('bandpass', 3000, 2); const g = a.createGain(); g.gain.value = 0.18;
      const am = a.createOscillator(); am.type = 'square'; am.frequency.value = 23; const ag = a.createGain(); ag.gain.value = 0.15; am.connect(ag).connect(g.gain);
      n.connect(f).connect(g).connect(out); n.start(t); am.start(t); am.stop(t + 1.5);
      break;
    }
    case 'alarm': {
      for (let i = 0; i < 4; i++) {
        const o = a.createOscillator(); o.type = 'square'; o.frequency.value = i % 2 ? 660 : 880;
        const g = env(a, 0.12, 0.01, 0.2, t + i * 0.25); o.connect(g).connect(out); o.start(t + i * 0.25); o.stop(t + i * 0.25 + 0.24);
      }
      break;
    }
    case 'ok': {
      [523, 659, 784].forEach((fr, i) => {
        const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
        const g = env(a, 0.18, 0.01, 0.5, t + i * 0.09); o.connect(g).connect(out); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.6);
      });
      break;
    }
    case 'step': {
      const n = noise(a, 0.08); const f = filt('lowpass', 600); const g = env(a, 0.08, 0.002, 0.06);
      n.connect(f).connect(g).connect(out); n.start(t);
      break;
    }
    case 'hum': {
      const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 50;
      const f = filt('lowpass', 300); const g = env(a, 0.12, 0.3, 1.6); o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + 2);
      break;
    }
  }
}
