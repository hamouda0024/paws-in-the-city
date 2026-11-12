/**
 * Boot: canvas sizing (letterboxed 960x540 virtual view), input mapping,
 * settings load, and the frame loop.
 */
import { VIEW_W, VIEW_H, SETTINGS_KEY } from './config.js';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { Game } from './game/game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
ctx.imageSmoothingEnabled = true;

function loadSettings() {
  const defaults = { sound: true, haptics: true, touch: 'auto' };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch { return defaults; }
}

const settings = loadSettings();
const audio = new AudioEngine(settings);

// Shared view transform, used by both the renderer and pointer mapping.
const view = { scale: 1, ox: 0, oy: 0, cssW: 0, cssH: 0, dpr: 1 };

function toVirtual(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left - view.ox) / view.scale;
  const y = (clientY - rect.top - view.oy) / view.scale;
  return {
    x: Math.max(0, Math.min(VIEW_W, x)),
    y: Math.max(0, Math.min(VIEW_H, y))
  };
}

const input = new Input(canvas, toVirtual);
const game = new Game({ canvas, ctx, input, audio, settings });

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = rect.width;
  const cssH = rect.height;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  // Letterbox: keep the 16:9 virtual view fully visible on any screen.
  const scale = Math.min(cssW / VIEW_W, cssH / VIEW_H);
  view.scale = scale;
  view.ox = (cssW - VIEW_W * scale) / 2;
  view.oy = (cssH - VIEW_H * scale) / 2;
  view.cssW = cssW;
  view.cssH = cssH;
  view.dpr = dpr;

  // Match the page background to the letterbox so bars look intentional.
  document.body.style.background = '#05080f';
}

function applyTransform() {
  const { scale, ox, oy, dpr } = view;
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);
}

let last = performance.now();
let acc = 0;
let frames = 0;

function frame(now) {
  const raw = (now - last) / 1000;
  last = now;
  // Clamp huge hitches (tab switches, GC) so physics never tunnels.
  const dt = Math.min(raw, 1 / 24);

  game.update(dt);

  // Clear the full device buffer (letterbox bars included), then draw in virtual space.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05080f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  applyTransform();
  game.render();

  frames++;
  acc += raw;
  if (acc > 5) { acc = 0; frames = 0; }

  requestAnimationFrame(frame);
}

// --- lifecycle -------------------------------------------------------------

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// Resume audio only after a real gesture (browser autoplay rules).
const unlock = () => {
  audio.unlock();
  if (settings.sound) audio.setSound(true);
};
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

// Pause when the app goes to the background.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') game.pause();
  if (!document.hidden) {
    last = performance.now();
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
  }
});

// Block Android WebView context menus / text selection gestures on the canvas.
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

resize();
applyTransform();
requestAnimationFrame(frame);

// Handy for debugging in a desktop browser console.
window.__urbanStray = { game, input, audio, view };
