import { GameState, GameMode, AIDifficulty, SumoSaveData } from '../types';
import { InputManager } from './Input';
import { Physics } from './Physics';
import { Arena } from '../entities/Arena';
import { Car } from '../entities/Car';
import { ItemManager } from '../entities/Item';
import { ParticleSystem } from '../entities/Particles';
import { SumoAI } from '../ai/SumoAI';
import { UIOverlay } from '../ui/UIOverlay';
import { SoundEffects } from '../audio/SoundEffects';
import { StorageManager } from '../storage/Storage';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private state: GameState = 'TITLE';
  private gameMode: GameMode = '1P_AI';
  private aiDifficulty: AIDifficulty = 'normal';

  private input: InputManager;
  private arena: Arena;
  private p1Car: Car;
  private p2Car: Car;
  private items: ItemManager;
  private particles: ParticleSystem;
  private ai: SumoAI;
  private ui: UIOverlay;

  private saveData: SumoSaveData;

  // Round & Score management
  private p1Score: number = 0;
  private p2Score: number = 0;
  private targetScore: number = 3; // First to 3 (BO5)
  private currentRound: number = 1;
  private roundTimer: number = 0;
  private countdownTimer: number = 3.2; // 3, 2, 1, GO
  private roundOverTimer: number = 0;
  private roundWinner: 1 | 2 = 1;

  // Title demo AI
  private titleAiP1: SumoAI;
  private titleAiP2: SumoAI;

  private lastTime: number = 0;
  private readonly fixedDt: number = 1 / 60;
  private accumulator: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot obtain 2D rendering context');
    this.ctx = context;

    this.saveData = StorageManager.load();
    SoundEffects.setMuted(this.saveData.settings.soundMuted);
    this.aiDifficulty = this.saveData.settings.aiDifficulty;

    this.input = new InputManager(canvas);
    this.arena = new Arena();
    this.p1Car = new Car(1);
    this.p2Car = new Car(2);
    this.items = new ItemManager();
    this.particles = new ParticleSystem();
    this.ai = new SumoAI(this.aiDifficulty);
    this.ui = new UIOverlay();

    this.titleAiP1 = new SumoAI('normal');
    this.titleAiP2 = new SumoAI('normal');

    this.setupEventListeners();
    this.setupTitleUI();
    this.initTitleDemo();
  }

  private setupEventListeners() {
    const getCanvasPos = (clientX: number, clientY: number) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      SoundEffects.unlock();
      const pos = getCanvasPos(e.clientX, e.clientY);

      // Check sound toggle in HUD
      if (this.state === 'IN_ROUND' || this.state === 'ROUND_READY' || this.state === 'ROUND_OVER') {
        if (pos.x > 620 && pos.y < 60) {
          this.toggleSound();
          return;
        }
      }

      if (this.ui.handleClick(pos.x, pos.y)) {
        SoundEffects.playButtonClick();
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const pos = getCanvasPos(e.clientX, e.clientY);
      this.ui.handleMouseMove(pos.x, pos.y);
    });
  }

  private toggleSound() {
    const newMuted = !SoundEffects.isMuted();
    SoundEffects.setMuted(newMuted);
    this.saveData.settings.soundMuted = newMuted;
    StorageManager.save(this.saveData);
  }

  private setupTitleUI() {
    this.ui.clearButtons();

    // Mode: 1P vs AI
    this.ui.addButton({
      id: 'btn_1p',
      x: 210,
      y: 255,
      w: 300,
      h: 56,
      text: '挑戰電腦 (1P vs AI)',
      subtext: `當前難度: ${this.getDifficultyName()}`,
      color: '#0284c7',
      hoverColor: '#0369a1',
      onClick: () => {
        this.startMatch('1P_AI');
      },
    });

    // Difficulty toggle
    this.ui.addButton({
      id: 'btn_diff',
      x: 210,
      y: 325,
      w: 300,
      h: 46,
      text: `切換難度: ${this.getDifficultyName()}`,
      color: '#334155',
      hoverColor: '#475569',
      onClick: () => {
        if (this.aiDifficulty === 'easy') this.aiDifficulty = 'normal';
        else if (this.aiDifficulty === 'normal') this.aiDifficulty = 'hard';
        else this.aiDifficulty = 'easy';

        this.ai.setDifficulty(this.aiDifficulty);
        this.saveData.settings.aiDifficulty = this.aiDifficulty;
        StorageManager.save(this.saveData);
        this.setupTitleUI();
      },
    });

    // Mode: 2P Local
    this.ui.addButton({
      id: 'btn_2p',
      x: 210,
      y: 385,
      w: 300,
      h: 56,
      text: '雙人同機 (1P vs 2P)',
      subtext: '鍵盤 A / L 鍵 或 觸控兩端',
      color: '#e11d48',
      hoverColor: '#be123c',
      onClick: () => {
        this.startMatch('2P_LOCAL');
      },
    });

    // Sound toggle
    this.ui.addButton({
      id: 'btn_sound',
      x: 580,
      y: 20,
      w: 120,
      h: 40,
      text: SoundEffects.isMuted() ? '🔇 靜音' : '🔊 音效',
      color: '#1e293b',
      hoverColor: '#334155',
      onClick: () => {
        this.toggleSound();
        this.setupTitleUI();
      },
    });
  }

  private getDifficultyName(): string {
    if (this.aiDifficulty === 'easy') return '簡單 (Easy)';
    if (this.aiDifficulty === 'normal') return '普通 (Normal)';
    return '相撲大師 (Master)';
  }

  private initTitleDemo() {
    this.arena.reset();
    this.p1Car.reset({ x: 260, y: 360 }, 0);
    this.p2Car.reset({ x: 460, y: 360 }, Math.PI);
    this.items.reset();
  }

  private startMatch(mode: GameMode) {
    this.gameMode = mode;
    this.p1Score = 0;
    this.p2Score = 0;
    this.currentRound = 1;
    this.ui.clearButtons();
    this.startRound();
  }

  private startRound() {
    this.state = 'ROUND_READY';
    this.roundTimer = 0;
    this.countdownTimer = 3.2;
    this.roundOverTimer = 0;

    this.arena.reset();
    this.p1Car.reset({ x: 260, y: 360 }, 0);
    this.p2Car.reset({ x: 460, y: 360 }, Math.PI);
    this.items.reset();
    this.particles.clear();

    SoundEffects.playCountdownBeep(false);
  }

  public start() {
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  private loop(currentTime: number) {
    const elapsed = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.accumulator += elapsed;
    while (this.accumulator >= this.fixedDt) {
      this.update(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number) {
    this.input.update();
    this.particles.update(dt);

    if (this.state === 'TITLE') {
      this.updateTitleDemo(dt);
      return;
    }

    if (this.state === 'ROUND_READY') {
      const prev = Math.ceil(this.countdownTimer);
      this.countdownTimer -= dt;
      const cur = Math.ceil(this.countdownTimer);

      if (cur < prev && cur > 0) {
        SoundEffects.playCountdownBeep(false);
      } else if (this.countdownTimer <= 0 && prev > 0) {
        SoundEffects.playCountdownBeep(true);
        this.state = 'IN_ROUND';
      }
      return;
    }

    if (this.state === 'IN_ROUND') {
      this.roundTimer += dt;
      this.arena.update(dt, this.roundTimer);
      this.items.update(dt, this.arena.currentRadius, this.arena.center);

      // 1. Gather player inputs
      const p1In = this.input.getP1Input();
      let p2Held = false;

      if (this.gameMode === '1P_AI') {
        p2Held = this.ai.update(dt, this.p2Car, this.p1Car, this.arena, this.items);
      } else {
        p2Held = this.input.getP2Input().holding;
      }

      // 2. Arena edge slope forces
      const p1Slope = this.arena.getEdgeSlopeForce(this.p1Car.pos, this.p1Car.currentRadius);
      const p2Slope = this.arena.getEdgeSlopeForce(this.p2Car.pos, this.p2Car.currentRadius);

      // 3. Update Car physics
      this.p1Car.update(dt, p1In.holding, p1Slope, this.particles);
      this.p2Car.update(dt, p2Held, p2Slope, this.particles);

      // 4. Car-to-Car Collision Resolution
      if (!this.p1Car.isFalling && !this.p2Car.isFalling) {
        const col = Physics.resolveCircleCollision(
          this.p1Car.pos,
          this.p1Car.vel,
          this.p1Car.currentMass,
          this.p1Car.currentRadius,
          this.p1Car.angle,
          this.p2Car.pos,
          this.p2Car.vel,
          this.p2Car.currentMass,
          this.p2Car.currentRadius,
          this.p2Car.angle,
          1.28
        );

        if (col.collided) {
          SoundEffects.playClang(col.relativeSpeed / 200);
          this.particles.addSparks(col.contactPoint, 16, '#ffd700');
          this.particles.triggerShake(Math.min(col.relativeSpeed * 0.03, 10), 0.15);

          // Reverse rotation directions on bump
          this.p1Car.reverseSpin();
          this.p2Car.reverseSpin();

          // Weak spot hit penalties
          if (col.weakSpotHitP1) {
            this.p1Car.triggerWeakSpotStun();
            this.particles.addSparks(this.p1Car.pos, 10, '#38bdf8');
          }
          if (col.weakSpotHitP2) {
            this.p2Car.triggerWeakSpotStun();
            this.particles.addSparks(this.p2Car.pos, 10, '#fb7185');
          }

          // Hot potato bomb transfer
          if (this.p1Car.hasBomb && !this.p2Car.hasBomb) {
            this.p1Car.hasBomb = false;
            this.p2Car.hasBomb = true;
            this.p2Car.bombTimer = this.p1Car.bombTimer;
            SoundEffects.playBombTick();
          } else if (this.p2Car.hasBomb && !this.p1Car.hasBomb) {
            this.p2Car.hasBomb = false;
            this.p1Car.hasBomb = true;
            this.p1Car.bombTimer = this.p2Car.bombTimer;
            SoundEffects.playBombTick();
          }
        }
      }

      // 5. Item pickups
      const p1Item = this.items.checkCollisionsWithCar(this.p1Car.pos, this.p1Car.currentRadius);
      if (p1Item) {
        SoundEffects.playItemPickup();
        if (p1Item === 'oil') {
          this.items.addOilPuddle(this.p1Car.pos);
        } else {
          this.p1Car.applyItem(p1Item);
        }
        this.particles.addSparks(this.p1Car.pos, 14, '#38bdf8');
      }

      const p2Item = this.items.checkCollisionsWithCar(this.p2Car.pos, this.p2Car.currentRadius);
      if (p2Item) {
        SoundEffects.playItemPickup();
        if (p2Item === 'oil') {
          this.items.addOilPuddle(this.p2Car.pos);
        } else {
          this.p2Car.applyItem(p2Item);
        }
        this.particles.addSparks(this.p2Car.pos, 14, '#fb7185');
      }

      // 6. Oil puddle check
      if (this.items.checkOilPuddle(this.p1Car.pos, this.p1Car.currentRadius)) {
        this.p1Car.triggerOilSlip();
      }
      if (this.items.checkOilPuddle(this.p2Car.pos, this.p2Car.currentRadius)) {
        this.p2Car.triggerOilSlip();
      }

      // 7. Bomb explosions
      if (this.p1Car.hasBomb && this.p1Car.bombTimer <= 0) {
        this.explodeBomb(this.p1Car, this.p2Car);
      }
      if (this.p2Car.hasBomb && this.p2Car.bombTimer <= 0) {
        this.explodeBomb(this.p2Car, this.p1Car);
      }

      // 8. Ring-Out / Fall check
      if (!this.p1Car.isFalling && this.arena.isFallen(this.p1Car.pos)) {
        this.p1Car.isFalling = true;
        SoundEffects.playFall();
        this.onCarFell(2); // P2 wins round
      }
      if (!this.p2Car.isFalling && this.arena.isFallen(this.p2Car.pos)) {
        this.p2Car.isFalling = true;
        SoundEffects.playFall();
        this.onCarFell(1); // P1 wins round
      }
    } else if (this.state === 'ROUND_OVER') {
      this.p1Car.update(dt, false, { x: 0, y: 0 }, this.particles);
      this.p2Car.update(dt, false, { x: 0, y: 0 }, this.particles);

      this.roundOverTimer += dt;
      if (this.roundOverTimer >= 2.0) {
        if (this.p1Score >= this.targetScore || this.p2Score >= this.targetScore) {
          this.finishMatch();
        } else {
          this.currentRound += 1;
          this.startRound();
        }
      }
    }
  }

  private explodeBomb(carrier: Car, other: Car) {
    carrier.hasBomb = false;
    SoundEffects.playExplosion();
    this.particles.addShockwave(carrier.pos, 140, '#ef4444');
    this.particles.triggerShake(14, 0.35);

    // Blast carrier far outward
    const blastDir = Physics.normalize(Physics.sub(carrier.pos, this.arena.center));
    carrier.vel = Physics.scale(blastDir, 850);

    // Blast other car if nearby
    const dist = Physics.dist(carrier.pos, other.pos);
    if (dist < 140) {
      const otherDir = Physics.normalize(Physics.sub(other.pos, carrier.pos));
      other.vel = Physics.scale(otherDir, 550);
    }
  }

  private onCarFell(roundWinner: 1 | 2) {
    this.roundWinner = roundWinner;
    if (roundWinner === 1) this.p1Score += 1;
    else this.p2Score += 1;

    this.state = 'ROUND_OVER';
    this.roundOverTimer = 0;
    SoundEffects.playRoundWin();
  }

  private finishMatch() {
    this.state = 'MATCH_OVER';
    SoundEffects.playMatchVictory();
    this.particles.addConfetti(this.arena.center, 80);

    const winner = this.p1Score >= this.targetScore ? 'p1' : (this.gameMode === '1P_AI' ? 'ai' : 'p2');
    this.saveData = StorageManager.recordMatch(winner, this.gameMode === '1P_AI');

    this.ui.clearButtons();
    this.ui.addButton({
      id: 'btn_rematch',
      x: 210,
      y: 350,
      w: 300,
      h: 56,
      text: '再來一局 (Rematch)',
      color: '#0284c7',
      hoverColor: '#0369a1',
      onClick: () => {
        this.startMatch(this.gameMode);
      },
    });

    this.ui.addButton({
      id: 'btn_menu',
      x: 210,
      y: 425,
      w: 300,
      h: 50,
      text: '返回主選單 (Menu)',
      color: '#334155',
      hoverColor: '#475569',
      onClick: () => {
        this.state = 'TITLE';
        this.setupTitleUI();
        this.initTitleDemo();
      },
    });
  }

  private updateTitleDemo(dt: number) {
    this.arena.update(dt, 0);

    const p1Held = this.titleAiP1.update(dt, this.p1Car, this.p2Car, this.arena, this.items);
    const p2Held = this.titleAiP2.update(dt, this.p2Car, this.p1Car, this.arena, this.items);

    this.p1Car.update(dt, p1Held, { x: 0, y: 0 }, this.particles);
    this.p2Car.update(dt, p2Held, { x: 0, y: 0 }, this.particles);

    // Demo collision
    Physics.resolveCircleCollision(
      this.p1Car.pos,
      this.p1Car.vel,
      this.p1Car.currentMass,
      this.p1Car.currentRadius,
      this.p1Car.angle,
      this.p2Car.pos,
      this.p2Car.vel,
      this.p2Car.currentMass,
      this.p2Car.currentRadius,
      this.p2Car.angle,
      1.15
    );

    // Keep cars inside arena for demo
    for (const car of [this.p1Car, this.p2Car]) {
      const d = Physics.dist(car.pos, this.arena.center);
      if (d > this.arena.currentRadius - 30) {
        const toCenter = Physics.normalize(Physics.sub(this.arena.center, car.pos));
        car.vel.x += toCenter.x * 200 * dt;
        car.vel.y += toCenter.y * 200 * dt;
      }
    }
  }

  private render() {
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Screen Shake
    const shake = this.particles.getShakeOffset();
    this.ctx.translate(shake.x, shake.y);

    // 1. Draw Arena & Skidmarks
    this.arena.draw(this.ctx);
    this.particles.drawSkidMarks(this.ctx);

    // 2. Draw Items
    this.items.draw(this.ctx);

    // 3. Draw Cars
    this.p1Car.draw(this.ctx);
    this.p2Car.draw(this.ctx);

    // 4. Draw Particles
    this.particles.drawParticles(this.ctx);

    this.ctx.restore();

    // 5. Draw UI Overlay
    if (this.state === 'TITLE') {
      this.ui.drawTitleScreen(this.ctx, this.saveData.stats);
      this.ui.drawButtons(this.ctx);
    } else if (this.state === 'ROUND_READY') {
      this.ui.drawTouchIndicators(this.ctx, this.p1Car.isHolding, this.p2Car.isHolding, this.gameMode);
      this.ui.drawHUD(
        this.ctx,
        this.p1Score,
        this.p2Score,
        this.targetScore,
        this.roundTimer,
        this.arena.isSuddenDeath,
        this.gameMode,
        SoundEffects.isMuted()
      );
      this.ui.drawRoundCountdown(this.ctx, this.currentRound, this.countdownTimer);
    } else if (this.state === 'IN_ROUND') {
      this.ui.drawTouchIndicators(this.ctx, this.p1Car.isHolding, this.p2Car.isHolding, this.gameMode);
      this.ui.drawHUD(
        this.ctx,
        this.p1Score,
        this.p2Score,
        this.targetScore,
        this.roundTimer,
        this.arena.isSuddenDeath,
        this.gameMode,
        SoundEffects.isMuted()
      );
    } else if (this.state === 'ROUND_OVER') {
      this.ui.drawHUD(
        this.ctx,
        this.p1Score,
        this.p2Score,
        this.targetScore,
        this.roundTimer,
        this.arena.isSuddenDeath,
        this.gameMode,
        SoundEffects.isMuted()
      );
      this.ui.drawRoundOver(this.ctx, this.roundWinner, this.gameMode === '1P_AI');
    } else if (this.state === 'MATCH_OVER') {
      const winner = this.p1Score >= this.targetScore ? 1 : 2;
      this.ui.drawMatchVictory(
        this.ctx,
        winner,
        this.gameMode === '1P_AI',
        this.p1Score,
        this.p2Score
      );
      this.ui.drawButtons(this.ctx);
    }
  }
}
