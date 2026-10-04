import { Vector2D } from '../types';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'spark' | 'smoke' | 'fire' | 'confetti' | 'shockwave';
  rotation?: number;
  rotSpeed?: number;
}

export interface SkidMark {
  x: number;
  y: number;
  angle: number;
  alpha: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private skidMarks: SkidMark[] = [];
  public shakeDuration: number = 0;
  public shakeMagnitude: number = 0;

  public triggerShake(magnitude: number, duration: number) {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
  }

  public getShakeOffset(): Vector2D {
    if (this.shakeDuration <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() * 2 - 1) * this.shakeMagnitude,
      y: (Math.random() * 2 - 1) * this.shakeMagnitude,
    };
  }

  public addSparks(pos: Vector2D, count: number = 12, color: string = '#ffd700') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 240;
      this.particles.push({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.2 + Math.random() * 0.25,
        maxLife: 0.45,
        size: 2 + Math.random() * 3,
        color,
        type: 'spark',
      });
    }
  }

  public addExhaust(pos: Vector2D, angle: number, isTurbo: boolean = false) {
    const oppAngle = angle + Math.PI + (Math.random() - 0.5) * 0.4;
    const speed = isTurbo ? 180 + Math.random() * 100 : 70 + Math.random() * 50;
    this.particles.push({
      x: pos.x,
      y: pos.y,
      vx: Math.cos(oppAngle) * speed,
      vy: Math.sin(oppAngle) * speed,
      life: isTurbo ? 0.35 : 0.25,
      maxLife: isTurbo ? 0.35 : 0.25,
      size: isTurbo ? 6 + Math.random() * 4 : 4 + Math.random() * 3,
      color: isTurbo ? (Math.random() > 0.5 ? '#ff3b30' : '#ff9500') : '#718096',
      type: isTurbo ? 'fire' : 'smoke',
    });
  }

  public addShockwave(pos: Vector2D, maxRadius: number = 100, color: string = '#ff3b30') {
    this.particles.push({
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      life: 0.4,
      maxLife: 0.4,
      size: maxRadius,
      color,
      type: 'shockwave',
    });
  }

  public addConfetti(center: Vector2D, count: number = 60) {
    const colors = ['#ff2d55', '#5856d6', '#007aff', '#34c759', '#ffcc00', '#ff9500'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 360;
      this.particles.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150, // blast up
        life: 1.5 + Math.random() * 1.5,
        maxLife: 3.0,
        size: 6 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: 'confetti',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 10,
      });
    }
  }

  public addSkidMark(pos: Vector2D, angle: number) {
    if (this.skidMarks.length > 120) {
      this.skidMarks.shift();
    }
    this.skidMarks.push({
      x: pos.x,
      y: pos.y,
      angle,
      alpha: 0.35,
    });
  }

  public update(dt: number) {
    // Shake decay
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      this.shakeMagnitude *= Math.pow(0.1, dt);
      if (this.shakeDuration <= 0) {
        this.shakeMagnitude = 0;
      }
    }

    // Skidmarks slowly fade
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      this.skidMarks[i].alpha -= dt * 0.04;
      if (this.skidMarks[i].alpha <= 0) {
        this.skidMarks.splice(i, 1);
      }
    }

    // Particles update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.type === 'confetti') {
        p.vy += 320 * dt; // gravity
        p.vx *= 0.98;
        if (p.rotation !== undefined && p.rotSpeed !== undefined) {
          p.rotation += p.rotSpeed * dt;
        }
      } else if (p.type === 'smoke' || p.type === 'fire') {
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
    }
  }

  public drawSkidMarks(ctx: CanvasRenderingContext2D) {
    for (const sm of this.skidMarks) {
      ctx.save();
      ctx.translate(sm.x, sm.y);
      ctx.rotate(sm.angle);
      ctx.fillStyle = `rgba(15, 23, 42, ${sm.alpha})`;
      ctx.fillRect(-10, -3, 20, 6);
      ctx.restore();
    }
  }

  public drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const progress = p.life / p.maxLife; // 1 to 0
      ctx.save();

      if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = Math.min(1, progress * 1.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'smoke' || p.type === 'fire') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = progress * 0.7;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.8 - progress * 0.8), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'shockwave') {
        const currentR = p.size * (1 - progress);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6 * progress;
        ctx.globalAlpha = progress;
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentR, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'confetti') {
        ctx.translate(p.x, p.y);
        if (p.rotation !== undefined) ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, progress * 1.2);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }

      ctx.restore();
    }
  }

  public clear() {
    this.particles = [];
    this.skidMarks = [];
    this.shakeDuration = 0;
    this.shakeMagnitude = 0;
  }
}
