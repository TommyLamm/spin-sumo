import { Vector2D } from '../types';

export class Physics {
  public static vec(x: number, y: number): Vector2D {
    return { x, y };
  }

  public static add(a: Vector2D, b: Vector2D): Vector2D {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  public static sub(a: Vector2D, b: Vector2D): Vector2D {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  public static scale(v: Vector2D, s: number): Vector2D {
    return { x: v.x * s, y: v.y * s };
  }

  public static dot(a: Vector2D, b: Vector2D): number {
    return a.x * b.x + a.y * b.y;
  }

  public static lenSq(v: Vector2D): number {
    return v.x * v.x + v.y * v.y;
  }

  public static len(v: Vector2D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  public static normalize(v: Vector2D): Vector2D {
    const l = Math.sqrt(v.x * v.x + v.y * v.y);
    if (l < 0.0001) return { x: 1, y: 0 };
    return { x: v.x / l, y: v.y / l };
  }

  public static dist(a: Vector2D, b: Vector2D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Resolve circle-circle collision with impulse resolution and position correction.
   * Returns collision details if a collision occurred.
   */
  public static resolveCircleCollision(
    p1: Vector2D,
    v1: Vector2D,
    m1: number,
    r1: number,
    angle1: number,
    p2: Vector2D,
    v2: Vector2D,
    m2: number,
    r2: number,
    angle2: number,
    restitution: number = 1.28
  ): {
    collided: boolean;
    contactPoint: Vector2D;
    normal: Vector2D;
    relativeSpeed: number;
    impulse: number;
    weakSpotHitP1: boolean; // P1 was struck in rear/side
    weakSpotHitP2: boolean; // P2 was struck in rear/side
  } {
    const delta = this.sub(p2, p1);
    const d = this.len(delta);
    const totalRadius = r1 + r2;

    if (d >= totalRadius || d < 0.0001) {
      return {
        collided: false,
        contactPoint: { x: 0, y: 0 },
        normal: { x: 1, y: 0 },
        relativeSpeed: 0,
        impulse: 0,
        weakSpotHitP1: false,
        weakSpotHitP2: false,
      };
    }

    // Normal pointing from 1 to 2
    const n = this.scale(delta, 1 / d);

    // 1. Position correction (prevent overlapping)
    const penetration = totalRadius - d;
    const totalMass = m1 + m2;
    const shift1 = (m2 / totalMass) * penetration;
    const shift2 = (m1 / totalMass) * penetration;

    p1.x -= n.x * shift1;
    p1.y -= n.y * shift1;
    p2.x += n.x * shift2;
    p2.y += n.y * shift2;

    // Contact point
    const contactPoint = {
      x: p1.x + n.x * r1,
      y: p1.y + n.y * r1,
    };

    // 2. Relative velocity along normal
    const relVel = this.sub(v1, v2);
    const velAlongNormal = this.dot(relVel, n);

    // Only resolve if objects are moving toward each other
    if (velAlongNormal <= 0) {
      return {
        collided: true,
        contactPoint,
        normal: n,
        relativeSpeed: 0,
        impulse: 0,
        weakSpotHitP1: false,
        weakSpotHitP2: false,
      };
    }

    // Weak spot detection:
    // Direction vector of P1's heading
    const h1 = { x: Math.cos(angle1), y: Math.sin(angle1) };
    // Direction vector of P2's heading
    const h2 = { x: Math.cos(angle2), y: Math.sin(angle2) };

    // Collision normal enters P2 from P1 (direction is +n)
    // If dot(n, h2) > 0.35, P1 struck P2 from behind / rear flank
    const weakSpotHitP2 = this.dot(n, h2) > 0.35;
    // Collision normal enters P1 from P2 (direction is -n)
    // If dot(-n, h1) > 0.35, P2 struck P1 from behind / rear flank
    const weakSpotHitP1 = this.dot(this.scale(n, -1), h1) > 0.35;

    let impulseMult = 1.0;
    if (weakSpotHitP1 || weakSpotHitP2) {
      impulseMult = 1.25; // +25% bonus bounce
    }

    const impulseScalar = ((1 + restitution) * velAlongNormal) / (1 / m1 + 1 / m2) * impulseMult;

    v1.x -= (impulseScalar / m1) * n.x;
    v1.y -= (impulseScalar / m1) * n.y;

    v2.x += (impulseScalar / m2) * n.x;
    v2.y += (impulseScalar / m2) * n.y;

    return {
      collided: true,
      contactPoint,
      normal: n,
      relativeSpeed: velAlongNormal,
      impulse: impulseScalar,
      weakSpotHitP1,
      weakSpotHitP2,
    };
  }
}
