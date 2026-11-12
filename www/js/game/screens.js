/**
 * Front-end screens drawn on the same canvas as the game: title, how-to-play,
 * settings, about, pause and game over. All menus work with touch and keyboard.
 */
import {
  VIEW_W, VIEW_H, GROUND_Y, COLORS,
  APP_VERSION, COPYRIGHT, COPYRIGHT_AR, OWNER_NAME, OWNER_NAME_AR, GAME_TITLE, QUEST
} from '../config.js';
import { clamp, mixHex, rgba } from '../core/rng.js';
import { roundRect, fillRound, text, ellipse } from '../core/draw.js';
import { formatTime } from './survival.js';

const DEATH_LINES = {
  starvation: ['The hunger won.', 'Three days is a long time for a stray.'],
  'a stray dog': ['The dog was faster tonight.', 'Territory is everything in this city.'],
  'a bad fall': ['The rooftops were not forgiving.', 'Nine lives, but not nine landings.'],
  traffic: ['The street never stops.', 'The city does not brake for strays.'],
  'the city': ['The city took another one.', 'It happens every night.']
};

export class Screens {
  constructor(game) {
    this.game = game;
    this.selection = 0;
    this.screen = 'title';
    this.time = 0;
    this.toast = '';
    this.toastLife = 0;
    this.exitNotice = 0;
    this._buttons = [];
  }

  /**
   * Draws a menu screen inside one input-button pass. Menu buttons are
   * registered while drawing and consumed by the same frame's pointer state,
   * so a tap lands immediately even on the first frame of a screen.
   */
  frame(ctx, drawFn) {
    this._buttons = [];
    drawFn(ctx);
    this.game.input.setButtons(this._buttons);
  }

  addButton(id, x, y, w, h) {
    this._buttons.push({ id, x, y, w, h });
  }

  enter(screen) {
    this.screen = screen;
    this.selection = 0;
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    this.toastLife = Math.max(0, this.toastLife - dt);
    this.exitNotice = Math.max(0, this.exitNotice - dt);
    const cat = this.game.titleCat;
    if (cat) {
      cat.blinkTimer -= dt;
      if (cat.blinkTimer <= 0) { cat.blinking = 0.13; cat.blinkTimer = 2.5 + Math.random() * 4; }
      cat.blinking = Math.max(0, cat.blinking - dt);
      cat.tailPhase += dt * 1.7;
      cat.gaitPhase += dt * 0.4;
      cat.sitAmount = 1;
      cat.idleTime += dt;
      cat.updateTail(dt, 0);
      if (cat.earTwitch <= 0 && Math.random() < dt * 0.18) cat.earTwitch = 0.16;
      cat.earTwitch = Math.max(0, cat.earTwitch - dt);
    }
  }

  showToast(msg) {
    this.toast = msg;
    this.toastLife = 2.4;
  }

  // ------------------------------------------------------------- helpers ---

  /** Draws a vertical menu and returns the activated index (or -1). */
  menuBlock(ctx, items, { x, y, w, itemH = 48, gap = 10, align = 'left' } = {}) {
    const game = this.game;
    const input = game.input;
    const buttons = items.map((it, i) => ({ id: `menu-${i}`, x, y: y + i * (itemH + gap), w, h: itemH }));
    for (const b of buttons) this.addButton(b.id, b.x, b.y, b.w, b.h);

    if (input.menuDown()) {
      this.selection = (this.selection + 1) % items.length;
      game.audio.playUi();
    }
    if (input.menuUp()) {
      this.selection = (this.selection - 1 + items.length) % items.length;
      game.audio.playUi();
    }
    this.selection = clamp(this.selection, 0, items.length - 1);

    let activated = -1;
    const pointer = input.lastPointer;

    items.forEach((it, i) => {
      const b = buttons[i];
      const hovered = pointer.active && pointer.x >= b.x && pointer.x <= b.x + b.w && pointer.y >= b.y && pointer.y <= b.y + b.h;
      const selected = this.selection === i || hovered;
      const disabled = !!it.disabled;

      const px = x;
      const py = y + i * (itemH + gap);

      // Pill.
      ctx.save();
      if (selected && !disabled) {
        ctx.shadowColor = 'rgba(255, 170, 80, 0.35)';
        ctx.shadowBlur = 18;
      }
      fillRound(ctx, px, py, w, itemH, 12, selected ? 'rgba(38, 48, 70, 0.94)' : 'rgba(12, 19, 33, 0.82)');
      ctx.shadowBlur = 0;
      roundRect(ctx, px + 0.5, py + 0.5, w - 1, itemH - 1, 12);
      ctx.strokeStyle = selected ? 'rgba(255, 190, 110, 0.75)' : 'rgba(140, 175, 220, 0.22)';
      ctx.lineWidth = selected ? 1.6 : 1;
      ctx.stroke();

      // Accent bar on the selected row.
      if (selected && !disabled) {
        fillRound(ctx, px + 8, py + itemH / 2 - 9, 3, 18, 2, COLORS.accent);
      }

      text(ctx, it.label, px + 24, py + (it.sub ? itemH / 2 - 1 : itemH / 2 + 5), {
        size: 16, weight: 700,
        color: disabled ? 'rgba(160, 175, 195, 0.4)' : selected ? '#fff6e8' : '#dbe6f6'
      });
      if (it.sub) {
        text(ctx, it.sub, px + 24, py + itemH / 2 + 15, { size: 10, weight: 500, color: 'rgba(170, 190, 215, 0.65)' });
      }
      if (it.value) {
        text(ctx, it.value, px + w - 20, py + itemH / 2 + 5, {
          size: 13, weight: 700, align: 'right',
          color: it.valueOn ? COLORS.good : 'rgba(180, 200, 225, 0.7)'
        });
      }
      if (selected && !disabled) {
        text(ctx, '›', px + w - 20, py + itemH / 2 + 6, { size: 18, weight: 800, align: 'right', color: 'rgba(255, 200, 140, 0.9)' });
      }
      ctx.restore();

      if (!disabled && input.buttonPressed.has(`menu-${i}`)) activated = i;
    });

    if (activated === -1 && input.menuConfirm()) activated = this.selection;
    if (activated >= 0) {
      game.audio.playUi('confirm');
      game.haptic(12);
    }
    return activated;
  }

  drawBackdrop(ctx, { dark = 0.45, blur = true } = {}) {
    const game = this.game;
    ctx.save();
    ctx.fillStyle = `rgba(5, 8, 16, ${dark})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }

  /** Reused city view for the title/pause screens. */
  drawCityBackdrop(ctx) {
    const game = this.game;
    const world = game.titleWorld;
    const camera = { x: 0 };
    const mockSurvival = { timeOfDay: 0.9, darkness: 1 };
    game.background.drawSky(ctx, { survival: mockSurvival, world, camera });
    game.background.drawCity(ctx, { world, camera, survival: mockSurvival });

    // The stray, sitting under the rain.
    const cat = game.titleCat;
    if (cat) {
      cat.x = VIEW_W * 0.34;
      cat.y = GROUND_Y - cat.h;
      cat.squash = 0;
      cat.stretch = 0;
      // Hero-sized on the title card.
      ctx.save();
      const cx = cat.centerX;
      const cy = cat.feetY;
      ctx.translate(cx, cy);
      ctx.scale(1.65, 1.65);
      ctx.translate(-cx, -cy);
      cat.draw(ctx, { darkness: 1, rainAmount: world.rainAmount });
      ctx.restore();
    }

    game.background.drawWeather(ctx, { world, survival: mockSurvival, camera });
    game.background.drawLighting(ctx, {
      world, survival: mockSurvival, camera,
      cat: { centerX: VIEW_W * 0.34 + 16, centerY: GROUND_Y - 20 }
    });
  }

  // -------------------------------------------------------------- screens ---

  drawTitle(ctx) {
    const game = this.game;
    this.drawCityBackdrop(ctx);

    // Cinematic grade.
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
    g.addColorStop(0, 'rgba(4, 7, 14, 0.9)');
    g.addColorStop(0.5, 'rgba(4, 7, 14, 0.45)');
    g.addColorStop(1, 'rgba(4, 7, 14, 0.82)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();

    // Title lockup.
    ctx.save();
    ctx.translate(64, 132);
    const grad = ctx.createLinearGradient(0, -46, 0, 46);
    grad.addColorStop(0, '#fff0d2');
    grad.addColorStop(0.55, '#ffb454');
    grad.addColorStop(1, '#e0723a');
    ctx.font = '800 62px ui-rounded, "Trebuchet MS", "Segoe UI", sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
    ctx.shadowColor = 'rgba(255, 140, 60, 0.45)';
    ctx.shadowBlur = 28;
    ctx.fillStyle = grad;
    ctx.fillText('URBAN', 0, 0);
    ctx.fillText('STRAY', 0, 62);
    ctx.shadowBlur = 0;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();

    text(ctx, 'قط المدينة', 68, 238, { size: 30, weight: 700, color: 'rgba(255, 214, 160, 0.92)' });
    text(ctx, 'A stray cat survival story', 68, 264, { size: 12, weight: 600, color: 'rgba(180, 200, 225, 0.8)', letterSpacing: 2 });

    const best = game.records;
    if (best.bestDay > 0) {
      ctx.save();
      fillRound(ctx, 68, 288, 190, 52, 12, 'rgba(10, 16, 28, 0.7)');
      roundRect(ctx, 68, 288, 190, 52, 12);
      ctx.strokeStyle = 'rgba(255, 190, 110, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      text(ctx, 'BEST RUN', 82, 305, { size: 9, weight: 800, color: 'rgba(255, 200, 140, 0.8)', letterSpacing: 1.6 });
      text(ctx, `${best.bestDay} day${best.bestDay === 1 ? '' : 's'} · ${best.bestFood} food`, 82, 326, { size: 13, weight: 700, color: '#fff1dd' });
      ctx.restore();
    }

    const items = [
      { label: 'Start Game', sub: 'Survive as long as you can' },
      { label: 'How to Play', sub: 'Controls & survival tips' },
      { label: 'Settings', sub: 'Sound, haptics, controls' },
      { label: 'About', sub: 'Credits & the story' },
      { label: 'Exit', sub: 'Leave the city' }
    ];
    const idx = this.menuBlock(ctx, items, { x: VIEW_W - 366, y: 148, w: 302, itemH: 50, gap: 9 });
    if (idx >= 0) {
      if (idx === 0) game.startRun();
      else if (idx === 1) game.go('help');
      else if (idx === 2) game.go('settings');
      else if (idx === 3) game.go('about');
      else if (idx === 4) game.exitApp();
    }

    this.drawUpdateBanner(ctx);

    text(ctx, `v${APP_VERSION} · Headphones recommended · Landscape`, 68, VIEW_H - 48, {
      size: 10, weight: 600, color: 'rgba(160, 185, 215, 0.55)', letterSpacing: 1
    });
    text(ctx, COPYRIGHT, 68, VIEW_H - 29, {
      size: 10, weight: 600, color: 'rgba(255, 208, 168, 0.52)'
    });
    this.drawToast(ctx);
  }

  /** Non-blocking "update available" card, with a direct download button. */
  drawUpdateBanner(ctx) {
    const game = this.game;
    const updates = game.updates;
    if (!updates || !updates.shouldNotify) return;

    const x = 64;
    const y = 344;
    const w = 348;
    const h = 96;

    ctx.save();
    fillRound(ctx, x, y, w, h, 14, 'rgba(28, 21, 12, 0.94)');
    roundRect(ctx, x, y, w, h, 14);
    ctx.strokeStyle = 'rgba(255, 190, 110, 0.7)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    text(ctx, 'UPDATE AVAILABLE', x + 18, y + 25, {
      size: 9.5, weight: 800, color: '#ffcf94', letterSpacing: 1.8
    });
    text(ctx, `Version ${updates.latest} is ready`, x + 18, y + 45, {
      size: 12, weight: 700, color: '#fff3e4'
    });

    const btnY = y + h - 40;
    const btnH = 28;
    const pressed = (id) => game.input.buttonHeld.get(id);
    this.addButton('update-download', x + 16, btnY, 138, btnH);
    this.addButton('update-later', x + 166, btnY, 84, btnH);

    fillRound(ctx, x + 16, btnY, 138, btnH, 8, pressed('update-download') ? '#ffd9a2' : '#ffb454');
    text(ctx, 'Download update', x + 85, btnY + 19, {
      size: 11, weight: 800, align: 'center', color: '#2a1a08'
    });
    fillRound(ctx, x + 166, btnY, 84, btnH, 8, 'rgba(46, 52, 68, 0.95)');
    text(ctx, 'Later', x + 208, btnY + 19, {
      size: 11, weight: 700, align: 'center', color: '#d3dced'
    });

    if (game.input.buttonPressed.has('update-download')) {
      game.audio.playUi('confirm');
      updates.openDownload();
      updates.dismiss();
    } else if (game.input.buttonPressed.has('update-later')) {
      game.audio.playUi();
      updates.dismiss();
    }
    ctx.restore();
  }

  drawHelp(ctx) {
    const game = this.game;
    this.drawCityBackdrop(ctx);
    this.drawBackdrop(ctx, { dark: 0.72 });

    fillRound(ctx, 54, 36, VIEW_W - 108, VIEW_H - 104, 18, 'rgba(9, 14, 26, 0.9)');
    roundRect(ctx, 54, 36, VIEW_W - 108, VIEW_H - 104, 18);
    ctx.strokeStyle = 'rgba(140, 175, 220, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    text(ctx, 'HOW TO PLAY', 82, 76, { size: 22, weight: 800, color: '#fff2dc', letterSpacing: 3 });
    text(ctx, 'Everything you need to survive one more night.', 82, 98, { size: 11, weight: 500, color: 'rgba(175, 195, 220, 0.7)' });

    const rows = [
      ['◀ ▶  /  A D', 'Move. Hold SHIFT or the >>> pad to sprint (burns energy).'],
      ['SPACE  /  ↑', 'Jump. Hold longer to jump higher. Second tap = double jump.'],
      ['E  /  PAW', 'Hold to rummage dumpsters or sleep in boxes. Appears in reach.'],
      ['ESC  /  ❚❚', 'Pause the run.']
    ];
    let y = 126;
    for (const [key, desc] of rows) {
      fillRound(ctx, 82, y - 15, 156, 24, 7, 'rgba(26, 36, 54, 0.95)');
      text(ctx, key, 160, y + 1, { size: 10.5, weight: 800, align: 'center', color: '#ffd9a5', letterSpacing: 1 });
      text(ctx, desc, 252, y + 1, { size: 11.5, weight: 500, color: 'rgba(220, 232, 248, 0.9)' });
      y += 36;
    }

    // Survival tips.
    text(ctx, 'SURVIVING THE CITY', 82, y + 12, { size: 12, weight: 800, color: '#ffcf94', letterSpacing: 2 });
    const tips = [
      ['Rooftops are safe', 'Dogs and cars stay on the street. Climb high to rest.'],
      ['Quests pay in food', 'Shelter from storms, sneak past dogs, climb for golden fish.'],
      ['Golden fish = power', `Collect ${QUEST.goldFishToUnlock} on high perches to learn the double jump.`],
      ['Read the warnings', 'A horn means a car is coming — get off the asphalt.'],
      ['Rain and night', 'Traffic speeds up and dogs get bolder after dark.']
    ];
    let ty = y + 32;
    for (const [title, desc] of tips) {
      ctx.fillStyle = 'rgba(255, 190, 110, 0.85)';
      ctx.beginPath();
      ctx.arc(88, ty - 4, 2.6, 0, Math.PI * 2);
      ctx.fill();
      text(ctx, title, 100, ty, { size: 11.5, weight: 700, color: '#eaf2ff' });
      text(ctx, desc, 100, ty + 13, { size: 10, weight: 500, color: 'rgba(170, 190, 215, 0.75)' });
      ty += 30;
    }

    const idx = this.menuBlock(ctx, [{ label: 'Back' }], { x: VIEW_W / 2 - 90, y: VIEW_H - 78, w: 180, itemH: 42 });
    if (idx === 0) game.back();
    this.drawToast(ctx);
  }

  drawSettings(ctx) {
    const game = this.game;
    this.drawCityBackdrop(ctx);
    this.drawBackdrop(ctx, { dark: 0.75 });

    const panelX = VIEW_W / 2 - 250;
    fillRound(ctx, panelX, 60, 500, VIEW_H - 130, 18, 'rgba(9, 14, 26, 0.92)');
    roundRect(ctx, panelX, 60, 500, VIEW_H - 130, 18);
    ctx.strokeStyle = 'rgba(140, 175, 220, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    text(ctx, 'SETTINGS', VIEW_W / 2, 108, { size: 22, weight: 800, align: 'center', color: '#fff2dc', letterSpacing: 3 });

    const s = game.settings;
    const touchLabel = s.touch === 'auto' ? 'Auto' : s.touch === 'on' ? 'Always' : 'Off';
    const updates = game.updates;
    const items = [
      { label: 'Sound', sub: 'Ambience, meows and traffic', value: s.sound ? 'ON' : 'OFF', valueOn: s.sound },
      { label: 'Haptics', sub: 'Vibrate on impacts', value: s.haptics ? 'ON' : 'OFF', valueOn: s.haptics },
      { label: 'Touch controls', sub: 'On-screen pads', value: touchLabel, valueOn: s.touch !== 'off' },
      {
        label: 'Check for updates',
        sub: updates.status === 'checking' ? 'Checking…' : `Current version ${APP_VERSION}`,
        value: updates.available ? 'UPDATE' : '',
        valueOn: updates.available
      },
      { label: 'Reset best record', sub: `${game.records.bestDay} days · ${game.records.bestFood} food`, value: '' },
      { label: 'Back', sub: '', value: '' }
    ];
    const idx = this.menuBlock(ctx, items, { x: VIEW_W / 2 - 218, y: 142, w: 436, itemH: 46, gap: 8 });
    if (idx === 0) { game.toggleSound(); this.selection = 0; }
    else if (idx === 1) { game.toggleHaptics(); this.selection = 1; }
    else if (idx === 2) { game.cycleTouch(); this.selection = 2; }
    else if (idx === 3) {
      game.checkForUpdates(true);
      this.selection = 3;
    } else if (idx === 4) {
      game.resetRecords();
      this.showToast('Best record cleared');
      this.selection = 4;
    } else if (idx === 5) game.back();

    this.drawToast(ctx);
  }

  drawAbout(ctx) {
    const game = this.game;
    this.drawCityBackdrop(ctx);
    this.drawBackdrop(ctx, { dark: 0.78 });

    fillRound(ctx, 120, 54, VIEW_W - 240, VIEW_H - 138, 18, 'rgba(9, 14, 26, 0.92)');
    roundRect(ctx, 120, 54, VIEW_W - 240, VIEW_H - 138, 18);
    ctx.strokeStyle = 'rgba(140, 175, 220, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    text(ctx, 'ABOUT', VIEW_W / 2, 96, { size: 22, weight: 800, align: 'center', color: '#fff2dc', letterSpacing: 3 });
    text(ctx, 'Urban Stray · قط المدينة', VIEW_W / 2, 120, { size: 12, weight: 600, align: 'center', color: 'rgba(255, 200, 145, 0.8)' });

    const para = [
      'You are a small ginger stray in a city that never slows down.',
      'The alleys are yours, but so is the traffic. Scavenge what you can,',
      'sleep where it is warm, and keep moving before the dogs find you.'
    ];
    let y = 154;
    for (const line of para) {
      text(ctx, line, VIEW_W / 2, y, { size: 12.5, weight: 500, align: 'center', color: 'rgba(215, 228, 245, 0.9)' });
      y += 20;
    }

    // ---- ownership & copyright (owner of the game) ----
    const mid = VIEW_W / 2;
    ctx.strokeStyle = 'rgba(255, 190, 110, 0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(198, 206);
    ctx.lineTo(VIEW_W - 198, 206);
    ctx.stroke();

    text(ctx, 'OWNER & COPYRIGHT', mid, 224, {
      size: 9, weight: 800, align: 'center', color: 'rgba(255, 190, 110, 0.78)', letterSpacing: 1.8
    });
    text(ctx, OWNER_NAME, mid, 246, {
      size: 14, weight: 800, align: 'center', color: '#fff3e2'
    });
    text(ctx, OWNER_NAME_AR, mid, 264, {
      size: 12.5, weight: 700, align: 'center', color: 'rgba(255, 216, 176, 0.9)'
    });
    text(ctx, COPYRIGHT, mid, 282, {
      size: 10.5, weight: 600, align: 'center', color: 'rgba(226, 236, 250, 0.85)'
    });
    text(ctx, COPYRIGHT_AR, mid, 299, {
      size: 9.5, weight: 500, align: 'center', color: 'rgba(190, 205, 225, 0.7)'
    });

    ctx.beginPath();
    ctx.moveTo(198, 314);
    ctx.lineTo(VIEW_W - 198, 314);
    ctx.stroke();

    const facts = [
      ['Engine', 'Custom Canvas 2D engine (no game framework)'],
      ['Art', '100% procedural vector art — no image assets'],
      ['Audio', 'Synthesized with WebAudio at runtime']
    ];
    let fy = 332;
    for (const [k, v] of facts) {
      text(ctx, k.toUpperCase(), 200, fy, { size: 9, weight: 800, color: 'rgba(255, 190, 110, 0.65)', letterSpacing: 1.4 });
      text(ctx, v, 300, fy, { size: 11.5, weight: 500, color: 'rgba(205, 220, 240, 0.9)' });
      fy += 22;
    }

    text(ctx, `Dedicated to every cat that ever owned a street. · ${GAME_TITLE} v${APP_VERSION}`, mid, 398, {
      size: 10.5, weight: 600, align: 'center', color: 'rgba(170, 190, 215, 0.65)'
    });

    const idx = this.menuBlock(ctx, [{ label: 'Back' }], { x: VIEW_W / 2 - 90, y: 414, w: 180, itemH: 36 });
    if (idx === 0) game.back();
    this.drawToast(ctx);
  }

  drawPause(ctx) {
    const game = this.game;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 16, 0.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();

    const pauseX = VIEW_W / 2 - 160;
    fillRound(ctx, pauseX, 62, 320, VIEW_H - 140, 18, 'rgba(9, 15, 27, 0.94)');
    roundRect(ctx, pauseX, 62, 320, VIEW_H - 140, 18);
    ctx.strokeStyle = 'rgba(255, 190, 110, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    text(ctx, 'PAUSED', VIEW_W / 2, 110, { size: 24, weight: 800, align: 'center', color: '#fff2dc', letterSpacing: 4 });

    const s = game.survival;
    text(ctx, `Day ${s.day} · ${formatTime(s.timeSurvived)} · ${Math.round(s.distance)} m`, VIEW_W / 2, 134, {
      size: 11, weight: 600, align: 'center', color: 'rgba(180, 200, 225, 0.75)'
    });

    const items = [
      { label: 'Resume', sub: '' },
      { label: 'Restart Run', sub: 'Start a fresh night' },
      { label: 'Main Menu', sub: '' }
    ];
    const idx = this.menuBlock(ctx, items, { x: VIEW_W / 2 - 130, y: 168, w: 260, itemH: 52, gap: 12 });
    if (idx === 0) game.resume();
    else if (idx === 1) game.startRun();
    else if (idx === 2) game.toMenu();

    text(ctx, game.showTouch ? 'Tap PAW or press J to paw' : 'Press ESC to resume', VIEW_W / 2, VIEW_H - 106, {
      size: 10, weight: 600, align: 'center', color: 'rgba(160, 185, 215, 0.55)'
    });
    this.drawToast(ctx);
  }

  drawGameOver(ctx) {
    const game = this.game;
    const s = game.survival;
    const sum = s.summary();
    const isRecord = game.isNewRecord;

    this.drawBackdrop(ctx, { dark: 0.8 });

    const overX = VIEW_W / 2 - 226;
    fillRound(ctx, overX, 48, 452, VIEW_H - 118, 20, 'rgba(10, 15, 27, 0.94)');
    roundRect(ctx, overX, 48, 452, VIEW_H - 118, 20);
    ctx.strokeStyle = 'rgba(255, 120, 120, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    text(ctx, 'THE CITY WINS', VIEW_W / 2, 92, { size: 20, weight: 800, align: 'center', color: '#ffd9d9', letterSpacing: 3 });
    const lines = DEATH_LINES[sum.cause] || DEATH_LINES['the city'];
    text(ctx, lines[0], VIEW_W / 2, 118, { size: 13, weight: 600, align: 'center', color: 'rgba(230, 235, 245, 0.9)' });
    text(ctx, lines[1], VIEW_W / 2, 136, { size: 10.5, weight: 500, align: 'center', color: 'rgba(175, 190, 212, 0.7)' });

    if (isRecord) {
      ctx.save();
      ctx.translate(VIEW_W / 2, 160);
      ctx.rotate(-0.03);
      fillRound(ctx, -66, -12, 132, 22, 11, 'rgba(255, 190, 90, 0.16)');
      roundRect(ctx, -66, -12, 132, 22, 11);
      ctx.strokeStyle = 'rgba(255, 200, 120, 0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      text(ctx, '★ NEW BEST RUN', 0, 3, { size: 10, weight: 800, align: 'center', color: '#ffd79a', letterSpacing: 1.5 });
      ctx.restore();
    }

    // Stats grid.
    const stats = [
      ['Days survived', String(sum.day)],
      ['Food collected', String(sum.food)],
      ['Distance', `${sum.distance} m`],
      ['Time alive', sum.time]
    ];
    let y = 190;
    const statsX = VIEW_W / 2 - 192;
    for (const [k, v] of stats) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fillRect(statsX, y - 16, 384, 30);
      text(ctx, k, statsX + 16, y + 4, { size: 11.5, weight: 600, color: 'rgba(180, 200, 225, 0.8)' });
      text(ctx, v, statsX + 368, y + 4, { size: 14, weight: 800, align: 'right', color: '#fff4e6' });
      y += 34;
    }

    const items = [
      { label: 'Try Again', sub: '' },
      { label: 'Main Menu', sub: '' }
    ];
    const idx = this.menuBlock(ctx, items, { x: VIEW_W / 2 - 150, y: y + 6, w: 300, itemH: 48, gap: 9 });
    if (idx === 0) game.startRun();
    else if (idx === 1) game.toMenu();
    this.drawToast(ctx);
  }

  drawToast(ctx) {
    if (this.toastLife <= 0) return;
    const a = clamp(this.toastLife / 0.4, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    const w = Math.max(160, ctx.measureText(this.toast).width + 46);
    fillRound(ctx, VIEW_W / 2 - w / 2, VIEW_H - 62, w, 28, 14, 'rgba(18, 28, 46, 0.95)');
    roundRect(ctx, VIEW_W / 2 - w / 2, VIEW_H - 62, w, 28, 14);
    ctx.strokeStyle = 'rgba(255, 190, 110, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    text(ctx, this.toast, VIEW_W / 2, VIEW_H - 43, { size: 11.5, weight: 700, align: 'center', color: '#ffe6c4' });
    ctx.restore();
  }
}
