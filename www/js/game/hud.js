/**
 * In-game HUD: survival bars, clock/weather, interaction prompts, toasts,
 * and the on-screen touch pad.
 */
import { VIEW_W, VIEW_H, COLORS, SURVIVAL } from '../config.js';
import { clamp, lerp, rgba } from '../core/rng.js';
import { roundRect, fillRound, text, ellipse } from '../core/draw.js';
import { clockLabel, timePhaseLabel } from './survival.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.ghost = { health: 100, hunger: 78, energy: 100 };
    this.toasts = [];
    this.floaters = [];
    this.promptPulse = 0;
  }

  reset() {
    this.ghost = { health: 100, hunger: 78, energy: 100 };
    this.toasts.length = 0;
    this.floaters.length = 0;
  }

  toast(msg, tone = 'info') {
    this.toasts.unshift({ msg, tone, life: 2.8, max: 2.8 });
    if (this.toasts.length > 4) this.toasts.pop();
  }

  /** Small floating text at a world position ("+34", "-16"). */
  floater(msg, x, y, tone = 'good') {
    this.floaters.push({ msg, x, y, tone, life: 1.1, max: 1.1 });
  }

  update(dt, game) {
    const s = game.survival;
    this.ghost.health = lerp(this.ghost.health, s.health, 1 - Math.pow(0.02, dt));
    this.ghost.hunger = lerp(this.ghost.hunger, s.hunger, 1 - Math.pow(0.02, dt));
    this.ghost.energy = lerp(this.ghost.energy, s.energy, 1 - Math.pow(0.02, dt));
    this.promptPulse += dt;
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= dt * 34;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  // -------------------------------------------------------------- drawing --

  draw(ctx, game) {
    const s = game.survival;

    this.drawBars(ctx, game);
    this.drawClock(ctx, game);
    this.drawToasts(ctx);
    this.drawFloaters(ctx, game);
    this.drawPrompt(ctx, game);
    this.drawTouch(ctx, game);

    // Low health pulse.
    if (s.health < 30) {
      const a = (0.12 + Math.sin(this.promptPulse * 4) * 0.06) * (1 - s.health / 30);
      ctx.save();
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.7);
      g.addColorStop(0, 'rgba(255, 40, 60, 0)');
      g.addColorStop(1, `rgba(255, 40, 60, ${a + 0.12})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.restore();
    }

    // Sleep overlay.
    if (game.cat.sleeping) {
      ctx.save();
      const a = 0.28 + Math.sin(this.promptPulse * 1.6) * 0.03;
      ctx.fillStyle = `rgba(6, 10, 24, ${a})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      text(ctx, 'Sleeping…', VIEW_W / 2, 92, { size: 20, weight: 700, align: 'center', color: 'rgba(200, 220, 255, 0.85)', letterSpacing: 2 });
      text(ctx, 'Tap jump to wake', VIEW_W / 2, 116, { size: 12, align: 'center', color: 'rgba(160, 185, 220, 0.7)' });
      ctx.restore();
    }
  }

  bar(ctx, x, y, w, h, value, ghost, color, label, iconFn) {
    const pct = clamp(value / SURVIVAL.maxStat, 0, 1);
    const ghostPct = clamp(ghost / SURVIVAL.maxStat, 0, 1);

    // Track.
    fillRound(ctx, x, y, w, h, h / 2, 'rgba(8, 12, 22, 0.62)');
    // Ghost (recent change).
    if (ghostPct > pct + 0.005) {
      fillRound(ctx, x, y, w * ghostPct, h, h / 2, 'rgba(255, 255, 255, 0.14)');
    }
    // Fill.
    if (pct > 0.001) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, color);
      g.addColorStop(1, rgba(color, 0.65));
      roundRect(ctx, x, y, Math.max(h, w * pct), h, h / 2);
      ctx.fillStyle = g;
      ctx.fill();
      // Gloss.
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      roundRect(ctx, x + 2, y + 1.5, Math.max(h, w * pct) - 4, h * 0.32, h / 4);
      ctx.fill();
    }
    // Border.
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
    ctx.strokeStyle = 'rgba(160, 190, 230, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Icon disc.
    ctx.save();
    ctx.translate(x - 15, y + h / 2);
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 16, 28, 0.85)';
    ctx.fill();
    ctx.strokeStyle = rgba(color, 0.7);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    iconFn(ctx, color);
    ctx.restore();

    text(ctx, label, x + 2, y + h + 11, { size: 9, weight: 700, color: 'rgba(180, 200, 225, 0.65)', letterSpacing: 1.4 });
  }

  drawBars(ctx, game) {
    const s = game.survival;
    const x = 40;
    let y = 22;
    const w = 186;
    const h = 11;
    const gap = 25;

    ctx.save();
    // Panel behind bars.
    fillRound(ctx, 10, 10, 232, 100, 14, 'rgba(8, 13, 24, 0.42)');

    const low = s.hunger < 20 ? 0.55 + Math.sin(this.promptPulse * 8) * 0.45 : 1;
    this.bar(ctx, x, y, w, h, s.health, this.ghost.health, '#ff5d6c', 'HEALTH', (c, col) => {
      // Heart.
      c.beginPath();
      c.moveTo(0, 4);
      c.bezierCurveTo(-6, -1.5, -3.5, -7, 0, -3.6);
      c.bezierCurveTo(3.5, -7, 6, -1.5, 0, 4);
      c.fillStyle = col;
      c.fill();
    });
    y += gap;
    this.bar(ctx, x, y, w, h, s.hunger, this.ghost.hunger, '#ffb454', 'HUNGER', (c, col) => {
      // Fish.
      c.beginPath();
      c.ellipse(-1, 0, 5.5, 3.4, 0, 0, Math.PI * 2);
      c.fillStyle = col;
      c.fill();
      c.beginPath();
      c.moveTo(4, 0);
      c.lineTo(8, -3.6);
      c.lineTo(8, 3.6);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(10,16,28,0.8)';
      c.beginPath();
      c.arc(-3, -0.6, 0.9, 0, Math.PI * 2);
      c.fill();
    });
    if (low < 1) {
      ctx.globalAlpha = 0.25 * low;
      fillRound(ctx, x - 14, y - 4, w + 24, h + 8, h, 'rgba(255, 120, 80, 0.6)');
      ctx.globalAlpha = 1;
    }
    y += gap;
    this.bar(ctx, x, y, w, h, s.energy, this.ghost.energy, '#5cc9ff', 'ENERGY', (c, col) => {
      // Lightning.
      c.beginPath();
      c.moveTo(0.5, -6);
      c.lineTo(-4, 0.5);
      c.lineTo(-0.5, 0.5);
      c.lineTo(-1.5, 6);
      c.lineTo(4.5, -1.5);
      c.lineTo(0.5, -1.5);
      c.closePath();
      c.fillStyle = col;
      c.fill();
    });
    ctx.restore();
  }

  drawClock(ctx, game) {
    const s = game.survival;
    const w = game.world;
    const x = VIEW_W - 20;
    const y = 22;
    ctx.save();
    fillRound(ctx, x - 176, 10, 176, 54, 14, 'rgba(8, 13, 24, 0.42)');

    text(ctx, `DAY ${s.day}`, x - 160, y + 12, { size: 16, weight: 800, color: '#fff2dc', letterSpacing: 1.5 });
    text(ctx, timePhaseLabel(s), x - 160, y + 29, { size: 10, weight: 600, color: 'rgba(180, 200, 225, 0.75)', letterSpacing: 1 });

    // Weather chip.
    const chipX = x - 66;
    const chipW = 56;
    fillRound(ctx, chipX, y - 4, chipW, 22, 11, 'rgba(20, 30, 46, 0.9)');
    const raining = w.rainAmount > 0.15;
    if (raining) {
      ctx.strokeStyle = '#8fd0ff';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(chipX + 10 + i * 8, y + 1);
        ctx.lineTo(chipX + 7 + i * 8, y + 11);
        ctx.stroke();
      }
      text(ctx, 'Rain', chipX + 30, y + 12, { size: 9, weight: 700, color: '#a9d8ff' });
    } else if (s.darkness > 0.5) {
      ctx.fillStyle = '#dbe7ff';
      ctx.beginPath();
      ctx.arc(chipX + 12, y + 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(20, 30, 46, 1)';
      ctx.beginPath();
      ctx.arc(chipX + 15, y + 4, 4.4, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, 'Clear', chipX + 22, y + 12, { size: 9, weight: 700, color: '#c9d8ef' });
    } else {
      ctx.fillStyle = '#ffd479';
      ctx.beginPath();
      ctx.arc(chipX + 12, y + 6, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 212, 121, 0.7)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(chipX + 12 + Math.cos(a) * 6.4, y + 6 + Math.sin(a) * 6.4);
        ctx.lineTo(chipX + 12 + Math.cos(a) * 8.6, y + 6 + Math.sin(a) * 8.6);
        ctx.stroke();
      }
      text(ctx, 'Clear', chipX + 22, y + 12, { size: 9, weight: 700, color: '#ffe9b3' });
    }

    text(ctx, clockLabel(s.timeOfDay), x - 4, y + 33, { size: 24, weight: 800, align: 'right', color: '#ffffff', shadow: 4 });
    text(ctx, `${Math.round(s.distance)} m`, x - 4, y + 49, { size: 10, weight: 700, align: 'right', color: 'rgba(180, 205, 235, 0.7)', letterSpacing: 1 });

    // Day clock arc.
    const cx = x - 160;
    const cy = y + 46;
    ctx.strokeStyle = 'rgba(140, 170, 210, 0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx + 4, cy, 10, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = s.darkness > 0.5 ? '#8fb6ff' : '#ffcf7a';
    ctx.beginPath();
    ctx.arc(cx + 4, cy, 10, Math.PI, Math.PI + Math.PI * s.timeOfDay);
    ctx.stroke();
    ctx.restore();
  }

  drawToasts(ctx) {
    ctx.save();
    let y = 118;
    for (const t of this.toasts) {
      const a = clamp(t.life / 0.5, 0, 1) * clamp((t.max - t.life) / 0.25, 0, 1);
      ctx.globalAlpha = a;
      const w = Math.max(120, ctx.measureText(t.msg).width + 40);
      const color = t.tone === 'bad' ? 'rgba(60, 18, 24, 0.9)' : t.tone === 'good' ? 'rgba(16, 44, 34, 0.9)' : 'rgba(12, 20, 34, 0.9)';
      const stroke = t.tone === 'bad' ? 'rgba(255, 110, 120, 0.5)' : t.tone === 'good' ? 'rgba(110, 231, 168, 0.45)' : 'rgba(150, 190, 235, 0.35)';
      fillRound(ctx, VIEW_W / 2 - w / 2, y - 14, w, 26, 13, color);
      roundRect(ctx, VIEW_W / 2 - w / 2, y - 14, w, 26, 13);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
      text(ctx, t.msg, VIEW_W / 2, y + 3, {
        size: 12, weight: 700, align: 'center',
        color: t.tone === 'bad' ? '#ffc7cb' : t.tone === 'good' ? '#c6f7de' : '#e6eefc'
      });
      y += 32;
    }
    ctx.restore();
  }

  drawFloaters(ctx, game) {
    ctx.save();
    for (const f of this.floaters) {
      const a = clamp(f.life / f.max, 0, 1);
      ctx.globalAlpha = a;
      text(ctx, f.msg, f.x - game.camera.x, f.y + game.camera.y, {
        size: 15, weight: 800, align: 'center',
        color: f.tone === 'bad' ? '#ff8a95' : f.tone === 'good' ? '#8dffc2' : '#ffe1a8',
        shadow: 5
      });
    }
    ctx.restore();
  }

  /** Context prompt above the cat: rummage / sleep / wake. */
  drawPrompt(ctx, game) {
    const action = game.currentAction;
    if (!action || game.state !== 'playing') return;
    const cat = game.cat;
    const sx = cat.centerX - game.camera.x;
    const sy = cat.y - 40 + Math.sin(this.promptPulse * 3) * 2;

    const label = action.label;
    ctx.save();
    const w = Math.max(110, ctx.measureText(label).width + 54);
    fillRound(ctx, sx - w / 2, sy - 15, w, 28, 14, 'rgba(10, 16, 28, 0.86)');
    roundRect(ctx, sx - w / 2, sy - 15, w, 28, 14);
    ctx.strokeStyle = 'rgba(255, 190, 110, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Progress ring / button hint.
    const cx = sx - w / 2 + 16;
    ctx.beginPath();
    ctx.arc(cx, sy - 1, 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 190, 110, 0.3)';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    if (action.progress > 0) {
      ctx.beginPath();
      ctx.arc(cx, sy - 1, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(action.progress, 0, 1));
      ctx.strokeStyle = '#ffb454';
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255, 190, 110, 0.85)';
      ctx.beginPath();
      ctx.arc(cx, sy - 1, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    text(ctx, label, sx - w / 2 + 30, sy + 4, { size: 11, weight: 700, color: '#ffe6c4' });
    text(ctx, game.showTouch ? 'HOLD' : 'HOLD  E', sx + w / 2 - 8, sy + 4, {
      size: 8, weight: 800, align: 'right', color: 'rgba(255, 210, 150, 0.65)', letterSpacing: 1
    });
    ctx.restore();
  }

  // ---------------------------------------------------------- touch pad ----

  buttons(game) {
    if (!game.showTouch) return [];
    return [
      { id: 'left', x: 18, y: 448, w: 68, h: 68 },
      { id: 'right', x: 94, y: 448, w: 68, h: 68 },
      { id: 'sprint', x: 172, y: 462, w: 62, h: 54 },
      { id: 'jump', x: 828, y: 424, w: 106, h: 106 },
      { id: 'interact', x: 726, y: 456, w: 78, h: 78 }
    ];
  }

  drawTouch(ctx, game) {
    if (!game.showTouch) return;
    const btn = (id) => this.buttons(game).find((b) => b.id === id);
    const pressed = (id) => game.input.buttonHeld.get(id);

    const pad = (b, glyph, accent = false, small = false) => {
      if (!b) return;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const r = b.w / 2;
      const active = pressed(b.id);
      ctx.save();
      ctx.globalAlpha = active ? 0.95 : 0.62;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = active ? 'rgba(46, 62, 92, 0.85)' : 'rgba(14, 22, 38, 0.6)';
      ctx.fill();
      ctx.strokeStyle = accent ? 'rgba(255, 190, 110, 0.6)' : 'rgba(160, 200, 245, 0.35)';
      ctx.lineWidth = active ? 2.4 : 1.4;
      ctx.stroke();

      ctx.translate(cx, cy);
      if (active) ctx.scale(0.94, 0.94);
      ctx.fillStyle = accent ? 'rgba(255, 214, 160, 0.95)' : 'rgba(226, 240, 255, 0.9)';
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      glyph(ctx, r, small);
      ctx.restore();
    };

    pad(btn('left'), (c) => {
      c.beginPath();
      c.moveTo(6, 0);
      c.lineTo(-6, -9);
      c.lineTo(-6, 9);
      c.closePath();
      c.fill();
    });
    pad(btn('right'), (c) => {
      c.beginPath();
      c.moveTo(-6, 0);
      c.lineTo(6, -9);
      c.lineTo(6, 9);
      c.closePath();
      c.fill();
    });
    pad(btn('sprint'), (c) => {
      c.lineWidth = 3.4;
      c.beginPath();
      c.moveTo(-7, -7);
      c.lineTo(1, 0);
      c.lineTo(-7, 7);
      c.moveTo(2, -7);
      c.lineTo(10, 0);
      c.lineTo(2, 7);
      c.stroke();
    });
    pad(btn('interact'), (c) => {
      // Paw print.
      c.beginPath();
      c.ellipse(0, 4, 7, 5.6, 0, 0, Math.PI * 2);
      c.fill();
      for (let i = 0; i < 4; i++) {
        const a = Math.PI + (i + 1) * (Math.PI / 5);
        c.beginPath();
        c.ellipse(Math.cos(a) * 10, Math.sin(a) * 9 + 2, 2.6, 3.2, a + Math.PI / 2, 0, Math.PI * 2);
        c.fill();
      }
    }, true);
    pad(btn('jump'), (c) => {
      c.beginPath();
      c.moveTo(0, -16);
      c.lineTo(13, -1);
      c.lineTo(5, -1);
      c.lineTo(5, 14);
      c.lineTo(-5, 14);
      c.lineTo(-5, -1);
      c.lineTo(-13, -1);
      c.closePath();
      c.fill();
    }, true);
  }
}
