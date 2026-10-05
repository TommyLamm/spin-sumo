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
  type: 'spark' | 'smoke' | 'fire' | 'confetti' | 'shockwave' | 'lightning' | 'ember' | 'snow';
  rotation?: number;
  rotSpeed?: number;
  secondaryColor?: string;
}

export interface SkidMark {
  x: number;
  y: number;
  angle: number;
  alpha: number;
  width: number;
  color?: string;
}

export interface ElectricArc {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
  segments: { x: number; y: number }[];
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private skidMarks: SkidMark[] = [];
  private electricArcs: ElectricArc[] = [];
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

  public addIntenseCollisionSparks(pos: Vector2D, count: number = 24, intensity: number = 1.0) {
    const colors = ['#ffffff', '#fef08a', '#f59e0b', '#ef4444'];
    const safeIntensity = Math.min(Math.max(intensity, 0.5), 2.5);
    const particleCount = Math.floor(count * safeIntensity);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (90 + Math.random() * 320) * safeIntensity;
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.25 + Math.random() * 0.35,
        maxLife: 0.6,
        size: (2.5 + Math.random() * 3.5) * Math.min(safeIntensity, 1.5),
        color: c,
        secondaryColor: '#f97316',
        type: 'spark',
      });
    }
  }

  public addExhaust(pos: Vector2D, angle: number, isTurbo: boolean = false) {
    const oppAngle = angle + Math.PI + (Math.random() - 0.5) * 0.45;
    const speed = isTurbo ? 220 + Math.random() * 120 : 80 + Math.random() * 60;
    this.particles.push({
      x: pos.x,
      y: pos.y,
      vx: Math.cos(oppAngle) * speed,
      vy: Math.sin(oppAngle) * speed,
      life: isTurbo ? 0.38 : 0.28,
      maxLife: isTurbo ? 0.38 : 0.28,
      size: isTurbo ? 7 + Math.random() * 5 : 4 + Math.random() * 3,
      color: isTurbo ? (Math.random() > 0.5 ? '#ff3b30' : '#ff9500') : '#64748b',
      type: isTurbo ? 'fire' : 'smoke',
    });
  }

  public addShockwave(pos: Vector2D, maxRadius: number = 110, color: string = '#f59e0b') {
    this.particles.push({
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      life: 0.38,
      maxLife: 0.38,
      size: maxRadius,
      color,
      type: 'shockwave',
    });
  }

  public addEmpShockwave(pos: Vector2D, maxRadius: number = 220) {
    this.particles.push({
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      life: 0.45,
      maxLife: 0.45,
      size: maxRadius,
      color: '#38bdf8',
      type: 'shockwave',
    });

    // Add radiating electric sparks
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const speed = 260 + Math.random() * 140;
      this.particles.push({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.15,
        maxLife: 0.5,
        size: 3 + Math.random() * 3,
        color: '#818cf8',
        secondaryColor: '#38bdf8',
        type: 'spark',
      });
    }
  }

  public addElectricArc(from: Vector2D, to: Vector2D) {
    const segments: { x: number; y: number }[] = [];
    const steps = 6;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 2) return;

    const nx = -dy / dist;
    const ny = dx / dist;

    segments.push({ x: from.x, y: from.y });
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const jitter = (Math.random() - 0.5) * 16;
      segments.push({
        x: from.x + dx * t + nx * jitter,
        y: from.y + dy * t + ny * jitter,
      });
    }
    segments.push({ x: to.x, y: to.y });

    this.electricArcs.push({
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      life: 0.18,
      maxLife: 0.18,
      segments,
    });
  }

  public addConfetti(center: Vector2D, count: number = 70) {
    const colors = ['#ff2d55', '#5856d6', '#007aff', '#34c759', '#ffcc00', '#ff9500'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 140 + Math.random() * 380;
      this.particles.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 160,
        life: 1.6 + Math.random() * 1.4,
        maxLife: 3.0,
        size: 6 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: 'confetti',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 10,
      });
    }
  }

  public addAmbientEmber(center: Vector2D, radius: number) {
    if (this.particles.length > 250) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (radius * 1.15);
    this.particles.push({
      x: center.x + Math.cos(angle) * dist,
      y: center.y + Math.sin(angle) * dist + 20,
      vx: (Math.random() - 0.5) * 35,
      vy: -30 - Math.random() * 50,
      life: 1.2 + Math.random() * 1.5,
      maxLife: 2.7,
      size: 2.5 + Math.random() * 3,
      color: Math.random() > 0.4 ? '#f97316' : '#ef4444',
      type: 'ember',
    });
  }

  public addAmbientSnow(center: Vector2D, radius: number) {
    if (this.particles.length > 250) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (radius * 1.1);
    this.particles.push({
      x: center.x + Math.cos(angle) * dist,
      y: center.y + Math.sin(angle) * dist - 30,
      vx: -15 + Math.random() * 30,
      vy: 20 + Math.random() * 40,
      life: 1.5 + Math.random() * 1.5,
      maxLife: 3.0,
      size: 2 + Math.random() * 2.5,
      color: '#e0f2fe',
      type: 'snow',
    });
  }

  public addSkidMark(pos: Vector2D, angle: number, alpha: number = 0.45, width: number = 6, color?: string) {
    if (this.skidMarks.length > 280) {
      this.skidMarks.shift();
    }
    this.skidMarks.push({
      x: pos.x,
      y: pos.y,
      angle,
      alpha,
      width,
      color,
    });
  }

  public update(dt: number) {
    // Screen shake decay
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      this.shakeMagnitude *= Math.pow(0.1, dt);
      if (this.shakeDuration <= 0) {
        this.shakeMagnitude = 0;
      }
    }

    // Skidmarks slowly fade
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      this.skidMarks[i].alpha -= dt * 0.035;
      if (this.skidMarks[i].alpha <= 0) {
        this.skidMarks.splice(i, 1);
      }
    }

    // Electric arcs update
    for (let i = this.electricArcs.length - 1; i >= 0; i--) {
      this.electricArcs[i].life -= dt;
      if (this.electricArcs[i].life <= 0) {
        this.electricArcs.splice(i, 1);
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
        p.vy += 320 * dt;
        p.vx *= 0.98;
        if (p.rotation !== undefined && p.rotSpeed !== undefined) {
          p.rotation += p.rotSpeed * dt;
        }
      } else if (p.type === 'smoke' || p.type === 'fire') {
        p.vx *= 0.92;
        p.vy *= 0.92;
      } else if (p.type === 'spark') {
        p.vx *= 0.95;
        p.vy *= 0.95;
      } else if (p.type === 'ember') {
        p.vy -= 10 * dt;
        p.vx += (Math.random() - 0.5) * 20 * dt;
      } else if (p.type === 'snow') {
        p.vx += Math.sin(p.life * 4) * 8 * dt;
      }
    }
  }

  public drawSkidMarks(ctx: CanvasRenderingContext2D) {
    for (const sm of this.skidMarks) {
      ctx.save();
      ctx.translate(sm.x, sm.y);
      ctx.rotate(sm.angle);
      ctx.fillStyle = sm.color || `rgba(15, 23, 42, ${sm.alpha})`;
      ctx.fillRect(-8, -sm.width / 2, 16, sm.width);
      ctx.restore();
    }
  }

  public drawElectricArcs(ctx: CanvasRenderingContext2D) {
    for (const arc of this.electricArcs) {
      const alpha = arc.life / arc.maxLife;
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (let i = 0; i < arc.segments.length; i++) {
        const pt = arc.segments[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      // White inner core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  public drawParticles(ctx: CanvasRenderingContext2D) {
    this.drawElectricArcs(ctx);

    for (const p of this.particles) {
      const progress = p.life / p.maxLife; // 1 to 0
      ctx.save();

      if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.secondaryColor || p.color;
        ctx.shadowBlur = 10;
        ctx.globalAlpha = Math.min(1, progress * 1.6);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
        ctx.fill();

        // White hot center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, (p.size * progress) * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'smoke' || p.type === 'fire') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = progress * 0.75;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.8 - progress * 0.8), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'shockwave') {
        const currentR = p.size * (1 - progress);
        ctx.strokeStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.lineWidth = Math.max(1, 8 * progress);
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
      } else if (p.type === 'ember') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 8;
        ctx.globalAlpha = progress * 0.9;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'snow') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = '#bae6fd';
        ctx.shadowBlur = 4;
        ctx.globalAlpha = progress * 0.85;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  public clear() {
    this.particles = [];
    this.skidMarks = [];
    this.electricArcs = [];
    this.shakeDuration = 0;
    this.shakeMagnitude = 0;
  }
}
