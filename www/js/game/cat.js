/**
 * The stray cat: movement, collisions and procedural animation.
 *
 * Feel details that make it read as a cat rather than a platformer blob:
 *  - coyote time + jump buffering (forgiving on touch screens)
 *  - variable jump height, and a small "pounce" burst out of a sprint
 *  - wall-claw slides instead of wall jumps (cats scrabble, they don't kick off)
 *  - landing squash scaled by impact, stretch while airborne
 *  - a spring-driven tail chain, ears that flick, slow blinks, idle grooming
 *  - paw-step dust and timed footsteps, purring when it rests contentedly
 */
import { PHYS, SURVIVAL, GROUND_Y, COLORS } from '../config.js';
import { clamp, lerp, approach } from '../core/rng.js';

export class Cat {
  constructor(game) {
    this.game = game;
    this.w = 32;
    this.h = 24;
    this.eyeGlow = 0;
    this.reset(140, GROUND_Y - 24);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.grounded = true;
    this.wasGrounded = true;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.onWall = 0;
    this.clawing = false;
    this.state = 'idle';
    this.stateTime = 0;
    this.idleTime = 0;
    this.sprinting = false;
    this.squash = 0;
    this.stretch = 0;
    this.gaitPhase = 0;
    this.tailPhase = 0;
    this.tailLift = 0;
    this.blinkTimer = 2 + Math.random() * 3;
    this.blinking = 0;
    this.earTwitch = 0;
    this.sitAmount = 0;
    this.sleeping = false;
    this.dead = false;
    this.iframes = 0;
    this.hurtFlash = 0;
    this.stepTimer = 0;
    this.pounceTimer = 0;
    this.purrTimer = 10 + Math.random() * 20;
    this.wet = 0;
    this.landImpact = 0;
    this.groundSolid = null;
    this.tail = Array.from({ length: 8 }, (_, i) => ({ x: -16 - i * 4, y: -16 }));
    this.motionTrail = [];
  }

  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  get centerX() { return this.x + this.w / 2; }
  get centerY() { return this.y + this.h / 2; }
  get feetY() { return this.y + this.h; }

  update(dt, game) {
    const { input, world, survival, audio } = game;
    this.stateTime += dt;
    this.iframes = Math.max(0, this.iframes - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.4);
    this.squash = Math.max(0, this.squash - dt * 5.5);
    this.stretch = Math.max(0, this.stretch - dt * 4);
    this.pounceTimer = Math.max(0, this.pounceTimer - dt);
    this.earTwitch = Math.max(0, this.earTwitch - dt);
    this.wet = approach(this.wet, game.world.rainAmount, dt * 0.6);

    // Ambient life even when the player is idle.
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinking = 0.14;
      this.blinkTimer = 2.4 + Math.random() * 4;
    }
    this.blinking = Math.max(0, this.blinking - dt);
    this.purrTimer -= dt;
    if (this.purrTimer <= 0 && !this.dead && !this.sleeping) {
      this.purrTimer = 22 + Math.random() * 26;
      if (survival.health > 55 && survival.hunger > 45) audio.playPurr();
    }

    if (this.sleeping || this.dead) {
      this.vx = 0;
      this.vy = 0;
      this.updateTail(dt, 0);
      this.sitAmount = approach(this.sitAmount, 0, dt * 6);
      return;
    }

    const left = input.held.left;
    const right = input.held.right;
    const move = (right ? 1 : 0) - (left ? 1 : 0);

    // ---- horizontal movement -------------------------------------------------
    const exhausted = survival.energy <= 1;
    const wantSprint = input.held.sprint && move !== 0 && survival.energy > 4 && !exhausted;
    this.sprinting = wantSprint && (this.grounded || this.vy < 0);
    const canSprint = this.sprinting && survival.energy > 1;
    const topSpeed = (canSprint ? PHYS.sprintSpeed : PHYS.walkSpeed) * (exhausted ? 0.78 : 1);

    if (move !== 0) {
      const accel = this.grounded ? PHYS.accelGround : PHYS.accelAir;
      this.vx = approach(this.vx, move * topSpeed, accel * dt);
      this.facing = move;
      this.idleTime = 0;
    } else {
      const fric = this.grounded ? PHYS.frictionGround : PHYS.frictionAir;
      this.vx = approach(this.vx, 0, fric * dt);
      this.idleTime += dt;
    }

    // ---- jumping -------------------------------------------------------------
    if (input.pressed.jump) this.jumpBuffer = PHYS.jumpBuffer;
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.grounded ? PHYS.coyoteTime : Math.max(0, this.coyote - dt);

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      const pounce = canSprint ? 1 : 0;
      this.vy = -PHYS.jumpVelocity * (1 + pounce * (PHYS.pounceBoost - 1));
      if (pounce) {
        this.vx += this.facing * 62;
        this.pounceTimer = 0.35;
        this.stretch = 1;
      }
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.squash = 0.0;
      survival.energy = Math.max(0, survival.energy - SURVIVAL.energyDrainJump);
      audio.playJump();
      game.particles.dust(this.centerX, this.feetY, 5, -this.facing, 0.7);
      game.onCatJump?.();
    }

    // Variable jump: releasing early cuts the rise.
    if (input.released.jump && this.vy < -120) this.vy *= 0.45;

    // ---- gravity -------------------------------------------------------------
    const holding = input.held.jump && this.vy < 0;
    const g = holding ? PHYS.gravityHold : PHYS.gravity;
    this.vy = Math.min(this.vy + g * dt, PHYS.maxFallSpeed);

    // ---- wall claw scrabbling ------------------------------------------------
    this.clawing = false;
    if (!this.grounded && this.onWall !== 0 && move === this.onWall && this.vy > 40 && survival.energy > 2) {
      this.clawing = true;
      this.vy = Math.min(this.vy, PHYS.clawFallSpeed);
      if (Math.random() < dt * 22) game.particles.claw(this.centerX + this.onWall * 15, this.feetY - 6);
      if (Math.random() < dt * 4) audio.playFootstep(0.12);
    }

    // ---- integrate + collide -------------------------------------------------
    this.wasGrounded = this.grounded;
    this.landImpact = 0;
    this.integrate(dt, world, game);

    // ---- landing -------------------------------------------------------------
    if (this.grounded && !this.wasGrounded) {
      const impact = this.landImpact || 0;
      this.squash = clamp(impact / 760, 0.12, 1);
      if (impact > 120) {
        game.particles.dust(this.centerX, this.feetY, Math.min(10, 3 + impact / 120), 0, 0.8 + impact / 900);
        audio.playLand(clamp(impact / 700, 0.35, 1));
      }
      if (impact > PHYS.fallDamageThreshold) {
        const dmg = Math.min(24, (impact - PHYS.fallDamageThreshold) / 42);
        game.damageCat(dmg, 'a bad fall', this.centerX, this.feetY);
      }
    }

    // ---- footsteps -----------------------------------------------------------
    if (this.grounded && Math.abs(this.vx) > 20) {
      this.stepTimer -= dt * (Math.abs(this.vx) / PHYS.walkSpeed);
      if (this.stepTimer <= 0) {
        this.stepTimer = this.sprinting ? 0.19 : 0.3;
        audio.playFootstep(this.sprinting ? 0.16 : 0.09);
        if (Math.random() < 0.5) game.particles.dust(this.centerX - this.facing * 10, this.feetY, 2, -this.facing, 0.35);
        if (world.rainAmount > 0.35 && Math.random() < 0.6) {
          game.particles.splash(this.centerX - this.facing * 8, this.feetY, 3, 'rgba(150, 200, 230, 0.6)');
        }
      }
    }

    this.gaitPhase += dt * (Math.abs(this.vx) * 0.055 + (this.grounded ? 0 : 1.4));
    this.updateTail(dt, Math.abs(this.vx));
    this.updateState(dt, move);

    // Blink on landings sometimes.
    if (this.squash > 0.6 && Math.random() < 0.3) this.blinking = 0.1;
  }

  updateState(dt, move) {
    if (this.dead) { this.state = 'dead'; return; }
    if (this.sleeping) { this.state = 'sleep'; return; }
    if (!this.grounded) { this.state = this.vy < 0 ? 'jump' : 'fall'; }
    else if (this.clawing) this.state = 'claw';
    else if (Math.abs(this.vx) > PHYS.walkSpeed + 20) this.state = 'run';
    else if (Math.abs(this.vx) > 12) this.state = 'walk';
    else this.state = 'idle';

    const targetSit = this.state === 'idle' && this.idleTime > 5.5 ? 1 : 0;
    this.sitAmount = approach(this.sitAmount, targetSit, dt * 3.2);
  }

  updateTail(dt, speed) {
    const lift = clamp(-this.vy / 700, -0.6, 1) + (speed > 220 ? 0.4 : 0) + (this.sleeping ? -1 : 0);
    this.tailLift = lerp(this.tailLift, lift, 1 - Math.pow(0.001, dt));
    this.tailPhase += dt * (2.4 + speed * 0.02);
    const sway = Math.sin(this.tailPhase) * (2.5 + speed * 0.012);
    const baseX = -15;
    const baseY = -19;
    const k = 1 - Math.pow(0.00004, dt); // stable, springy follow
    for (let i = 0; i < this.tail.length; i++) {
      const t = i / (this.tail.length - 1);
      const curl = Math.sin(this.tailPhase + t * 1.7) * (2 + t * 5);
      const tx = baseX - t * 22 + curl * 0.5;
      // Rests with a gentle upward hook, rises with speed and jumps.
      const ty = baseY - Math.sin(t * Math.PI * 0.5) * 11 - this.tailLift * t * 14 + sway * t * 0.7 + curl * 0.5;
      const p = this.tail[i];
      p.x = lerp(p.x, tx, k);
      p.y = lerp(p.y, ty, k);
    }
  }

  /** Move with swept AABB resolution against the world's solids. */
  integrate(dt, world, game) {
    const steps = Math.abs(this.vy) * dt > 18 || Math.abs(this.vx) * dt > 18 ? 2 : 1;
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      const solids = world.solidsNear(this.centerX, 140);

      // Horizontal
      this.x += this.vx * sdt;
      this.onWall = 0;
      for (const sol of solids) {
        if (sol.oneWay) continue;
        if (this.overlaps(sol)) {
          if (this.vx > 0) { this.x = sol.x - this.w; this.onWall = 1; }
          else if (this.vx < 0) { this.x = sol.x + sol.w; this.onWall = -1; }
          this.vx = 0;
        }
      }

      // Vertical
      const prevTop = this.y;
      const prevBottom = this.y + this.h;
      this.y += this.vy * sdt;
      const wasGrounded = this.grounded;
      this.grounded = false;
      let groundRef = null;
      for (const sol of solids) {
        if (!(this.x + this.w > sol.x + 1 && this.x < sol.x + sol.w - 1)) continue;
        const bottom = this.y + this.h;
        if (this.vy >= 0 && bottom > sol.y && prevBottom <= sol.y + 6) {
          if (this.iframes > 0 && sol.kind === 'street' && false) continue;
          this.landImpact = Math.max(this.landImpact, this.vy);
          this.y = sol.y - this.h;
          this.vy = 0;
          this.grounded = true;
          groundRef = sol;
        } else if (!sol.oneWay && this.vy < 0 && prevTop >= sol.y + sol.h - 4 && this.y < sol.y + sol.h) {
          this.y = sol.y + sol.h;
          this.vy = 0;
        }
      }
      if (this.grounded) this.groundSolid = groundRef;
      else if (!wasGrounded) this.groundSolid = null;
    }

    // World hard limits: a fence at the start of the run, and never fall out of the world.
    if (this.x < world.leftLimit) { this.x = world.leftLimit; this.vx = Math.max(0, this.vx); }
    if (this.y > GROUND_Y + 60) {
      this.y = GROUND_Y - this.h;
      this.vy = 0;
      this.grounded = true;
      game.damageCat(18, 'the fall', this.centerX, this.feetY);
    }
  }

  overlaps(r) {
    return this.x < r.x + r.w && this.x + this.w > r.x && this.y < r.y + r.h && this.y + this.h > r.y;
  }

  startSleep() {
    this.sleeping = true;
    this.state = 'sleep';
    this.vx = 0;
  }

  wake() {
    this.sleeping = false;
  }

  /** Called by the game when the cat takes damage: knockback + invulnerability. */
  hurt(knockX, knockY = -180) {
    this.vx = knockX;
    this.vy = knockY;
    this.grounded = false;
    this.iframes = 0.85;
    this.hurtFlash = 1;
    this.stretch = 0;
    this.squash = 0.3;
    this.blinking = 0.18;
  }

  // ------------------------------------------------------------------ draw --
  draw(ctx, { darkness = 0, rainAmount = 0 } = {}) {
    const flashing = this.iframes > 0 && this.hurtFlash > 0;
    if (flashing && Math.floor(this.iframes * 22) % 2 === 0) return;

    const scaleX = 1 + this.squash * 0.28 - this.stretch * 0.1;
    const scaleY = 1 - this.squash * 0.3 + this.stretch * 0.14;
    const speed = Math.abs(this.vx);
    const bob = this.grounded ? Math.sin(this.gaitPhase * 2) * Math.min(2.4, speed * 0.012) : 0;
    const sit = this.sitAmount;

    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h);
    ctx.scale(this.facing, 1);
    if (this.sleeping) {
      this.drawSleeping(ctx);
      ctx.restore();
      return;
    }
    if (this.dead) {
      this.drawDead(ctx);
      ctx.restore();
      return;
    }
    ctx.translate(0, bob + sit * 2);
    // Sitting tilts the whole animal nose-up around its hind paws.
    if (sit > 0.01) ctx.rotate(-0.2 * sit);
    ctx.scale(scaleX, scaleY);

    const fur = COLORS.catFur;
    const furDark = COLORS.catFurDark;
    const cream = COLORS.catCream;

    // Ground contact shadow.
    if (this.grounded) {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, 1.5, 17, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    this.drawShadowTail(ctx);
    this.drawLegs(ctx, furDark, true);
    this.drawBody(ctx, fur, cream);
    this.drawLegs(ctx, fur, false);
    this.drawHead(ctx, fur, cream, darkness);
    ctx.restore();

    // Eyes catching the light at night.
    if (darkness > 0.35) {
      const ex = this.x + this.w / 2 + this.facing * 14;
      const ey = this.y + 2;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * darkness;
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 26);
      g.addColorStop(0, 'rgba(168, 224, 90, 0.55)');
      g.addColorStop(1, 'rgba(168, 224, 90, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ex, ey, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawShadowTail(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.tail[0].x, this.tail[0].y);
    for (let i = 1; i < this.tail.length - 1; i++) {
      const p = this.tail[i];
      const n = this.tail[i + 1];
      ctx.quadraticCurveTo(p.x, p.y, (p.x + n.x) / 2, (p.y + n.y) / 2);
    }
    const last = this.tail[this.tail.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Darker under-layer for volume, then the ginger top coat.
    ctx.strokeStyle = COLORS.catFurDark;
    ctx.lineWidth = 6.6;
    ctx.stroke();
    ctx.strokeStyle = COLORS.catFur;
    ctx.lineWidth = 4.7;
    ctx.stroke();

    // Tail rings.
    ctx.strokeStyle = COLORS.catStripe;
    for (let i = 2; i < this.tail.length - 1; i += 2) {
      const p = this.tail[i];
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(p.x - 2, p.y - 2.6);
      ctx.lineTo(p.x + 2, p.y + 2.6);
      ctx.stroke();
    }
    // White tip.
    ctx.strokeStyle = COLORS.catCream;
    ctx.lineWidth = 4;
    ctx.beginPath();
    const a = this.tail[this.tail.length - 2];
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  }

  drawBody(ctx, fur, cream) {
    ctx.save();
    // Sitting pulls the hips down and back while the chest stays up.
    ctx.translate(-this.sitAmount * 2.5, this.sitAmount * 1.5);

    // Torso from overlapping rounded volumes — same fill, so no visible seams.
    ctx.beginPath();
    ctx.ellipse(-8.5, -15.5, 9.4, 9.2, -0.12, 0, Math.PI * 2);
    ctx.ellipse(-1, -17.5, 15.6, 9.2, -0.05, 0, Math.PI * 2);
    ctx.ellipse(8.5, -18.5, 8.8, 8.8, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = fur;
    ctx.fill();

    // Cream chest and belly.
    ctx.beginPath();
    ctx.ellipse(10.5, -14, 5.6, 6.8, 0.18, 0, Math.PI * 2);
    ctx.fillStyle = cream;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-1, -11.2, 12, 4.2, 0.02, 0, Math.PI * 2);
    ctx.fill();

    // Saddle shading.
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.ellipse(-4, -23, 13, 4, -0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#5c2c12';
    ctx.fill();
    ctx.globalAlpha = 1;

    // Tabby stripes along the spine.
    ctx.strokeStyle = COLORS.catStripe;
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) {
      const x = -12 + i * 8;
      ctx.beginPath();
      ctx.moveTo(x, -25 + Math.abs(i - 1) * 1.2);
      ctx.quadraticCurveTo(x + 3, -21, x + 1.5, -17.5);
      ctx.stroke();
    }

    // Tattered collar with a little bell.
    ctx.strokeStyle = '#2f7d7a';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(11, -24.5);
    ctx.quadraticCurveTo(15.5, -21.5, 12.5, -17);
    ctx.stroke();
    ctx.fillStyle = '#f2c25a';
    ctx.beginPath();
    ctx.arc(14.2, -18.8, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(14.6, -18.2, 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawLegs(ctx, color, far) {
    const moving = Math.abs(this.vx) > 12 && this.grounded;
    const phase = this.gaitPhase;
    const air = !this.grounded;
    const sit = this.sitAmount;

    const leg = (hipX, hipY, footX, footY, thickness, dark) => {
      ctx.strokeStyle = dark ? COLORS.catFurDark : color;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      const kneeX = (hipX + footX) / 2 + (footY - hipY) * 0.18;
      const kneeY = (hipY + footY) / 2;
      ctx.quadraticCurveTo(kneeX, kneeY, footX, footY);
      ctx.stroke();
      // Paw.
      ctx.fillStyle = dark ? COLORS.catFurDark : COLORS.catCream;
      ctx.beginPath();
      ctx.ellipse(footX + 1.5, footY - 1.2, 3.4, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    const swing = (offset) => Math.sin(phase + offset);
    const lift = (offset) => Math.max(0, Math.cos(phase + offset)) * 3.6;

    if (!far) {
      // Near legs (drawn over the body).
      if (sit > 0.5) {
        // Sitting loaf: the hind leg folds into a haunch, front legs stay upright.
        ctx.save();
        ctx.fillStyle = COLORS.catFur;
        ctx.beginPath();
        ctx.ellipse(-10, -11, 9, 8.5, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.catCream;
        ctx.beginPath();
        ctx.ellipse(-4, -2.2, 4.8, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        leg(9.5, -14, 10.5, -1, 4.6, false);
      } else if (air) {
        const tuck = this.vy < 0 ? 1 : 0.45;
        leg(9, -14, 15 - tuck * 3, -6 - tuck * 5, 4.6, false);
        leg(-9, -15, -17, -8 + tuck * 2, 5, false);
      } else if (moving) {
        leg(9, -14, 10 + swing(0) * 7, -1 - lift(0), 4.6, false);
        leg(-9, -15, -9 + swing(Math.PI) * 8, -1 - lift(Math.PI), 5, false);
      } else {
        leg(9.5, -14, 10.5, -1, 4.6, false);
        leg(-9.5, -15, -10.5, -1, 5, false);
      }
    } else {
      // Far legs, slightly darker and offset in phase.
      if (sit > 0.5) {
        leg(12, -11, 14, -1.5, 3.8, true);
        leg(-5, -11, -4, -1.5, 4, true);
      } else if (air) {
        leg(7, -14, 12, -7, 4, true);
        leg(-11, -15, -19, -9, 4.4, true);
      } else if (moving) {
        leg(8, -14, 8 + swing(Math.PI) * 7, -1.4 - lift(Math.PI), 4, true);
        leg(-10, -15, -10 + swing(0) * 8, -1.4 - lift(0), 4.4, true);
      } else {
        leg(8, -14, 8.5, -1.4, 4, true);
        leg(-10.5, -15, -12, -1.4, 4.4, true);
      }
    }
  }

  drawHead(ctx, fur, cream, darkness) {
    const sit = this.sitAmount;
    const run = this.state === 'run';
    const hx = 15 + (run ? 1.5 : 0) + sit * 1.5;
    const hy = -26 + (run ? 1.2 : 0) - sit * 1.5 + Math.sin(this.gaitPhase * 2) * (this.grounded ? 0.6 : 0);
    const tilt = run ? 0.06 : Math.sin(this.gaitPhase * 0.5) * 0.02;
    const eating = this.game.eatingTimer > 0;
    const headDip = eating ? 5 + Math.sin(this.stateTime * 14) * 1.6 : 0;

    ctx.save();
    ctx.translate(hx, hy + headDip);
    ctx.rotate(tilt);

    // Ears (twitch occasionally).
    const twitch = this.earTwitch > 0 ? 0.28 : 0;
    const ear = (x1, x2, bx, tipX, tipY) => {
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(x2, 1);
      ctx.closePath();
      ctx.fillStyle = fur;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x1 + (bx - x1) * 0.5, -1.5);
      ctx.lineTo(tipX * 0.98 + 0.2, tipY * 0.72);
      ctx.lineTo(x2 - 1, -0.5);
      ctx.closePath();
      ctx.fillStyle = '#e9a6a0';
      ctx.fill();
    };
    ctx.save();
    ctx.rotate(-twitch);
    ear(-7.5, -1.5, -4, -7, -13);
    ctx.restore();
    ctx.save();
    ctx.translate(1.5, 0);
    ctx.rotate(twitch * 0.6);
    ear(-2.5, 4.5, 1, 3.5, -12);
    ctx.restore();

    // Skull.
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 8.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = fur;
    ctx.fill();

    // Cheek fluff + muzzle.
    ctx.beginPath();
    ctx.ellipse(5.2, 3.2, 5.4, 4.4, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = cream;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(2.6, 4.6, 3.6, 2.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff3e0';
    ctx.fill();

    // Forehead stripes.
    ctx.strokeStyle = COLORS.catStripe;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-2 + i * 2.6, -7.2);
      ctx.lineTo(-2.4 + i * 2.6, -4.6);
      ctx.stroke();
    }

    // Eyes: half-closed when sitting/resting, wide when running.
    const blink = this.blinking > 0 ? 0.08 : 1;
    const squint = this.sitAmount > 0.4 ? 0.52 : 1;
    const eyeY = -0.4;
    const drawEye = (ex, scale) => {
      const rx = 3.5 * scale;
      const ry = 3.3 * blink * squint;
      ctx.save();
      ctx.translate(ex, eyeY);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, Math.max(0.5, ry), 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1d2a12';
      ctx.fill();
      if (blink > 0.5) {
        ctx.beginPath();
        ctx.ellipse(0, 0.2, rx * 0.82, Math.max(0.4, ry * 0.86), 0, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.catEye;
        ctx.fill();
        // Slit pupil.
        ctx.beginPath();
        ctx.ellipse(0.4, 0, rx * 0.24, Math.max(0.4, ry * 0.72), 0, 0, Math.PI * 2);
        ctx.fillStyle = '#131a0c';
        ctx.fill();
        // Catchlight.
        ctx.beginPath();
        ctx.arc(-rx * 0.32, -ry * 0.34, Math.max(0.4, rx * 0.2), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fill();
      }
      ctx.restore();
    };
    drawEye(-3.4, 1);
    drawEye(3.2, 0.85);

    // Nose + mouth.
    ctx.beginPath();
    ctx.moveTo(7.4, 1.4);
    ctx.lineTo(9.6, 1.4);
    ctx.lineTo(8.5, 2.9);
    ctx.closePath();
    ctx.fillStyle = COLORS.catNose;
    ctx.fill();
    ctx.strokeStyle = 'rgba(90, 50, 40, 0.7)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(8.5, 2.9);
    ctx.lineTo(8.5, 4);
    ctx.moveTo(8.5, 4);
    ctx.quadraticCurveTo(7, 5.4, 6, 4.4);
    ctx.moveTo(8.5, 4);
    ctx.quadraticCurveTo(10, 5.4, 10.8, 4.2);
    ctx.stroke();

    // Whiskers.
    ctx.strokeStyle = 'rgba(255, 248, 235, 0.55)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const y = 2 + i * 1.8;
      ctx.beginPath();
      ctx.moveTo(9, y);
      ctx.quadraticCurveTo(15, y - 1 + i * 1.6, 19, y - 3 + i * 2.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawSleeping(ctx) {
    // Curled cat: a loaf with a wrapped tail.
    ctx.save();
    ctx.translate(0, -2);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 2.5, 20, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.ellipse(-1, -11, 18, 10.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.catFur;
    ctx.fill();

    // Tail curling around the front.
    ctx.strokeStyle = COLORS.catFurDark;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.quadraticCurveTo(2, 2, 16, -6);
    ctx.stroke();
    ctx.strokeStyle = COLORS.catFur;
    ctx.lineWidth = 4.2;
    ctx.stroke();

    // Head resting on paws.
    ctx.beginPath();
    ctx.ellipse(10, -10, 9, 7.6, 0.12, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.catFur;
    ctx.fill();

    // Ears.
    ctx.fillStyle = COLORS.catFur;
    ctx.beginPath();
    ctx.moveTo(4, -15); ctx.lineTo(3, -22); ctx.lineTo(9, -17); ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(11, -17); ctx.lineTo(13, -23.5); ctx.lineTo(16.5, -16.5); ctx.closePath();
    ctx.fill();

    // Closed eyes.
    ctx.strokeStyle = '#3b2a1c';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(8, -11); ctx.quadraticCurveTo(10, -9.4, 12, -11);
    ctx.moveTo(13.5, -10.6); ctx.quadraticCurveTo(15, -9.2, 16.5, -10.6);
    ctx.stroke();

    // Nose.
    ctx.fillStyle = COLORS.catNose;
    ctx.beginPath();
    ctx.arc(14.6, -7.6, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Stripes.
    ctx.strokeStyle = COLORS.catStripe;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-12 + i * 7, -20 + Math.abs(i - 1) * 1.5);
      ctx.quadraticCurveTo(-10 + i * 7, -16, -11 + i * 7, -13);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawDead(ctx) {
    ctx.save();
    ctx.translate(0, -3);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 3.4, 22, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Lying on its side.
    ctx.beginPath();
    ctx.ellipse(-1, -8, 19, 8.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.catFur;
    ctx.fill();
    ctx.strokeStyle = COLORS.catFurDark;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-15, -10);
    ctx.quadraticCurveTo(-24, -8, -26, -3);
    ctx.stroke();

    // Head.
    ctx.beginPath();
    ctx.ellipse(14, -8, 8.6, 7.6, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.catFur;
    ctx.fill();
    ctx.fillStyle = COLORS.catFur;
    ctx.beginPath();
    ctx.moveTo(8, -14); ctx.lineTo(6.5, -20); ctx.lineTo(12, -15.5); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3b2a1c';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(12, -10); ctx.lineTo(16, -9);
    ctx.moveTo(15, -7); ctx.lineTo(18.5, -7.6);
    ctx.stroke();
    ctx.fillStyle = COLORS.catNose;
    ctx.beginPath();
    ctx.arc(19.6, -6.4, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
