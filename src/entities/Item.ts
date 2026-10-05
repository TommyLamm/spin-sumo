import { Vector2D, ItemType, TacticalBomb } from '../types';
import { Physics } from '../core/Physics';
import { SoundEffects } from '../audio/SoundEffects';
import { ParticleSystem } from './Particles';
import { Car } from './Car';

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
  public tacticalBomb: TacticalBomb | null = null;

  private nextBoxId: number = 1;
  private spawnCooldown: number = 5.0; // Spawns mystery box after 5s
  private bombAirdropped: boolean = false;
  private bombAirdropTime: number = 10.0; // Airdrops at 10s into round

  public reset() {
    this.boxes = [];
    this.puddles = [];
    this.tacticalBomb = null;
    this.spawnCooldown = 5.0;
    this.bombAirdropped = false;
    this.bombAirdropTime = 9.0 + Math.random() * 4.0; // 9~13 seconds
  }

  public update(
    dt: number,
    arenaRadius: number,
    arenaCenter: Vector2D,
    roundElapsed: number,
    particles?: ParticleSystem,
    cars?: Car[]
  ) {
    // 1. Spawning Mystery Boxes
    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0 && this.boxes.length === 0) {
      this.spawnMysteryBox(arenaRadius, arenaCenter);
      this.spawnCooldown = 8.0;
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

    // 4. Tactical Bomb Airdrop Trigger
    if (!this.bombAirdropped && roundElapsed >= this.bombAirdropTime) {
      this.bombAirdropped = true;
      this.airdropTacticalBomb(arenaCenter);
    }

    // 5. Tactical Bomb update
    if (this.tacticalBomb && !this.tacticalBomb.exploded) {
      const bomb = this.tacticalBomb;

      if (bomb.isDropping) {
        bomb.dropProgress += dt * 0.9;
        if (bomb.dropProgress >= 1.0) {
          bomb.isDropping = false;
          bomb.dropProgress = 1.0;
          bomb.pos = { ...bomb.targetPos };
          if (particles) {
            particles.addShockwave(bomb.pos, 50, '#f97316');
            particles.triggerShake(5, 0.15);
          }
        } else {
          // Parachute drift down
          bomb.pos.y = bomb.targetPos.y - (1 - bomb.dropProgress) * 260;
        }
      } else {
        // Bomb on ground: count down
        const prevFuse = bomb.fuseTimer;
        bomb.fuseTimer -= dt;

        // Ticking audio
        const tickInterval = bomb.fuseTimer < 2.0 ? 0.25 : 0.8;
        if (Math.floor(prevFuse / tickInterval) !== Math.floor(bomb.fuseTimer / tickInterval)) {
          SoundEffects.playNuclearTick();
          if (particles) {
            particles.addShockwave(bomb.pos, 45, '#ef4444');
          }
        }

        // Bomb ground physics (friction & position integration)
        bomb.pos.x += bomb.vel.x * dt;
        bomb.pos.y += bomb.vel.y * dt;
        bomb.vel.x *= Math.pow(0.88, 60 * dt);
        bomb.vel.y *= Math.pow(0.88, 60 * dt);

        // Keep inside arena center radius
        const d = Physics.dist(bomb.pos, arenaCenter);
        if (d > arenaRadius - bomb.radius) {
          const toC = Physics.normalize(Physics.sub(arenaCenter, bomb.pos));
          bomb.vel.x += toC.x * 200 * dt;
          bomb.vel.y += toC.y * 200 * dt;
        }

        // Resolve collisions with cars (players can push the bomb!)
        if (cars) {
          for (const car of cars) {
            if (!car.isFalling) {
              this.resolveCarBombCollision(car, bomb);
            }
          }
        }

        // Check Explosion!
        if (bomb.fuseTimer <= 0) {
          this.triggerBombExplosion(bomb, cars, particles);
        }
      }
    }
  }

  private airdropTacticalBomb(arenaCenter: Vector2D) {
    // Drop near arena center (offset up to 45px)
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 45;
    const target = {
      x: arenaCenter.x + Math.cos(angle) * dist,
      y: arenaCenter.y + Math.sin(angle) * dist,
    };

    this.tacticalBomb = {
      id: Date.now(),
      pos: { x: target.x, y: target.y - 260 },
      vel: { x: 0, y: 0 },
      radius: 20,
      mass: 1.2,
      fuseTimer: 5.0,
      maxFuse: 5.0,
      isDropping: true,
      dropProgress: 0,
      targetPos: target,
      exploded: false,
    };

    SoundEffects.playNuclearSiren();
  }

  private resolveCarBombCollision(car: Car, bomb: TacticalBomb) {
    const delta = Physics.sub(bomb.pos, car.pos);
    const dist = Physics.len(delta);
    const minDist = car.currentRadius + bomb.radius;

    if (dist < minDist && dist > 0.001) {
      const normal = Physics.scale(delta, 1 / dist);
      const overlap = minDist - dist;

      // Position pushout
      bomb.pos.x += normal.x * overlap * 0.75;
      bomb.pos.y += normal.y * overlap * 0.75;
      car.pos.x -= normal.x * overlap * 0.25;
      car.pos.y -= normal.y * overlap * 0.25;

      // Impulse transfer: shove bomb away with car velocity
      const pushSpeed = Physics.len(car.vel);
      if (pushSpeed > 30) {
        bomb.vel.x = normal.x * Math.max(pushSpeed * 0.9, 140);
        bomb.vel.y = normal.y * Math.max(pushSpeed * 0.9, 140);
      }
    }
  }

  private triggerBombExplosion(bomb: TacticalBomb, cars?: Car[], particles?: ParticleSystem) {
    bomb.exploded = true;
    SoundEffects.playNuclearExplosion();

    if (particles) {
      particles.addNuclearExplosion(bomb.pos);
      particles.triggerShake(24, 0.55);
    }

    // Blast cars in high blast radius (240px)
    if (cars) {
      const blastRadius = 240;
      for (const car of cars) {
        if (car.isFalling) continue;
        const d = Physics.dist(bomb.pos, car.pos);
        if (d < blastRadius) {
          const blastDir = d > 0.001 ? Physics.normalize(Physics.sub(car.pos, bomb.pos)) : { x: 1, y: 0 };
          const blastFactor = Math.max(0.35, 1 - d / blastRadius);
          // Massive impulse outward!
          const blastForce = (950 * blastFactor) / Math.max(0.6, car.currentMass * 0.8);
          car.vel.x += blastDir.x * blastForce;
          car.vel.y += blastDir.y * blastForce;

          // Stun hit
          car.triggerWeakSpotStun();
          if (particles) {
            particles.addIntenseCollisionSparks(car.pos, 20, 1.5);
          }
        }
      }
    }
  }

  private spawnMysteryBox(arenaRadius: number, arenaCenter: Vector2D) {
    const types: ItemType[] = ['anchor', 'emp', 'rocket', 'oil', 'bomb', 'anchor', 'emp'];
    const chosenType = types[Math.floor(Math.random() * types.length)];

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

      const pulse = (Math.sin(box.bobTimer * 6) + 1) * 0.5;
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 10 + pulse * 10;

      ctx.fillStyle = boxColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(box.x - box.radius, floatY - box.radius, size, size, 8);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, box.x, floatY);

      ctx.restore();
    }

    // 3. Draw Tactical Bomb (Airdrop & Countdown)
    if (this.tacticalBomb && !this.tacticalBomb.exploded) {
      const bomb = this.tacticalBomb;
      ctx.save();

      // Draw landing crosshair & shadow on target position
      if (bomb.isDropping) {
        ctx.beginPath();
        ctx.arc(bomb.targetPos.x, bomb.targetPos.y, 22 * bomb.dropProgress + 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + bomb.dropProgress * 0.35})`;
        ctx.fill();

        // Parachute canopy above
        ctx.save();
        ctx.translate(bomb.pos.x, bomb.pos.y - 28);
        ctx.beginPath();
        ctx.arc(0, 0, 24, Math.PI, 0);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Cords
        ctx.beginPath();
        ctx.moveTo(-20, 0);
        ctx.lineTo(0, 26);
        ctx.moveTo(20, 0);
        ctx.lineTo(0, 26);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.stroke();
        ctx.restore();
      } else {
        // Red warning perimeter circle (blast zone radius 240px)
        const pulse = (Math.sin(performance.now() * 0.008) + 1) * 0.5;
        ctx.save();
        ctx.beginPath();
        ctx.arc(bomb.pos.x, bomb.pos.y, 230, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.18 + pulse * 0.22})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.stroke();
        ctx.restore();

        // Ground shadow
        ctx.beginPath();
        ctx.arc(bomb.pos.x, bomb.pos.y + 3, bomb.radius + 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fill();
      }

      // Bomb chassis
      ctx.translate(bomb.pos.x, bomb.pos.y);

      // Warning Strobe
      const flash = bomb.fuseTimer < 2.0 ? Math.floor(bomb.fuseTimer * 8) % 2 === 0 : Math.floor(bomb.fuseTimer * 3) % 2 === 0;

      ctx.beginPath();
      ctx.arc(0, 0, bomb.radius, 0, Math.PI * 2);
      ctx.fillStyle = flash ? '#ef4444' : '#1e293b';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#facc15';
      ctx.stroke();

      // Radiation symbol / Countdown
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (bomb.fuseTimer > 0) {
        ctx.fillText(`☢${Math.ceil(bomb.fuseTimer)}s`, 0, 0);
      } else {
        ctx.fillText('💥', 0, 0);
      }

      ctx.restore();
    }
  }
}
