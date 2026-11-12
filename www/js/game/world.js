/**
 * The city streams in horizontal chunks. Each chunk owns two buildings with a
 * climbable chain (dumpster -> awning -> balcony -> roof), an alley, loot,
 * sleep spots, and possibly a dog, a human or a mouse.
 *
 * Also owns weather, traffic and the world's solid-collider list.
 */
import { VIEW_W, GROUND_Y, TIERS, WEATHER, HAZARD } from '../config.js';
import { mulberry32, randRange, pick, clamp, approach, lerp } from '../core/rng.js';
import { Car, Dog, Human, Mouse, Food, RestSpot } from './entities.js';

export const CHUNK_W = 960;
const KEEP_BEHIND = 2;

export class World {
  constructor(seed = Date.now() % 100000) {
    this.seed = seed;
    this.reset();
  }

  reset(seed = this.seed) {
    this.seed = seed;
    this.chunks = new Map();
    this.solids = [];
    this.entities = [];
    this.puddles = [];
    this.buildings = [];
    this.entitiesById = new Map();
    this.leftLimit = 0;
    this.rightLimit = 1200;
    this.maxChunk = -1;
    this.minChunk = 0;
    this.rainAmount = 0;
    this.rainTarget = 0;
    this.raining = false;
    this.weatherTimer = randRange(Math.random, 38, 70);
    this.carTimer = 9;
    this.trafficDir = 1;
    this.trafficFlip = 26;
    this.carCount = 0;
    this.spawnX = 140;
    this.ambientTimer = 0;
    this.eveningStarted = false;

    this.ground = { x: -20000, y: GROUND_Y, w: 40000, h: 200, kind: 'street', oneWay: false };
    this.solids.push(this.ground);

    this.ensureChunks(0, { force: true });
    this.spawnX = this.findClearSpawn();
  }

  /** Walk forward from the starting corner until the cat fits without clipping a prop. */
  findClearSpawn() {
    const gap = 52;
    const h = 34;
    for (let x = 120; x < 1600; x += 24) {
      const box = { x: x - gap / 2, y: GROUND_Y - h, w: gap, h };
      let blocked = false;
      for (const s of this.solids) {
        if (s === this.ground) continue;
        if (box.x < s.x + s.w + 18 && box.x + box.w > s.x - 18 && s.y < GROUND_Y && s.y + s.h > GROUND_Y - h) {
          blocked = true;
          break;
        }
      }
      // Never start the run standing in runoff.
      for (const p of this.puddles) {
        if (box.x < p.x + p.w + 30 && box.x + box.w > p.x - 30) { blocked = true; break; }
      }
      if (!blocked) return x;
    }
    return 140;
  }

  // -------------------------------------------------------------- chunks ----

  ensureChunks(camX, { force = false } = {}) {
    const first = Math.max(0, Math.floor((camX - VIEW_W * 0.75) / CHUNK_W));
    const last = Math.floor((camX + VIEW_W * 1.6) / CHUNK_W);
    for (let i = first; i <= last; i++) {
      if (!this.chunks.has(i)) this.generateChunk(i);
    }
    if (force) return;

    // Recycle chunks far behind the camera.
    for (const [i, chunk] of [...this.chunks]) {
      if (i < first - KEEP_BEHIND) this.disposeChunk(chunk);
    }
  }

  disposeChunk(chunk) {
    const solidSet = new Set(chunk.solids);
    this.solids = this.solids.filter((s) => !solidSet.has(s) && s !== this.ground);
    this.solids.push(this.ground);
    const puddleSet = new Set(chunk.puddles);
    this.puddles = this.puddles.filter((p) => !puddleSet.has(p));
    const bSet = new Set(chunk.buildings);
    this.buildings = this.buildings.filter((b) => !bSet.has(b) && b.x > chunk.x - VIEW_W * 3);
    this.entities = this.entities.filter((e) => e.chunkIndex !== chunk.index && !e.dead);
    this.chunks.delete(chunk.index);
    this.minChunk = Math.min(...this.chunks.keys());
  }

  addSolid(chunk, solid) {
    chunk.solids.push(solid);
    this.solids.push(solid);
    return solid;
  }

  spawn(entity, chunk) {
    if (chunk) entity.chunkIndex = chunk.index;
    this.entities.push(entity);
    return entity;
  }

  generateChunk(index) {
    const rand = mulberry32(this.seed + index * 7919 + 13);
    const chunk = { index, x: index * CHUNK_W, w: CHUNK_W, solids: [], buildings: [], puddles: [], decor: [], entityIds: [] };
    const x0 = chunk.x;
    this.chunks.set(index, chunk);
    this.maxChunk = Math.max(this.maxChunk, index);
    this.rightLimit = Math.min(40000, (this.maxChunk + 1) * CHUNK_W - 60);

    // Two buildings with an alley between them.
    const b1w = randRange(rand, 290, 380);
    const gap = randRange(rand, 115, 165);
    const b2x = x0 + b1w + gap;
    const b2w = CHUNK_W - b1w - gap;

    this.addBuilding(chunk, x0, b1w, rand, index);
    this.addBuilding(chunk, b2x, b2w, rand, index + 0.5);

    // ---- alley: toxic runoff, trash, hiding spots
    const alleyX = x0 + b1w + gap * 0.5;
    if (rand() < 0.6) {
      const pw = randRange(rand, 66, 110);
      const p = { x: alleyX - pw / 2, y: GROUND_Y - 6, w: pw, h: 7, kind: rand() < 0.55 ? 'toxic' : 'water', phase: rand() * 6 };
      chunk.puddles.push(p);
      this.puddles.push(p);
    }

    // ---- loot
    const foodSpots = [];
    for (const b of chunk.buildings) {
      if (rand() < 0.55) foodSpots.push({ x: b.x + randRange(rand, 40, b.w - 50), y: b.roofY, type: pick(rand, ['fishBones', 'scraps', 'sandwich', 'milk']) });
      if (b.balcony && rand() < 0.5) foodSpots.push({ x: b.balcony.x + randRange(rand, 20, b.balcony.w - 40), y: b.balcony.y, type: pick(rand, ['fishBones', 'scraps']) });
      if (rand() < 0.35) foodSpots.push({ x: b.x + randRange(rand, 30, b.w - 40), y: GROUND_Y, type: pick(rand, ['scraps', 'fishBones', 'milk']) });
    }
    for (const spot of foodSpots) {
      this.spawn(new Food(spot.x, spot.y, spot.type, index), chunk);
    }

    // ---- rest spots (safer the higher up you go)
    const roofBuilding = chunk.buildings[rand() < 0.5 ? 0 : chunk.buildings.length - 1];
    if (roofBuilding && rand() < 0.7) {
      this.spawn(new RestSpot(roofBuilding.x + randRange(rand, 50, roofBuilding.w - 60), roofBuilding.roofY, 'box', index), chunk);
    }
    if (rand() < 0.4) {
      this.spawn(new RestSpot(x0 + randRange(rand, 30, CHUNK_W - 40), GROUND_Y, 'vent', index), chunk);
    }

    // ---- wildlife & locals (the first chunk is a safe tutorial pocket)
    const safe = index === 0;
    if (!safe && rand() < 0.42) {
      this.spawn(new Dog(alleyX - 40, GROUND_Y, randRange(rand, 110, 190), index), chunk);
    }
    if (rand() < 0.3) {
      const b = chunk.buildings[0];
      this.spawn(new Human(b.x + b.w * randRange(rand, 0.55, 0.85), GROUND_Y, index), chunk);
    }
    if (!safe && rand() < 0.55) {
      this.spawn(new Mouse(alleyX + randRange(rand, -60, 60), GROUND_Y, index), chunk);
    }
    if (safe) {
      // Guaranteed meal within sight of the spawn point.
      this.spawn(new Food(this.spawnX + 260, GROUND_Y, 'fishBones', index), chunk);
    }

    this.generateDecor(chunk, rand);
  }

  addBuilding(chunk, bx, bw, rand, index) {
    const roofY = pick(rand, [TIERS.roof, 242]);
    const b = {
      x: bx,
      w: bw,
      roofY,
      tone: randRange(rand, 0.24, 0.62),
      seed: Math.floor(rand() * 10000),
      sign: rand() < 0.5 ? pick(rand, ['HOTEL', '24H', 'CAFÉ', 'PHARMACY', 'NOODLES', 'PAWN', 'LAUNDRY', 'BAR']) : null,
      signColor: pick(rand, ['#ff7b6b', '#69d2e7', '#ffd166', '#c792ea', '#7ee7a8']),
      waterTank: rand() < 0.4,
      antenna: rand() < 0.5,
      balcony: null,
    };
    chunk.buildings.push(b);
    this.buildings.push(b);

    // Roof is a one-way platform so jumps from below pass through and land on top.
    this.addSolid(chunk, { x: bx + 6, y: roofY, w: bw - 12, h: 10, kind: 'roof', oneWay: true, building: b });

    // Rooftop tank platform gives a high, dog-free perch.
    if (b.waterTank) {
      const tankX = bx + bw * 0.62;
      this.addSolid(chunk, { x: tankX, y: roofY - 62, w: 96, h: 10, kind: 'tank', oneWay: true });
      b.tankX = tankX;
    }

    // Climb chain: dumpster -> awning -> balcony -> roof.
    const dumpX = bx + randRange(rand, 50, Math.max(60, bw * 0.42));
    const dumpster = this.addSolid(chunk, {
      x: dumpX, y: TIERS.dumpster, w: 86, h: GROUND_Y - TIERS.dumpster,
      kind: 'dumpster', oneWay: false, rummaged: false, looted: 0
    });
    chunk.dumpster = dumpster;

    const awningX = clamp(dumpX - 26, bx + 8, bx + bw - 140);
    this.addSolid(chunk, { x: awningX, y: TIERS.awning, w: 138, h: 10, kind: 'awning', oneWay: true });

    if (roofY <= TIERS.roof + 4) {
      const balX = clamp(awningX + 46, bx + 10, bx + bw - 160);
      const balcony = this.addSolid(chunk, { x: balX, y: TIERS.balcony, w: 152, h: 10, kind: 'balcony', oneWay: true });
      b.balcony = { x: balX, y: TIERS.balcony, w: 152 };
      b.balconySolid = balcony;
    }

    // A crate near the dumpster for a second way up.
    if (rand() < 0.45) {
      const crX = dumpX + 96 + randRange(rand, 0, 40);
      if (crX + 52 < bx + bw) {
        this.addSolid(chunk, { x: crX, y: GROUND_Y - 46, w: 54, h: 46, kind: 'crate', oneWay: false });
      }
    }
  }

  generateDecor(chunk, rand) {
    const x0 = chunk.x;
    // Street lamps roughly every half chunk.
    for (let i = 0; i < 2; i++) {
      chunk.decor.push({ type: 'lamp', x: x0 + 90 + i * 460 + randRange(rand, -60, 60), y: GROUND_Y });
    }
    if (rand() < 0.6) chunk.decor.push({ type: 'hydrant', x: x0 + randRange(rand, 60, CHUNK_W - 60), y: GROUND_Y });
    if (rand() < 0.55) chunk.decor.push({ type: 'bag', x: x0 + randRange(rand, 60, CHUNK_W - 60), y: GROUND_Y });
    if (rand() < 0.35) chunk.decor.push({ type: 'tires', x: x0 + randRange(rand, 60, CHUNK_W - 60), y: GROUND_Y });
    for (let i = 0; i < 3; i++) {
      chunk.decor.push({ type: 'grass', x: x0 + randRange(rand, 20, CHUNK_W - 20), y: GROUND_Y, s: randRange(rand, 0.6, 1.4) });
    }
  }

  // ------------------------------------------------------------ queries ----

  solidsNear(x, radius = 140) {
    const out = [];
    for (const s of this.solids) {
      if (s.x < x + radius && s.x + s.w > x - radius) out.push(s);
    }
    return out;
  }

  nearestFood(x, range = 160) {
    let best = null;
    let bestD = range;
    for (const e of this.entities) {
      if (e.kind !== 'food' || e.dead) continue;
      const d = Math.abs(e.cx - x);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  nearestInteractable(x, y, range = 80) {
    let best = null;
    let bestD = range;
    for (const e of this.entities) {
      if (e.dead) continue;
      if (e.kind !== 'rest' && e.kind !== 'food') continue;
      const d = Math.hypot(e.cx - x, e.cy - y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  nearestDumpster(x, y, range = 90) {
    let best = null;
    let bestD = range;
    for (const s of this.solids) {
      if (s.kind !== 'dumpster' || s.rummaged) continue;
      const cx = s.x + s.w / 2;
      const cy = s.y;
      const d = Math.hypot(cx - x, cy - y);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  nearestHuman(cat) {
    for (const e of this.entities) {
      if (e.kind !== 'human' || e.dead || e.given) continue;
      if (Math.abs(e.cx - cat.centerX) < 100 && Math.abs(e.feetY - cat.feetY) < 70) return e;
    }
    return null;
  }

  toxicAt(x, y) {
    for (const p of this.puddles) {
      if (p.kind !== 'toxic') continue;
      if (x > p.x && x < p.x + p.w && y > p.y - 10 && y < p.y + p.h + 8) return p;
    }
    return null;
  }

  // ------------------------------------------------------------- update ----

  update(dt, game) {
    const { cat, survival, camera } = game;

    // Weather cycle.
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      if (this.raining) {
        this.raining = false;
        this.rainTarget = 0;
        this.weatherTimer = randRange(Math.random, WEATHER.dryMin, WEATHER.dryMax);
      } else {
        this.raining = true;
        this.rainTarget = 1;
        this.weatherTimer = randRange(Math.random, WEATHER.rainMin, WEATHER.rainMax);
      }
    }
    this.rainAmount = approach(this.rainAmount, this.rainTarget, dt / WEATHER.rainFade);

    this.ensureChunks(camera.x);

    // Chunk generation is camera-driven; keep the right limit a little ahead of the cat.
    if (cat.x > this.rightLimit - 600) {
      const next = Math.max(this.maxChunk + 1, Math.floor((cat.x + CHUNK_W) / CHUNK_W));
      this.ensureChunks(next * CHUNK_W + VIEW_W, { force: false });
      this.ensureChunks(cat.x + VIEW_W * 1.2);
    }

    const difficulty = this.difficulty(survival);

    // Entities.
    for (const e of this.entities) {
      if (e.dead) continue;
      const far = e.cx < camera.x - VIEW_W * 1.2 || e.cx > camera.x + VIEW_W * 2.2;
      if (far && e.kind !== 'car') continue;
      e.update(dt, game);
    }
    if (this.entities.length > 90) this.entities = this.entities.filter((e) => !e.dead);

    this.updateTraffic(dt, game, difficulty);

    // Puddle shimmer particles.
    for (const p of this.puddles) {
      p.phase = (p.phase || 0) + dt * 2;
      if (p.kind === 'water' && Math.random() < dt * 1.5 && Math.abs(p.x - camera.x) < VIEW_W) {
        game.particles.spawn({
          x: p.x + Math.random() * p.w, y: p.y, vx: 0, vy: -18,
          life: 0.5, maxLife: 0.5, size: 1.6, color: 'rgba(190, 225, 255, 0.35)', gravity: -12, type: 'puff'
        });
      }
    }

    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 7 + Math.random() * 10;
      if (this.rainAmount < 0.2 && Math.random() < 0.6) game.audio.playCarPass(Math.random() * 1.4 - 0.7);
    }
  }

  difficulty(survival) {
    return clamp(0.12 + (survival.day - 1) * 0.1 + survival.distance / 9000, 0.12, 1);
  }

  updateTraffic(dt, game, difficulty) {
    const { camera, cat, audio, survival } = game;

    this.trafficFlip -= dt;
    if (this.trafficFlip <= 0) {
      this.trafficFlip = 24 + Math.random() * 16;
      this.trafficDir = Math.random() < 0.5 ? 1 : -1;
    }

    this.carTimer -= dt;
    if (this.carTimer > 0) return;

    const nightFactor = 0.75 + survival.darkness * 0.35;
    const rainFactor = 1 - this.rainAmount * 0.28;
    const base = lerp(5.4, 2.1, difficulty);
    this.carTimer = base * nightFactor * rainFactor * randRange(Math.random, 0.75, 1.4);

    // Don't spawn on top of an existing car.
    const dir = this.trafficDir;
    const spawnX = dir > 0 ? camera.x - 420 : camera.x + VIEW_W + 420;
    for (const e of this.entities) {
      if (e.kind === 'car' && Math.abs(e.cx - spawnX) < 320) {
        this.carTimer = 0.7;
        return;
      }
    }

    const typeIndex = Math.random() < 0.14 + difficulty * 0.1 ? 3 : Math.random() < 0.35 ? 2 : Math.random() < 0.5 ? 1 : 0;
    const speed = randRange(Math.random, HAZARD.carSpeedMin, HAZARD.carSpeedMax) * (1 + difficulty * 0.35) * (1 + this.rainAmount * 0.18);
    const car = new Car(spawnX, GROUND_Y, dir, speed, typeIndex);
    this.entities.push(car);
    this.carCount++;

    // Telegraph the danger before it arrives.
    const pan = dir > 0 ? -0.8 : 0.8;
    audio.playHorn(pan);
    game.onCarTelegraph?.(dir);
  }
}
