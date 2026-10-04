import { Vector2D, ItemType } from '../types';
import { Physics } from '../core/Physics';
import { ParticleSystem } from './Particles';
import { SoundEffects } from '../audio/SoundEffects';

export class Car {
  public id: 1 | 2;
  public pos: Vector2D;
  public vel: Vector2D;
  public angle: number; // In radians
  public spinDir: 1 | -1; // 1: clockwise, -1: counter-clockwise

  public baseRadius: number = 26;
  public currentRadius: number = 26;
  public baseMass: number = 1.0;
  public currentMass: number = 1.0;

  public baseSpinSpeed: number = (420 * Math.PI) / 180; // 420 deg/s in radians
  public baseAccel: number = 1350;
  public baseMaxSpeed: number = 420;
  public friction: number = 0.94;

  public isHolding: boolean = false;
  public isFalling: boolean = false;
  public fallScale: number = 1.0;
  public fallTimer: number = 0;

  public weakSpotStunTimer: number = 0;
  public oilSlipTimer: number = 0;

  // Items
  public activeBuff: ItemType | null = null;
  public buffTimer: number = 0;

  public hasBomb: boolean = false;
  public bombTimer: number = 0;

  public colorPrimary: string;
  public colorSecondary: string;
  public colorGlow: string;

  constructor(id: 1 | 2) {
    this.id = id;
    this.pos = { x: 0, y: 0 };
    this.vel = { x: 0, y: 0 };
    this.angle = id === 1 ? 0 : Math.PI;
    this.spinDir = id === 1 ? 1 : -1;

    if (id === 1) {
      this.colorPrimary = '#0284c7'; // Blue
      this.colorSecondary = '#38bdf8';
      this.colorGlow = 'rgba(56, 189, 248, 0.4)';
    } else {
      this.colorPrimary = '#e11d48'; // Red
      this.colorSecondary = '#fb7185';
      this.colorGlow = 'rgba(251, 113, 133, 0.4)';
    }
  }

  public reset(spawnPos: Vector2D, spawnAngle: number) {
    this.pos = { ...spawnPos };
    this.vel = { x: 0, y: 0 };
    this.angle = spawnAngle;
    this.spinDir = this.id === 1 ? 1 : -1;

    this.currentRadius = this.baseRadius;
    this.currentMass = this.baseMass;
    this.isHolding = false;
    this.isFalling = false;
    this.fallScale = 1.0;
    this.fallTimer = 0;

    this.weakSpotStunTimer = 0;
    this.oilSlipTimer = 0;

    this.activeBuff = null;
    this.buffTimer = 0;
    this.hasBomb = false;
    this.bombTimer = 0;
  }

  public applyItem(item: ItemType) {
    if (item === 'heavy') {
      this.activeBuff = 'heavy';
      this.buffTimer = 6.0;
      this.currentRadius = this.baseRadius * 1.35;
      this.currentMass = this.baseMass * 2.5;
    } else if (item === 'rocket') {
      this.activeBuff = 'rocket';
      this.buffTimer = 5.0;
    } else if (item === 'oil') {
      // Store item effect: will trigger oil puddle drop
      this.activeBuff = 'oil';
      this.buffTimer = 0; // immediate
    } else if (item === 'bomb') {
      this.hasBomb = true;
      this.bombTimer = 4.0;
    }
  }

  public triggerWeakSpotStun() {
    this.weakSpotStunTimer = 0.35;
  }

  public triggerOilSlip() {
    this.oilSlipTimer = 1.5;
  }

  public reverseSpin() {
    this.spinDir = (this.spinDir * -1) as 1 | -1;
  }

  public update(dt: number, inputHeld: boolean, slopeForce: Vector2D, particles: ParticleSystem) {
    if (this.isFalling) {
      this.fallTimer += dt;
      this.fallScale = Math.max(0, 1.0 - this.fallTimer * 2.5);
      this.angle += this.spinDir * 15 * dt;
      this.pos.x += this.vel.x * dt;
      this.pos.y += this.vel.y * dt;
      return;
    }

    // 1. Buff timers
    if (this.buffTimer > 0) {
      this.buffTimer -= dt;
      if (this.buffTimer <= 0) {
        this.activeBuff = null;
        this.currentRadius = this.baseRadius;
        this.currentMass = this.baseMass;
      }
    }

    // 2. Bomb timer
    if (this.hasBomb) {
      this.bombTimer -= dt;
      if (Math.floor((this.bombTimer + dt) * 3) !== Math.floor(this.bombTimer * 3)) {
        SoundEffects.playBombTick();
      }
    }

    // 3. Stun / Oil timers
    if (this.weakSpotStunTimer > 0) {
      this.weakSpotStunTimer -= dt;
      // Stun spin disruption
      this.angle += this.spinDir * 18 * dt;
      inputHeld = false; // Cannot thrust while stunned
    }

    let isSlipping = false;
    if (this.oilSlipTimer > 0) {
      this.oilSlipTimer -= dt;
      isSlipping = true;
      this.angle += this.spinDir * 14 * dt;
      particles.addSkidMark(this.pos, this.angle);
    }

    this.isHolding = inputHeld;

    // 4. Kinematics
    const isRocket = this.activeBuff === 'rocket';
    const accel = this.baseAccel * (isRocket ? 1.5 : 1.0);
    const maxSpeed = this.baseMaxSpeed * (isRocket ? 1.75 : 1.0);

    if (inputHeld && !isSlipping && this.weakSpotStunTimer <= 0) {
      // Thrusting: Lock rotation, apply acceleration
      const heading = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
      this.vel.x += heading.x * accel * dt;
      this.vel.y += heading.y * accel * dt;

      // Exhaust particles
      particles.addExhaust(this.pos, this.angle, isRocket);
    } else {
      // Not thrusting: Spin in place
      const spinSpeed = this.baseSpinSpeed * (this.activeBuff === 'heavy' ? 0.8 : 1.0);
      this.angle += this.spinDir * spinSpeed * dt;
    }

    // Apply arena slope outward force
    this.vel.x += slopeForce.x * dt;
    this.vel.y += slopeForce.y * dt;

    // Clamp max speed
    const currentSpeed = Physics.len(this.vel);
    if (currentSpeed > maxSpeed) {
      const normalizedVel = Physics.normalize(this.vel);
      this.vel.x = normalizedVel.x * maxSpeed;
      this.vel.y = normalizedVel.y * maxSpeed;
    }

    // Ground friction
    const curFriction = isSlipping ? 0.99 : this.friction;
    const decay = Math.pow(curFriction, 60 * dt);
    this.vel.x *= decay;
    this.vel.y *= decay;

    // Position integration
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
  }

  public draw(ctx: CanvasRenderingContext2D, mirrorForFaceToFace: boolean = false) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.scale(this.fallScale, this.fallScale);

    if (mirrorForFaceToFace && this.id === 2) {
      // In face-to-face mode, keep car body orientation normal
    }

    // 1. Soft drop shadow under car
    ctx.beginPath();
    ctx.arc(0, 4, this.currentRadius + 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    // 2. Outer Rubber Bumper (Tire Ring)
    ctx.beginPath();
    ctx.arc(0, 0, this.currentRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = this.activeBuff === 'heavy' ? '#f59e0b' : '#334155';
    ctx.stroke();

    // 3. Main Car Body
    ctx.beginPath();
    ctx.arc(0, 0, this.currentRadius - 4, 0, Math.PI * 2);
    ctx.fillStyle = this.colorPrimary;
    ctx.fill();

    // Inner highlight
    ctx.beginPath();
    ctx.arc(0, 0, this.currentRadius - 8, 0, Math.PI * 2);
    ctx.fillStyle = this.colorSecondary;
    ctx.fill();

    // 4. Directional Heading Indicator (Front headlights & pointer)
    ctx.save();
    ctx.rotate(this.angle);

    // Front headlights beam
    ctx.beginPath();
    ctx.moveTo(this.currentRadius - 4, -8);
    ctx.lineTo(this.currentRadius + 14, 0);
    ctx.lineTo(this.currentRadius - 4, 8);
    ctx.closePath();
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#fef08a';
    ctx.shadowBlur = 10;
    ctx.fill();

    // Driver helmet in center
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    ctx.fill();

    // Visor pointing forward
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(2, -4, 5, 8);

    ctx.restore();

    // 5. Bomb indicator if carrying
    if (this.hasBomb) {
      ctx.save();
      ctx.translate(0, -this.currentRadius - 12);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.ceil(this.bombTimer).toString(), 0, 1);
      ctx.restore();
    }

    // 6. Active Buff Ring
    if (this.activeBuff === 'rocket') {
      ctx.beginPath();
      ctx.arc(0, 0, this.currentRadius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 10;
      ctx.stroke();
    } else if (this.activeBuff === 'heavy') {
      ctx.beginPath();
      ctx.arc(0, 0, this.currentRadius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // 7. Player Tag Label (P1 or P2)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`P${this.id}`, 0, this.currentRadius + 14);

    ctx.restore();
  }
}
