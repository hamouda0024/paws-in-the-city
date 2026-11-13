import test from 'node:test';
import assert from 'node:assert/strict';

import {
  Survival, FOOD_TYPES, formatTime, clockLabel, timePhaseLabel
} from '../www/js/game/survival.js';
import { SURVIVAL, DAY_LENGTH, FOOD_VALUE } from '../www/js/config.js';

const idle = { moving: false, sprinting: false, climbing: false, raining: 0, sleeping: false };

/** Advances the sim in 1/60 s steps so behaviour matches a real frame loop. */
function run(survival, seconds, conditions = {}) {
  const c = { ...idle, ...conditions };
  const events = [];
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) events.push(...survival.update(step, c));
  return events;
}

test('a fresh run starts alive with full stats', () => {
  const s = new Survival();
  assert.equal(s.alive, true);
  assert.equal(s.health, 100);
  assert.equal(s.energy, 100);
  assert.equal(s.day, 1);
  assert.equal(s.hunger, 78);
  assert.equal(s.causeOfDeath, '');
  assert.equal(s.timeOfDay, 0.36);
});

test('hunger drains over time and faster while sprinting', () => {
  const idleRun = new Survival();
  run(idleRun, 10);
  const sprintRun = new Survival();
  run(sprintRun, 10, { sprinting: true, moving: true });

  assert.ok(idleRun.hunger < 78, 'hunger must fall');
  assert.ok(sprintRun.hunger < idleRun.hunger, 'sprinting must cost more hunger');
});

test('sleeping slows hunger and restores energy', () => {
  const s = new Survival();
  s.energy = 20;
  const awake = new Survival();
  awake.energy = 20;

  run(s, 5, { sleeping: true });
  run(awake, 5);

  assert.ok(s.energy > awake.energy, 'sleep restores energy faster');
  assert.ok(s.sleeping === true);
});

test('eating food feeds, heals slightly and counts the item', () => {
  const s = new Survival();
  s.hunger = 40;
  const result = s.eat('sandwich');

  assert.equal(result.absorbed, FOOD_VALUE.sandwich);
  assert.equal(result.label, FOOD_TYPES.sandwich.label);
  assert.equal(s.hunger, 40 + FOOD_VALUE.sandwich);
  assert.equal(s.foodCollected, 1);
  assert.equal(s.foodEaten, 1);
});

test('eating cannot overflow the stat cap', () => {
  const s = new Survival();
  s.hunger = 95;
  const result = s.eat('sandwich');
  assert.equal(s.hunger, 100);
  assert.equal(result.absorbed, 5);
});

test('unknown food keys fall back to scraps instead of throwing', () => {
  const s = new Survival();
  const result = s.eat('not-a-food');
  assert.equal(result.food, FOOD_TYPES.scraps);
});

test('starvation drains health and eventually kills with the starvation cause', () => {
  const s = new Survival();
  s.hunger = 0;
  const events = run(s, 60);

  assert.ok(s.health < 100, 'health must drop while starving');
  assert.ok(events.some((e) => e.type === 'starving'));

  run(s, 120);
  assert.equal(s.alive, false);
  assert.equal(s.causeOfDeath, 'starvation');
});

test('damage is capped at the remaining health and sets the cause', () => {
  const s = new Survival();
  assert.equal(s.damage(30, 'a stray dog'), 30);
  assert.equal(s.health, 70);

  assert.equal(s.damage(500, 'traffic'), 70);
  assert.equal(s.health, 0);
  assert.equal(s.alive, false);
  assert.equal(s.causeOfDeath, 'traffic');
  assert.equal(s.damage(10), 0, 'dead cats cannot take more damage');
});

test('heal clamps between 0 and the stat cap', () => {
  const s = new Survival();
  s.health = 90;
  s.heal(50);
  assert.equal(s.health, 100);
  s.health = 10;
  s.heal(-50);
  assert.equal(s.health, 0);
});

test('the day advances after a full day length and reports a new day', () => {
  const s = new Survival();
  s.dayTime = 0.999;
  const events = run(s, 2);
  assert.ok(events.some((e) => e.type === 'newday'), 'newday event expected');
  assert.equal(s.day, 2);
  assert.ok(s.dayTime < 0.1, 'clock wraps');
  assert.equal(DAY_LENGTH > 0, true);
});

test('nightfall and dawn events fire at their thresholds', () => {
  const s = new Survival();
  s.dayTime = 0.77;
  const duskEvents = run(s, 3);
  assert.ok(duskEvents.some((e) => e.type === 'nightfall'));

  const dawn = new Survival();
  dawn.dayTime = 0.21;
  const dawnEvents = run(dawn, 3);
  assert.ok(dawnEvents.some((e) => e.type === 'dawn'));
});

test('darkness peaks at midnight, is zero at noon and is continuous', () => {
  const s = new Survival();
  s.dayTime = 0;
  assert.equal(s.darkness, 1);
  s.dayTime = 0.5;
  assert.equal(s.darkness, 0);

  let previous = null;
  for (let i = 0; i <= 100; i++) {
    s.dayTime = i / 100;
    const value = s.darkness;
    assert.ok(value >= 0 && value <= 1, `darkness out of range at ${s.dayTime}`);
    if (previous !== null) {
      assert.ok(Math.abs(value - previous) < 0.2, `darkness jumped at ${s.dayTime}`);
    }
    previous = value;
  }
});

test('isNight, starving and exhausted flags follow the stats', () => {
  const s = new Survival();
  s.dayTime = 0.9;
  assert.equal(s.isNight, true);
  s.dayTime = 0.5;
  assert.equal(s.isNight, false);

  s.hunger = 0;
  assert.equal(s.starving, true);
  s.hunger = 30;
  assert.equal(s.starving, false);

  s.energy = 0;
  assert.equal(s.exhausted, true);
  s.energy = 20;
  assert.equal(s.exhausted, false);
});

test('summary reports the displayed run stats with a formatted time', () => {
  const s = new Survival();
  s.day = 4;
  s.foodCollected = 7;
  s.distance = 123.7;
  s.timeSurvived = 65;
  s.causeOfDeath = 'traffic';

  const summary = s.summary();
  assert.deepEqual(summary, {
    day: 4,
    food: 7,
    distance: 124,
    cause: 'traffic',
    time: '1:05'
  });
});

test('formatTime pads seconds and clockLabel rounds to five minutes', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(9), '0:09');
  assert.equal(formatTime(605), '10:05');

  assert.equal(clockLabel(0), '00:00');
  assert.equal(clockLabel(0.5), '12:00');
  assert.equal(clockLabel(0.51), '12:10', 'minutes snap down to five-minute steps');
  assert.equal(clockLabel(0.99), '23:45');
});

test('timePhaseLabel names every phase of the day', () => {
  const phases = [0.1, 0.25, 0.4, 0.6, 0.72, 0.9].map((timeOfDay) => timePhaseLabel({ timeOfDay }));
  assert.deepEqual(phases, ['Deep night', 'Dawn', 'Morning', 'Afternoon', 'Dusk', 'Night']);
});

test('death stops the simulation from draining stats further', () => {
  const s = new Survival();
  s.damage(100, 'a bad fall');
  const before = { hunger: s.hunger, health: s.health, time: s.timeSurvived };
  const events = run(s, 5);
  assert.deepEqual(events, []);
  assert.deepEqual({ hunger: s.hunger, health: s.health, time: s.timeSurvived }, before);
  assert.equal(SURVIVAL.maxStat, 100);
});
