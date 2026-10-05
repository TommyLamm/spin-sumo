import { Vector2D, ItemType } from '../types';
import { Physics } from '../core/Physics';

export interface MysteryBox {
  id: number;
  x: number;
  y: number;
  radius: number;
  itemType: ItemType;
  bobTimer: number;
}

export interface OilPuddle {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

export class ItemManager {
  public boxes: MysteryBox[] = [];
  public puddles: OilPuddle[] = [];
  private nextBoxId: number = 1;
  private spawnCooldown: number = 5.0; // Spawns after 5s

  public reset() {
    this.boxes = [];
    this.puddles = [];
    this.spawnCooldown = 5.0;
  }

  public update(dt: number, arenaRadius: number, arenaCenter: Vector2D) {
    // 1. Spawning logic
    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0 && this.boxes.length === 0) {
      this.spawnMysteryBox(arenaRadius, arenaCenter);
      this.spawnCooldown = 8.0; // next box in 8s after this one is gone
    }

    // 2. Mystery Box animation
    for (const box of this.boxes) {
      box.bobTimer += dt;
    }

    // 3. Oil puddles decay
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      this.puddles[i].life -= dt;
      if (this.puddles[i].life <= 0) {
        this.puddles.splice(i, 1);
      }
    }
  }

  private spawnMysteryBox(arenaRadius: number, arenaCenter: Vector2D) {
    // Prioritize new exciting items: EMP Shockwave & Heavy Anchor!
    const types: ItemType[] = ['anchor', 'emp', 'rocket', 'oil', 'bomb', 'anchor', 'emp'];
    const chosenType = types[Math.floor(Math.random() * types.length)];

    // Spawn inside 65% of arena radius
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (arenaRadius * 0.6);

    this.boxes.push({
      id: this.nextBoxId++,
      x: arenaCenter.x + Math.cos(angle) * dist,
      y: arenaCenter.y + Math.sin(angle) * dist,
      radius: 20,
      itemType: chosenType,
      bobTimer: 0,
    });
  }

  public addOilPuddle(pos: Vector2D) {
    this.puddles.push({
      x: pos.x,
      y: pos.y,
      radius: 36,
      life: 10.0,
      maxLife: 10.0,
    });
  }

  public checkCollisionsWithCar(carPos: Vector2D, carRadius: number): ItemType | null {
    for (let i = 0; i < this.boxes.length; i++) {
      const box = this.boxes[i];
      if (Physics.dist(carPos, { x: box.x, y: box.y }) < carRadius + box.radius) {
        const item = box.itemType;
        this.boxes.splice(i, 1);
        return item;
      }
    }
    return null;
  }

  public checkOilPuddle(carPos: Vector2D, carRadius: number): boolean {
    for (const puddle of this.puddles) {
      if (Physics.dist(carPos, { x: puddle.x, y: puddle.y }) < carRadius + puddle.radius) {
        return true;
      }
    }
    return false;
  }

  public draw(ctx: CanvasRenderingContext2D) {
    // 1. Draw Oil Puddles
    for (const puddle of this.puddles) {
      const alpha = Math.min(1.0, puddle.life / 2.0) * 0.8;
      ctx.save();
      ctx.beginPath();
      ctx.arc(puddle.x, puddle.y, puddle.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(30, 41, 59, ${alpha})`;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(100, 116, 139, ${alpha * 0.7})`;
      ctx.stroke();

      // Iridescent rainbow sheen on oil
      ctx.beginPath();
      ctx.arc(puddle.x - 6, puddle.y - 6, puddle.radius * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(168, 85, 247, ${alpha * 0.4})`;
      ctx.fill();
      ctx.restore();
    }

    // 2. Draw Mystery Boxes
    for (const box of this.boxes) {
      ctx.save();
      const floatY = box.y + Math.sin(box.bobTimer * 4) * 6;
      const size = box.radius * 2;

      let boxColor = '#0284c7';
      let strokeColor = '#38bdf8';
      let symbol = '?';

      if (box.itemType === 'anchor') {
        boxColor = '#854d0e';
        strokeColor = '#eab308';
        symbol = '⚓';
      } else if (box.itemType === 'emp') {
        boxColor = '#1e1b4b';
        strokeColor = '#38bdf8';
        symbol = '⚡';
      } else if (box.itemType === 'rocket') {
        boxColor = '#c2410c';
        strokeColor = '#fb923c';
        symbol = '▲';
      } else if (box.itemType === 'oil') {
        boxColor = '#3b0764';
        strokeColor = '#c084fc';
        symbol = '●';
      } else if (box.itemType === 'bomb') {
        boxColor = '#991b1b';
        strokeColor = '#f87171';
        symbol = '✹';
      }

      // Dynamic outer pulse glow
      const pulse = (Math.sin(box.bobTimer * 6) + 1) * 0.5;
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 10 + pulse * 10;

      // Box shape
      ctx.fillStyle = boxColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(box.x - box.radius, floatY - box.radius, size, size, 8);
      ctx.fill();
      ctx.stroke();

      // Item icon / Symbol
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, box.x, floatY);

      ctx.restore();
    }
  }
}
