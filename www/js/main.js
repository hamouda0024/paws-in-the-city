/**
 * Boot: canvas sizing (letterboxed 960x540 virtual view), input mapping,
 * settings load, and the frame loop.
 */
import { VIEW_W, VIEW_H, SETTINGS_KEY, setViewport } from './config.js';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { Game } from './game/game.js';
import { setLang, lang, isRTL } from './core/i18n.js';

function applyDocumentLanguage() {
  document.documentElement.lang = lang();
  document.documentElement.dir = isRTL() ? 'rtl' : 'ltr';
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
ctx.imageSmoothingEnabled = true;

function loadSettings() {
  const defaults = { sound: true, haptics: true, touch: 'auto', lighting: 'high', language: 'auto' };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch { return defaults; }
}

window.addEventListener('urbanstray:language', applyDocumentLanguage);

const settings = loadSettings();

// 'auto' follows the device language; the canvas text direction follows it too.
setLang(settings.language);
applyDocumentLanguage();

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

/**
 * Safe-area probe. Reading env(safe-area-inset-*) from CSS is the only way to
 * get notches/rounded corners into canvas space; the values are converted to
 * virtual units on every resize so the HUD can keep taps away from them.
 */
const safeProbe = document.createElement('div');
safeProbe.setAttribute('aria-hidden', 'true');
safeProbe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;' +
  'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
document.body.appendChild(safeProbe);

function readSafeInsets() {
  const cs = window.getComputedStyle(safeProbe);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0
  };
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = Math.max(1, rect.width);
  const cssH = Math.max(1, rect.height);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);

  // Full-bleed: a fixed 540-unit tall world whose width follows the screen, so
  // the city covers every pixel of the phone — no bars, no blurry side gutters.
  const aspect = cssW / cssH;
  const vw = setViewport(VIEW_H * aspect);
  const scale = Math.max(cssW / vw, cssH / VIEW_H);
  view.scale = scale;
  view.ox = (cssW - vw * scale) / 2;
  view.oy = (cssH - VIEW_H * scale) / 2;
  view.cssW = cssW;
  view.cssH = cssH;
  view.dpr = dpr;

  // Safe-area insets in virtual units, for HUD/button placement.
  const insets = readSafeInsets();
  const toVirtualUnits = (px) => Math.round((px / scale) * 10) / 10;
  view.safe = {
    top: toVirtualUnits(insets.top),
    right: toVirtualUnits(insets.right),
    bottom: toVirtualUnits(insets.bottom),
    left: toVirtualUnits(insets.left)
  };
  game.safeInsets = view.safe;

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

  // The virtual view covers the whole buffer, so one clear is enough.
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
// Layout can change without a window resize event (fullscreen, keyboard, split
// screen, an embedded webview). Re-measure whenever the canvas box changes.
if (window.ResizeObserver) {
  new ResizeObserver(() => resize()).observe(canvas);
}

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
