/**
 * Everything that lives in the street: cars, stray dogs, humans, mice, food,
 * cardboard boxes, and the fog-lamp glow of the city night.
 *
 * Entities are plain classes with update(dt, game) / draw(ctx) in world space.
 */
import { GROUND_Y, HAZARD, COLORS } from '../config.js';
import { clamp, lerp, randRange, pick, rgba } from '../core/rng.js';
import { ellipse } from '../core/draw.js';

let uid = 1;

class Entity {
  constructor(chunkIndex = -1) {
    this.id = uid++;
    this.chunkIndex = chunkIndex;
    this.dead = false;
    this.x = 0;
    this.y = 0;
    this.w = 20;
    this.h = 20;
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update() {}
  draw() {}
}

// ------------------------------------------------------------------ food ----

const FOOD_ART = {
  fishBones: { w: 26, h: 10, label: 'Fish bones' },
  scraps: { w: 22, h: 14, label: 'Scraps' },
  sandwich: { w: 24, h: 12, label: 'Sandwich' },
  milk: { w: 16, h: 20, label: 'Milk' }
};

export class Food extends Entity {
  constructor(x, groundY, type = 'fishBones', chunkIndex = -1) {
    super(chunkIndex);
    const art = FOOD_ART[type] || FOOD_ART.fishBones;
    this.type = type in FOOD_ART ? type : 'fishBones';
    this.w = art.w;
    this.h = art.h;
    this.x = x - this.w / 2;
    this.y = groundY - this.h;
    this.baseY = this.y;
    this.phase = Math.random() * Math.PI * 2;
    this.freshness = 1;
    this.spawnAnim = 0;
    this.kind = 'food';
  }

  update(dt) {
    this.phase += dt * 2.2;
    this.spawnAnim = Math.min(1, this.spawnAnim + dt * 3);
    this.y = this.baseY + Math.sin(this.phase) * 1.6;
  }

  draw(ctx, { darkness = 0 } = {}) {
    const bob = Math.sin(this.phase) * 1.4;
    ctx.save();
    ctx.translate(this.cx, this.baseY + bob + this.h);

    // Night: food gives off a faint warm glimmer so it stays findable.
    if (darkness > 0.2) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, -6, 0, 0, -6, 34);
      g.addColorStop(0, `rgba(255, 205, 120, ${0.22 * darkness})`);
      g.addColorStop(1, 'rgba(255, 205, 120, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -6, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    // Contact shadow.
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ellipse(ctx, 0, 1.5, this.w * 0.45, 3);
    ctx.fill();
    ctx.globalAlpha = 1;

    const s = 0.6 + this.spawnAnim * 0.4;
    ctx.scale(s, s);

    if (this.type === 'fishBones') {
      ctx.strokeStyle = '#e8eef8';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-11, -5);
      ctx.lineTo(11, -5);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const x = -8 + i * 5;
        ctx.beginPath();
        ctx.moveTo(x, -8);
        ctx.lineTo(x, -2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(12, -5, 3.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#c9d6e6';
      ctx.beginPath();
      ctx.moveTo(-11, -5);
      ctx.lineTo(-15, -9);
      ctx.lineTo(-15, -1);
      ctx.closePath();
      ctx.fill();
    } else if (this.type === 'scraps') {
      ctx.fillStyle = '#6a5b45';
      ctx.beginPath();
      ctx.ellipse(0, -5, 10, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = ['#c4a163', '#9d8256', '#7d6a4a', '#d8c07a'][i];
        ctx.beginPath();
        ctx.arc(-7 + i * 4.4, -7 - (i % 2) * 2.4, 2 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.type === 'sandwich') {
      ctx.fillStyle = '#e8c47c';
      ctx.beginPath();
      ctx.moveTo(-11, -3);
      ctx.lineTo(0, -13);
      ctx.lineTo(11, -3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8fbf62';
      ctx.fillRect(-9, -4.5, 18, 2);
      ctx.fillStyle = '#c96a5a';
      ctx.fillRect(-9, -6.5, 18, 1.6);
      ctx.fillStyle = '#f4e3bd';
      ctx.fillRect(-9.5, -2.6, 19, 2.6);
    } else if (this.type === 'milk') {
      ctx.fillStyle = '#f3f6ff';
      ctx.beginPath();
      ctx.moveTo(-7, -18);
      ctx.lineTo(7, -18);
      ctx.lineTo(7, 0);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#9fb4d8';
      ctx.fillRect(-7, -14, 14, 5);
      ctx.fillStyle = '#e2e9f7';
      ctx.beginPath();
      ctx.moveTo(-7, -18);
      ctx.lineTo(0, -22);
      ctx.lineTo(7, -18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------- furniture ----

/** Cardboard box / warm vent: a safe place to sleep. */
export class RestSpot extends Entity {
  constructor(x, groundY, kind = 'box', chunkIndex = -1) {
    super(chunkIndex);
    this.kind = 'rest';
    this.type = kind;
    this.w = kind === 'vent' ? 58 : 54;
    this.h = kind === 'vent' ? 30 : 36;
    this.x = x - this.w / 2;
    this.y = groundY - this.h;
    this.safe = true;
    this.warmth = Math.random() * Math.PI * 2;
    this.occupied = false;
  }

  update(dt) {
    this.warmth += dt;
    this.occupied = false;
  }

  get interactLabel() { return this.type === 'vent' ? 'Sleep on the warm vent' : 'Sleep in the box'; }

  draw(ctx, { darkness = 0 } = {}) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ellipse(ctx, this.w / 2, this.h + 1, this.w * 0.5, 3);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (this.type === 'box') {
      ctx.fillStyle = '#a9793f';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.fillStyle = '#8d6332';
      ctx.fillRect(0, 0, this.w, 6);
      ctx.fillStyle = '#c08d4d';
      ctx.fillRect(4, 8, this.w - 8, this.h - 12);
      // Open flap.
      ctx.fillStyle = '#8a5f2f';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(16, -10);
      ctx.lineTo(this.w * 0.3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(70,45,20,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.w * 0.5, 6);
      ctx.lineTo(this.w * 0.5, this.h);
      ctx.stroke();
      // Scrawled rain shelter mark.
      ctx.fillStyle = 'rgba(60, 38, 18, 0.45)';
      ctx.font = '700 10px sans-serif';
      ctx.fillText('SUGAR', 8, 22);
    } else {
      // Warm vent with rising heat shimmer.
      ctx.fillStyle = '#3a4256';
      ctx.fillRect(0, 8, this.w, this.h - 8);
      ctx.fillStyle = '#2b3245';
      ctx.fillRect(0, 0, this.w, 9);
      ctx.strokeStyle = '#5e6a86';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(8 + i * 12, 12);
        ctx.lineTo(8 + i * 12, this.h - 4);
        ctx.stroke();
      }
      const t = Math.sin(this.warmth * 2) * 0.5 + 0.5;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, 0, 0, -40);
      g.addColorStop(0, `rgba(255, 170, 90, ${0.16 + t * 0.08})`);
      g.addColorStop(1, 'rgba(255, 170, 90, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(4, -40, this.w - 8, 40);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.25 + darkness * 0.2;
      ctx.fillStyle = '#ffb066';
      ctx.fillRect(6, this.h - 6, this.w - 12, 2);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ mice ---

export class Mouse extends Entity {
  constructor(x, groundY, chunkIndex = -1) {
    super(chunkIndex);
    this.kind = 'mouse';
    this.w = 14;
    this.h = 8;
    this.x = x;
    this.y = groundY - this.h;
    this.vx = 0;
    this.vy = 0;
    this.grounded = true;
    this.dir = Math.random() > 0.5 ? 1 : -1;
    this.wanderTimer = randRange(Math.random, 0.4, 1.6);
    this.fleeTimer = 0;
    this.anim = Math.random() * 10;
    this.caught = false;
  }

  update(dt, game) {
    const cat = game.cat;
    const d = cat.centerX - this.cx;
    const dy = cat.centerY - this.cy;
    const near = Math.abs(d) < 190 && dy < 90;

    this.anim += dt * (near ? 22 : 10);

    if (near && cat.state !== 'sleep') {
      this.dir = d > 0 ? -1 : 1;
      this.vx = this.dir * 165;
      this.fleeTimer = 0.9;
    } else {
      this.fleeTimer -= dt;
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = randRange(Math.random, 0.6, 2.2);
        this.dir = Math.random() > 0.5 ? 1 : -1;
        this.vx = Math.random() < 0.35 ? 0 : this.dir * 34;
      }
      this.vx = this.vx || 0;
    }

    this.x += this.vx * dt;
    this.x = clamp(this.x, game.world.leftLimit, game.world.rightLimit - this.w);

    // Hop a little when startled.
    if (near && this.grounded && Math.random() < dt * 3) {
      this.vy = -110;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.vy += 900 * dt;
      this.y += this.vy * dt;
      if (this.y + this.h >= GROUND_Y) {
        this.y = GROUND_Y - this.h;
        this.vy = 0;
        this.grounded = true;
      }
    }

    // Caught by the cat.
    const close = Math.abs(cat.centerX - this.cx) < 26 && Math.abs(cat.feetY - (this.y + this.h)) < 30;
    if (close && !this.caught && !cat.sleeping) {
      this.caught = true;
      this.dead = true;
      game.onCatchMouse(this);
    }
  }

  draw(ctx) {
    const flip = this.dir < 0 ? -1 : 1;
    ctx.save();
    ctx.translate(this.cx, this.y + this.h);
    ctx.scale(flip, 1);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ellipse(ctx, 0, 1, 9, 2.4);
    ctx.fill();
    ctx.globalAlpha = 1;

    const bob = Math.sin(this.anim) * 1.2;
    ctx.translate(0, bob);
    ctx.fillStyle = '#8f99a8';
    ctx.beginPath();
    ctx.ellipse(0, -5, 8, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head.
    ctx.beginPath();
    ctx.ellipse(7, -6, 4.2, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ears.
    ctx.beginPath();
    ctx.arc(5.5, -9, 2.4, 0, Math.PI * 2);
    ctx.arc(9, -9.4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Eye + nose.
    ctx.fillStyle = '#161a22';
    ctx.beginPath();
    ctx.arc(8.6, -6.4, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e7a3a3';
    ctx.beginPath();
    ctx.arc(11, -5.2, 1, 0, Math.PI * 2);
    ctx.fill();
    // Tail.
    ctx.strokeStyle = '#8f99a8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-7, -5);
    ctx.quadraticCurveTo(-13, -6 + Math.sin(this.anim) * 2, -15, -2);
    ctx.stroke();
    // Feet.
    ctx.fillStyle = '#7b8594';
    ctx.beginPath();
    ctx.arc(-3, -1, 1.6, 0, Math.PI * 2);
    ctx.arc(4, -1, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ------------------------------------------------------------------ dogs ----

export class Dog extends Entity {
  constructor(x, groundY, patrolRange = 150, chunkIndex = -1) {
    super(chunkIndex);
    this.kind = 'dog';
    this.w = 54;
    this.h = 36;
    this.x = x;
    this.y = groundY - this.h;
    this.homeX = x;
    this.patrolRange = patrolRange;
    this.dir = Math.random() > 0.5 ? 1 : -1;
    this.state = 'patrol';
    this.vx = 0;
    this.biteTimer = 0;
    this.anim = Math.random() * 8;
    this.alert = 0;
    this.barkTimer = 0;
    this.target = null;
    this.loseTimer = 0;
    this.fur = pick(Math.random, ['#5b4a3c', '#6b5643', '#4a3f36', '#7a6047']);
    this.scruff = Math.random() * 6.28;
  }

  update(dt, game) {
    const cat = game.cat;
    const dx = cat.centerX - this.cx;
    const adx = Math.abs(dx);
    const sameLevel = Math.abs(cat.feetY - (this.y + this.h)) < 110;
    const canSense = adx < HAZARD.dogSenseRadius && sameLevel && !cat.sleeping && cat.state !== 'dead';
    this.biteTimer = Math.max(0, this.biteTimer - dt);
    this.alert = Math.max(0, this.alert - dt * 0.8);
    this.barkTimer -= dt;

    // Dogs get distracted by unattended food — a useful escape route for the cat.
    if (this.state !== 'chase') {
      const food = game.world.nearestFood(this.cx, 160);
      if (food) {
        this.target = food;
        this.state = 'food';
      }
    }

    if (canSense && this.state !== 'chase') {
      this.state = 'chase';
      this.alert = 1;
      this.loseTimer = 3.4;
      if (this.barkTimer <= 0) {
        this.barkTimer = 1.6;
        game.audio.playBark(clamp((this.cx - game.cat.centerX) / 500, -1, 1), 2);
      }
    }

    if (this.state === 'chase') {
      this.loseTimer -= dt;
      if (!canSense && this.loseTimer <= 0) {
        this.state = 'patrol';
        this.target = null;
      } else {
        this.dir = dx > 0 ? 1 : -1;
        // Dodge the cat's platform: dogs stay street-bound, which is the cat's advantage.
        const speed = HAZARD.dogSpeedChase * (cat.feetY < GROUND_Y - 60 ? 0.65 : 1);
        this.vx = this.dir * speed;
      }
    } else if (this.state === 'food' && this.target && !this.target.dead) {
      const fdx = this.target.cx - this.cx;
      this.dir = fdx > 0 ? 1 : -1;
      this.vx = Math.sign(fdx) * HAZARD.dogSpeedPatrol * 1.9;
      if (Math.abs(fdx) < 24) {
        this.target.dead = true;
        game.particles.crumbs(this.target.cx, this.target.cy, 8);
        this.state = 'patrol';
        this.target = null;
        game.audio.playEat();
      }
    } else {
      this.state = 'patrol';
      this.target = null;
      this.vx = this.dir * HAZARD.dogSpeedPatrol;
      if (this.x < this.homeX - this.patrolRange) this.dir = 1;
      if (this.x > this.homeX + this.patrolRange) this.dir = -1;
      this.vx = this.dir * HAZARD.dogSpeedPatrol;
      if (this.x < game.world.leftLimit + 10) this.dir = 1;
    }

    this.x += this.vx * dt;
    this.x = clamp(this.x, game.world.leftLimit, game.world.rightLimit - this.w);
    this.anim += dt * (Math.abs(this.vx) * 0.06 + 2);

    // Bite.
    const biteRange = Math.abs(cat.centerX - this.cx) < 40 && Math.abs(cat.feetY - (this.y + this.h)) < 34;
    if (biteRange && this.biteTimer <= 0 && !cat.sleeping) {
      this.biteTimer = HAZARD.dogBiteCooldown;
      game.damageCat(HAZARD.dogDamage, 'a stray dog', this.cx, this.y);
      cat.hurt(Math.sign(dx) * HAZARD.dogKnockback, -220);
      game.audio.playBark(clamp(dx / 400, -1, 1), 1);
    }
  }

  draw(ctx) {
    const flip = this.dir < 0 ? -1 : 1;
    const chasing = this.state === 'chase';
    ctx.save();
    ctx.translate(this.cx, this.y + this.h);
    ctx.scale(flip, 1);

    ctx.globalAlpha = 0.24;
    ctx.fillStyle = '#000';
    ellipse(ctx, 0, 1, 26, 4);
    ctx.fill();
    ctx.globalAlpha = 1;

    const gait = Math.sin(this.anim * 2) * (chasing ? 5 : 2.4);
    const bob = Math.abs(Math.sin(this.anim * 2)) * (chasing ? 3 : 1.4);
    ctx.translate(0, -bob);

    // Legs.
    ctx.strokeStyle = '#3f342b';
    ctx.lineWidth = 4.4;
    ctx.lineCap = 'round';
    const leg = (hx, phase) => {
      ctx.beginPath();
      ctx.moveTo(hx, -18);
      const kx = hx + Math.sin(this.anim * 2 + phase) * 6;
      ctx.quadraticCurveTo(kx, -10, kx + (chasing ? 2 : 0), 0);
      ctx.stroke();
    };
    leg(-15, 0);
    leg(15, Math.PI);
    ctx.strokeStyle = '#6b5643';
    leg(-11, Math.PI);
    leg(18, 0);

    // Body.
    ctx.fillStyle = this.fur;
    ctx.beginPath();
    ctx.ellipse(0, -24, 24, 11.5, chasing ? 0.04 : 0, 0, Math.PI * 2);
    ctx.fill();
    // Scruffy back tufts.
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const bx = -18 + i * 9;
      ctx.moveTo(bx, -33);
      ctx.lineTo(bx + 4, -37 - (i % 2) * 2);
      ctx.lineTo(bx + 7, -32);
    }
    ctx.fillStyle = '#45372c';
    ctx.fill();

    // Tail (wagging hard when chasing).
    const wag = chasing ? Math.sin(this.anim * 6) * 8 : Math.sin(this.anim * 2) * 4;
    ctx.strokeStyle = this.fur;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-22, -26);
    ctx.quadraticCurveTo(-32, -32 + wag, -34, -40 + wag);
    ctx.stroke();

    // Neck + head.
    ctx.fillStyle = this.fur;
    ctx.beginPath();
    ctx.ellipse(20, -28, 11, 9.5, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(29, -27, 11, 8.6, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Snout.
    ctx.beginPath();
    ctx.ellipse(38, -24, 7.5, 5.2, 0.06, 0, Math.PI * 2);
    ctx.fillStyle = '#4a3c31';
    ctx.fill();
    // Ear.
    ctx.beginPath();
    ctx.moveTo(24, -35);
    ctx.lineTo(21, -44);
    ctx.lineTo(31, -36);
    ctx.closePath();
    ctx.fillStyle = '#3f342b';
    ctx.fill();
    // Eye.
    ctx.fillStyle = '#12100e';
    ctx.beginPath();
    ctx.arc(32, -30, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,220,120,0.9)';
    ctx.beginPath();
    ctx.arc(32.4, -30.4, 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Nose.
    ctx.fillStyle = '#1a1512';
    ctx.beginPath();
    ctx.arc(44, -25, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Teeth when chasing.
    if (chasing) {
      ctx.fillStyle = '#f6f2e6';
      ctx.beginPath();
      ctx.moveTo(36, -20);
      ctx.lineTo(39, -20);
      ctx.lineTo(37.5, -16.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(41, -20);
      ctx.lineTo(44, -20);
      ctx.lineTo(42.5, -16.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 60, 70, 0.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(34, -19);
      ctx.quadraticCurveTo(40, -16, 46, -19);
      ctx.stroke();
    }
    ctx.restore();

    // Alert bubble.
    if (this.alert > 0.2) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.alert);
      const yy = this.y - 26 - Math.sin(this.anim * 3) * 2;
      ctx.fillStyle = 'rgba(255, 90, 90, 0.95)';
      ctx.beginPath();
      ctx.arc(this.cx, yy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', this.cx, yy + 0.5);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- humans ----

export class Human extends Entity {
  constructor(x, groundY, chunkIndex = -1) {
    super(chunkIndex);
    this.kind = 'human';
    this.w = 30;
    this.h = 78;
    this.x = x;
    this.y = groundY - this.h;
    this.generous = Math.random() < 0.82;
    this.given = false;
    this.coat = pick(Math.random, ['#3b5f8a', '#7a4560', '#3f6b5a', '#6b5a3f', '#4b4b6b']);
    this.skin = pick(Math.random, ['#e8b48c', '#c98f63', '#8d5d3d', '#f1c9a5']);
    this.umbrella = Math.random() < 0.6;
    this.anim = Math.random() * 10;
    this.reactTimer = 0;
    this.hasBag = Math.random() < 0.5;
  }

  update(dt, game) {
    this.anim += dt;
    this.reactTimer = Math.max(0, this.reactTimer - dt);
    const cat = game.cat;
    this.near = Math.abs(cat.centerX - this.cx) < 92 && Math.abs(cat.feetY - (this.y + this.h)) < 60;
    if (this.near && !this.given && this.generous && cat.state !== 'sleep') {
      // Being noticed by a friendly human is enough — no interaction required.
      this.given = true;
      this.reactTimer = 1.2;
      game.onHumanFeed?.(this);
    }
  }

  draw(ctx, { rainAmount = 0 } = {}) {
    const sway = Math.sin(this.anim * 1.4) * 1.2;
    ctx.save();
    ctx.translate(this.cx, this.y + this.h);

    ctx.globalAlpha = 0.24;
    ctx.fillStyle = '#000';
    ellipse(ctx, 0, 1, 16, 4);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.translate(sway * 0.3, 0);

    // Legs.
    ctx.strokeStyle = '#252c3d';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -34);
    ctx.lineTo(-6, -1);
    ctx.moveTo(5, -34);
    ctx.lineTo(6, -1);
    ctx.stroke();
    // Shoes.
    ctx.fillStyle = '#171b26';
    ctx.beginPath();
    ctx.ellipse(-7, -1, 6, 2.6, 0, 0, Math.PI * 2);
    ctx.ellipse(7, -1, 6, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Coat.
    ctx.fillStyle = this.coat;
    ctx.beginPath();
    ctx.moveTo(-11, -70);
    ctx.quadraticCurveTo(-15, -50, -12, -32);
    ctx.lineTo(12, -32);
    ctx.quadraticCurveTo(15, -50, 11, -70);
    ctx.closePath();
    ctx.fill();
    // Scarf.
    ctx.fillStyle = '#c9584f';
    ctx.fillRect(-9, -72, 18, 7);
    ctx.fillStyle = '#a8433c';
    ctx.fillRect(4, -68, 6, 14);
    // Arm.
    ctx.strokeStyle = this.coat;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(10, -66);
    ctx.quadraticCurveTo(16, -55, 13 + Math.sin(this.anim) * 2, -44);
    ctx.stroke();
    // Bag.
    if (this.hasBag) {
      ctx.fillStyle = '#c9b48a';
      ctx.fillRect(11, -46, 12, 13);
      ctx.strokeStyle = '#a9946b';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(11, -46, 12, 13);
    }

    // Head.
    ctx.fillStyle = this.skin;
    ctx.beginPath();
    ctx.arc(0, -80, 9.5, 0, Math.PI * 2);
    ctx.fill();
    // Hair.
    ctx.fillStyle = '#2a2119';
    ctx.beginPath();
    ctx.arc(0, -83, 9.6, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-9.6, -83, 19, 4);
    // Face.
    ctx.fillStyle = '#2a2119';
    ctx.beginPath();
    ctx.arc(3.5, -80, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Umbrella in the rain.
    if (this.umbrella && rainAmount > 0.05) {
      ctx.strokeStyle = '#8a93a8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(6, -44);
      ctx.lineTo(10, -108);
      ctx.stroke();
      ctx.fillStyle = '#37607f';
      ctx.beginPath();
      ctx.arc(10, -106, 26, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b4d68';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(10, -106, 26 - i * 8.5, Math.PI + i * 0.5, Math.PI + (i + 1) * 0.5);
        ctx.lineTo(10, -106);
        ctx.fill();
      }
    }
    ctx.restore();

    // Kindness indicator.
    if (this.near && !this.given && this.generous) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ff8fa6';
      const yy = this.y - 18 + Math.sin(this.anim * 3) * 3;
      ctx.beginPath();
      ctx.moveTo(this.cx, yy + 5);
      ctx.bezierCurveTo(this.cx - 8, yy - 3, this.cx - 4, yy - 10, this.cx, yy - 5);
      ctx.bezierCurveTo(this.cx + 4, yy - 10, this.cx + 8, yy - 3, this.cx, yy + 5);
      ctx.fill();
      ctx.restore();
    }
    if (this.reactTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.reactTimer);
      ctx.fillStyle = '#fff';
      ctx.font = '700 14px ui-rounded, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('❤', this.cx, this.y - 24 - (1.2 - this.reactTimer) * 20);
      ctx.restore();
    }
  }
}

// ------------------------------------------------------------------ cars ----

const CAR_TYPES = [
  { name: 'sedan', w: 168, h: 58, colors: ['#c94f4f', '#3f7fb5', '#d8d8dc', '#4a4a52'] },
  { name: 'taxi', w: 176, h: 60, colors: ['#e8b83c'] },
  { name: 'van', w: 212, h: 76, colors: ['#e2e4ea', '#5b6470'] },
  { name: 'bus', w: 300, h: 96, colors: ['#2f7d7a', '#b8543f'] }
];

export class Car extends Entity {
  constructor(x, y, dir, speed, typeIndex = 0, chunkIndex = -1) {
    const type = CAR_TYPES[typeIndex % CAR_TYPES.length];
    super(chunkIndex);
    this.kind = 'car';
    this.type = type;
    this.w = type.w;
    this.h = type.h;
    this.x = x;
    this.y = y - this.h;
    this.dir = dir;
    this.speed = speed;
    this.color = pick(Math.random, type.colors);
    this.wheelPhase = Math.random() * 10;
    this.hitCat = false;
    this.headlightsOn = true;
    this.honk = false;
    this.blink = 0;
  }

  update(dt, game) {
    this.x += this.dir * this.speed * dt;
    this.wheelPhase += this.speed * dt * 0.09;

    // Splash spray when driving through rain.
    if (game.world.rainAmount > 0.3 && Math.random() < dt * 14) {
      game.particles.splash(this.cx - this.dir * (this.w / 2), this.y + this.h, 2, 'rgba(160, 210, 230, 0.55)');
    }

    if (!this.hitCat && Math.abs(game.cat.centerX - this.cx) < 30 + this.w * 0.2) {
      const catFeet = game.cat.feetY;
      const carTop = this.y + 6;
      if (catFeet > carTop + 4 && game.cat.y + game.cat.h > carTop) {
        this.hitCat = true;
        game.onCarHit(this);
      }
    }

    // Remove once well past the play area.
    const cam = game.camera.x;
    if (this.dir > 0 ? this.x > cam + 1400 : this.x + this.w < cam - 500) this.dead = true;
  }

  draw(ctx, { darkness = 0, rainAmount = 0 } = {}) {
    const flip = this.dir < 0 ? -1 : 1;
    ctx.save();
    ctx.translate(this.cx, this.y + this.h);
    ctx.scale(flip, 1);

    // Shadow.
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#000';
    ellipse(ctx, 0, 0, this.w * 0.48, 7);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Headlight beam (stronger at night / in rain).
    const beamA = (darkness * 0.5 + rainAmount * 0.16) * (this.headlightsOn ? 1 : 0);
    if (beamA > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(this.w * 0.42, -this.h * 0.4, this.w * 1.25, -this.h * 0.15);
      g.addColorStop(0, `rgba(255, 236, 190, ${beamA})`);
      g.addColorStop(1, 'rgba(255, 236, 190, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(this.w * 0.4, -this.h * 0.5);
      ctx.lineTo(this.w * 1.35, -this.h * 0.75);
      ctx.lineTo(this.w * 1.35, this.h * 0.25);
      ctx.lineTo(this.w * 0.4, -this.h * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const bodyH = this.h * 0.52;
    const bodyY = -bodyH;
    const cabinH = this.h - bodyH;
    const wheelR = this.h * 0.17;

    // Wheels.
    ctx.fillStyle = '#14161c';
    [this.w * 0.22, this.w * 0.78].forEach((wx) => {
      ctx.beginPath();
      ctx.arc(-this.w / 2 + wx, -wheelR, wheelR, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(-this.w / 2 + wx, -wheelR);
      ctx.rotate(this.wheelPhase);
      ctx.strokeStyle = '#3a4050';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-wheelR * 0.6, 0);
      ctx.lineTo(wheelR * 0.6, 0);
      ctx.stroke();
      ctx.restore();
    });

    // Body.
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(-this.w / 2, bodyY);
    ctx.lineTo(this.w / 2 - 4, bodyY);
    ctx.quadraticCurveTo(this.w / 2 + 3, bodyY, this.w / 2 + 2, bodyY + 8);
    ctx.lineTo(this.w / 2 + 2, -6);
    ctx.lineTo(-this.w / 2 - 1, -6);
    ctx.lineTo(-this.w / 2 - 1, bodyY + 8);
    ctx.quadraticCurveTo(-this.w / 2, bodyY, -this.w / 2, bodyY);
    ctx.closePath();
    ctx.fill();

    // Cabin / windows.
    ctx.fillStyle = this.type.name === 'bus' ? this.color : this.color;
    ctx.beginPath();
    if (this.type.name === 'van' || this.type.name === 'bus') {
      ctx.moveTo(-this.w / 2 + 6, bodyY);
      ctx.lineTo(-this.w / 2 + 12, bodyY - cabinH + 4);
      ctx.lineTo(this.w / 2 - 10, bodyY - cabinH + 4);
      ctx.lineTo(this.w / 2 - 2, bodyY - 4);
      ctx.lineTo(this.w / 2 - 2, bodyY);
    } else {
      ctx.moveTo(-this.w * 0.26, bodyY);
      ctx.lineTo(-this.w * 0.14, bodyY - cabinH + 4);
      ctx.lineTo(this.w * 0.18, bodyY - cabinH + 4);
      ctx.lineTo(this.w * 0.34, bodyY);
    }
    ctx.closePath();
    ctx.fill();

    // Window glass.
    ctx.fillStyle = 'rgba(150, 205, 235, 0.55)';
    if (this.type.name === 'sedan' || this.type.name === 'taxi') {
      ctx.beginPath();
      ctx.moveTo(-this.w * 0.22, bodyY - 3);
      ctx.lineTo(-this.w * 0.12, bodyY - cabinH + 7);
      ctx.lineTo(this.w * 0.15, bodyY - cabinH + 7);
      ctx.lineTo(this.w * 0.28, bodyY - 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba('#0d1420', 0.5);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(this.w * 0.03, bodyY - cabinH + 7);
      ctx.lineTo(this.w * 0.03, bodyY - 3);
      ctx.stroke();
    } else {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = 'rgba(150, 205, 235, 0.5)';
        ctx.fillRect(-this.w * 0.38 + i * this.w * 0.19, bodyY - cabinH + 8, this.w * 0.13, cabinH * 0.5);
      }
    }

    // Taxi sign.
    if (this.type.name === 'taxi') {
      ctx.fillStyle = '#fff2c4';
      ctx.fillRect(-8, bodyY - cabinH - 5, 18, 7);
      ctx.fillStyle = '#c9a63a';
      ctx.font = '700 6px sans-serif';
      ctx.fillText('TAXI', -5, bodyY - cabinH);
    }

    // Headlight + taillight.
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(this.w / 2 - 1, -this.h * 0.3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(-this.w / 2, -this.h * 0.3, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Trim line.
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-this.w / 2 + 4, -this.h * 0.24);
    ctx.lineTo(this.w / 2 - 4, -this.h * 0.24);
    ctx.stroke();

    ctx.restore();

    // Speed streaks.
    if (this.speed > 150) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = '#cfd8ea';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const y = this.y + 14 + i * 14;
        ctx.beginPath();
        ctx.moveTo(this.dir > 0 ? this.x - 30 - i * 12 : this.x + this.w + 30 + i * 12, y);
        ctx.lineTo(this.dir > 0 ? this.x - 6 : this.x + this.w + 6, y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
