import { Vector2D } from '../types';
import { Physics } from '../core/Physics';

export class Arena {
  public center: Vector2D = { x: 360, y: 360 };
  public baseRadius: number = 240;
  public currentRadius: number = 240;
  public warningRadius: number = 210;
  public minRadius: number = 120;
  public suddenDeathTime: number = 40.0; // Starts collapsing at 40s
  public isSuddenDeath: boolean = false;
  private pulseTimer: number = 0;

  public reset() {
    this.currentRadius = this.baseRadius;
    this.warningRadius = this.baseRadius - 30;
    this.isSuddenDeath = false;
    this.pulseTimer = 0;
  }

  public update(dt: number, roundElapsed: number) {
    this.pulseTimer += dt;
    if (roundElapsed >= this.suddenDeathTime) {
      this.isSuddenDeath = true;
      if (this.currentRadius > this.minRadius) {
        this.currentRadius -= 6 * dt; // Collapses at 6px/sec
        this.warningRadius = Math.max(this.minRadius - 20, this.currentRadius - 25);
      }
    }
  }

  /**
   * Check if a car has fallen outside the arena
   */
  public isFallen(pos: Vector2D): boolean {
    const d = Physics.dist(pos, this.center);
    return d > this.currentRadius + 5;
  }

  /**
   * Returns slope acceleration pushing outward when on the edge
   */
  public getEdgeSlopeForce(pos: Vector2D, carRadius: number): Vector2D {
    const d = Physics.dist(pos, this.center);
    const threshold = this.currentRadius - carRadius;
    if (d > threshold) {
      const dir = Physics.normalize(Physics.sub(pos, this.center));
      const factor = Math.min((d - threshold) / (carRadius + 5), 1.0);
      return Physics.scale(dir, 320 * factor);
    }
    return { x: 0, y: 0 };
  }

  public draw(ctx: CanvasRenderingContext2D) {
    const { x: cx, y: cy } = this.center;
    const r = this.currentRadius;

    ctx.save();

    // 1. Abyss drop shadow underneath the floating island
    ctx.beginPath();
    ctx.arc(cx, cy + 18, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fill();

    // 2. Island side / 3D thickness
    ctx.beginPath();
    ctx.arc(cx, cy + 10, r, 0, Math.PI);
    ctx.lineTo(cx - r, cy);
    ctx.arc(cx, cy, r, Math.PI, 0, true);
    ctx.closePath();
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    // 3. Main Arena Surface
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, r);
    grad.addColorStop(0, '#2d3748');
    grad.addColorStop(0.7, '#1a202c');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fill();

    // 4. Warning Ring Zone
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.arc(cx, cy, this.warningRadius, 0, Math.PI * 2, true);
    if (this.isSuddenDeath) {
      const pulse = (Math.sin(this.pulseTimer * 8) + 1) * 0.5;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.35 + pulse * 0.4})`;
    } else {
      ctx.fillStyle = 'rgba(234, 179, 8, 0.16)';
    }
    ctx.fill();

    // 5. Outer Edge Border Rim
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = this.isSuddenDeath ? 5 : 4;
    ctx.strokeStyle = this.isSuddenDeath ? '#ef4444' : '#eab308';
    if (this.isSuddenDeath) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 15;
    }
    ctx.stroke();

    // 6. Sumo Center Ring & Decal
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();

    // Starting line markings
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(cx - 35, cy - 4, 18, 8); // P1 side
    ctx.fillRect(cx + 17, cy - 4, 18, 8); // P2 side

    ctx.restore();
  }
}
