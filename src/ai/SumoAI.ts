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

  public getDifficulty(): AIDifficulty {
    return this.difficulty;
  }

  public update(dt: number, aiCar: Car, opponentCar: Car, arena: Arena, itemManager: ItemManager): boolean {
    this.reactionTimer -= dt;
    if (this.reactionTimer > 0) {
      return this.currentDecision;
    }

    // Reaction parameters based on difficulty:
    // easy: 輕鬆 (Casual)
    // normal: 老手 (Veteran)
    // hard: 相撲宗師 (Grandmaster)
    let delay = 0.08;
    let angleTolerance = (12 * Math.PI) / 180;
    let itemDesire = 0.65;

    if (this.difficulty === 'easy') {
      delay = 0.22;
      angleTolerance = (26 * Math.PI) / 180;
      itemDesire = 0.2;
    } else if (this.difficulty === 'hard') {
      delay = 0.02;
      angleTolerance = (6 * Math.PI) / 180;
      itemDesire = 0.95;
    }
    this.reactionTimer = delay;

    // 1. Boundary Danger Check & Cliff-Edge Emergency Recovery
    const distToCenter = Physics.dist(aiCar.pos, arena.center);
    const dangerDist = arena.currentRadius - 38;

    if (distToCenter > dangerDist) {
      if (this.difficulty === 'hard') {
        // Grandmaster Cliff-edge Recovery
        // Compute escape vector directly towards center
        const toCenter = Physics.sub(arena.center, aiCar.pos);
        const centerAngle = Math.atan2(toCenter.y, toCenter.x);
        const angleDiff = Math.abs(this.normalizeAngle(aiCar.angle - centerAngle));

        // If opponent is charging full-speed at us near the cliff:
        const oppSpeed = Physics.len(opponentCar.vel);
        const toAi = Physics.sub(aiCar.pos, opponentCar.pos);
        const isOpponentCharging = oppSpeed > 180 && Physics.dot(opponentCar.vel, toAi) > 0.6 * oppSpeed * Physics.len(toAi);

        if (isOpponentCharging && Physics.dist(aiCar.pos, opponentCar.pos) < 90) {
          // Feint: Don't thrust head-on into opponent near edge, let opponent overshoot!
          if (angleDiff < angleTolerance) {
            this.currentDecision = true;
            return true;
          } else {
            this.currentDecision = false;
            return false;
          }
        }

        // Align and burst towards center
        if (angleDiff < angleTolerance * 1.8) {
          this.currentDecision = true;
          return true;
        } else {
          this.currentDecision = false;
          return false;
        }
      } else if (this.difficulty === 'normal') {
        const toCenter = Physics.sub(arena.center, aiCar.pos);
        const centerAngle = Math.atan2(toCenter.y, toCenter.x);
        const angleDiff = Math.abs(this.normalizeAngle(aiCar.angle - centerAngle));
        if (angleDiff < angleTolerance * 1.5) {
          this.currentDecision = true;
          return true;
        } else {
          this.currentDecision = false;
          return false;
        }
      }
    }

    // 2. Tactical Nuclear Bomb Danger Evasion
    if (itemManager.tacticalBomb && !itemManager.tacticalBomb.exploded && !itemManager.tacticalBomb.isDropping) {
      const bomb = itemManager.tacticalBomb;
      const distToBomb = Physics.dist(aiCar.pos, bomb.pos);
      if (bomb.fuseTimer < 2.8 && distToBomb < 160 && (this.difficulty === 'hard' || this.difficulty === 'normal')) {
        // Run away from bomb!
        const escapeDir = Physics.normalize(Physics.sub(aiCar.pos, bomb.pos));
        const escapeTarget = Physics.add(aiCar.pos, Physics.scale(escapeDir, 180));
        // Keep inside arena
        if (Physics.dist(escapeTarget, arena.center) < arena.currentRadius - 20) {
          const toTarget = Physics.sub(escapeTarget, aiCar.pos);
          const targetAngle = Math.atan2(toTarget.y, toTarget.x);
          const angleDiff = Math.abs(this.normalizeAngle(aiCar.angle - targetAngle));
          this.currentDecision = angleDiff < angleTolerance * 1.5;
          return this.currentDecision;
        }
      }
    }

    // 3. Target Selection: Opponent vs High-value Power-up
    let targetPos: Vector2D = opponentCar.pos;

    if (itemManager.boxes.length > 0 && Math.random() < itemDesire) {
      const box = itemManager.boxes[0];
      const distToBox = Physics.dist(aiCar.pos, { x: box.x, y: box.y });
      const distToOpp = Physics.dist(aiCar.pos, opponentCar.pos);

      // Grandmaster AI strongly prioritizes EMP and Anchor
      const isPriorityItem = box.itemType === 'anchor' || box.itemType === 'emp';
      const weight = isPriorityItem ? 1.8 : 1.2;

      if (distToBox < distToOpp * weight) {
        targetPos = { x: box.x, y: box.y };
      }
    }

    // 3. Trajectory Prediction & Interception (Grandmaster AI)
    if (this.difficulty === 'hard' && targetPos === opponentCar.pos) {
      const oppSpeed = Physics.len(opponentCar.vel);
      const distToOpp = Physics.dist(aiCar.pos, opponentCar.pos);

      if (oppSpeed > 60) {
        // Lookahead time based on distance and relative velocity
        const lookaheadTime = Math.min(distToOpp / (aiCar.baseMaxSpeed * 0.9), 0.35);
        const predictedOppPos = {
          x: opponentCar.pos.x + opponentCar.vel.x * lookaheadTime,
          y: opponentCar.pos.y + opponentCar.vel.y * lookaheadTime,
        };

        // If predicted opponent pos is on arena, intercept there!
        if (Physics.dist(predictedOppPos, arena.center) < arena.currentRadius - 15) {
          targetPos = predictedOppPos;
        } else {
          // Opponent is flying off the arena on their own!
          // AI stays safe inside and lets them plunge!
          const toCenter = Physics.sub(arena.center, aiCar.pos);
          const centerAngle = Math.atan2(toCenter.y, toCenter.x);
          const angleDiff = Math.abs(this.normalizeAngle(aiCar.angle - centerAngle));
          this.currentDecision = angleDiff < angleTolerance && distToCenter > 80;
          return this.currentDecision;
        }
      }
    }

    // 4. Compute Angle to Target
    const toTarget = Physics.sub(targetPos, aiCar.pos);
    const targetAngle = Math.atan2(toTarget.y, toTarget.x);
    const angleDiff = Math.abs(this.normalizeAngle(aiCar.angle - targetAngle));

    // 5. Forward Raycast Safety (Avoid dashing off cliff on hard/normal)
    if (this.difficulty === 'hard') {
      const heading = { x: Math.cos(aiCar.angle), y: Math.sin(aiCar.angle) };
      const futurePos = {
        x: aiCar.pos.x + heading.x * aiCar.baseMaxSpeed * 0.45,
        y: aiCar.pos.y + heading.y * aiCar.baseMaxSpeed * 0.45,
      };

      if (Physics.dist(futurePos, arena.center) > arena.currentRadius - 10) {
        // Will overshoot cliff unless opponent stops us
        const distOppToFuture = Physics.dist(opponentCar.pos, futurePos);
        if (distOppToFuture > 45) {
          this.currentDecision = false;
          return false;
        }
      }
    }

    // 6. Thrust Decision
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
