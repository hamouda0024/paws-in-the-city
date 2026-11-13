/**
 * Dynamic quests.
 *
 * Three objective types rotate through a run so there is always a reason to
 * move somewhere new:
 *   1. shelter  — a storm rolls in, find a box/vent and sleep through it
 *   2. stealth  — slip past a stray dog without waking it (crates help)
 *   3. goldfish — collect golden fish on the rooftops; enough of them unlocks
 *                 the double jump for the cat (persisted between runs)
 *
 * The system only *observes* the world (rain, dogs, pickups) — it never drives
 * physics, so a bug here can never trap the player.
 */
import { QUEST, VIEW_W, VIEW_H } from '../config.js';
import { clamp } from '../core/rng.js';
import { t } from '../core/i18n.js';

const ROTATION = ['shelter', 'stealth', 'goldfish'];

export class Quests {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.queue = [...ROTATION];
    this.active = null;
    this.timeLeft = 0;
    this.goldFish = 0;
    this.doubleJump = false;
    this.completedCount = 0;
    this.nextTimer = 6;
    this.stealthHold = 0;
    this.banner = '';
    this.bannerLife = 0;
    this.flash = 0;
  }

  /** Restore permanent progress from the save file. */
  restore(records) {
    this.goldFish = records.goldFish || 0;
    this.doubleJump = !!records.doubleJump;
  }

  get current() {
    return this.active;
  }

  start(id) {
    const game = this.game;
    this.active = { id, progress: 0, target: 0, label: '', hint: '' };
    this.timeLeft = id === 'shelter' ? QUEST.shelterWindow : QUEST.duration;
    this.stealthHold = 0;

    if (id === 'shelter') {
      this.active.label = 'Shelter before the storm';
      this.active.hint = 'Sleep in a box or on a warm vent';
      this.active.target = QUEST.shelterWindow;
      if (!game.world.raining) {
        // Force the weather so the quest is always playable.
        game.world.forcingRain = true;
      }
    } else if (id === 'stealth') {
      this.active.label = 'Sneak past a stray dog';
      this.active.hint = 'Stay quiet behind crates — do not get spotted';
      this.active.target = QUEST.stealthHold;
    } else {
      this.active.label = 'Golden fish on the rooftops';
      this.active.hint = `Collect ${QUEST.goldFishToUnlock} to learn the double jump`;
      this.active.target = QUEST.goldFishToUnlock;
      this.active.progress = Math.min(this.goldFish, QUEST.goldFishToUnlock);
    }
    this.banner = this.active.label;
    this.bannerLife = 2.6;
  }

  complete(quest) {
    const game = this.game;
    const s = game.survival;
    s.hunger = clamp(s.hunger + QUEST.rewardHunger, 0, 100);
    s.heal(QUEST.rewardHeal);
    game.hud.toast(t('toast.questDone', { label: quest.label }), 'good');
    game.hud.floater(`+${QUEST.rewardHunger} hunger`, game.cat.centerX, game.cat.y - 20, 'good');
    game.audio.playMotif?.(1);
    game.particles.sparkle(game.cat.centerX, game.cat.y - 10, 14, '#ffe08a');
    this.completedCount++;
    this.active = null;
    this.nextTimer = 8;
    this.queue = ROTATION.filter((id) => id !== quest.id || id === 'goldfish');
    this.flash = 1;
  }

  fail(reason) {
    const game = this.game;
    if (this.active?.id === 'shelter') game.world.forcingRain = false;
    game.hud.toast(reason, 'info');
    this.active = null;
    this.nextTimer = 7;
  }

  /** Called when the cat picks up a golden fish. */
  onGoldFish() {
    this.goldFish++;
    const records = this.game.records;
    records.goldFish = this.goldFish;
    if (this.active?.id === 'goldfish') {
      this.active.progress = Math.min(this.goldFish, QUEST.goldFishToUnlock);
      if (this.active.progress >= QUEST.goldFishToUnlock) this.unlockDoubleJump();
    } else if (this.goldFish >= QUEST.goldFishToUnlock && !this.doubleJump) {
      this.unlockDoubleJump();
    }
    this.game.saveRecords();
  }

  unlockDoubleJump() {
    if (this.doubleJump) return;
    this.doubleJump = true;
    this.game.records.doubleJump = true;
    this.game.saveRecords();
    this.game.cat.airJumps = 1;
    this.game.hud.toast('Double jump unlocked! Tap jump again in mid-air', 'good');
    this.game.particles.sparkle(this.game.cat.centerX, this.game.cat.centerY, 20, '#ffe9a8');
    this.game.audio.playMotif?.(1.3);
    if (this.active?.id === 'goldfish') {
      this.active.progress = this.active.target;
      // Completing the quest itself is handled on the next update tick.
    }
  }

  update(dt, game) {
    this.bannerLife = Math.max(0, this.bannerLife - dt);
    this.flash = Math.max(0, this.flash - dt * 1.6);

    if (!this.active) {
      this.nextTimer -= dt;
      if (this.nextTimer <= 0) {
        const id = this.queue.find((q) => q !== 'goldfish' || !this.doubleJump) || ROTATION[0];
        this.start(id);
      }
      return;
    }

    this.timeLeft = Math.max(0, this.timeLeft - dt);
    const q = this.active;

    if (q.id === 'shelter') {
      q.progress = Math.max(0, QUEST.shelterWindow - (QUEST.shelterWindow - q.progress)); // timer driven
      q.progress = clamp(this.timeLeft, 0, q.target);
      if (game.cat.sleeping && game.world.rainAmount > 0.2) {
        this.complete(q);
        game.world.forcingRain = false;
        return;
      }
      if (this.timeLeft <= 0 || (!game.world.raining && this.timeLeft < q.target - 4)) {
        this.fail('The storm passed — shelter found too late');
      }
    } else if (q.id === 'stealth') {
      let closest = null;
      let bestD = QUEST.stealthRadius;
      for (const e of game.world.entities) {
        if (e.kind !== 'dog' || e.dead) continue;
        const d = Math.abs(e.cx - game.cat.centerX);
        if (d < bestD) { bestD = d; closest = e; }
      }
      const unnoticed = closest && closest.state !== 'chase' && closest.alert < 0.5;
      if (unnoticed && !game.cat.sleeping) {
        this.stealthHold += dt;
        q.progress = clamp(this.stealthHold, 0, q.target);
        if (this.stealthHold >= q.target) { this.complete(q); return; }
      } else {
        this.stealthHold = Math.max(0, this.stealthHold - dt * 1.4);
        q.progress = clamp(this.stealthHold, 0, q.target);
        if (closest && closest.state === 'chase') {
          this.fail('You were spotted — the dog chased you off');
          return;
        }
      }
      if (this.timeLeft <= 0) this.fail('Too slow — the dog wandered off');
    } else {
      q.progress = Math.min(this.goldFish, q.target);
      if (q.progress >= q.target) {
        this.unlockDoubleJump();
        this.complete(q);
        return;
      }
      if (this.timeLeft <= 0) this.fail('The golden fish are still up there');
    }
  }
}
