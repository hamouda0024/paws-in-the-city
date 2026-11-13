/** Canvas drawing helpers: rounded shapes, soft glows and text with the game's type style. */

import { dir, isRTL } from './i18n.js';

const glowCache = new Map();

/** Latin UI stack plus Arabic faces; harmless fallbacks for English text. */
export const UI_FAMILY = 'ui-rounded, "Trebuchet MS", "Segoe UI", "Noto Naskh Arabic", "Geeza Pro", system-ui, sans-serif';

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function fillRound(ctx, x, y, w, h, r, fill) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A radial light blob, drawn with 'lighter' blending. Cheaper than a real shadow blur. */
export function radialGlow(ctx, x, y, radius, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color.replace('ALPHA', String(alpha)));
  g.addColorStop(0.45, color.replace('ALPHA', String(alpha * 0.35)));
  g.addColorStop(1, color.replace('ALPHA', '0'));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
}

export function text(ctx, str, x, y, {
  size = 16,
  weight = 600,
  color = '#eaf2ff',
  align = 'left',
  baseline = 'alphabetic',
  family = UI_FAMILY,
  shadow = 0,
  letterSpacing = 0,
  direction = null
} = {}) {
  // Shape Arabic right-to-left; letter-spacing would break the joins.
  // Latin-only strings (numbers, key names, copyright) can force direction: 'ltr'
  // so bidi cannot reorder them inside an Arabic layout.
  const rtl = isRTL();
  ctx.direction = direction || dir();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (letterSpacing && !rtl && 'letterSpacing' in ctx) ctx.letterSpacing = `${letterSpacing}px`;
  if (shadow > 0) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = shadow;
    ctx.shadowOffsetY = 2;
    ctx.fillText(str, x, y);
    ctx.restore();
  } else {
    ctx.fillText(str, x, y);
  }
  if (letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

export function measure(ctx, str, size, weight = 600) {
  ctx.font = `${weight} ${size}px ${UI_FAMILY}`;
  return ctx.measureText(str).width;
}

export { glowCache };
