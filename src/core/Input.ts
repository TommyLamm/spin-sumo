import { PlayerInput } from '../types';

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  player: 1 | 2;
}

export class InputManager {
  private p1Keys = new Set(['KeyA', 'KeyW', 'Space']);
  private p2Keys = new Set(['KeyL', 'ArrowUp', 'NumpadEnter', 'Enter']);

  private p1KeyHeld = false;
  private p2KeyHeld = false;

  // Strict Pointer Isolation: Separate tracking sets per player
  private p1PointerIds = new Set<number>();
  private p2PointerIds = new Set<number>();
  private pointerOwners = new Map<number, 1 | 2>();
  private activeTouchPoints = new Map<number, TouchPoint>();

  private p1State: PlayerInput = { holding: false, justPressed: false, justReleased: false };
  private p2State: PlayerInput = { holding: false, justPressed: false, justReleased: false };

  private p1PrevHolding = false;
  private p2PrevHolding = false;

  private canvas: HTMLCanvasElement;
  private isFaceToFace: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initKeyboard();
    this.initPointers();
  }

  public setFaceToFace(val: boolean) {
    this.isFaceToFace = val;
  }

  private initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (this.p1Keys.has(e.code)) {
        this.p1KeyHeld = true;
      }
      if (this.p2Keys.has(e.code)) {
        this.p2KeyHeld = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.p1Keys.has(e.code)) {
        this.p1KeyHeld = false;
      }
      if (this.p2Keys.has(e.code)) {
        this.p2KeyHeld = false;
      }
    });

    window.addEventListener('blur', () => {
      this.resetAll();
    });
  }

  private initPointers() {
    const getCanvasPos = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
        rect,
      };
    };

    const handlePointerDown = (e: PointerEvent) => {
      // Avoid browser scrolling / gesture handling
      e.preventDefault();

      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        // Fallback for non-supporting browsers
      }

      const { x, y, rect } = getCanvasPos(e.clientX, e.clientY);

      // Determine player partition ONCE at pointer-down and LOCK it!
      let player: 1 | 2 = 1;
      if (this.isFaceToFace && rect.height > rect.width * 1.1) {
        player = y < this.canvas.height / 2 ? 2 : 1;
      } else {
        player = x < this.canvas.width / 2 ? 1 : 2;
      }

      this.pointerOwners.set(e.pointerId, player);
      if (player === 1) {
        this.p1PointerIds.add(e.pointerId);
      } else {
        this.p2PointerIds.add(e.pointerId);
      }

      this.activeTouchPoints.set(e.pointerId, { id: e.pointerId, x, y, player });
    };

    const handlePointerMove = (e: PointerEvent) => {
      const owner = this.pointerOwners.get(e.pointerId);
      if (!owner) return;

      const { x, y } = getCanvasPos(e.clientX, e.clientY);
      // Update coordinates without changing ownership!
      const pt = this.activeTouchPoints.get(e.pointerId);
      if (pt) {
        pt.x = x;
        pt.y = y;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const owner = this.pointerOwners.get(e.pointerId);
      if (owner === 1) {
        this.p1PointerIds.delete(e.pointerId);
      } else if (owner === 2) {
        this.p2PointerIds.delete(e.pointerId);
      }

      this.pointerOwners.delete(e.pointerId);
      this.activeTouchPoints.delete(e.pointerId);

      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Safe guard
      }
    };

    this.canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp, { passive: false });
    window.addEventListener('pointercancel', handlePointerUp, { passive: false });
  }

  public resetAll() {
    this.p1KeyHeld = false;
    this.p2KeyHeld = false;
    this.p1PointerIds.clear();
    this.p2PointerIds.clear();
    this.pointerOwners.clear();
    this.activeTouchPoints.clear();
  }

  public update() {
    const p1Holding = this.p1KeyHeld || this.p1PointerIds.size > 0;
    const p2Holding = this.p2KeyHeld || this.p2PointerIds.size > 0;

    this.p1State.holding = p1Holding;
    this.p1State.justPressed = p1Holding && !this.p1PrevHolding;
    this.p1State.justReleased = !p1Holding && this.p1PrevHolding;
    this.p1PrevHolding = p1Holding;

    this.p2State.holding = p2Holding;
    this.p2State.justPressed = p2Holding && !this.p2PrevHolding;
    this.p2State.justReleased = !p2Holding && this.p2PrevHolding;
    this.p2PrevHolding = p2Holding;
  }

  public getP1Input(): PlayerInput {
    return this.p1State;
  }

  public getP2Input(): PlayerInput {
    return this.p2State;
  }

  public getActiveTouchPoints(): TouchPoint[] {
    return Array.from(this.activeTouchPoints.values());
  }

  public getActivePointerCount(): number {
    return this.pointerOwners.size;
  }
}
