/**
 * Procedural textures drawn on a canvas once and cached: surface noise for
 * roughness and bump, brushed and cast metal, the workshop's epoxy floor,
 * hazard stripes, text plates and ISO 7010-style safety signs (EN or AR).
 * Nothing is downloaded, so the 3D works offline and inside one HTML file.
 */
import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();
const canDraw = () => typeof document !== 'undefined';

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function canvasTex(key: string, w: number, h: number, draw: Draw, o: { srgb?: boolean; repeat?: [number, number]; aniso?: number } = {}) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  if (o.srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...o.repeat); }
  t.anisotropy = o.aniso ?? 4;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

/** Deterministic pseudo-random numbers, so textures look the same on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Smooth value noise in 0..1 on a w×h grid, tiling. */
function valueNoise(w: number, h: number, cells: number, seed: number) {
  const r = rng(seed);
  const g = Array.from({ length: cells * cells }, () => r());
  const at = (x: number, y: number) => g[((y + cells) % cells) * cells + ((x + cells) % cells)]!;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = (x / w) * cells, fy = (y / h) * cells;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const sx = fx - ix, sy = fy - iy;
    const ux = sx * sx * (3 - 2 * sx), uy = sy * sy * (3 - 2 * sy);
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * ux;
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * ux;
    out[y * w + x] = a + (b - a) * uy;
  }
  return out;
}

function fractal(w: number, h: number, seed: number, octaves: [number, number][]) {
  const out = new Float32Array(w * h);
  for (const [cells, amp] of octaves) {
    const n = valueNoise(w, h, cells, seed + cells);
    for (let i = 0; i < out.length; i++) out[i]! += n[i]! * amp;
  }
  return out;
}

function putGrey(ctx: CanvasRenderingContext2D, w: number, h: number, v: (i: number) => number) {
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const g = Math.max(0, Math.min(255, v(i) * 255));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Fine surface variation (0.72..1) for roughness maps: paint, plastic, cast iron. */
export const noiseTex = () => {
  if (!canDraw()) return null;
  return canvasTex('noise', 256, 256, (ctx, w, h) => {
    const n = fractal(w, h, 7, [[8, 0.5], [32, 0.3], [128, 0.2]]);
    putGrey(ctx, w, h, (i) => 0.72 + n[i]! * 0.28);
  }, { repeat: [1, 1] });
};

/** Directional streaks of ground or turned steel. */
export const brushedTex = () => {
  if (!canDraw()) return null;
  return canvasTex('brushed', 256, 256, (ctx, w, h) => {
    const r = rng(11);
    const rows = new Float32Array(h).map(() => r());
    const n = valueNoise(w, h, 16, 3);
    putGrey(ctx, w, h, (i) => 0.62 + rows[Math.floor(i / w)]! * 0.25 + n[i]! * 0.13);
  });
};

/** Speckled sand-cast or powder-coated surface. */
export const castTex = () => {
  if (!canDraw()) return null;
  return canvasTex('cast', 256, 256, (ctx, w, h) => {
    const r = rng(5);
    const n = fractal(w, h, 9, [[16, 0.4], [64, 0.6]]);
    putGrey(ctx, w, h, (i) => 0.7 + n[i]! * 0.2 + (r() > 0.92 ? 0.12 : 0));
  });
};

/** Epoxy-coated concrete floor (colour), with wear and a few oil marks. */
export const floorTex = (repeat: [number, number]) => {
  if (!canDraw()) return null;
  return canvasTex(`floor:${repeat.join('x')}`, 512, 512, (ctx, w, h) => {
    const n = fractal(w, h, 21, [[4, 0.35], [16, 0.35], [96, 0.3]]);
    const r = rng(9);
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = n[i]!;
      const speck = r() > 0.985 ? -18 : r() > 0.97 ? 10 : 0;
      img.data[i * 4] = 108 + v * 26 + speck;
      img.data[i * 4 + 1] = 120 + v * 26 + speck;
      img.data[i * 4 + 2] = 116 + v * 22 + speck;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // Oil stains and tyre/trolley marks
    for (let k = 0; k < 7; k++) {
      const x = r() * w, y = r() * h, rad = 14 + r() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(40,44,42,.35)'); g.addColorStop(1, 'rgba(40,44,42,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(60,64,62,.18)'; ctx.lineWidth = 6;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(0, r() * h); ctx.bezierCurveTo(w * .3, r() * h, w * .7, r() * h, w, r() * h); ctx.stroke(); }
    // Saw-cut expansion joints at the tile edges
    ctx.strokeStyle = 'rgba(30,34,32,.55)'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }, { srgb: true, repeat, aniso: 8 });
};

/** Yellow and black diagonal hazard stripes. */
export const hazardTex = (repeat: [number, number] = [1, 1]) => {
  if (!canDraw()) return null;
  return canvasTex(`hazard:${repeat.join('x')}`, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f2c230'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#16181a';
    for (let k = -2; k < 4; k++) {
      ctx.beginPath(); ctx.moveTo(k * 64, 0); ctx.lineTo(k * 64 + 32, 0); ctx.lineTo(k * 64 + 32 + 128, h); ctx.lineTo(k * 64 + 128, h); ctx.fill();
    }
  }, { srgb: true, repeat });
};

/** Corrugated roller-shutter door. */
export const shutterTex = () => {
  if (!canDraw()) return null;
  return canvasTex('shutter', 64, 256, (ctx, w, h) => {
    for (let y = 0; y < h; y += 8) {
      const g = ctx.createLinearGradient(0, y, 0, y + 8);
      g.addColorStop(0, '#aab3ba'); g.addColorStop(0.5, '#d9dee2'); g.addColorStop(1, '#8a939a');
      ctx.fillStyle = g; ctx.fillRect(0, y, w, 8);
    }
  }, { srgb: true, repeat: [1, 6] });
};

/** Perforated tool board with outlines of the tools that hang on it. */
export const pegboardTex = () => {
  if (!canDraw()) return null;
  return canvasTex('pegboard', 512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e8e2d2'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#b9b2a0';
    for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }
    // Shadow-board outlines (so a missing tool shows)
    ctx.strokeStyle = '#1b1d20'; ctx.lineWidth = 3; ctx.fillStyle = '#2d3136';
    const tool = (x: number, y: number, l: number, r: number, head: number) => {
      ctx.fillRect(x - r, y, r * 2, l);
      ctx.beginPath(); ctx.arc(x, y + l + head * 0.6, head, 0, Math.PI * 2); ctx.fill();
    };
    tool(60, 30, 120, 6, 18); tool(110, 30, 140, 5, 14); tool(160, 30, 110, 7, 20);
    ctx.fillStyle = '#c8312b'; ctx.fillRect(220, 40, 26, 150); ctx.fillStyle = '#2d3136'; ctx.fillRect(226, 190, 14, 40);
    ctx.fillStyle = '#f06721'; ctx.fillRect(290, 40, 26, 150); ctx.fillStyle = '#2d3136'; ctx.fillRect(296, 190, 14, 40);
    ctx.fillStyle = '#2d3136';
    for (let k = 0; k < 5; k++) ctx.fillRect(360 + k * 26, 50, 12, 70 + k * 18);
  }, { srgb: true });
};

// ---------------------------------------------------------------------------
// Text plates and signs
// ---------------------------------------------------------------------------
const FONT = '"Segoe UI", "Noto Sans Arabic", "Noto Sans", Tahoma, Arial, sans-serif';

export interface PlateOpts { bg?: string; fg?: string; border?: string; w?: number; h?: number; align?: 'left' | 'center'; stripe?: string; rtl?: boolean }

/** A rating plate, nameplate or sticker with up to a few lines of text. */
export function plateTex(lines: string[], o: PlateOpts = {}) {
  if (!canDraw()) return null;
  const { bg = '#e9ecef', fg = '#14181d', border = '#5b6670', w = 512, h = 256, align = 'left', stripe, rtl = false } = o;
  return canvasTex(`plate:${lines.join('|')}:${bg}${fg}${border}${w}${h}${align}${stripe}${rtl}`, w, h, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (stripe) { ctx.fillStyle = stripe; ctx.fillRect(0, 0, w, h * 0.2); }
    ctx.strokeStyle = border; ctx.lineWidth = Math.max(4, w / 90); ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.direction = rtl ? 'rtl' : 'ltr';
    const n = lines.length;
    const top = stripe ? h * 0.22 : h * 0.08;
    const lh = (h - top - h * 0.08) / n;
    lines.forEach((t, i) => {
      const big = i === 0;
      ctx.font = `${big ? 700 : 500} ${Math.floor(lh * (big ? 0.62 : 0.5))}px ${FONT}`;
      ctx.fillStyle = big && stripe ? fg : fg;
      ctx.textBaseline = 'middle';
      ctx.textAlign = align === 'center' ? 'center' : rtl ? 'right' : 'left';
      const x = align === 'center' ? w / 2 : rtl ? w - w * 0.06 : w * 0.06;
      ctx.fillText(t, x, top + lh * (i + 0.5), w * 0.88);
    });
  }, { srgb: true });
}

export type SignKind = 'mandatory' | 'warning' | 'prohibition' | 'safe' | 'fire';
export type Pictogram = 'glasses' | 'ear' | 'boots' | 'gloves' | 'mask' | 'welding' | 'apron' | 'visor' | 'hairnet' | 'exclaim'
  | 'electric' | 'rotating' | 'hot' | 'flying' | 'noGloves' | 'noJewel' | 'noFlame' | 'firstAid' | 'exit' | 'extinguisher' | 'eyewash' | 'lockout' | 'gas' | 'fume';

/** Simple vector pictograms in a 100×100 box, shared with the SVG versions in the lesson cards. */
export function drawPictogram(ctx: CanvasRenderingContext2D, p: Pictogram, color: string) {
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = (d: string, fill = true) => { const p2 = new Path2D(d); if (fill) ctx.fill(p2); else ctx.stroke(p2); };
  switch (p) {
    case 'glasses': path('M14 46 Q14 36 26 36 L74 36 Q86 36 86 46 L86 52 Q86 66 70 66 Q58 66 54 54 L46 54 Q42 66 30 66 Q14 66 14 52 Z'); break;
    case 'ear': path('M36 30 Q36 14 52 14 Q70 14 70 34 Q70 46 60 54 Q54 60 54 70 Q54 84 42 84 Q32 84 32 74', false); path('M10 50 a14 14 0 0 1 28 0 v10 a14 14 0 0 1 -28 0 Z M62 50 a14 14 0 0 1 28 0 v10 a14 14 0 0 1 -28 0 Z'); break;
    case 'boots': path('M30 14 L56 14 L56 56 L84 66 Q90 70 90 78 L90 86 L22 86 L22 78 Q30 74 30 66 Z'); break;
    case 'gloves': path('M30 88 L30 52 Q24 44 20 34 Q18 28 24 26 Q30 26 34 36 L36 40 L36 16 Q36 10 42 10 Q48 10 48 16 L48 38 L50 12 Q50 6 56 6 Q62 6 62 12 L62 38 L64 16 Q64 10 70 10 Q76 10 76 16 L76 60 Q76 76 70 88 Z'); break;
    case 'mask': path('M22 40 Q50 22 78 40 L74 64 Q50 84 26 64 Z'); ctx.fillStyle = '#fff'; path('M34 50 h32 v6 h-32 Z'); break;
    case 'welding': path('M20 20 Q50 6 80 20 L84 70 Q50 92 16 70 Z'); ctx.fillStyle = '#fff'; path('M30 40 h40 v14 h-40 Z'); break;
    case 'apron': path('M38 10 h24 v14 Q76 26 76 40 L80 90 L20 90 L24 40 Q24 26 38 24 Z'); break;
    case 'visor': path('M18 30 Q50 10 82 30 L82 40 L18 40 Z'); ctx.globalAlpha = 0.55; path('M20 42 L80 42 L76 80 Q50 90 24 80 Z'); break;
    case 'hairnet': path('M18 56 Q18 18 50 18 Q82 18 82 56 Z'); break;
    case 'exclaim': path('M44 20 h12 l-2 42 h-8 Z M50 70 a7 7 0 1 1 0 14 a7 7 0 1 1 0 -14'); break;
    case 'electric': path('M56 10 L26 56 L48 56 L40 90 L74 40 L52 40 Z'); break;
    case 'rotating': ctx.lineWidth = 9; path('M24 50 A26 26 0 1 1 50 76', false); path('M42 66 L56 76 L42 88 Z'); path('M50 50 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0'); break;
    case 'hot': ctx.lineWidth = 7; for (const x of [32, 50, 68]) path(`M${x} 74 Q${x - 10} 60 ${x} 46 Q${x + 10} 32 ${x} 18`, false); path('M16 80 h68 v8 h-68 Z'); break;
    case 'flying': path('M18 40 h30 v20 h-30 Z'); for (const [x, y] of [[62, 26], [74, 50], [64, 72], [84, 36]] as const) { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); } break;
    case 'noGloves': drawPictogram(ctx, 'gloves', color); break;
    case 'noJewel': ctx.lineWidth = 8; path('M50 54 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0', false); path('M40 14 L60 14 L66 28 L50 38 L34 28 Z'); break;
    case 'noFlame': path('M50 12 Q74 40 66 64 Q60 84 50 86 Q40 84 34 64 Q26 40 50 12 Z'); break;
    case 'firstAid': ctx.fillStyle = '#fff'; path('M40 18 h20 v22 h22 v20 h-22 v22 h-20 v-22 h-22 v-20 h22 Z'); break;
    case 'exit': ctx.fillStyle = '#fff'; path('M58 12 a8 8 0 1 1 0 16 a8 8 0 1 1 0 -16 M44 32 L64 34 L74 52 L66 56 L58 44 L54 60 L68 74 L64 90 L56 90 L58 78 L44 66 L36 88 L26 86 L40 50 L34 54 L26 66 L18 60 L32 40 Z'); break;
    case 'extinguisher': ctx.fillStyle = '#fff'; path('M38 30 h24 v58 h-24 Z M44 16 h12 v14 h-12 Z M56 20 Q76 20 76 40', true); ctx.strokeStyle = '#fff'; path('M56 20 Q78 20 78 44', false); break;
    case 'eyewash': ctx.fillStyle = '#fff'; path('M20 50 Q50 24 80 50 Q50 76 20 50 Z'); ctx.fillStyle = '#2f9e57'; path('M50 50 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0'); break;
    case 'lockout': path('M30 46 h40 v40 h-40 Z'); ctx.lineWidth = 8; path('M38 46 V32 Q38 18 50 18 Q62 18 62 32 V46', false); break;
    case 'gas': path('M36 22 h28 v8 Q74 34 74 46 L74 88 L26 88 L26 46 Q26 34 36 30 Z M44 10 h12 v12 h-12 Z'); break;
    case 'fume': ctx.lineWidth = 7; for (const x of [30, 50, 70]) path(`M${x} 86 Q${x - 12} 70 ${x} 56 Q${x + 12} 42 ${x} 26`, false); break;
  }
  ctx.restore();
}

/** An ISO 7010-style safety sign: pictogram plus a caption underneath. */
export function signTex(kind: SignKind, pic: Pictogram, caption: string, rtl = false) {
  if (!canDraw()) return null;
  return canvasTex(`sign:${kind}:${pic}:${caption}`, 256, 340, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d0d4d8'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, w - 4, h - 4);
    const cx = w / 2, cy = 118, R = 96;
    if (kind === 'mandatory') {
      ctx.fillStyle = '#1b5fae'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(cx - 62, cy - 62); ctx.scale(1.24, 1.24); drawPictogram(ctx, pic, '#ffffff'); ctx.restore();
    } else if (kind === 'warning') {
      ctx.fillStyle = '#f2c230'; ctx.strokeStyle = '#111'; ctx.lineWidth = 12; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx + R * 1.08, cy + R * 0.85); ctx.lineTo(cx - R * 1.08, cy + R * 0.85); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(cx - 42, cy - 30); ctx.scale(0.86, 0.86); drawPictogram(ctx, pic, '#111'); ctx.restore();
    } else if (kind === 'prohibition') {
      ctx.save(); ctx.translate(cx - 56, cy - 56); ctx.scale(1.12, 1.12); drawPictogram(ctx, pic, '#111'); ctx.restore();
      ctx.strokeStyle = '#c8312b'; ctx.lineWidth = 18;
      ctx.beginPath(); ctx.arc(cx, cy, R - 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - (R - 9) * 0.7, cy - (R - 9) * 0.7); ctx.lineTo(cx + (R - 9) * 0.7, cy + (R - 9) * 0.7); ctx.stroke();
    } else {
      ctx.fillStyle = kind === 'fire' ? '#c8312b' : '#2f9e57'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.save(); ctx.translate(cx - 62, cy - 62); ctx.scale(1.24, 1.24); drawPictogram(ctx, pic, '#ffffff'); ctx.restore();
    }
    ctx.fillStyle = '#111'; ctx.direction = rtl ? 'rtl' : 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const words = caption.split(' ');
    const lines: string[] = [];
    ctx.font = `700 26px ${FONT}`;
    let cur = '';
    for (const wd of words) { const t = cur ? `${cur} ${wd}` : wd; if (ctx.measureText(t).width > w - 24 && cur) { lines.push(cur); cur = wd; } else cur = t; }
    if (cur) lines.push(cur);
    lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, cx, 248 + i * 30 - (Math.min(lines.length, 3) - 1) * 10));
  }, { srgb: true });
}

/** The WABYS logo as cloth print: a patch for the chest and a print for the back. */
export function wabysTex(variant: 'patch' | 'back' | 'banner', sub = '') {
  if (!canDraw()) return null;
  const [w, h] = variant === 'banner' ? [1024, 256] : variant === 'back' ? [512, 256] : [256, 128];
  return canvasTex(`wabys:${variant}:${sub}`, w, h, (ctx) => {
    if (variant !== 'back') { ctx.fillStyle = '#14234c'; ctx.fillRect(0, 0, w, h); }
    else ctx.clearRect(0, 0, w, h);
    const s = h / 128;
    // Mark: an orange hexagon nut with a white tick
    const mx = variant === 'banner' ? h * 0.62 : variant === 'back' ? w / 2 : h * 0.55, my = variant === 'back' ? h * 0.32 : h / 2, R = (variant === 'back' ? 34 : 40) * s;
    ctx.fillStyle = '#f06721'; ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; ctx[k ? 'lineTo' : 'moveTo'](mx + R * Math.cos(a), my + R * Math.sin(a)); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 9 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(mx - R * 0.45, my); ctx.lineTo(mx - R * 0.1, my + R * 0.35); ctx.lineTo(mx + R * 0.5, my - R * 0.4); ctx.stroke();
    ctx.fillStyle = variant === 'back' ? '#f06721' : '#ffffff'; ctx.textBaseline = 'middle';
    if (variant === 'back') {
      ctx.textAlign = 'center'; ctx.font = `900 ${70 * s * 0.9}px ${FONT}`; ctx.fillText('WABYS', w / 2, h * 0.68);
      ctx.fillStyle = '#ffffff'; ctx.font = `700 ${22 * s}px ${FONT}`; ctx.fillText(sub || 'STUDENT · متدرب', w / 2, h * 0.9);
    } else {
      ctx.textAlign = 'left'; ctx.font = `900 ${(variant === 'banner' ? 64 : 46) * s}px ${FONT}`;
      ctx.fillText('WABYS', mx + R * 1.35, variant === 'banner' ? my - 22 * s : my);
      if (variant === 'banner') {
        ctx.fillStyle = '#f5b38c'; ctx.font = `600 ${26 * s}px ${FONT}`; ctx.fillText(sub, mx + R * 1.35, my + 34 * s);
        ctx.fillStyle = '#f06721'; ctx.fillRect(0, h - 10 * s, w, 10 * s);
      }
    }
  }, { srgb: true });
}

const urls = new Map<string, string>();
/** A sign as an image URL, for the 2D lesson cards and the simulator's panels. */
export function signDataURL(kind: SignKind, pic: Pictogram) {
  if (!canDraw()) return '';
  const key = `${kind}:${pic}`;
  let u = urls.get(key);
  if (!u) {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 200;
    const ctx = c.getContext('2d')!;
    const cx = 100, cy = 100, R = 92;
    if (kind === 'mandatory') {
      ctx.fillStyle = '#1b5fae'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(cx - 60, cy - 60); ctx.scale(1.2, 1.2); drawPictogram(ctx, pic, '#ffffff'); ctx.restore();
    } else if (kind === 'warning') {
      ctx.fillStyle = '#f2c230'; ctx.strokeStyle = '#111'; ctx.lineWidth = 10; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(cx, 10); ctx.lineTo(190, 178); ctx.lineTo(10, 178); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(cx - 40, 78); ctx.scale(0.8, 0.8); drawPictogram(ctx, pic, '#111'); ctx.restore();
    } else if (kind === 'prohibition') {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(cx - 55, cy - 55); ctx.scale(1.1, 1.1); drawPictogram(ctx, pic, '#111'); ctx.restore();
      ctx.strokeStyle = '#c8312b'; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.arc(cx, cy, R - 8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - (R - 8) * 0.7, cy - (R - 8) * 0.7); ctx.lineTo(cx + (R - 8) * 0.7, cy + (R - 8) * 0.7); ctx.stroke();
    } else {
      ctx.fillStyle = kind === 'fire' ? '#c8312b' : '#2f9e57'; ctx.beginPath(); ctx.roundRect(8, 8, 184, 184, 16); ctx.fill();
      ctx.save(); ctx.translate(cx - 60, cy - 60); ctx.scale(1.2, 1.2); drawPictogram(ctx, pic, '#ffffff'); ctx.restore();
    }
    u = c.toDataURL();
    urls.set(key, u);
  }
  return u;
}
