import { AIDifficulty, Vector2D } from '../types';
import { Car } from '../entities/Car';
import { Arena } from '../entities/Arena';
import { ItemManager } from '../entities/Item';
import { Physics } from '../core/Physics';

export class SumoAI {
  private difficulty: AIDifficulty;
  private reactionTimer: number = 0;
  private currentDecision: boolean = false; // whether AI chooses to hold thrust

  constructor(difficulty: AIDifficulty = 'normal') {
    this.difficulty = difficulty;
  }

  public setDifficulty(diff: AIDifficulty) {
    this.difficulty = diff;
  }

  public update(dt: number, aiCar: Car, opponentCar: Car, arena: Arena, itemManager: ItemManager): boolean {
    this.reactionTimer -= dt;
    if (this.reactionTimer > 0) {
      return this.currentDecision;
    }

    // Set next reaction tick
    let delay = 0.08;
    let angleTolerance = (14 * Math.PI) / 180;
    let itemDesire = 0.6;

    if (this.difficulty === 'easy') {
      delay = 0.18;
      angleTolerance = (24 * Math.PI) / 180;
      itemDesire = 0.2;
    } else if (this.difficulty === 'hard') {
      delay = 0.02;
      angleTolerance = (7 * Math.PI) / 180;
      itemDesire = 0.9;
    }
    this.reactionTimer = delay;

    // 1. Boundary Safety Check (Edge proximity)
    const distToCenter = Physics.dist(aiCar.pos, arena.center);
    const dangerDist = arena.currentRadius - 38;

    if (distToCenter > dangerDist) {
      // In danger zone!
      if (this.difficulty !== 'easy') {
        // Point towards arena center to recover
        const toCenter = Physics.sub(arena.center, aiCar.pos);
        const centerAngle = Math.atan2(toCenter.y, toCenter.x);
        let angleDiff = Math.abs(this.normalizeAngle(aiCar.angle - centerAngle));
        if (angleDiff < angleTolerance * 1.5) {
          this.currentDecision = true; // Thrust back to center!
          return true;
        } else {
          this.currentDecision = false; // Spin until facing center
          return false;
        }
      }
    }

    // 2. Select Target: Opponent or Mystery Box
    let targetPos: Vector2D = opponentCar.pos;

    if (itemManager.boxes.length > 0 && Math.random() < itemDesire) {
      const box = itemManager.boxes[0];
      const distToBox = Physics.dist(aiCar.pos, { x: box.x, y: box.y });
      const distToOpp = Physics.dist(aiCar.pos, opponentCar.pos);
      if (distToBox < distToOpp * 1.3) {
        targetPos = { x: box.x, y: box.y };
      }
    }

    // 3. Compute Angle to Target
    const toTarget = Physics.sub(targetPos, aiCar.pos);
    const targetAngle = Math.atan2(toTarget.y, toTarget.x);
    const angleDiff = Math.abs(this.normalizeAngle(aiCar.angle - targetAngle));

    // 4. Forward Raycast Safety (Hard mode)
    if (this.difficulty === 'hard') {
      const heading = { x: Math.cos(aiCar.angle), y: Math.sin(aiCar.angle) };
      const futurePos = {
        x: aiCar.pos.x + heading.x * aiCar.baseMaxSpeed * 0.45,
        y: aiCar.pos.y + heading.y * aiCar.baseMaxSpeed * 0.45,
      };

      if (Physics.dist(futurePos, arena.center) > arena.currentRadius - 10) {
        // Future position is off the ring
        const distOppToFuture = Physics.dist(opponentCar.pos, futurePos);
        if (distOppToFuture > 50) {
          // No opponent to stop us -> don't drive off cliff!
          this.currentDecision = false;
          return false;
        }
      }
    }

    // 5. Decision
    if (angleDiff < angleTolerance) {
      this.currentDecision = true;
    } else {
      this.currentDecision = false;
    }

    return this.currentDecision;
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }
}
