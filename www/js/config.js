/**
 * Global tuning constants for Urban Stray.
 * All gameplay values live here so balance can be tuned without touching systems.
 * World coordinates are in a fixed 960x540 "virtual view" (CSS pixels are scaled to fit).
 */

export const VIEW_W = 960;
export const VIEW_H = 540;

/** Street surface the cat walks on. */
export const GROUND_Y = 470;
/** Platform tier heights, from street to rooftop. Each is reachable with one good jump. */
export const TIERS = { street: GROUND_Y, dumpster: 402, awning: 334, balcony: 266, roof: 190 };

export const PHYS = {
  walkSpeed: 152,
  sprintSpeed: 268,
  accelGround: 1500,
  accelAir: 820,
  frictionGround: 1900,
  frictionAir: 260,
  gravity: 1580,
  /** Lower gravity while ascending with jump held = variable jump height. */
  gravityHold: 1120,
  jumpVelocity: 505,
  /** Extra oomph when jumping out of a sprint. */
  pounceBoost: 1.1,
  coyoteTime: 0.1,
  jumpBuffer: 0.13,
  /** Clawing a wall slows the fall instead of stopping it. */
  clawFallSpeed: 110,
  clawStaminaDrain: 8,
  maxFallSpeed: 980,
  fallDamageThreshold: 720,
  terminalLandVelocity: 1200,
  stepDustSpeed: 130
};

export const SURVIVAL = {
  hungerDrain: 0.5,
  hungerDrainSprint: 0.32,
  hungerDrainRain: 0.12,
  hungerDrainCold: 0.1,
  energyDrainSprint: 13,
  energyDrainJump: 3.5,
  energyRegen: 4.2,
  energyRegenResting: 7.5,
  sleepEnergyRegen: 46,
  sleepHungerDrain: 0.75,
  starveDamage: 2.6,
  exhaustedSpeedScale: 0.78,
  healthRegen: 0.65,
  healthRegenHungerFloor: 55,
  maxStat: 100
};

export const HAZARD = {
  carDamage: 30,
  carKnockback: 340,
  carSpeedMin: 210,
  carSpeedMax: 330,
  dogDamage: 16,
  dogKnockback: 190,
  dogSpeedChase: 158,
  dogSpeedPatrol: 46,
  dogSenseRadius: 250,
  dogBiteCooldown: 1.1,
  toxicDps: 11,
  iframeTime: 0.85,
  shooDamage: 5
};

export const FOOD_VALUE = {
  fishBones: 34,
  scraps: 24,
  sandwich: 42,
  mouse: 30,
  milk: 20
};

/** One full day (dawn -> day -> dusk -> night -> dawn) in seconds of real play. */
export const DAY_LENGTH = 168;

export const WEATHER = {
  dryMin: 48,
  dryMax: 96,
  rainMin: 24,
  rainMax: 52,
  rainFade: 4
};

export const COLORS = {
  ink: '#0b0f1a',
  night: '#070b16',
  catFur: '#e08b4a',
  catFurDark: '#b96b31',
  catCream: '#f6e3c8',
  catStripe: '#8a4a21',
  catEye: '#a8e05a',
  catNose: '#e97b8a',
  uiPanel: 'rgba(12, 18, 32, 0.82)',
  uiStroke: 'rgba(150, 200, 255, 0.28)',
  uiText: '#eaf2ff',
  uiDim: '#9db0cf',
  accent: '#ffb454',
  danger: '#ff5d6c',
  good: '#6ee7a8',
  energy: '#5cc9ff',
  hunger: '#ffb454'
};

export const SAVE_KEY = 'urban-stray-save-v1';
export const SETTINGS_KEY = 'urban-stray-settings-v1';

// ------------------------------------------------------- build & ownership --

/** Running build version. Bump together with www/version.json and the Gradle versionName. */
export const APP_VERSION = '1.1.0';

/** Public manifest used by the silent update check (override with window.__urbanStrayUpdateUrl). */
export const UPDATE_MANIFEST_URL =
  'https://raw.githubusercontent.com/hamouda0024/paws-in-the-city/main/www/version.json';

export const DOWNLOAD_PAGE_URL = 'https://github.com/hamouda0024/paws-in-the-city/releases';

export const OWNER_NAME = 'Zerguine Ahmed Islam';
export const OWNER_NAME_AR = 'زرقين أحمد إسلام';
export const COPYRIGHT = '© 2026 Zerguine Ahmed Islam. All rights reserved.';
export const COPYRIGHT_AR = 'حقوق الملكية محفوظة لـ زرقين أحمد إسلام (Zerguine Ahmed Islam)';
export const GAME_TITLE = 'Urban Stray';
