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

  public baseSpinSpeed: number = (420 * Math.PI) / 180;
  public baseAccel: number = 1350;
  public baseMaxSpeed: number = 420;
  public friction: number = 0.94;

  public isHolding: boolean = false;
  public isFalling: boolean = false;
  public fallScale: number = 1.0;
  public fallTimer: number = 0;

  // Stun effects
  public weakSpotStunTimer: number = 0;
  public empStunTimer: number = 0;
  public oilSlipTimer: number = 0;

  // Dynamic Impact Squash & Stretch Deformation
  public deformationAmount: number = 0;
  public deformationAngle: number = 0;

  // Items
  public activeBuff: ItemType | null = null;
  public buffTimer: number = 0;

  public hasBomb: boolean = false;
  public bombTimer: number = 0;

  // Tire skid timing
  private skidCooldown: number = 0;

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
    this.empStunTimer = 0;
    this.oilSlipTimer = 0;

    this.deformationAmount = 0;
    this.deformationAngle = 0;

    this.activeBuff = null;
    this.buffTimer = 0;
    this.hasBomb = false;
    this.bombTimer = 0;
    this.skidCooldown = 0;
  }

  public applyItem(item: ItemType) {
    if (item === 'anchor') {
      this.activeBuff = 'anchor';
      this.buffTimer = 6.0;
      this.currentRadius = this.baseRadius * 1.35;
      this.currentMass = this.baseMass * 4.0; // +300% mass increase!
      SoundEffects.playAnchorEquip();
    } else if (item === 'heavy') {
      this.activeBuff = 'heavy';
      this.buffTimer = 6.0;
      this.currentRadius = this.baseRadius * 1.25;
      this.currentMass = this.baseMass * 2.5;
    } else if (item === 'rocket') {
      this.activeBuff = 'rocket';
      this.buffTimer = 5.0;
    } else if (item === 'oil') {
      this.activeBuff = 'oil';
      this.buffTimer = 0;
    } else if (item === 'bomb') {
      this.hasBomb = true;
      this.bombTimer = 4.0;
    }
  }

  public applyDeformation(normal: Vector2D, relativeSpeed: number) {
    // Normal is collision contact normal
    this.deformationAngle = Math.atan2(normal.y, normal.x);
    // Squash scale up to 0.35
    const intensity = Math.min(0.35, (relativeSpeed / 500) * 0.35);
    this.deformationAmount = Math.max(this.deformationAmount, intensity);
  }

  public triggerWeakSpotStun() {
    this.weakSpotStunTimer = 0.35;
  }

  public triggerEmpStun() {
    this.empStunTimer = 1.2; // 1.2 seconds paralysis
  }

  public triggerOilSlip() {
    this.oilSlipTimer = 1.5;
  }

  public reverseSpin() {
    this.spinDir = (this.spinDir * -1) as 1 | -1;
  }

  public update(
    dt: number,
    inputHeld: boolean,
    slopeForce: Vector2D,
    particles: ParticleSystem,
    arenaFriction: number = 0.94
  ) {
    if (this.isFalling) {
      this.fallTimer += dt;
      this.fallScale = Math.max(0, 1.0 - this.fallTimer * 2.4);
      this.angle += this.spinDir * 16 * dt;
      this.pos.x += this.vel.x * dt;
      this.pos.y += this.vel.y * dt;
      return;
    }

    // 1. Squash & Stretch deformation recovery
    if (this.deformationAmount > 0) {
      this.deformationAmount = Math.max(0, this.deformationAmount - dt * 3.2);
    }

    // 2. Buff timers
    if (this.buffTimer > 0) {
      this.buffTimer -= dt;
      if (this.buffTimer <= 0) {
        this.activeBuff = null;
        this.currentRadius = this.baseRadius;
        this.currentMass = this.baseMass;
      }
    }

    // 3. Bomb timer
    if (this.hasBomb) {
      this.bombTimer -= dt;
      if (Math.floor((this.bombTimer + dt) * 3) !== Math.floor(this.bombTimer * 3)) {
        SoundEffects.playBombTick();
      }
    }

    // 4. Stun timers
    let isStunned = false;
    if (this.empStunTimer > 0) {
      this.empStunTimer -= dt;
      isStunned = true;
      inputHeld = false;
      // Glitchy erratic spin
      this.angle += this.spinDir * 24 * dt;
      // Electric arc particles around chassis
      if (Math.random() < 0.3) {
        const pAngle = Math.random() * Math.PI * 2;
        const offset = {
          x: this.pos.x + Math.cos(pAngle) * this.currentRadius,
          y: this.pos.y + Math.sin(pAngle) * this.currentRadius,
        };
        particles.addElectricArc(this.pos, offset);
      }
    }

    if (this.weakSpotStunTimer > 0) {
      this.weakSpotStunTimer -= dt;
      isStunned = true;
      inputHeld = false;
      this.angle += this.spinDir * 18 * dt;
    }

    let isSlipping = false;
    if (this.oilSlipTimer > 0) {
      this.oilSlipTimer -= dt;
      isSlipping = true;
      this.angle += this.spinDir * 14 * dt;
    }

    this.isHolding = inputHeld;

    // 5. Kinematics & Thrust
    const isRocket = this.activeBuff === 'rocket';
    const isAnchor = this.activeBuff === 'anchor';
    const accel = this.baseAccel * (isRocket ? 1.5 : (isAnchor ? 0.85 : 1.0));
    const maxSpeed = this.baseMaxSpeed * (isRocket ? 1.75 : (isAnchor ? 0.9 : 1.0));

    const forward = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
    const right = { x: -Math.sin(this.angle), y: Math.cos(this.angle) };

    if (inputHeld && !isSlipping && !isStunned) {
      this.vel.x += forward.x * accel * dt;
      this.vel.y += forward.y * accel * dt;
      particles.addExhaust(this.pos, this.angle, isRocket);
    } else {
      // Spinning in place
      const spinMult = isAnchor ? 0.75 : (this.activeBuff === 'heavy' ? 0.85 : 1.0);
      this.angle += this.spinDir * this.baseSpinSpeed * spinMult * dt;
    }

    // 6. Arena slope outward force
    this.vel.x += slopeForce.x * dt;
    this.vel.y += slopeForce.y * dt;

    // 7. Speed clamping
    const currentSpeed = Physics.len(this.vel);
    if (currentSpeed > maxSpeed) {
      const normalizedVel = Physics.normalize(this.vel);
      this.vel.x = normalizedVel.x * maxSpeed;
      this.vel.y = normalizedVel.y * maxSpeed;
    }

    // 8. Ground friction (arena theme specific)
    const effectiveFriction = isSlipping ? 0.99 : arenaFriction;
    const decay = Math.pow(effectiveFriction, 60 * dt);
    this.vel.x *= decay;
    this.vel.y *= decay;

    // 9. Tire Skidmarks generation (Drifting & Burnout)
    this.skidCooldown -= dt;
    const lateralSpeed = Math.abs(Physics.dot(this.vel, right));
    const isDrifting = (lateralSpeed > 75 && currentSpeed > 90) || isSlipping || (currentSpeed > 220 && !inputHeld);

    if (isDrifting && this.skidCooldown <= 0) {
      this.skidCooldown = 0.04;
      const rearDist = this.currentRadius * 0.6;
      const wheelSpread = this.currentRadius * 0.65;
      const rearCenterX = this.pos.x - forward.x * rearDist;
      const rearCenterY = this.pos.y - forward.y * rearDist;

      const w1 = {
        x: rearCenterX + right.x * wheelSpread,
        y: rearCenterY + right.y * wheelSpread,
      };
      const w2 = {
        x: rearCenterX - right.x * wheelSpread,
        y: rearCenterY - right.y * wheelSpread,
      };

      const skidAlpha = Math.min(0.55, (lateralSpeed / 200) * 0.45 + 0.15);
      particles.addSkidMark(w1, this.angle, skidAlpha, 5);
      particles.addSkidMark(w2, this.angle, skidAlpha, 5);

      if (lateralSpeed > 130) {
        SoundEffects.playSkidSound();
      }
    }

    // 10. Position integration
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.scale(this.fallScale, this.fallScale);

    // Apply Impact Squash & Stretch deformation along collision normal
    if (this.deformationAmount > 0.01) {
      ctx.rotate(this.deformationAngle);
      ctx.scale(1 - this.deformationAmount, 1 + this.deformationAmount * 0.65);
      ctx.rotate(-this.deformationAngle);
    }

    // 1. Soft drop shadow under car
    ctx.beginPath();
    ctx.arc(0, 4, this.currentRadius + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();

    // 2. Outer Rubber Bumper (Tire Ring)
    const isAnchor = this.activeBuff === 'anchor';
    ctx.beginPath();
    ctx.arc(0, 0, this.currentRadius, 0, Math.PI * 2);
    ctx.fillStyle = isAnchor ? '#1e293b' : '#0f172a';
    ctx.fill();
    ctx.lineWidth = isAnchor ? 6 : 4;
    ctx.strokeStyle = isAnchor ? '#eab308' : (this.activeBuff === 'heavy' ? '#f59e0b' : '#334155');
    ctx.stroke();

    // Armor spikes if Heavy Anchor active
    if (isAnchor) {
      for (let i = 0; i < 6; i++) {
        const spikeAngle = (i / 6) * Math.PI * 2;
        ctx.save();
        ctx.rotate(spikeAngle);
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(this.currentRadius - 2, -4);
        ctx.lineTo(this.currentRadius + 6, 0);
        ctx.lineTo(this.currentRadius - 2, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 3. Main Car Body
    ctx.beginPath();
    ctx.arc(0, 0, this.currentRadius - 4, 0, Math.PI * 2);
    ctx.fillStyle = this.colorPrimary;
    ctx.fill();

    // Inner highlight plate
    ctx.beginPath();
    ctx.arc(0, 0, this.currentRadius - 8, 0, Math.PI * 2);
    ctx.fillStyle = this.colorSecondary;
    ctx.fill();

    // 4. Directional Heading Indicator (Headlights & driver helmet)
    ctx.save();
    ctx.rotate(this.angle);

    // Front headlights beam
    ctx.beginPath();
    ctx.moveTo(this.currentRadius - 4, -8);
    ctx.lineTo(this.currentRadius + 15, 0);
    ctx.lineTo(this.currentRadius - 4, 8);
    ctx.closePath();
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#fef08a';
    ctx.shadowBlur = 12;
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

    // 5. Bomb indicator
    if (this.hasBomb) {
      ctx.save();
      ctx.translate(0, -this.currentRadius - 14);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
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

    // 6. Active Buff Visuals
    if (this.activeBuff === 'rocket') {
      ctx.beginPath();
      ctx.arc(0, 0, this.currentRadius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 12;
      ctx.stroke();
    } else if (isAnchor) {
      ctx.beginPath();
      ctx.arc(0, 0, this.currentRadius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 14;
      ctx.stroke();

      // Anchor icon above
      ctx.save();
      ctx.translate(0, -this.currentRadius - 12);
      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('⚓ 巨獸', 0, 0);
      ctx.restore();
    }

    // 7. EMP Stun visual glitch ring
    if (this.empStunTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, this.currentRadius + 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#818cf8';
      ctx.shadowBlur = 16;
      ctx.stroke();

      ctx.save();
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ 麻痺', 0, -this.currentRadius - 12);
      ctx.restore();
    }

    // 8. Player Tag Label (P1 or P2)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`P${this.id}`, 0, this.currentRadius + 15);

    ctx.restore();
  }
}
