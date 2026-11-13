/**
 * Game orchestrator: owns the run state machine, camera, interactions,
 * damage rules, records and the render pipeline.
 */
import {
  VIEW_W, VIEW_H, GROUND_Y, HAZARD, SAVE_KEY, SETTINGS_KEY, COLORS,
  APP_VERSION, UPDATE_MANIFEST_URL, FEEL, QUEST
} from '../config.js';
import { UpdateChecker } from '../core/updates.js';
import { clamp, damp, lerp, randRange } from '../core/rng.js';
import { fillRound, roundRect, text } from '../core/draw.js';
import { World } from './world.js';
import { Cat } from './cat.js';
import { Survival } from './survival.js';
import { Particles } from './particles.js';
import { Background } from './background.js';
import { HUD } from './hud.js';
import { Screens } from './screens.js';
import { Food } from './entities.js';
import { Quests } from './quests.js';

export class Game {
  constructor({ canvas, ctx, input, audio, settings }) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.input = input;
    this.audio = audio;
    this.settings = settings;

    this.records = this.loadRecords();
    this.background = new Background();
    this.particles = new Particles();
    this.survival = new Survival();
    this.world = new World(1000);
    this.cat = new Cat(this);
    this.camera = { x: 0, y: 0 };
    this.shake = { x: 0, y: 0, t: 0, mag: 0 };
    this.hud = new HUD(this);
    this.screens = new Screens(this);
    this.state = 'title';
    this.returnScreen = 'title';
    this.time = 0;
    this.eatingTimer = 0;
    this.actionTarget = null;
    this.actionProgress = 0;
    this.currentAction = null;
    this.meowCooldown = 0;
    this.toxinSound = 0;
    this.deathTimer = 0;
    this.isNewRecord = false;
    this.carWarning = { dir: 0, life: 0 };
    this.showTouch = false;
    this.runSeed = 1000;
    this.quests = new Quests(this);
    this.updates = new UpdateChecker({
      currentVersion: APP_VERSION,
      manifestUrl: UPDATE_MANIFEST_URL
    });

    // Title diorama (separate world so the menu city never disturbs a run).
    this.titleWorld = new World(4242);
    this.titleWorld.rainAmount = 0.55;
    this.titleWorld.weatherTimer = 999;
    this.titleWorld.raining = true;
    this.titleCat = new Cat(this);
    this.titleCat.sitAmount = 1;
    this.titleCat.facing = -1;

    this.updateTouchMode();

    // Never blocks startup, never throws: a failed check is a no-op.
    setTimeout(() => { this.updates.check(); }, 1500);
  }

  /** Manual check from Settings. Returns the result and optionally toasts it. */
  async checkForUpdates(notify = false) {
    const res = await this.updates.check();
    if (notify) {
      if (res.available) this.screens.showToast(`Update ${res.latest} available — see the title screen`);
      else if (res.error) this.screens.showToast('Could not check for updates (offline?)');
      else this.screens.showToast('You are up to date');
    }
    return res;
  }

  // ----------------------------------------------------------- persistence --

  loadRecords() {
    const fallback = { bestDay: 0, bestFood: 0, bestDistance: 0, runs: 0, goldFish: 0, doubleJump: false };
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return fallback;
      return { ...fallback, ...JSON.parse(raw) };
    } catch { return fallback; }
  }

  saveRecords() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.records)); } catch { /* private mode */ }
  }

  resetRecords() {
    this.records = { bestDay: 0, bestFood: 0, bestDistance: 0, runs: 0, goldFish: 0, doubleJump: false };
    this.saveRecords();
  }

  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* ignore */ }
  }

  toggleSound() {
    this.settings.sound = !this.settings.sound;
    this.audio.setSound(this.settings.sound);
    this.saveSettings();
    this.screens.showToast(this.settings.sound ? 'Sound on' : 'Sound muted');
  }

  toggleHaptics() {
    this.settings.haptics = !this.settings.haptics;
    this.saveSettings();
    this.haptic(20);
    this.screens.showToast(this.settings.haptics ? 'Haptics on' : 'Haptics off');
  }

  cycleTouch() {
    const order = ['auto', 'on', 'off'];
    const i = order.indexOf(this.settings.touch);
    this.settings.touch = order[(i + 1) % order.length];
    this.updateTouchMode();
    this.saveSettings();
  }

  updateTouchMode() {
    const coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
    this.showTouch = this.settings.touch === 'on' ||
      (this.settings.touch === 'auto' && (coarse || this.input.touchEverUsed));
  }

  haptic(ms) {
    if (!this.settings.haptics) return;
    try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
  }

  exitApp() {
    const capApp = window.Capacitor?.Plugins?.App;
    if (capApp?.exitApp) {
      capApp.exitApp();
      return;
    }
    this.screens.showToast('Close the tab to leave the city');
  }

  // ------------------------------------------------------------- flow ------

  go(screen) {
    if (screen !== 'pause' && this.state !== 'paused') this.returnScreen = this.state;
    this.state = screen;
    this.screens.enter(screen);
  }

  back() {
    const target = this.returnScreen === 'pause' ? 'paused' : 'title';
    this.state = target;
    this.screens.enter(target);
  }

  startRun() {
    this.runSeed = Math.floor(Math.random() * 100000);
    this.world.reset(this.runSeed);
    this.survival.reset();
    this.quests.reset();
    this.quests.restore(this.records);
    this.cat.airJumps = this.quests.doubleJump ? 1 : 0;
    this.particles.clear();
    this.hud.reset();
    this.cat.reset(this.world.spawnX, GROUND_Y - 24);
    this.camera.x = 0;
    this.shake.t = 0;
    this.eatingTimer = 0;
    this.actionTarget = null;
    this.actionProgress = 0;
    this.currentAction = null;
    this.deathTimer = 0;
    this.isNewRecord = false;
    this.meowCooldown = 0;
    this.records.runs++;
    this.saveRecords();
    this.state = 'playing';
    this.screens.enter('playing');
    this.audio.unlock();
    this.audio.playMeow({ pitch: 1.05 });
    this.hud.toast('Find food, stay off the road', 'info');
    this.updateTouchMode();
  }

  toMenu() {
    this.state = 'title';
    this.screens.enter('title');
    this.input.setButtons([]);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.screens.enter('paused');
    this.audio.playUi('confirm');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.audio.playUi();
  }

  // ------------------------------------------------------------- update ----

  update(dt) {
    this.input.beginFrame();
    this.time += dt;
    this.background.update(dt);
    this.updateTouchMode();

    switch (this.state) {
      case 'playing':
        if (this.input.pressed.pause) { this.pause(); break; }
        this.updatePlaying(dt);
        break;
      case 'dying':
        this.updateDying(dt);
        break;
      case 'paused':
        this.screens.update(dt);
        if (this.input.pressed.pause) this.resume();
        break;
      case 'title':
        this.screens.update(dt);
        this.titleWorld.rainAmount = 0.55;
        break;
      default:
        this.screens.update(dt);
        break;
    }

    this.input.endFrame();
  }

  updatePlaying(dt) {
    const { cat, world, survival, input } = this;

    // On-screen pause pad (keyboard pause is handled in update()).
    if (input.buttonPressed.has('pause')) {
      this.pause();
      return;
    }

    this.meowCooldown = Math.max(0, this.meowCooldown - dt);
    this.eatingTimer = Math.max(0, this.eatingTimer - dt);

    // Waking up takes priority over any other interaction.
    if (cat.sleeping) {
      const wantsUp = input.pressed.jump || input.pressed.interact || input.held.left || input.held.right ||
        survival.energy >= 99.5 || survival.health < 20;
      if (wantsUp) {
        cat.wake();
        survival.wake();
        this.hud.toast('You wake up, a little warmer', 'good');
        this.audio.playMeow({ pitch: 0.95 });
      }
    }

    cat.update(dt, this);
    world.update(dt, this);

    const events = survival.update(dt, {
      moving: Math.abs(cat.vx) > 24 || !cat.grounded,
      sprinting: cat.sprinting && !cat.sleeping,
      climbing: cat.clawing,
      raining: world.rainAmount,
      sleeping: cat.sleeping
    });
    for (const e of events) this.handleSurvivalEvent(e);

    if (this.state !== 'playing') return; // death may have fired

    this.updateInteraction(dt);
    this.updatePickups(dt);
    this.updateToxins(dt);
    this.updateCamera(dt);
    this.updateTrafficFeel(dt);
    this.quests.update(dt, this);

    this.particles.update(dt);
    this.hud.update(dt, this);
    survival.distance = Math.max(0, cat.x - world.spawnX);

    // Camera shake decay.
    if (this.shake.t > 0) {
      this.shake.t = Math.max(0, this.shake.t - dt);
      const k = this.shake.t / this.shake.total;
      this.shake.x = Math.sin(this.time * 74) * this.shake.mag * k;
      this.shake.y = Math.cos(this.time * 61) * this.shake.mag * k * 0.6;
    } else {
      this.shake.x = 0;
      this.shake.y = 0;
    }
    this.carWarning.life = Math.max(0, this.carWarning.life - dt);

    this.audio.updateAmbience(dt, {
      raining: world.rainAmount,
      night: survival.darkness,
      inCity: true,
      lowHealth: survival.health < 28
    });
  }

  updateDying(dt) {
    this.deathTimer -= dt;
    this.particles.update(dt);
    this.hud.update(dt, this);
    if (this.deathTimer <= 0) {
      this.state = 'dead';
      this.screens.enter('dead');
    }
  }

  /** Passing traffic shakes the camera so speed is felt, not just seen. */
  updateTrafficFeel(dt) {
    const cat = this.cat;
    for (const e of this.world.entities) {
      if (e.kind !== 'car' || e.dead || e.shook) continue;
      const d = Math.abs(e.cx - cat.centerX);
      const speed = Math.abs(e.speed || 0);
      if (d < FEEL.carShakeRadius && speed > FEEL.carShakeSpeed) {
        e.shook = true;
        const close = 1 - d / FEEL.carShakeRadius;
        this.addShake(FEEL.carShakeMag * (0.5 + close), 0.26);
        this.audio.playCarPass?.(e.dir * 0.6);
        if (this.world.rainAmount > 0.2) {
          this.particles.splash(e.cx, this.world.ground.y, 5, 'rgba(180, 215, 245, 0.5)');
        }
      }
    }
  }

  updateCamera(dt) {
    const cat = this.cat;
    const lookahead = cat.facing * 34 + clamp(cat.vx * 0.18, -46, 46);
    const target = cat.centerX - VIEW_W * 0.44 + lookahead;
    this.camera.x = damp(this.camera.x, Math.max(0, target), 0.0009, dt);
  }

  handleSurvivalEvent(e) {
    if (e.type === 'newday') {
      this.hud.toast(`Day ${this.survival.day} begins`, 'good');
      this.audio.playMotif(0.7);
    } else if (e.type === 'nightfall') {
      this.hud.toast('Night falls — the rooftops are safer', 'info');
    } else if (e.type === 'dawn') {
      this.audio.playMeow({ pitch: 1.15 });
    } else if (e.type === 'starving') {
      if (!this.starveWarned) {
        this.hud.toast('You are starving. Eat something!', 'bad');
        this.starveWarned = true;
      }
    } else if (e.type === 'death') {
      this.onDeath(e.cause);
    }
  }

  // ------------------------------------------------------- interactions ----

  findAction() {
    const cat = this.cat;
    if (cat.sleeping) return { kind: 'wake', label: 'Wake up', time: 0.001, target: null };

    const dumpster = this.world.nearestDumpster(cat.centerX, cat.feetY - 8, 104);
    const rest = this.world.nearestInteractable(cat.centerX, cat.feetY - 14, 74);
    const candidates = [];
    if (dumpster) candidates.push({ kind: 'dumpster', target: dumpster, label: 'Rummage the dumpster', time: 1.15 });
    if (rest && rest.kind === 'rest') candidates.push({ kind: 'sleep', target: rest, label: rest.interactLabel, time: 0.4 });
    if (!candidates.length) return null;

    // Prefer whatever the player is standing closest to.
    let best = candidates[0];
    let bestD = Infinity;
    for (const c of candidates) {
      const cx = c.target.x + (c.target.w || 0) / 2;
      const d = Math.abs(cx - cat.centerX) + (c.kind === 'dumpster' ? 10 : 0);
      if (d < bestD) { bestD = d; best = c; }
    }
    best.progress = this.actionTarget === best.target ? this.actionProgress : 0;
    return best;
  }

  updateInteraction(dt) {
    const action = this.findAction();
    this.currentAction = action;

    if (!action) {
      this.actionTarget = null;
      this.actionProgress = 0;
      // Paw button with nothing nearby = meow.
      if ((this.input.pressed.interact || this.input.buttonPressed.has('interact')) && this.meowCooldown <= 0) {
        this.meowCooldown = 1.8;
        this.audio.playMeow({ pitch: randRange(Math.random, 0.95, 1.12), pan: 0 });
        this.particles.hearts(this.cat.centerX + this.cat.facing * 14, this.cat.y - 8);
      }
      return;
    }

    if (action.kind === 'wake') {
      action.progress = 0;
      return;
    }

    if (this.actionTarget !== action.target) {
      this.actionTarget = action.target;
      this.actionProgress = 0;
    }

    const holding = this.input.held.interact || this.cat.sleeping;
    if (holding) {
      this.actionProgress = Math.min(1, this.actionProgress + dt / action.time);
      if (action.kind === 'dumpster' && Math.random() < dt * 8) this.audio.playRummage();
      if (this.actionProgress >= 1) {
        this.actionProgress = 0;
        if (action.kind === 'dumpster') this.completeRummage(action.target);
        else if (action.kind === 'sleep') this.completeSleep(action.target);
      }
    } else {
      this.actionProgress = Math.max(0, this.actionProgress - dt * 2.5);
    }
    action.progress = this.actionProgress;
    action.time = Math.max(0.0001, action.time);
    // Keep the label's progress in sync for the HUD.
    this.currentAction.progress = this.actionProgress;
  }

  completeRummage(dumpster) {
    dumpster.rummaged = true;
    this.actionTarget = null;
    this.actionProgress = 0;
    const s = this.survival;
    const roll = Math.random();
    const topY = dumpster.y;
    const cx = dumpster.x + dumpster.w / 2;

    if (roll < 0.52) {
      const type = Math.random() < 0.55 ? 'scraps' : 'fishBones';
      const res = s.eat(type);
      this.eatingTimer = 1.2;
      this.audio.playEat();
      this.particles.crumbs(cx, topY - 10, 8);
      this.hud.toast(`Found ${res.label.toLowerCase()} +${res.absorbed} hunger`, 'good');
      this.hud.floater(`+${res.absorbed}`, cx, topY - 30, 'good');
    } else if (roll < 0.68) {
      this.world.spawn(new Food(cx, topY, 'milk'));
      this.audio.playPickup();
      this.particles.sparkle(cx, topY - 14, 8);
      this.hud.toast('A whole milk carton!', 'good');
    } else if (roll < 0.82) {
      this.hud.toast('Just soggy cardboard…', 'info');
      this.audio.playRummage();
    } else {
      // A rat bolts out — free dinner if you can catch it.
      this.world.spawn(new (this.world.entities.find((e) => e.kind === 'mouse')?.constructor || Food)(cx, topY, 'mouse'));
      this.hud.toast('Something is moving in there!', 'info');
      this.audio.playBark(0, 1);
    }

    // Noise draws attention.
    for (const e of this.world.entities) {
      if (e.kind === 'dog' && Math.abs(e.cx - cx) < 520) {
        e.state = 'chase';
        e.alert = 1;
        e.loseTimer = 3.5;
        this.hud.toast('A dog heard that', 'bad');
        break;
      }
    }
  }

  completeSleep(spot) {
    this.cat.startSleep();
    this.audio.playSleep();
    this.hud.toast(spot.type === 'vent' ? 'Warm air from the vent…' : 'Curled up in the box', 'good');
    this.haptic(20);
  }

  updatePickups(dt) {
    const cat = this.cat;
    if (cat.sleeping) return;
    for (const e of this.world.entities) {
      if (e.kind === 'goldfish' && !e.dead) {
        if (Math.abs(e.cx - cat.centerX) < 34 && Math.abs(e.cy - cat.centerY) < 42) {
          e.dead = true;
          this.quests.onGoldFish();
          this.audio.playPickup();
          this.particles.sparkle(e.cx, e.cy, 16, '#ffe08a');
          this.hud.floater('GOLDEN FISH', e.cx, e.cy - 16, 'good');
          this.hud.toast(`Golden fish ${this.quests.goldFish}/${QUEST.goldFishToUnlock}`, 'good');
          this.addShake(3, 0.18);
        }
        continue;
      }
      if (e.kind !== 'food' || e.dead) continue;
      if (Math.abs(e.cx - cat.centerX) < 30 && Math.abs(e.cy - cat.centerY) < 34) {
        e.dead = true;
        const res = this.survival.eat(e.type);
        this.eatingTimer = 1.1;
        this.audio.playEat();
        this.particles.crumbs(e.cx, e.cy, 9);
        this.particles.sparkle(e.cx, e.cy - 6, 5);
        this.hud.floater(`+${res.absorbed}`, e.cx, e.cy - 18, 'good');
        this.hud.toast(`Ate ${res.label.toLowerCase()} (+${res.absorbed})`, 'good');
      }
    }
  }

  updateToxins(dt) {
    const cat = this.cat;
    const toxic = this.world.toxicAt(cat.centerX, cat.feetY);
    if (!toxic) return;
    this.survival.damage(HAZARD.toxicDps * dt, 'toxic waste');
    if (this.survival.health <= 0) { this.onDeath('toxic waste'); return; }
    this.toxinSound -= dt;
    if (this.toxinSound <= 0) {
      this.toxinSound = 0.7;
      this.audio.playHurt();
      this.hud.toast('Toxic runoff — get out of it!', 'bad');
      this.haptic(15);
    }
    if (Math.random() < dt * 12) {
      this.particles.splash(cat.centerX, cat.feetY, 2, 'rgba(120, 255, 150, 0.7)');
    }
    cat.vx *= 0.9;
  }

  // ------------------------------------------------------------- events ----

  damageCat(amount, cause, x, y) {
    if (!this.survival.alive) return;
    if (this.cat.iframes > 0) return;
    const dealt = this.survival.damage(amount, cause);
    if (dealt <= 0) return;
    this.cat.hurtFlash = 1;
    this.audio.playHurt();
    this.haptic(45);
    this.addShake(10, 0.3);
    this.particles.sparkle(x ?? this.cat.centerX, y ?? this.cat.centerY, 7, '#ff8a95');
    this.hud.floater(`-${Math.round(dealt)}`, this.cat.centerX, this.cat.y - 10, 'bad');
    if (!this.survival.alive) this.onDeath(cause);
  }

  onCarHit(car) {
    if (this.cat.iframes > 0) return;
    const dir = Math.sign(this.cat.centerX - car.cx) || 1;
    this.cat.hurt(dir * HAZARD.carKnockback, -300);
    this.cat.iframes = 1.1;
    this.damageCat(HAZARD.carDamage, 'traffic', this.cat.centerX, this.cat.centerY);
    this.cat.hurtFlash = 1;
    this.particles.sparkle(this.cat.centerX, this.cat.centerY, 12, '#ffd08a');
    this.addShake(18, 0.55);
    this.audio.playHorn(0);
  }

  onCarTelegraph(dir) {
    this.carWarning = { dir, life: 1.4 };
  }

  onCatJump() {
    this.haptic(6);
  }

  onCatchMouse(mouse) {
    const res = this.survival.eat('mouse');
    this.eatingTimer = 1.2;
    this.audio.playEat();
    this.particles.crumbs(mouse.cx, mouse.cy, 7);
    this.hud.floater(`+${res.absorbed}`, mouse.cx, mouse.cy - 16, 'good');
    this.hud.toast('Caught a mouse!', 'good');
  }

  onHumanFeed(human) {
    const x = human.cx + 26;
    const f = new Food(x, GROUND_Y, 'sandwich');
    this.world.entities.push(f);
    this.audio.playMeow({ pitch: 1.2 });
    this.particles.hearts(human.cx, human.y - 6);
    this.hud.toast('A kind stranger left you a sandwich', 'good');
  }

  onDeath(cause) {
    if (this.state !== 'playing') return;
    this.survival.causeOfDeath = cause || this.survival.causeOfDeath;
    this.cat.dead = true;
    this.cat.sleeping = false;
    this.audio.playDeath();
    this.haptic([30, 60, 120]);
    this.addShake(14, 0.6);
    const s = this.survival;
    const record = s.day > this.records.bestDay ||
      (s.day === this.records.bestDay && s.foodCollected > this.records.bestFood);
    this.isNewRecord = record && s.day > 0;
    if (record) {
      this.records.bestDay = s.day;
      this.records.bestFood = s.foodCollected;
      this.records.bestDistance = Math.max(this.records.bestDistance, Math.round(s.distance));
      this.saveRecords();
    }
    this.state = 'dying';
    this.deathTimer = 1.6;
  }

  addShake(mag, time) {
    this.shake.mag = Math.max(this.shake.mag, mag);
    this.shake.t = time;
    this.shake.total = time;
  }

  // ------------------------------------------------------------- render ---

  render() {
    const ctx = this.ctx;
    // The main loop owns the device transform and clears the letterbox bars.
    if (this.state === 'title') return this.screens.frame(ctx, (c) => this.screens.drawTitle(c));
    if (this.state === 'help') return this.screens.frame(ctx, (c) => this.screens.drawHelp(c));
    if (this.state === 'settings') return this.screens.frame(ctx, (c) => this.screens.drawSettings(c));
    if (this.state === 'about') return this.screens.frame(ctx, (c) => this.screens.drawAbout(c));

    this.drawWorld(ctx);

    if (this.state === 'playing') {
      this.input.setButtons(this.showTouch ? this.hud.buttons(this) : []);
      this.hud.draw(ctx, this);
      this.drawCarWarning(ctx);
    }

    if (this.state === 'dying') {
      const a = clamp((1.6 - this.deathTimer) / 1.6, 0, 1);
      ctx.save();
      ctx.fillStyle = `rgba(40, 4, 10, ${a * 0.55})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      text(ctx, '…', VIEW_W / 2, VIEW_H / 2, { size: 40, weight: 800, align: 'center', color: `rgba(255,220,220,${a})` });
      ctx.restore();
    }

    if (this.state === 'paused') this.screens.frame(ctx, (c) => this.screens.drawPause(c));
    if (this.state === 'dead') this.screens.frame(ctx, (c) => this.screens.drawGameOver(c));
  }

  drawWorld(ctx) {
    const { world, survival, background, cat, particles } = this;
    const cam = { x: this.camera.x - this.shake.x, y: -this.shake.y };

    background.drawSky(ctx, { survival, world, camera: cam });
    background.drawCity(ctx, { world, camera: cam, survival });

    ctx.save();
    ctx.translate(-cam.x, cam.y);

    // Traffic sits behind the cat so the cat stays readable.
    for (const e of world.entities) {
      if (e.kind !== 'car' || e.dead) continue;
      e.draw(ctx, { darkness: survival.darkness, rainAmount: world.rainAmount });
    }
    for (const e of world.entities) {
      if (e.kind === 'car' || e.dead) continue;
      e.draw(ctx, { darkness: survival.darkness, rainAmount: world.rainAmount });
    }

    cat.draw(ctx, { darkness: survival.darkness, rainAmount: world.rainAmount });
    particles.draw(ctx);
    ctx.restore();

    background.drawWeather(ctx, { world, survival, camera: cam });
    background.drawLighting(ctx, { world, survival, camera: cam, cat });
  }

  drawCarWarning(ctx) {
    const w = this.carWarning;
    if (w.life <= 0) return;
    const a = clamp(w.life / 1.4, 0, 1) * (0.5 + Math.sin(this.time * 12) * 0.3);
    ctx.save();
    ctx.globalAlpha = a;
    const x = w.dir > 0 ? 26 : VIEW_W - 26;
    const dir = w.dir > 0 ? 1 : -1;
    ctx.fillStyle = 'rgba(255, 80, 90, 0.18)';
    fillRound(ctx, x - 30, VIEW_H / 2 - 46, 60, 92, 14, 'rgba(255, 80, 90, 0.16)');
    ctx.strokeStyle = 'rgba(255, 110, 120, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      const ox = x + dir * (6 + i * 12);
      ctx.moveTo(ox + dir * 8, VIEW_H / 2 - 16);
      ctx.lineTo(ox - dir * 4, VIEW_H / 2);
      ctx.lineTo(ox + dir * 8, VIEW_H / 2 + 16);
    }
    ctx.stroke();
    ctx.restore();
  }
}
