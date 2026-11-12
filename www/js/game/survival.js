/**
 * Survival stats: hunger, health, energy + time-of-day bookkeeping.
 * Pure logic with no rendering, so balance tweaks stay in one place.
 */
import { SURVIVAL, PHYS, DAY_LENGTH, FOOD_VALUE } from '../config.js';
import { clamp, lerp } from '../core/rng.js';

export const FOOD_TYPES = {
  fishBones: { label: 'Fish bones', value: FOOD_VALUE.fishBones, color: '#cfd8e6' },
  scraps: { label: 'Garbage scraps', value: FOOD_VALUE.scraps, color: '#b9a06a' },
  sandwich: { label: 'Sandwich', value: FOOD_VALUE.sandwich, color: '#e6c07a' },
  mouse: { label: 'Mouse', value: FOOD_VALUE.mouse, color: '#9aa4b2' },
  milk: { label: 'Milk', value: FOOD_VALUE.milk, color: '#f2f4ff' }
};

export class Survival {
  constructor() {
    this.reset();
  }

  reset() {
    this.hunger = 78;
    this.health = 100;
    this.energy = 100;
    this.dayTime = 0.36; // start mid-morning
    this.day = 1;
    this.alive = true;
    this.causeOfDeath = '';
    this.foodEaten = 0;
    this.foodCollected = 0;
    this.distance = 0;
    this.timeSurvived = 0;
    this.sleeping = false;
    this.sleepQuality = 0;
  }

  /** 0 (midnight) .. 1 (next midnight); 0.25 = dawn, 0.5 = noon, 0.75 = dusk. */
  get timeOfDay() { return this.dayTime % 1; }
  get isNight() { return this.timeOfDay > 0.78 || this.timeOfDay < 0.22; }
  get isDusk() { return this.timeOfDay > 0.68 && this.timeOfDay <= 0.78; }
  get isDawn() { return this.timeOfDay >= 0.22 && this.timeOfDay < 0.32; }

  /** Darkness 0..1 used by rendering and hazard tuning. */
  get darkness() {
    const t = this.timeOfDay;
    if (t < 0.2) return 1;
    if (t < 0.32) return lerp(1, 0, (t - 0.2) / 0.12);
    if (t < 0.68) return 0;
    if (t < 0.8) return lerp(0, 1, (t - 0.68) / 0.12);
    return 1;
  }

  get starving() { return this.hunger <= 0; }
  get exhausted() { return this.energy <= 0; }
  get healthFraction() { return clamp(this.health / SURVIVAL.maxStat, 0, 1); }

  /**
   * @param {number} dt seconds
   * @param {{moving:boolean, sprinting:boolean, climbing:boolean, raining:number, sleeping:boolean}} c
   * @returns {Array<{type:string, amount?:number}>} events for the game to react to
   */
  update(dt, c) {
    const events = [];
    if (!this.alive) return events;

    this.timeSurvived += dt;
    this.sleeping = !!c.sleeping;

    // Time runs faster while the cat sleeps — a rest costs part of a day.
    const timeScale = c.sleeping ? 3.2 : 1;
    const prevDay = this.dayTime;
    this.dayTime += (dt * timeScale) / DAY_LENGTH;
    if (this.dayTime >= 1) {
      this.dayTime -= 1;
      this.day++;
      events.push({ type: 'newday' });
    }
    if (prevDay < 0.78 && this.dayTime >= 0.78 && this.dayTime < 0.9) events.push({ type: 'nightfall' });
    if (prevDay < 0.22 && this.dayTime >= 0.22) events.push({ type: 'dawn' });

    // Hunger: faster when active, in the rain, or cold at night.
    let hungerDrain = SURVIVAL.hungerDrain;
    if (c.sprinting) hungerDrain += SURVIVAL.hungerDrainSprint;
    if (c.raining > 0.4) hungerDrain += SURVIVAL.hungerDrainRain;
    if (this.isNight) hungerDrain += SURVIVAL.hungerDrainCold;
    if (c.sleeping) hungerDrain = SURVIVAL.sleepHungerDrain;
    this.hunger = clamp(this.hunger - hungerDrain * dt * timeScale, 0, SURVIVAL.maxStat);

    // Energy.
    if (c.sleeping) {
      this.energy = clamp(this.energy + SURVIVAL.sleepEnergyRegen * dt, 0, 100);
    } else if (c.climbing) {
      this.energy = clamp(this.energy - PHYS.clawStaminaDrain * dt, 0, 100);
    } else {
      if (c.sprinting) this.energy -= SURVIVAL.energyDrainSprint * dt;
      else if (!c.moving) this.energy += SURVIVAL.energyRegenResting * dt;
      else this.energy += SURVIVAL.energyRegen * 0.45 * dt;
    }
    this.energy = clamp(this.energy, 0, 100);

    // Health: starvation and slow natural recovery when well fed.
    if (this.hunger <= 0) {
      this.health -= SURVIVAL.starveDamage * dt * (c.sleeping ? 1.4 : 1);
      events.push({ type: 'starving' });
    } else if (this.hunger > SURVIVAL.healthRegenHungerFloor && !c.sleeping) {
      this.health += SURVIVAL.healthRegen * dt;
    }
    this.health = clamp(this.health, 0, 100);

    if (this.health <= 0 && this.alive) {
      this.alive = false;
      this.causeOfDeath = this.hunger <= 0 ? 'starvation' : this.causeOfDeath || 'the city';
      events.push({ type: 'death', cause: this.causeOfDeath });
    }
    return events;
  }

  /** Feeding. Returns the food value actually absorbed. */
  eat(foodKey) {
    const food = FOOD_TYPES[foodKey] || FOOD_TYPES.scraps;
    const before = this.hunger;
    this.hunger = clamp(this.hunger + food.value, 0, 100);
    this.foodEaten++;
    this.foodCollected++;
    this.health = clamp(this.health + 3, 0, 100);
    return { absorbed: Math.round(this.hunger - before), label: food.label, food };
  }

  collectFood() { this.foodCollected++; }

  damage(amount, cause = 'the city') {
    if (!this.alive) return 0;
    const dealt = Math.min(this.health, amount);
    this.health -= dealt;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.causeOfDeath = cause;
    }
    return dealt;
  }

  heal(amount) { this.health = clamp(this.health + amount, 0, 100); }

  /** Waking up costs a little warmth, but restores clarity. */
  wake() {
    this.sleeping = false;
  }

  /** Human-readable stat summary for the game-over card. */
  summary() {
    return {
      day: this.day,
      food: this.foodCollected,
      distance: Math.max(0, Math.round(this.distance)),
      cause: this.causeOfDeath,
      time: formatTime(this.timeSurvived)
    };
  }
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Clock label, e.g. "03:40". */
export function clockLabel(dayTime) {
  const totalMinutes = Math.floor(dayTime * 24 * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(Math.floor(m / 5) * 5).padStart(2, '0')}`;
}

export function timePhaseLabel(survival) {
  const t = survival.timeOfDay;
  if (t < 0.22) return 'Deep night';
  if (t < 0.32) return 'Dawn';
  if (t < 0.5) return 'Morning';
  if (t < 0.68) return 'Afternoon';
  if (t < 0.78) return 'Dusk';
  return 'Night';
}
