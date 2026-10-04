import { PlayerInput } from '../types';

export class InputManager {
  private p1Keys = new Set(['KeyA', 'KeyW', 'Space']);
  private p2Keys = new Set(['KeyL', 'ArrowUp', 'NumpadEnter', 'Enter']);

  private p1KeyHeld = false;
  private p2KeyHeld = false;

  private activePointers = new Map<number, { x: number; y: number; player: 1 | 2 }>();

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
      this.p1KeyHeld = false;
      this.p2KeyHeld = false;
      this.activePointers.clear();
    });
  }

  private initPointers() {
    const handlePointerDown = (e: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      // Determine which player based on screen layout
      let player: 1 | 2 = 1;
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;

      if (this.isFaceToFace && rect.height > rect.width * 1.1) {
        // Portrait face-to-face: Top half is P2, Bottom half is P1
        player = relY < rect.height / 2 ? 2 : 1;
      } else {
        // Landscape or standard square: Left is P1, Right is P2
        player = relX < rect.width / 2 ? 1 : 2;
      }

      this.activePointers.set(e.pointerId, { x: relX, y: relY, player });
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!this.activePointers.has(e.pointerId)) return;
      const rect = this.canvas.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;

      let player: 1 | 2 = 1;
      if (this.isFaceToFace && rect.height > rect.width * 1.1) {
        player = relY < rect.height / 2 ? 2 : 1;
      } else {
        player = relX < rect.width / 2 ? 1 : 2;
      }

      const p = this.activePointers.get(e.pointerId)!;
      p.x = relX;
      p.y = relY;
      p.player = player;
    };

    const handlePointerUp = (e: PointerEvent) => {
      this.activePointers.delete(e.pointerId);
    };

    this.canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }

  public update() {
    // Check if any active pointer is assigned to P1 or P2
    let p1Touch = false;
    let p2Touch = false;

    for (const pointer of this.activePointers.values()) {
      if (pointer.player === 1) p1Touch = true;
      if (pointer.player === 2) p2Touch = true;
    }

    const p1Holding = this.p1KeyHeld || p1Touch;
    const p2Holding = this.p2KeyHeld || p2Touch;

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

  /**
   * For UI clicking: returns recent tap position if any
   */
  public getActivePointerCount(): number {
    return this.activePointers.size;
  }
}
