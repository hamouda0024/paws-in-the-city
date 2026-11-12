/** Lightweight pooled particle system — dust, splashes, crumbs, Zzz, hearts. */

const MAX = 320;

export class Particles {
  constructor() {
    this.items = [];
  }

  clear() { this.items.length = 0; }

  spawn(opts) {
    if (this.items.length >= MAX) this.items.shift();
    this.items.push({
      x: 0, y: 0, vx: 0, vy: 0, life: 1, maxLife: 1,
      size: 3, color: '#ffffff', gravity: 0, drag: 0.9,
      type: 'dot', rot: 0, spin: 0, text: '',
      ...opts
    });
  }

  dust(x, y, count = 6, dir = 0, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (14 + Math.random() * 60) * power;
      this.spawn({
        x: x + (Math.random() - 0.5) * 14,
        y: y - Math.random() * 6,
        vx: Math.cos(a) * sp + dir * 40,
        vy: Math.sin(a) * sp * 0.5 - 10,
        life: 0.35 + Math.random() * 0.4,
        maxLife: 0.75,
        size: 2 + Math.random() * 4,
        color: 'rgba(198, 208, 226, ALPHA)'.replace('ALPHA', String(0.25 + Math.random() * 0.3)),
        gravity: 90,
        drag: 0.86,
        type: 'puff'
      });
    }
  }

  splash(x, y, count = 8, color = '#7de1c0') {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 16,
        y: y - 2,
        vx: (Math.random() - 0.5) * 120,
        vy: -40 - Math.random() * 130,
        life: 0.4 + Math.random() * 0.35,
        maxLife: 0.75,
        size: 1.5 + Math.random() * 2.6,
        color,
        gravity: 620,
        drag: 0.98,
        type: 'drop'
      });
    }
  }

  sparkle(x, y, count = 6, color = '#ffd57a') {
    for (let i = 0; i < count; i++) {
      const a = Math.PI * 2 * (i / count) + Math.random();
      this.spawn({
        x, y,
        vx: Math.cos(a) * (30 + Math.random() * 50),
        vy: Math.sin(a) * (30 + Math.random() * 50) - 20,
        life: 0.4 + Math.random() * 0.45,
        maxLife: 0.85,
        size: 1.8 + Math.random() * 2.2,
        color,
        gravity: 40,
        drag: 0.9,
        type: 'star'
      });
    }
  }

  crumbs(x, y, count = 7) {
    for (let i = 0; i < count; i++) {
      this.spawn({
        x, y,
        vx: (Math.random() - 0.5) * 90,
        vy: -30 - Math.random() * 60,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        size: 1.5 + Math.random() * 2,
        color: Math.random() > 0.5 ? '#d8b878' : '#f0dcae',
        gravity: 500,
        drag: 0.99,
        type: 'dot'
      });
    }
  }

  hearts(x, y) {
    this.spawn({
      x, y, vx: (Math.random() - 0.5) * 18, vy: -34,
      life: 1.1, maxLife: 1.1, size: 9, color: '#ff8fa6',
      gravity: -6, drag: 0.98, type: 'heart'
    });
  }

  zzz(x, y) {
    this.spawn({
      x, y, vx: 12 + Math.random() * 10, vy: -26,
      life: 1.6, maxLife: 1.6, size: 10 + Math.random() * 4,
      color: 'rgba(200, 220, 255, 0.85)', gravity: -4, drag: 0.99, type: 'z'
    });
  }

  claw(x, y) {
    for (let i = 0; i < 3; i++) {
      this.spawn({
        x, y: y - i * 6,
        vx: (Math.random() - 0.5) * 70,
        vy: -20 - Math.random() * 40,
        life: 0.3, maxLife: 0.3, size: 1.6,
        color: 'rgba(255, 240, 210, 0.8)',
        gravity: 200, drag: 0.95, type: 'dot'
      });
    }
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) { this.items.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= p.gravity === 0 ? d : 1;
      p.rot += p.spin * dt;
    }
  }

  draw(ctx) {
    for (const p of this.items) {
      const t = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = p.type === 'puff' ? t * 0.65 : Math.min(1, t * 1.5);
      ctx.fillStyle = p.color;
      if (p.type === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -0.8, p.size, 1.6);
        ctx.fillRect(-0.8, -p.size / 2, 1.6, p.size);
        ctx.restore();
      } else if (p.type === 'heart') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.size / 10, p.size / 10);
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.bezierCurveTo(-7, -2, -4, -8, 0, -4);
        ctx.bezierCurveTo(4, -8, 7, -2, 0, 4);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'z') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalAlpha *= 0.9;
        ctx.font = `700 ${p.size}px ui-rounded, sans-serif`;
        ctx.fillText('z', 0, 0);
        ctx.restore();
      } else if (p.type === 'puff') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.4 - t * 0.4), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'drop') {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 0.6, p.size * 1.3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }
}
