import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mulberry32, clamp, lerp, invLerp, smoothstep, randRange, randInt, pick,
  approach, damp, aabb, dist2, rgba, mixHex
} from '../www/js/core/rng.js';

test('mulberry32 is deterministic for a seed and stays in [0, 1)', () => {
  const a = mulberry32(1234);
  const b = mulberry32(1234);
  const first = [a(), a(), a()];
  const second = [b(), b(), b()];
  assert.deepEqual(first, second);

  const rand = mulberry32(99);
  for (let i = 0; i < 500; i++) {
    const v = rand();
    assert.ok(v >= 0 && v < 1, `value out of range: ${v}`);
  }
});

test('mulberry32 differs between seeds', () => {
  const first = mulberry32(1)();
  const second = mulberry32(2)();
  assert.notEqual(first, second);
});

test('mulberry32 spreads across the unit interval', () => {
  const rand = mulberry32(2026);
  let sum = 0;
  for (let i = 0; i < 2000; i++) sum += rand();
  const mean = sum / 2000;
  assert.ok(mean > 0.45 && mean < 0.55, `mean was ${mean}`);
});

test('clamp bounds both sides and passes values through', () => {
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(50, 0, 10), 10);
  assert.equal(clamp(5, 0, 10), 5);
});

test('lerp, invLerp and smoothstep agree at the endpoints', () => {
  assert.equal(lerp(10, 20, 0), 10);
  assert.equal(lerp(10, 20, 1), 20);
  assert.equal(lerp(10, 20, 0.5), 15);

  assert.equal(invLerp(0, 10, 5), 0.5);
  assert.equal(invLerp(4, 4, 4), 0, 'degenerate range returns 0');

  assert.equal(smoothstep(0), 0);
  assert.equal(smoothstep(1), 1);
  assert.ok(smoothstep(0.5) > 0.49 && smoothstep(0.5) < 0.51);
});

test('randRange and randInt respect their bounds', () => {
  const rand = mulberry32(7);
  for (let i = 0; i < 300; i++) {
    const v = randRange(rand, -3, 4);
    assert.ok(v >= -3 && v < 4, `randRange out of range: ${v}`);
    const n = randInt(rand, 1, 6);
    assert.ok(Number.isInteger(n) && n >= 1 && n <= 6, `randInt out of range: ${n}`);
  }
});

test('randInt reaches both ends of the range', () => {
  const rand = mulberry32(42);
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(randInt(rand, 0, 2));
  assert.deepEqual([...seen].sort(), [0, 1, 2]);
});

test('pick returns an element of the array', () => {
  const rand = mulberry32(3);
  const items = ['a', 'b', 'c'];
  for (let i = 0; i < 100; i++) assert.ok(items.includes(pick(rand, items)));
});

test('approach never overshoots its target', () => {
  assert.equal(approach(0, 10, 3), 3);
  assert.equal(approach(9, 10, 3), 10);
  assert.equal(approach(10, 0, 4), 6);
  assert.equal(approach(5, 5, 1), 5);
});

test('damp converges and is frame-rate independent', () => {
  const oneStep = damp(0, 100, 0.5, 1);
  assert.ok(oneStep > 0 && oneStep < 100);

  let slow = 0;
  for (let i = 0; i < 120; i++) slow = damp(slow, 100, 0.001, 1 / 60);
  let fast = 0;
  for (let i = 0; i < 60; i++) fast = damp(fast, 100, 0.001, 1 / 30);
  assert.ok(Math.abs(slow - fast) < 1, `slow=${slow} fast=${fast}`);
  assert.ok(slow > 99);
});

test('aabb detects overlap and touching edges', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  assert.equal(aabb(a, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(aabb(a, { x: 20, y: 0, w: 5, h: 5 }), false);
  assert.equal(aabb(a, { x: 10, y: 0, w: 5, h: 5 }), false, 'touching edges do not overlap');
});

test('dist2 is the squared distance and stays non-negative', () => {
  assert.equal(dist2(0, 0, 3, 4), 25);
  assert.equal(dist2(2, 2, 2, 2), 0);
  assert.ok(dist2(-5, 1, 5, 1) === 100);
});

test('rgba converts hex to an rgba string', () => {
  assert.equal(rgba('#ff0000'), 'rgba(255,0,0,1)');
  assert.equal(rgba('#00ff80', 0.5), 'rgba(0,255,128,0.5)');
});

test('mixHex interpolates between colours', () => {
  assert.equal(mixHex('#000000', '#ffffff', 0), '#000000');
  assert.equal(mixHex('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
});
