/**
 * City rendering: sky, day/night palettes, parallax skyline, building facades,
 * the street, props, weather and the lighting pass.
 *
 * Everything is drawn procedurally (no textures), so build size stays tiny and
 * the city can scroll forever without repeating visual seams.
 */
import { VIEW_W, VIEW_H, GROUND_Y, COLORS } from '../config.js';
import { clamp, lerp, mixHex, rgba } from '../core/rng.js';
import { roundRect, ellipse } from '../core/draw.js';

const SKY_KEYS = [
  { t: 0.00, top: '#05070f', mid: '#0a1222', low: '#121c30', haze: '#16213a' },
  { t: 0.20, top: '#070a16', mid: '#141c30', low: '#2a2436', haze: '#33283c' },
  { t: 0.26, top: '#2a2b4a', mid: '#6b4a66', low: '#c97a68', haze: '#d99a7a' },
  { t: 0.34, top: '#41637f', mid: '#6f8ea3', low: '#a6b8bf', haze: '#b6c4c6' },
  { t: 0.62, top: '#4f748c', mid: '#7f9aac', low: '#adbfc5', haze: '#bcc9cb' },
  { t: 0.72, top: '#3b4a70', mid: '#8a6a7e', low: '#d98561', haze: '#e0a071' },
  { t: 0.80, top: '#141a32', mid: '#2a2542', low: '#4a2f45', haze: '#533246' },
  { t: 0.88, top: '#05070f', mid: '#0a1222', low: '#101a2c', haze: '#131e34' },
  { t: 1.00, top: '#05070f', mid: '#0a1222', low: '#121c30', haze: '#16213a' }
];

const hash = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

export function skyPalette(timeOfDay) {
  const t = ((timeOfDay % 1) + 1) % 1;
  let a = SKY_KEYS[0];
  let b = SKY_KEYS[1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (t >= SKY_KEYS[i].t && t <= SKY_KEYS[i + 1].t) {
      a = SKY_KEYS[i];
      b = SKY_KEYS[i + 1];
      break;
    }
  }
  const k = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
  return {
    top: mixHex(a.top, b.top, k),
    mid: mixHex(a.mid, b.mid, k),
    low: mixHex(a.low, b.low, k),
    haze: mixHex(a.haze, b.haze, k)
  };
}

export class Background {
  constructor() {
    this.time = 0;
    this.stars = Array.from({ length: 110 }, (_, i) => ({
      x: hash(i * 3.1) * VIEW_W,
      y: hash(i * 7.7) * 300,
      r: 0.5 + hash(i * 5.3) * 1.3,
      tw: hash(i * 1.7) * 6.28
    }));
    this.clouds = Array.from({ length: 7 }, (_, i) => ({
      x: hash(i * 2.3) * 1600,
      y: 40 + hash(i * 9.1) * 180,
      s: 0.6 + hash(i * 4.4) * 1.5,
      sp: 4 + hash(i * 6.2) * 12
    }));
    this.rain = Array.from({ length: 150 }, () => ({
      x: Math.random() * (VIEW_W + 200) - 100,
      y: Math.random() * VIEW_H,
      len: 8 + Math.random() * 16,
      sp: 520 + Math.random() * 420,
      drift: 60 + Math.random() * 50
    }));
    this.glowCache = new Map();
  }

  update(dt) {
    this.time += dt;
  }

  /** Cached radial gradient — avoids rebuilding gradients every frame. */
  glow(ctx, radius, rgb) {
    const key = `${radius}|${rgb}`;
    let g = this.glowCache.get(key);
    if (!g) {
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      g.addColorStop(0, `rgba(${rgb}, 0.95)`);
      g.addColorStop(0.4, `rgba(${rgb}, 0.4)`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      this.glowCache.set(key, g);
    }
    return g;
  }

  // ------------------------------------------------------------------ sky ---

  drawSky(ctx, { survival, world, camera }) {
    const pal = skyPalette(survival.timeOfDay);
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, pal.top);
    g.addColorStop(0.55, pal.mid);
    g.addColorStop(1, pal.low);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const dark = survival.darkness;

    // Stars.
    if (dark > 0.15) {
      ctx.save();
      ctx.globalAlpha = dark * 0.9;
      for (const s of this.stars) {
        const tw = 0.55 + 0.45 * Math.sin(this.time * 1.6 + s.tw);
        ctx.globalAlpha = dark * tw;
        ctx.fillStyle = '#dbe7ff';
        const x = (s.x - camera.x * 0.02) % VIEW_W;
        ctx.fillRect(x, s.y, s.r, s.r);
      }
      ctx.restore();
    }

    // Sun / moon on a slow arc.
    const t = survival.timeOfDay;
    const arc = (t - 0.25) / 0.5; // 0..1 across daylight
    if (t > 0.2 && t < 0.82) {
      const sx = lerp(90, VIEW_W - 90, clamp(arc, 0, 1));
      const sy = 250 - Math.sin(clamp(arc, 0, 1) * Math.PI) * 190;
      const sunA = clamp(Math.min((t - 0.2) / 0.08, (0.82 - t) / 0.08), 0, 1);
      ctx.save();
      ctx.globalAlpha = sunA;
      ctx.fillStyle = 'rgba(255, 226, 170, 0.35)';
      ctx.beginPath();
      ctx.arc(sx, sy, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff2cf';
      ctx.beginPath();
      ctx.arc(sx, sy, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      const mx = lerp(120, VIEW_W - 140, clamp(((t - 0.82) % 1) / 0.38, 0, 1));
      const my = 70 + Math.sin(clamp(((t - 0.8) % 1) / 0.42, 0, 1) * Math.PI) * 120;
      ctx.save();
      ctx.globalAlpha = dark;
      ctx.fillStyle = 'rgba(220, 235, 255, 0.22)';
      ctx.beginPath();
      ctx.arc(mx, my, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#eef4ff';
      ctx.beginPath();
      ctx.arc(mx, my, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(190, 205, 230, 0.55)';
      ctx.beginPath();
      ctx.arc(mx - 6, my - 4, 4.5, 0, Math.PI * 2);
      ctx.arc(mx + 5, my + 5, 3.4, 0, Math.PI * 2);
      ctx.arc(mx + 3, my - 8, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Clouds.
    ctx.save();
    const cloudAlpha = 0.2 + (1 - dark) * 0.25 + world.rainAmount * 0.3;
    for (const c of this.clouds) {
      const x = ((c.x - camera.x * 0.04 - this.time * c.sp) % 1600 + 1600) % 1600 - 320;
      const base = 60 + c.y * 0.7;
      const col = world.rainAmount > 0.4 ? '91,100,120' : mixHex('#8fa3bd', '#2c3448', dark).replace('#', '');
      const rgb = col.startsWith('9') ? col : [parseInt(col.slice(0, 2), 16), parseInt(col.slice(2, 4), 16), parseInt(col.slice(4, 6), 16)].join(',');
      // Soft radial puffs read as cloud rather than as dark blobs.
      ctx.save();
      ctx.translate(x, base);
      for (let i = 0; i < 4; i++) {
        const ox = (i - 1.4) * 38 * c.s;
        const oy = Math.sin(i * 1.7) * 6 * c.s;
        const r = (46 + (i % 2) * 22) * c.s;
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
        g.addColorStop(0, `rgba(${rgb}, ${cloudAlpha * 0.55})`);
        g.addColorStop(0.65, `rgba(${rgb}, ${cloudAlpha * 0.32})`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ox, oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();

    this.drawSkyline(ctx, camera, pal, dark, 0.08, 0.62, '#1b2436', 0.35);
    this.drawSkyline(ctx, camera, pal, dark, 0.22, 0.78, '#141c2b', 0.6);
  }

  drawSkyline(ctx, camera, pal, dark, parallax, yScale, color, litChance) {
    const offset = camera.x * parallax;
    const baseY = GROUND_Y - 40;
    const step = 96;
    const start = Math.floor((offset - 200) / step);
    const end = Math.ceil((offset + VIEW_W + 200) / step);
    ctx.save();
    for (let i = start; i <= end; i++) {
      const seed = i * 3.77;
      const h = 90 + hash(seed) * 240 * yScale;
      const w = step + 20;
      const x = i * step - offset;
      const y = baseY - h;
      const col = mixHex(color, pal.haze, 0.22 + hash(seed * 2) * 0.2);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h + 40);

      // Rooftop details.
      if (hash(seed * 5) > 0.6) {
        ctx.fillRect(x + w * 0.3, y - 24, 3, 24);
        ctx.fillStyle = 'rgba(255, 80, 90, 0.8)';
        const blink = Math.sin(this.time * 2 + i) > 0.4 ? 1 : 0.15;
        ctx.globalAlpha = blink * (0.4 + dark * 0.6);
        ctx.fillRect(x + w * 0.3 - 1, y - 26, 5, 3);
        ctx.globalAlpha = 1;
        ctx.fillStyle = col;
      }

      // Lit windows.
      const cols = 4;
      const rows = Math.floor(h / 26);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lit = hash(seed + r * 7.3 + c * 3.1);
          if (lit > litChance) continue;
          const a = (0.25 + dark * 0.7) * (0.5 + lit);
          ctx.fillStyle = `rgba(255, 210, 140, ${a})`;
          ctx.fillRect(x + 12 + c * (w / cols), y + 10 + r * 26, 7, 10);
        }
      }
    }
    ctx.restore();
  }

  // -------------------------------------------------------------- facades ---

  drawCity(ctx, { world, camera, survival }) {
    const pal = skyPalette(survival.timeOfDay);
    const dark = survival.darkness;

    for (const b of world.buildings) {
      if (b.x + b.w < camera.x - 100 || b.x > camera.x + VIEW_W + 100) continue;
      this.drawBuilding(ctx, b, pal, dark, survival);
    }

    this.drawStreet(ctx, world, camera, pal, dark, survival);
    this.drawProps(ctx, world, camera, survival);
  }

  drawBuilding(ctx, b, pal, dark, survival) {
    const x = b.x;
    const w = b.w;
    const top = b.roofY + 10;
    const height = GROUND_Y - top;

    // Ambient facade tone, unified toward the sky haze.
    const base = mixHex(mixHex('#1a2333', '#4e5b70', b.tone), pal.haze, 0.14);
    const lit = mixHex(base, '#ffd9a0', 0.05 + dark * 0.02);

    const g = ctx.createLinearGradient(0, top, 0, GROUND_Y);
    g.addColorStop(0, lit);
    g.addColorStop(1, mixHex(base, '#0d1220', 0.35));
    ctx.fillStyle = g;
    ctx.fillRect(x, top, w, height);

    // Facade seams.
    ctx.strokeStyle = 'rgba(10, 14, 24, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 18, top + 8);
    ctx.lineTo(x + 18, GROUND_Y);
    ctx.moveTo(x + w - 18, top + 8);
    ctx.lineTo(x + w - 18, GROUND_Y);
    ctx.stroke();

    // Windows.
    const cols = Math.max(3, Math.floor(w / 58));
    const rows = Math.max(2, Math.floor(height / 54));
    const cw = w / cols;
    const ch = height / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seed = b.seed + r * 13.7 + c * 4.3;
        const wx = x + c * cw + cw * 0.24;
        const wy = top + r * ch + ch * 0.2;
        const ww = cw * 0.52;
        const wh = ch * 0.5;
        const litRoll = hash(seed);
        const isLit = litRoll > 0.62 - dark * 0.12;
        ctx.fillStyle = '#101826';
        roundRect(ctx, wx - 2, wy - 2, ww + 4, wh + 4, 3);
        ctx.fill();
        if (isLit) {
          const warm = hash(seed * 3.3) > 0.25;
          ctx.fillStyle = warm
            ? `rgba(255, 198, 128, ${0.55 + hash(seed * 7) * 0.35})`
            : `rgba(168, 220, 255, ${0.35 + hash(seed * 9) * 0.3})`;
        } else {
          ctx.fillStyle = `rgba(${28 + hash(seed * 2) * 24}, ${40 + hash(seed * 2) * 20}, ${60 + hash(seed * 5) * 24}, 0.9)`;
        }
        ctx.fillRect(wx, wy, ww, wh);
        // Window frame cross.
        ctx.strokeStyle = 'rgba(12, 18, 30, 0.5)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(wx + ww / 2, wy);
        ctx.lineTo(wx + ww / 2, wy + wh);
        ctx.moveTo(wx, wy + wh / 2);
        ctx.lineTo(wx + ww, wy + wh / 2);
        ctx.stroke();
        // Curtains.
        if (hash(seed * 4.1) > 0.7) {
          ctx.fillStyle = 'rgba(120, 70, 70, 0.35)';
          ctx.fillRect(wx, wy, ww * 0.3, wh);
        }
        // AC units.
        if (hash(seed * 5.7) > 0.86) {
          ctx.fillStyle = '#68748a';
          ctx.fillRect(wx + ww * 0.15, wy + wh + 3, ww * 0.7, 7);
          ctx.fillStyle = 'rgba(30,38,50,0.6)';
          ctx.fillRect(wx + ww * 0.15, wy + wh + 5, ww * 0.7, 2);
        }
      }
    }

    // Storefront band.
    const sfTop = GROUND_Y - 92;
    ctx.fillStyle = mixHex(base, '#0a0f19', 0.42);
    ctx.fillRect(x + 6, sfTop, w - 12, 92);
    // Shop window glow.
    const glowA = 0.25 + dark * 0.5;
    ctx.fillStyle = `rgba(255, 206, 140, ${glowA * 0.5})`;
    ctx.fillRect(x + 18, sfTop + 14, w * 0.36, 56);
    ctx.fillStyle = `rgba(120, 200, 230, ${glowA * 0.35})`;
    ctx.fillRect(x + w * 0.52, sfTop + 14, w * 0.16, 56);
    // Door.
    ctx.fillStyle = 'rgba(20, 26, 38, 0.9)';
    ctx.fillRect(x + w - 78, sfTop + 26, 44, 66);
    ctx.fillStyle = 'rgba(255, 220, 160, 0.25)';
    ctx.fillRect(x + w - 70, sfTop + 34, 28, 40);

    // Sign.
    if (b.sign) {
      const sx = x + 22;
      const sy = sfTop - 26;
      ctx.save();
      ctx.shadowColor = b.signColor;
      ctx.shadowBlur = 12 + dark * 18;
      ctx.fillStyle = b.signColor;
      ctx.globalAlpha = 0.55 + dark * 0.4;
      ctx.font = '700 15px ui-rounded, "Trebuchet MS", sans-serif';
      ctx.fillText(b.sign, sx, sy);
      ctx.restore();
      ctx.strokeStyle = 'rgba(12, 18, 30, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - 4, sy - 20);
      ctx.lineTo(sx + 96, sy - 20);
      ctx.stroke();
    }

    // Fire escape zigzag on the facade.
    const fx = x + w - 58;
    ctx.strokeStyle = 'rgba(14, 20, 30, 0.75)';
    ctx.lineWidth = 3;
    const feTop = b.roofY + 26; // never poke above the parapet
    for (let i = 0; i < 4; i++) {
      const ly = GROUND_Y - 120 - i * 62;
      if (ly - 62 < feTop) break;
      ctx.beginPath();
      ctx.moveTo(fx, ly);
      ctx.lineTo(fx + 34, ly);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(fx + 2, ly);
      ctx.lineTo(fx + 34, ly - 62);
      ctx.stroke();
      for (let r = 0; r < 6; r++) {
        ctx.beginPath();
        ctx.moveTo(fx + 4 + r * 5.5, ly - 12);
        ctx.lineTo(fx + 4 + r * 5.5, ly);
        ctx.stroke();
      }
    }

    // Parapet + rooftop clutter.
    ctx.fillStyle = mixHex(base, '#0a0f19', 0.2);
    ctx.fillRect(x - 4, b.roofY - 4, w + 8, 14);
    ctx.fillStyle = mixHex(base, '#ffffff', 0.08);
    ctx.fillRect(x - 4, b.roofY - 4, w + 8, 3);
    for (let i = 0; i < Math.floor(w / 70); i++) {
      const vx = x + 26 + i * 70;
      if (hash(b.seed + i * 3.3) > 0.55) {
        const vy = b.roofY - 10;
        ctx.fillStyle = '#39445a';
        ctx.fillRect(vx, vy - 8, 22, 12);
        ctx.fillStyle = '#2a3344';
        ctx.fillRect(vx, vy - 12, 22, 4);
      }
    }
    if (b.waterTank) {
      const tx = b.tankX || x + w * 0.6;
      ctx.strokeStyle = '#2c3444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tx + 8, b.roofY - 62);
      ctx.lineTo(tx + 8, b.roofY);
      ctx.moveTo(tx + 88, b.roofY - 62);
      ctx.lineTo(tx + 88, b.roofY);
      ctx.stroke();
      ctx.fillStyle = '#4c3a2c';
      roundRect(ctx, tx - 2, b.roofY - 116, 100, 56, 6);
      ctx.fill();
      ctx.fillStyle = '#3a2c22';
      ctx.beginPath();
      ctx.ellipse(tx + 48, b.roofY - 116, 50, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,14,10,0.5)';
      ctx.lineWidth = 2;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(tx - 1, b.roofY - 116 + i * 18);
        ctx.lineTo(tx + 99, b.roofY - 116 + i * 18);
        ctx.stroke();
      }
    }
    if (b.antenna) {
      const ax = x + w * 0.2;
      ctx.strokeStyle = '#222b3a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ax, b.roofY - 6);
      ctx.lineTo(ax, b.roofY - 70);
      ctx.moveTo(ax - 12, b.roofY - 52);
      ctx.lineTo(ax + 12, b.roofY - 52);
      ctx.stroke();
      const blink = Math.sin(this.time * 1.6 + b.seed) > 0.5;
      if (blink) {
        ctx.fillStyle = 'rgba(255, 70, 80, 0.9)';
        ctx.beginPath();
        ctx.arc(ax, b.roofY - 72, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Soft ambient light spill from the storefront.
    if (dark > 0.3) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = dark * 0.32;
      ctx.translate(x + w * 0.3, GROUND_Y - 20);
      ctx.fillStyle = this.glow(ctx, 150, '255, 196, 120');
      ctx.beginPath();
      ctx.arc(0, 0, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawStreet(ctx, world, camera, pal, dark, survival) {
    // Sidewalk band peeking out behind the buildings.
    ctx.fillStyle = mixHex('#2a3242', pal.haze, 0.2);
    ctx.fillRect(0, GROUND_Y - 6, VIEW_W, 10);

    // Asphalt.
    const g = ctx.createLinearGradient(0, GROUND_Y, 0, VIEW_H);
    g.addColorStop(0, mixHex('#323b4e', pal.haze, 0.12));
    g.addColorStop(0.35, '#1b2130');
    g.addColorStop(1, '#10141d');
    ctx.fillStyle = g;
    ctx.fillRect(0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y);

    // Curb highlight.
    ctx.fillStyle = 'rgba(190, 205, 225, 0.28)';
    ctx.fillRect(0, GROUND_Y, VIEW_W, 2);

    // Lane dashes scrolling with the world.
    const dashY = GROUND_Y + 34;
    ctx.fillStyle = 'rgba(226, 214, 160, 0.22)';
    const spacing = 96;
    const off = ((camera.x * 0.6) % spacing + spacing) % spacing;
    for (let x = -off; x < VIEW_W + spacing; x += spacing) {
      ctx.fillRect(x, dashY, 46, 4);
    }

    // Manholes + cracks.
    const tile = 320;
    const start = Math.floor((camera.x - 100) / tile);
    for (let i = start; i <= start + 4; i++) {
      const mx = i * tile - camera.x + (hash(i) * 120);
      if (mx > -60 && mx < VIEW_W + 60) {
        ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
        ellipse(ctx, mx, GROUND_Y + 20, 18, 4.5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 140, 170, 0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(mx, GROUND_Y + 20, 18, 4.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Wet reflections when raining.
    if (world.rainAmount > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = world.rainAmount * 0.16;
      for (let i = 0; i < 8; i++) {
        const x = ((i * 173 - camera.x * 0.7) % (VIEW_W + 200) + VIEW_W + 200) % (VIEW_W + 200) - 100;
        ctx.fillStyle = i % 2 ? 'rgba(255, 200, 130, 0.5)' : 'rgba(140, 210, 255, 0.4)';
        ctx.fillRect(x, GROUND_Y + 6, 60, 3);
      }
      ctx.restore();
    }
  }

  drawProps(ctx, world, camera, survival) {
    const dark = survival.darkness;

    // Chunk decor behind the play layer.
    for (const chunk of world.chunks.values()) {
      if (chunk.x + chunk.w < camera.x - 100 || chunk.x > camera.x + VIEW_W + 100) continue;
      for (const d of chunk.decor) {
        if (d.type === 'lamp') this.drawLamp(ctx, d, dark, camera);
        else if (d.type === 'hydrant') this.drawHydrant(ctx, d);
        else if (d.type === 'bag') this.drawBags(ctx, d);
        else if (d.type === 'tires') this.drawTires(ctx, d);
        else if (d.type === 'grass') this.drawGrass(ctx, d);
      }
    }

    // Toxic / rain puddles.
    for (const p of world.puddles) {
      if (p.x + p.w < camera.x - 60 || p.x > camera.x + VIEW_W + 60) continue;
      this.drawPuddle(ctx, p, dark);
    }

    // Solid props.
    for (const s of world.solids) {
      if (s.x + s.w < camera.x - 80 || s.x > camera.x + VIEW_W + 80) continue;
      if (s.kind === 'dumpster') this.drawDumpster(ctx, s, dark);
      else if (s.kind === 'awning') this.drawAwning(ctx, s, dark);
      else if (s.kind === 'balcony') this.drawBalcony(ctx, s);
      else if (s.kind === 'crate') this.drawCrate(ctx, s);
      else if (s.kind === 'roof') this.drawRoofEdge(ctx, s);
      else if (s.kind === 'tank') this.drawRoofTankPlatform(ctx, s);
    }
  }

  drawLamp(ctx, d, dark, camera) {
    const x = d.x;
    ctx.save();
    // Pole.
    ctx.strokeStyle = '#1b222f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x, GROUND_Y - 168);
    ctx.quadraticCurveTo(x, GROUND_Y - 184, x + 26, GROUND_Y - 184);
    ctx.stroke();
    ctx.fillStyle = '#2b3446';
    ctx.beginPath();
    ctx.ellipse(x + 32, GROUND_Y - 182, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (dark > 0.1) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = dark;
      // Light cone.
      const g = ctx.createLinearGradient(x + 30, GROUND_Y - 176, x + 30, GROUND_Y);
      g.addColorStop(0, 'rgba(255, 206, 140, 0.3)');
      g.addColorStop(1, 'rgba(255, 206, 140, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + 26, GROUND_Y - 176);
      ctx.lineTo(x + 44, GROUND_Y - 176);
      ctx.lineTo(x + 118, GROUND_Y);
      ctx.lineTo(x - 60, GROUND_Y);
      ctx.closePath();
      ctx.fill();
      ctx.translate(x + 32, GROUND_Y - 180);
      ctx.fillStyle = this.glow(ctx, 90, '255, 200, 120');
      ctx.beginPath();
      ctx.arc(0, 0, 90, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHydrant(ctx, d) {
    const x = d.x;
    ctx.fillStyle = '#b4453f';
    roundRect(ctx, x - 7, GROUND_Y - 30, 14, 30, 4);
    ctx.fill();
    ctx.fillStyle = '#8d332f';
    ctx.fillRect(x - 11, GROUND_Y - 24, 22, 6);
    ctx.beginPath();
    ctx.arc(x, GROUND_Y - 31, 6, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  drawBags(ctx, d) {
    ctx.fillStyle = '#1d2430';
    ctx.beginPath();
    ctx.ellipse(d.x, GROUND_Y - 12, 22, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(d.x + 20, GROUND_Y - 8, 15, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    ctx.ellipse(d.x - 4, GROUND_Y - 18, 8, 4, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawTires(ctx, d) {
    ctx.strokeStyle = '#161b24';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(d.x, GROUND_Y - 12, 15, 0, Math.PI * 2);
    ctx.arc(d.x + 24, GROUND_Y - 8, 12, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawGrass(ctx, d) {
    ctx.strokeStyle = 'rgba(96, 130, 92, 0.6)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(d.x + i * 3, GROUND_Y);
      ctx.quadraticCurveTo(d.x + i * 3 + 2 * d.s, GROUND_Y - 8 * d.s, d.x + i * 3 + 5 * d.s, GROUND_Y - 12 * d.s);
      ctx.stroke();
    }
  }

  drawPuddle(ctx, p, dark) {
    const toxic = p.kind === 'toxic';
    ctx.save();
    ctx.fillStyle = toxic ? 'rgba(90, 210, 130, 0.35)' : 'rgba(140, 190, 230, 0.22)';
    ellipse(ctx, p.x + p.w / 2, p.y + 3, p.w / 2, 5);
    ctx.fill();
    ctx.strokeStyle = toxic ? 'rgba(150, 255, 170, 0.5)' : 'rgba(190, 225, 255, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    if (toxic) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(p.phase || 0) * 0.15;
      ctx.fillStyle = 'rgba(120, 255, 150, 0.5)';
      for (let i = 0; i < 3; i++) {
        const bx = p.x + 12 + i * (p.w / 3.4);
        const by = p.y + 1 + Math.sin((p.phase || 0) + i) * 1.5;
        ctx.beginPath();
        ctx.arc(bx, by, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawDumpster(ctx, s, dark) {
    const x = s.x;
    const y = s.y;
    const w = s.w;
    const h = s.h;
    // Body.
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#3f6b5f');
    g.addColorStop(1, '#223c39');
    ctx.fillStyle = g;
    roundRect(ctx, x, y + 6, w, h - 6, 4);
    ctx.fill();
    // Lid.
    ctx.fillStyle = '#2c504a';
    roundRect(ctx, x - 4, y, w + 8, 12, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y + 2, w, 2);
    // Ribs.
    ctx.strokeStyle = 'rgba(10, 20, 18, 0.4)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + (w / 4) * i, y + 12);
      ctx.lineTo(x + (w / 4) * i, y + h - 6);
      ctx.stroke();
    }
    // Graffiti tag.
    ctx.strokeStyle = 'rgba(240, 210, 120, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 14, y + h - 22);
    ctx.quadraticCurveTo(x + 26, y + h - 34, x + 34, y + h - 20);
    ctx.quadraticCurveTo(x + 40, y + h - 30, x + 50, y + h - 22);
    ctx.stroke();
    // Wheels.
    ctx.fillStyle = '#171d24';
    ctx.beginPath();
    ctx.arc(x + 16, y + h - 4, 6, 0, Math.PI * 2);
    ctx.arc(x + w - 16, y + h - 4, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  drawAwning(ctx, s, dark) {
    const x = s.x;
    const y = s.y;
    const w = s.w;
    // Striped fabric.
    for (let i = 0; i < Math.ceil(w / 22); i++) {
      ctx.fillStyle = i % 2 ? '#8c3f45' : '#d8c7a8';
      ctx.beginPath();
      ctx.moveTo(x + i * 22, y);
      ctx.lineTo(x + (i + 1) * 22, y);
      ctx.lineTo(x + (i + 1) * 22 + 2, y + 14);
      ctx.lineTo(x + i * 22 + 2, y + 14);
      ctx.closePath();
      ctx.fill();
    }
    // Scalloped edge.
    ctx.fillStyle = '#8c3f45';
    for (let i = 0; i < Math.ceil(w / 22); i++) {
      ctx.beginPath();
      ctx.arc(x + i * 22 + 11, y + 15, 10, 0, Math.PI);
      ctx.fill();
    }
    // Support struts.
    ctx.strokeStyle = 'rgba(40, 46, 58, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 16);
    ctx.lineTo(x + 6, y + 8);
    ctx.moveTo(x + w - 6, y + 16);
    ctx.lineTo(x + w - 6, y + 8);
    ctx.stroke();
    // Top surface line (standable).
    ctx.strokeStyle = 'rgba(255, 245, 220, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x + w, y + 1);
    ctx.stroke();
  }

  drawBalcony(ctx, s) {
    const x = s.x;
    const y = s.y;
    const w = s.w;
    ctx.fillStyle = '#2a3344';
    ctx.fillRect(x, y + 2, w, 8);
    ctx.strokeStyle = 'rgba(150, 175, 205, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < w; i += 12) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + 2);
      ctx.lineTo(x + i, y - 18);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(170, 195, 225, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x + w, y - 18);
    ctx.stroke();
    // Planters.
    ctx.fillStyle = '#4a3a2e';
    ctx.fillRect(x + 10, y - 14, 20, 12);
    ctx.fillStyle = 'rgba(110, 170, 110, 0.8)';
    ctx.beginPath();
    ctx.arc(x + 20, y - 18, 8, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3e3126';
    ctx.fillRect(x + w - 34, y - 14, 22, 12);
    ctx.fillStyle = 'rgba(150, 190, 120, 0.7)';
    ctx.beginPath();
    ctx.arc(x + w - 23, y - 18, 7, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  drawCrate(ctx, s) {
    ctx.fillStyle = '#8a6136';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = 'rgba(60, 40, 20, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
    ctx.beginPath();
    ctx.moveTo(s.x + 4, s.y + 4);
    ctx.lineTo(s.x + s.w - 4, s.y + s.h - 4);
    ctx.moveTo(s.x + s.w - 4, s.y + 4);
    ctx.lineTo(s.x + 4, s.y + s.h - 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 230, 190, 0.12)';
    ctx.fillRect(s.x, s.y, s.w, 3);
  }

  drawRoofEdge(ctx, s) {
    ctx.fillStyle = 'rgba(12, 18, 28, 0.85)';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = 'rgba(180, 200, 225, 0.18)';
    ctx.fillRect(s.x, s.y, s.w, 2.5);
  }

  drawRoofTankPlatform(ctx, s) {
    ctx.fillStyle = '#4c3a2c';
    ctx.fillRect(s.x, s.y, s.w, s.h + 2);
    ctx.fillStyle = 'rgba(255, 240, 210, 0.16)';
    ctx.fillRect(s.x, s.y, s.w, 2);
  }

  // ------------------------------------------------------------- weather ---

  drawWeather(ctx, { world, survival, camera }) {
    const rain = world.rainAmount;
    const dark = survival.darkness;

    // Rain streaks.
    if (rain > 0.02) {
      ctx.save();
      ctx.strokeStyle = `rgba(180, 215, 245, ${0.18 + rain * 0.22})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const d of this.rain) {
        const y = ((d.y + this.time * d.sp) % (VIEW_H + 40)) - 20;
        const x = ((d.x - camera.x * 0.35 + this.time * d.drift) % (VIEW_W + 200) + VIEW_W + 200) % (VIEW_W + 200) - 100;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + d.len);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Fog / haze band low in the street.
    if (rain > 0.1 || dark > 0.4) {
      ctx.save();
      const fogA = rain * 0.12 + dark * 0.08;
      const g = ctx.createLinearGradient(0, GROUND_Y - 120, 0, GROUND_Y + 20);
      g.addColorStop(0, 'rgba(150, 175, 205, 0)');
      g.addColorStop(1, `rgba(150, 175, 205, ${fogA})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, GROUND_Y - 120, VIEW_W, 140);
      ctx.restore();
    }
  }

  /** Night grading + light pools + vignette. */
  drawLighting(ctx, { world, survival, camera, cat }) {
    const dark = survival.darkness;
    if (dark > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      const strength = 0.72 * dark;
      g.addColorStop(0, `rgba(${Math.round(255 - 130 * strength)}, ${Math.round(255 - 120 * strength)}, ${Math.round(255 - 78 * strength)}, 1)`);
      g.addColorStop(1, `rgba(${Math.round(255 - 155 * strength)}, ${Math.round(255 - 145 * strength)}, ${Math.round(255 - 100 * strength)}, 1)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.restore();

      // Warm light pools (additive) under lamps and around the cat.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 * dark;
      for (const chunk of world.chunks.values()) {
        for (const d of chunk.decor) {
          if (d.type !== 'lamp') continue;
          if (d.x < camera.x - 120 || d.x > camera.x + VIEW_W + 120) continue;
          ctx.save();
          ctx.translate(d.x + 32, GROUND_Y - 6);
          ctx.fillStyle = this.glow(ctx, 120, '255, 190, 110');
          ctx.beginPath();
          ctx.arc(0, 0, 120, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      // Cat's own little pool of visibility.
      ctx.save();
      ctx.translate(cat.centerX, cat.centerY);
      ctx.globalAlpha = 0.35 * dark;
      ctx.fillStyle = this.glow(ctx, 170, '200, 220, 255');
      ctx.beginPath();
      ctx.arc(0, 0, 170, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    // Vignette.
    ctx.save();
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${0.34 + dark * 0.16})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }
}
