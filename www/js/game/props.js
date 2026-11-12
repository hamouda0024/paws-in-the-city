/**
 * World props.
 *
 * Every climbable/interactable object in the city is ONE object here: it owns
 * its collision rectangle AND the code that draws exactly that rectangle, so
 * what you see and what you hit can never drift apart. `world.js` only places
 * them (always inside a building's footprint) and the renderer only asks a prop
 * to draw itself.
 *
 * Rules that keep the world honest:
 *  - `x/y/w/h` is the collision box; every draw call derives from it.
 *  - `oneWay` props are standable surfaces you can jump through from below.
 *  - `interact` marks the prop as usable ("Rummage the dumpster").
 *  - `bounds` is the owning building, used to assert/clamp placement.
 */
import { GROUND_Y } from '../config.js';
import { roundRect, ellipse } from '../core/draw.js';

export const PROP_KINDS = ['dumpster', 'awning', 'balcony', 'crate', 'roof', 'tank', 'steps'];

let nextPropId = 1;

export class Prop {
  constructor({ kind, x, y, w, h, oneWay = false, building = null, ...data }) {
    this.id = nextPropId++;
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.oneWay = oneWay;
    this.building = building;
    this.interact = null;
    Object.assign(this, data);
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  /** Top surface a cat stands on. */
  get top() { return this.y; }
  /** Interaction range is a rectangle, not a radius, so prompts never float. */
  get reach() {
    return { x: this.x - 34, y: this.y - 58, w: this.w + 68, h: this.h + 66 };
  }

  containsPoint(px, py, pad = 0) {
    return px >= this.x - pad && px <= this.x + this.w + pad &&
      py >= this.y - pad && py <= this.y + this.h + pad;
  }

  /** Single entry point used by the renderer. */
  draw(ctx, { darkness = 0 } = {}) {
    switch (this.kind) {
      case 'dumpster': return this.drawDumpster(ctx, darkness);
      case 'awning': return this.drawAwning(ctx);
      case 'balcony': return this.drawBalcony(ctx);
      case 'crate': return this.drawCrate(ctx);
      case 'roof': return this.drawRoofEdge(ctx);
      case 'tank': return this.drawTankPlatform(ctx);
      case 'steps': return this.drawSteps(ctx);
      default: return undefined;
    }
  }

  // ------------------------------------------------------------- dumpster ---

  drawDumpster(ctx, dark) {
    const { x, y, w, h } = this;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, this.rummaged ? '#37564f' : '#3f6b5f');
    g.addColorStop(1, '#223c39');
    ctx.fillStyle = g;
    roundRect(ctx, x, y + 6, w, h - 6, 4);
    ctx.fill();

    ctx.fillStyle = '#2c504a';
    roundRect(ctx, x - 4, y, w + 8, 12, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y + 2, w, 2);

    ctx.strokeStyle = 'rgba(10, 20, 18, 0.4)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + (w / 4) * i, y + 12);
      ctx.lineTo(x + (w / 4) * i, y + h - 6);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(240, 210, 120, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 14, y + h - 22);
    ctx.quadraticCurveTo(x + 26, y + h - 34, x + 34, y + h - 20);
    ctx.quadraticCurveTo(x + 40, y + h - 30, x + 50, y + h - 22);
    ctx.stroke();

    ctx.fillStyle = '#171d24';
    ctx.beginPath();
    ctx.arc(x + 16, y + h - 4, 6, 0, Math.PI * 2);
    ctx.arc(x + w - 16, y + h - 4, 6, 0, Math.PI * 2);
    ctx.fill();

    // Lootable glint so the player knows this is usable.
    if (!this.rummaged) {
      const t = (this.glint || 0) + 0.02;
      this.glint = t;
      const a = 0.35 + Math.sin(t * 2.2) * 0.25;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * (0.5 + dark * 0.5);
      ctx.fillStyle = 'rgba(255, 226, 150, 0.5)';
      ctx.beginPath();
      ctx.arc(x + w - 18, y + 14, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // --------------------------------------------------------------- awning ---

  drawAwning(ctx) {
    const { x, y, w } = this;
    for (let i = 0; i < Math.ceil(w / 22); i++) {
      ctx.fillStyle = i % 2 ? '#8c3f45' : '#d8c7a8';
      ctx.beginPath();
      ctx.moveTo(x + i * 22, y);
      ctx.lineTo(x + (i + 1) * 22, y);
      ctx.lineTo(x + (i + 1) * 22 + 2, y + 14);
      ctx.lineTo(x + i * 22 + 2, y + 14);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#8c3f45';
    for (let i = 0; i < Math.ceil(w / 22); i++) {
      ctx.beginPath();
      ctx.arc(x + i * 22 + 11, y + 15, 10, 0, Math.PI);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(40, 46, 58, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 16);
    ctx.lineTo(x + 6, y + 8);
    ctx.moveTo(x + w - 6, y + 16);
    ctx.lineTo(x + w - 6, y + 8);
    ctx.stroke();
    // Exactly the standable surface, drawn.
    ctx.strokeStyle = 'rgba(255, 245, 220, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x + w, y + 1);
    ctx.stroke();
  }

  // -------------------------------------------------------------- balcony ---

  drawBalcony(ctx) {
    const { x, y, w } = this;
    ctx.fillStyle = '#2a3344';
    ctx.fillRect(x, y + 2, w, 8);
    ctx.strokeStyle = 'rgba(150, 175, 205, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < w; i += 12) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + 2);
      ctx.lineTo(x + i, y - 18);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(170, 195, 225, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x + w, y - 18);
    ctx.stroke();
    ctx.fillStyle = '#4a3a2e';
    ctx.fillRect(x + 10, y - 14, 20, 12);
    ctx.fillStyle = 'rgba(110, 170, 110, 0.8)';
    ctx.beginPath();
    ctx.arc(x + 20, y - 18, 8, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3e3126';
    ctx.fillRect(x + w - 34, y - 14, 22, 12);
    ctx.fillStyle = 'rgba(150, 190, 120, 0.7)';
    ctx.beginPath();
    ctx.arc(x + w - 23, y - 18, 7, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  // ---------------------------------------------------------------- crate ---

  drawCrate(ctx) {
    const { x, y, w, h } = this;
    ctx.fillStyle = '#8a6136';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(60, 40, 20, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4);
    ctx.lineTo(x + w - 4, y + h - 4);
    ctx.moveTo(x + w - 4, y + 4);
    ctx.lineTo(x + 4, y + h - 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 230, 190, 0.12)';
    ctx.fillRect(x, y, w, 3);
  }

  // ------------------------------------------------------------ roof edge ---

  drawRoofEdge(ctx) {
    const { x, y, w, h } = this;
    ctx.fillStyle = 'rgba(12, 18, 28, 0.9)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(190, 208, 232, 0.28)';
    ctx.fillRect(x, y, w, 2.5);
    // Parapet lights make the standable line obvious at night.
    ctx.fillStyle = 'rgba(255, 210, 150, 0.5)';
    for (let i = 8; i < w - 6; i += 52) {
      ctx.fillRect(x + i, y - 1, 3, 2);
    }
  }

  // ------------------------------------------------------- water tank deck ---

  drawTankPlatform(ctx) {
    const { x, y, w, h } = this;
    ctx.fillStyle = '#4c3a2c';
    ctx.fillRect(x, y, w, h + 2);
    ctx.fillStyle = 'rgba(255, 240, 210, 0.16)';
    ctx.fillRect(x, y, w, 2);
  }

  // ---------------------------------------------------- stepped roof steps ---

  drawSteps(ctx) {
    const { x, y, w, h } = this;
    ctx.fillStyle = '#39445c';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(210, 225, 245, 0.25)';
    ctx.fillRect(x, y, w, 2);
    ctx.strokeStyle = 'rgba(12, 18, 30, 0.5)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < h / 8; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y + i * 8);
      ctx.lineTo(x + w, y + i * 8);
      ctx.stroke();
    }
  }
}

/** Street-level dumpster; the lowest rung of the rooftop climb. */
export function makeDumpster(building, x, topY, width = 88) {
  return new Prop({
    kind: 'dumpster',
    x,
    y: topY,
    w: width,
    h: GROUND_Y - topY,
    building,
    rummaged: false,
    interact: 'rummage'
  });
}

export function makeAwning(building, x, y, width = 138) {
  return new Prop({ kind: 'awning', x, y, w: width, h: 8, oneWay: true, building, interact: 'none' });
}

export function makeBalcony(building, x, y, width = 152) {
  return new Prop({ kind: 'balcony', x, y, w: width, h: 8, oneWay: true, building });
}

export function makeCrate(building, x, y, width = 54) {
  return new Prop({ kind: 'crate', x, y, w: width, h: GROUND_Y - y, building, interact: 'hide' });
}

export function makeRoof(building) {
  return new Prop({
    kind: 'roof',
    x: building.x + 6,
    y: building.roofY,
    w: building.w - 12,
    h: 10,
    oneWay: true,
    building
  });
}

export function makeTankPlatform(building, x, y, width = 96) {
  return new Prop({ kind: 'tank', x, y, w: width, h: 10, oneWay: true, building });
}

export function makeSteps(building, x, y, width = 84, height = 26) {
  return new Prop({ kind: 'steps', x, y, w: width, h: height, oneWay: true, building });
}

export { ellipse };
