/**
 * Unified input: keyboard for desktop, on-screen pads for touch.
 * Scene code only ever reads abstract actions:
 *   held.left / held.right / held.jump / held.sprint / held.interact
 *   pressed.jump / pressed.interact / pressed.pause / pressed.confirm ...
 * UI buttons are registered by the scene, and hit-testing happens here.
 */

const KEY_ACTIONS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  ArrowDown: 'down', KeyS: 'down',
  ShiftLeft: 'sprint', ShiftRight: 'sprint', KeyK: 'sprint',
  KeyE: 'interact', KeyF: 'interact', KeyJ: 'interact',
  Escape: 'pause', KeyP: 'pause',
  Enter: 'confirm', NumpadEnter: 'confirm'
};

const ACTIONS = ['left', 'right', 'jump', 'down', 'sprint', 'interact', 'pause', 'confirm'];

export class Input {
  constructor(canvas, toVirtual) {
    this.canvas = canvas;
    this.toVirtual = toVirtual;
    this.keyDown = new Set();
    this.rawHeld = Object.fromEntries(ACTIONS.map((a) => [a, false]));
    this.held = { ...this.rawHeld };
    this.pressed = { ...this.rawHeld };
    this.released = { ...this.rawHeld };

    this.buttons = [];            // [{ id, x, y, w, h }] registered by the scene
    this.buttonHeld = new Map();  // id -> bool
    this.buttonPressed = new Set(); // ids pressed this frame
    this.buttonReleased = new Set();

    this.pointers = new Map();
    this.taps = [];       // virtual-space taps this frame
    this.dragDX = 0;      // horizontal drag delta since last frame (for swipe steering)
    this.lastPointer = { x: 0, y: 0, active: false };
    this.touchEverUsed = false;
    this._rawTaps = [];
    this.keysPressed = new Set();
    this.rawKeys = new Set();

    this._bind();
  }

  _bind() {
    const c = this.canvas;

    window.addEventListener('keydown', (e) => {
      const action = KEY_ACTIONS[e.code];
      if (action) {
        e.preventDefault();
        this.keyDown.add(action);
        this.keysPressed.add(e.code);
        if (action === 'interact' || action === 'confirm') this._rawTaps.push({ x: -1, y: -1, key: action });
      }
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      const action = KEY_ACTIONS[e.code];
      if (action) this.keyDown.delete(action);
    });

    window.addEventListener('blur', () => {
      this.keyDown.clear();
      this.pointers.clear();
    });

    const down = (e) => {
      this.touchEverUsed = true;
      const p = this.toVirtual(e.clientX, e.clientY);
      this.pointers.set(e.pointerId, { x: p.x, y: p.y, startX: p.x, startY: p.y });
      this._rawTaps.push({ x: p.x, y: p.y });
      this.lastPointer = { x: p.x, y: p.y, active: true };
      if (e.pointerType === 'touch') e.preventDefault();
    };
    const move = (e) => {
      const prev = this.pointers.get(e.pointerId);
      const p = this.toVirtual(e.clientX, e.clientY);
      if (prev) {
        this.dragDX += p.x - prev.x;
        prev.x = p.x;
        prev.y = p.y;
      }
      this.lastPointer = { x: p.x, y: p.y, active: true };
    };
    const up = (e) => {
      this.pointers.delete(e.pointerId);
    };

    c.addEventListener('pointerdown', down, { passive: false });
    c.addEventListener('pointermove', move, { passive: false });
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', up);
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    // iOS/Android gesture suppression for a game canvas.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  /** Scene calls this every frame with the buttons it is currently showing. */
  setButtons(buttons) {
    this.buttons = buttons || [];
  }

  beginFrame() {
    const held = Object.fromEntries(ACTIONS.map((a) => [a, false]));
    for (const a of this.keyDown) held[a] = true;

    // Touch buttons: a pointer inside a button rect holds that button.
    const ids = new Set();
    for (const b of this.buttons) ids.add(b.id);
    const pointers = [...this.pointers.values()];

    for (const b of this.buttons) {
      let inside = false;
      for (const p of pointers) {
        if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { inside = true; break; }
      }
      const was = this.buttonHeld.get(b.id) || false;
      this.buttonHeld.set(b.id, inside);
      if (inside && !was) this.buttonPressed.add(b.id);
      if (!inside && was) this.buttonReleased.add(b.id);
      if (inside && (b.id in held)) held[b.id] = true;
    }
    for (const id of [...this.buttonHeld.keys()]) {
      if (!ids.has(id)) this.buttonHeld.delete(id);
    }

    this.held = held;
    for (const a of ACTIONS) {
      this.pressed[a] = held[a] && !this.rawHeld[a];
      this.released[a] = !held[a] && this.rawHeld[a];
    }
    this.pressed.pause = this.keyDown.has('pause') && !this.rawHeld.pause;
    this.rawKeys = this.keysPressed;
    this.keysPressed = new Set();
    this.taps = this._rawTaps;
    this._rawTaps = [];
  }

  endFrame() {
    this.rawHeld = { ...this.held };
    this.buttonPressed.clear();
    this.buttonReleased.clear();
    this.dragDX = 0;
    this.taps = this.taps.length ? [] : this.taps;
  }

  /** Any action that means "fire the primary control". */
  anyJump() { return this.pressed.jump || this.buttonPressed.has('jump'); }

  /** Raw physical key edge, used by menus (Enter vs Space vs arrows). */
  wasKey(code) { return this.rawKeys.has(code); }

  menuUp() { return this.wasKey('ArrowUp') || this.wasKey('KeyW'); }
  menuDown() { return this.wasKey('ArrowDown') || this.wasKey('KeyS'); }
  menuConfirm() { return this.wasKey('Enter') || this.wasKey('NumpadEnter') || this.wasKey('Space') || this.wasKey('KeyE'); }
}
