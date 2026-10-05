import { Vector2D, ArenaTheme, ArenaThemeConfig } from '../types';
import { Physics } from '../core/Physics';
import { ParticleSystem } from './Particles';
import { SoundEffects } from '../audio/SoundEffects';

export const ARENA_THEMES: Record<ArenaTheme, ArenaThemeConfig> = {
  classic: {
    id: 'classic',
    name: '經典水泥擂台',
    subname: 'Classic Arena',
    description: '標準相撲摩擦力與彈性，考驗純粹的時機與衝撞技巧。',
    friction: 0.94,
    restitution: 1.28,
    suddenDeathTime: 40.0,
    collapseSpeed: 6.0,
    rimColor: '#eab308',
    warningColor: '#ef4444',
    bgColor: '#090d16',
    floorGradient: ['#2d3748', '#1a202c', '#0f172a'],
  },
  frost: {
    id: 'frost',
    name: '極地溜冰場',
    subname: 'Frost Glaze',
    description: '極低摩擦力！甩尾滑行順暢無比，撞擊反彈大幅加劇！',
    friction: 0.985,
    restitution: 1.48,
    suddenDeathTime: 35.0,
    collapseSpeed: 7.0,
    rimColor: '#38bdf8',
    warningColor: '#f43f5e',
    bgColor: '#081426',
    floorGradient: ['#38bdf8', '#0284c7', '#0c4a6e'],
  },
  magma: {
    id: 'magma',
    name: '熔岩工廠',
    subname: 'Magma Foundry',
    description: '倒數 25 秒即刻崩塌！邊界碎石滾落熔岩，生存空間急遽縮小！',
    friction: 0.93,
    restitution: 1.25,
    suddenDeathTime: 25.0,
    collapseSpeed: 9.0,
    rimColor: '#f97316',
    warningColor: '#dc2626',
    bgColor: '#180808',
    floorGradient: ['#431407', '#290e05', '#1a0505'],
  },
};

export class Arena {
  public theme: ArenaTheme = 'classic';
  public center: Vector2D = { x: 360, y: 360 };
  public baseRadius: number = 240;
  public currentRadius: number = 240;
  public warningRadius: number = 210;
  public minRadius: number = 100;
  public isSuddenDeath: boolean = false;

  private pulseTimer: number = 0;
  private hazardFlashTimer: number = 0;
  private dangerActive: boolean = false;
  private dangerAngles: number[] = [];

  // Magma crumbling debris animation
  private crumbleSparksCooldown: number = 0;

  constructor(theme: ArenaTheme = 'classic') {
    this.setTheme(theme);
  }

  public setTheme(theme: ArenaTheme) {
    this.theme = theme;
    this.reset();
  }

  public getThemeConfig(): ArenaThemeConfig {
    return ARENA_THEMES[this.theme];
  }

  public reset() {
    this.currentRadius = this.baseRadius;
    this.warningRadius = this.baseRadius - 30;
    this.isSuddenDeath = false;
    this.pulseTimer = 0;
    this.hazardFlashTimer = 0;
    this.dangerActive = false;
    this.dangerAngles = [];
    this.crumbleSparksCooldown = 0;
  }

  public update(dt: number, roundElapsed: number, particles?: ParticleSystem) {
    const config = this.getThemeConfig();
    this.pulseTimer += dt;
    this.hazardFlashTimer += dt * 14; // Fast flash for hazard strobe

    // Sudden death collapse
    if (roundElapsed >= config.suddenDeathTime) {
      this.isSuddenDeath = true;
      if (this.currentRadius > this.minRadius) {
        this.currentRadius -= config.collapseSpeed * dt;
        this.warningRadius = Math.max(this.minRadius - 20, this.currentRadius - 28);

        // Magma arena crumbling rock debris
        if (this.theme === 'magma' && particles) {
          this.crumbleSparksCooldown -= dt;
          if (this.crumbleSparksCooldown <= 0) {
            this.crumbleSparksCooldown = 0.08;
            const angle = Math.random() * Math.PI * 2;
            const edgePos = {
              x: this.center.x + Math.cos(angle) * this.currentRadius,
              y: this.center.y + Math.sin(angle) * this.currentRadius,
            };
            particles.addIntenseCollisionSparks(edgePos, 3, 0.6);
          }
        }
      }
    }

    // Ambient particles
    if (particles) {
      if (this.theme === 'magma' && Math.random() < 0.25) {
        particles.addAmbientEmber(this.center, this.currentRadius);
      } else if (this.theme === 'frost' && Math.random() < 0.25) {
        particles.addAmbientSnow(this.center, this.currentRadius);
      }
    }
  }

  /**
   * Check car proximity to edge (within 30px) to trigger hazard strobes
   */
  public checkEdgeDanger(carPositions: Vector2D[]) {
    this.dangerActive = false;
    this.dangerAngles = [];

    const dangerDist = this.currentRadius - 30;
    for (const pos of carPositions) {
      const d = Physics.dist(pos, this.center);
      if (d > dangerDist) {
        this.dangerActive = true;
        const angle = Math.atan2(pos.y - this.center.y, pos.x - this.center.x);
        this.dangerAngles.push(angle);
        SoundEffects.playWarningBeep();
      }
    }
  }

  public isFallen(pos: Vector2D): boolean {
    const d = Physics.dist(pos, this.center);
    return d > this.currentRadius + 6;
  }

  public getEdgeSlopeForce(pos: Vector2D, carRadius: number): Vector2D {
    const d = Physics.dist(pos, this.center);
    const threshold = this.currentRadius - carRadius;
    if (d > threshold) {
      const dir = Physics.normalize(Physics.sub(pos, this.center));
      const factor = Math.min((d - threshold) / (carRadius + 5), 1.0);
      return Physics.scale(dir, 340 * factor);
    }
    return { x: 0, y: 0 };
  }

  public draw(ctx: CanvasRenderingContext2D) {
    const { x: cx, y: cy } = this.center;
    const r = this.currentRadius;
    const config = this.getThemeConfig();

    ctx.save();

    // 1. Abyss Background & Outer Pit
    if (this.theme === 'magma') {
      // Molten bubbling lava pool below
      const lavaGrad = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r + 90);
      lavaGrad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
      lavaGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.35)');
      lavaGrad.addColorStop(1, 'rgba(120, 20, 10, 0.1)');
      ctx.beginPath();
      ctx.arc(cx, cy, r + 85, 0, Math.PI * 2);
      ctx.fillStyle = lavaGrad;
      ctx.fill();
    } else if (this.theme === 'frost') {
      // Frosted icy glow
      const frostGlow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r + 60);
      frostGlow.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
      frostGlow.addColorStop(1, 'rgba(14, 116, 144, 0.0)');
      ctx.beginPath();
      ctx.arc(cx, cy, r + 55, 0, Math.PI * 2);
      ctx.fillStyle = frostGlow;
      ctx.fill();
    }

    // 2. 3D Island Thickness / Drop Shadow
    ctx.beginPath();
    ctx.arc(cx, cy + 18, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy + 12, r, 0, Math.PI);
    ctx.lineTo(cx - r, cy);
    ctx.arc(cx, cy, r, Math.PI, 0, true);
    ctx.closePath();
    ctx.fillStyle = this.theme === 'magma' ? '#260a0a' : (this.theme === 'frost' ? '#0c4a6e' : '#1e293b');
    ctx.fill();

    // 3. Main Arena Floor
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, r);
    grad.addColorStop(0, config.floorGradient[0]);
    grad.addColorStop(0.65, config.floorGradient[1]);
    grad.addColorStop(1, config.floorGradient[2]);
    ctx.fillStyle = grad;
    ctx.fill();

    // Theme Surface Details
    if (this.theme === 'frost') {
      // Ice surface glistening cracks & crystal polygons
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 80, cy - 90);
      ctx.lineTo(cx - 20, cy - 40);
      ctx.lineTo(cx + 40, cy - 60);
      ctx.lineTo(cx + 100, cy - 30);

      ctx.moveTo(cx - 110, cy + 50);
      ctx.lineTo(cx - 40, cy + 70);
      ctx.lineTo(cx + 60, cy + 40);
      ctx.lineTo(cx + 120, cy + 80);
      ctx.stroke();

      // Frosted radial rings
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (this.theme === 'magma') {
      // Glowing volcanic magma cracks
      ctx.save();
      const pulse = (Math.sin(this.pulseTimer * 4) + 1) * 0.5;
      ctx.strokeStyle = `rgba(249, 115, 22, ${0.4 + pulse * 0.3})`;
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 100, cy - 60);
      ctx.lineTo(cx - 30, cy - 30);
      ctx.lineTo(cx + 20, cy - 80);
      ctx.lineTo(cx + 90, cy - 50);

      ctx.moveTo(cx - 80, cy + 60);
      ctx.lineTo(cx - 10, cy + 40);
      ctx.lineTo(cx + 50, cy + 70);
      ctx.lineTo(cx + 110, cy + 30);
      ctx.stroke();
      ctx.restore();
    } else {
      // Classic Sumo Dohyo rings & decals
      ctx.beginPath();
      ctx.arc(cx, cy, 65, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(cx - 35, cy - 4, 18, 8); // P1 mark
      ctx.fillRect(cx + 17, cy - 4, 18, 8); // P2 mark
    }

    // 4. Edge Warning Zone
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.arc(cx, cy, this.warningRadius, 0, Math.PI * 2, true);
    if (this.isSuddenDeath) {
      const pulse = (Math.sin(this.pulseTimer * 8) + 1) * 0.5;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + pulse * 0.4})`;
    } else if (this.dangerActive) {
      const pulse = (Math.sin(this.hazardFlashTimer) + 1) * 0.5;
      ctx.fillStyle = `rgba(234, 179, 8, ${0.25 + pulse * 0.35})`;
    } else {
      ctx.fillStyle = 'rgba(234, 179, 8, 0.12)';
    }
    ctx.fill();

    // 5. Outer Edge Border Rim
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = this.isSuddenDeath ? 6 : 4;
    ctx.strokeStyle = this.isSuddenDeath ? '#ef4444' : config.rimColor;
    if (this.isSuddenDeath) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 18;
    }
    ctx.stroke();

    // 6. Hazard Strobe Lights (Flashing red/yellow stripes when cars approach edge < 30px)
    if (this.dangerActive || this.isSuddenDeath) {
      ctx.save();
      const numSegments = 36;
      const step = (Math.PI * 2) / numSegments;
      const flash = Math.floor(this.hazardFlashTimer) % 2 === 0;

      for (let i = 0; i < numSegments; i++) {
        const segAngle = i * step;
        let isNearDangerCar = false;

        if (this.isSuddenDeath) {
          isNearDangerCar = true;
        } else {
          for (const da of this.dangerAngles) {
            let diff = Math.abs(segAngle - da);
            while (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff < 0.65) {
              isNearDangerCar = true;
              break;
            }
          }
        }

        if (isNearDangerCar) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, segAngle, segAngle + step * 0.85);
          ctx.lineWidth = 6;
          ctx.strokeStyle = (i % 2 === 0 ? flash : !flash) ? '#f59e0b' : '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 14;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    ctx.restore();
  }
}
