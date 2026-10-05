import {
  GameState,
  GameMode,
  AIDifficulty,
  ArenaTheme,
  SumoSaveData,
  VehicleClassId,
  TournamentData,
} from '../types';
import { InputManager } from './Input';
import { Physics } from './Physics';
import { Arena, ARENA_THEMES } from '../entities/Arena';
import { Car, VEHICLE_CLASSES } from '../entities/Car';
import { ItemManager } from '../entities/Item';
import { ParticleSystem } from '../entities/Particles';
import { SumoAI } from '../ai/SumoAI';
import { UIOverlay } from '../ui/UIOverlay';
import { SoundEffects } from '../audio/SoundEffects';
import { StorageManager } from '../storage/Storage';
import { Playroom } from '../playroom-sdk';

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private state: GameState = 'TITLE';
  private gameMode: GameMode = '1P_AI';
  private aiDifficulty: AIDifficulty = 'normal';
  private selectedArena: ArenaTheme = 'classic';

  private input: InputManager;
  private arena: Arena;
  private p1Car: Car;
  private p2Car: Car;
  private items: ItemManager;
  private particles: ParticleSystem;
  private ai: SumoAI;
  private ui: UIOverlay;

  private saveData: SumoSaveData;

  // Vehicle class selections
  private p1Class: VehicleClassId = 'classic';
  private p2Class: VehicleClassId = 'classic';

  // Tournament Cup state
  private tournament: TournamentData = {
    active: false,
    currentStageIndex: 0,
    stages: ['classic', 'frost', 'magma'],
    p1Wins: 0,
    p2Wins: 0,
  };

  // Round & Score management
  private p1Score: number = 0;
  private p2Score: number = 0;
  private targetScore: number = 3; // First to 3 in quick match, first to 2 (BO3) in tournament
  private currentRound: number = 1;
  private roundTimer: number = 0;
  private countdownTimer: number = 3.2; // 3, 2, 1, GO
  private roundOverTimer: number = 0;
  private roundWinner: 1 | 2 = 1;
  private stageWinner: 1 | 2 = 1;

  // Playroom Leaderboard run state
  private currentRunId: string | null = null;
  private currentRunPromise: Promise<{ runId: string } | null> | null = null;

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
    this.selectedArena = this.saveData.settings.selectedArena || 'classic';
    this.p1Class = this.saveData.settings.p1Class || 'classic';
    this.p2Class = this.saveData.settings.p2Class || 'classic';

    this.input = new InputManager(canvas);
    this.arena = new Arena(this.selectedArena);
    this.p1Car = new Car(1, this.p1Class);
    this.p2Car = new Car(2, this.p2Class);
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
      if (
        this.state === 'IN_ROUND' ||
        this.state === 'ROUND_READY' ||
        this.state === 'ROUND_OVER'
      ) {
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

    // 1. Tournament Cup Mode (Highlight Hero Button)
    this.ui.addButton({
      id: 'btn_tournament',
      x: 210,
      y: 220,
      w: 300,
      h: 52,
      text: '🏆 大獎賽巡迴盃 (Tournament)',
      subtext: '經典水泥 ➔ 極地冰場 ➔ 熔岩工廠 三連戰',
      color: '#d97706',
      hoverColor: '#b45309',
      onClick: () => {
        this.startTournament('TOURNAMENT');
      },
    });

    // 2. Mode: 1P vs AI
    this.ui.addButton({
      id: 'btn_1p',
      x: 210,
      y: 280,
      w: 300,
      h: 46,
      text: '挑戰電腦 (1P vs AI)',
      subtext: `難度: ${this.getDifficultyName()}`,
      color: '#0284c7',
      hoverColor: '#0369a1',
      onClick: () => {
        this.startMatch('1P_AI');
      },
    });

    // 3. Mode: 2P Local
    this.ui.addButton({
      id: 'btn_2p',
      x: 210,
      y: 334,
      w: 300,
      h: 46,
      text: '雙人同機 (1P vs 2P)',
      subtext: '鍵盤 [A] / [L] 鍵 或 觸控螢幕兩側',
      color: '#e11d48',
      hoverColor: '#be123c',
      onClick: () => {
        this.startMatch('2P_LOCAL');
      },
    });

    // 4. Vehicle Garage & Class Select
    this.ui.addButton({
      id: 'btn_garage',
      x: 210,
      y: 388,
      w: 300,
      h: 44,
      text: '🏎️ 戰車工坊 (Vehicle Garage)',
      subtext: `P1: ${VEHICLE_CLASSES[this.p1Class].name} | P2: ${VEHICLE_CLASSES[this.p2Class].name}`,
      color: '#4f46e5',
      hoverColor: '#4338ca',
      onClick: () => {
        this.openCarSelect();
      },
    });

    // 5. Difficulty toggle
    this.ui.addButton({
      id: 'btn_diff',
      x: 140,
      y: 440,
      w: 215,
      h: 40,
      text: `AI: ${this.getDifficultyName()}`,
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

    // 6. Arena Theme toggle
    this.ui.addButton({
      id: 'btn_arena',
      x: 365,
      y: 440,
      w: 215,
      h: 40,
      text: `擂台: ${this.getArenaName()}`,
      color:
        this.selectedArena === 'magma'
          ? '#7f1d1d'
          : this.selectedArena === 'frost'
          ? '#0e7490'
          : '#475569',
      hoverColor:
        this.selectedArena === 'magma'
          ? '#991b1b'
          : this.selectedArena === 'frost'
          ? '#0891b2'
          : '#64748b',
      onClick: () => {
        if (this.selectedArena === 'classic') this.selectedArena = 'frost';
        else if (this.selectedArena === 'frost') this.selectedArena = 'magma';
        else this.selectedArena = 'classic';

        this.arena.setTheme(this.selectedArena);
        this.saveData.settings.selectedArena = this.selectedArena;
        StorageManager.save(this.saveData);
        this.setupTitleUI();
      },
    });

    // 7. Sound toggle
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

  private openCarSelect() {
    this.state = 'CAR_SELECT';
    this.ui.clearButtons();

    const classList: VehicleClassId[] = ['classic', 'speedster', 'juggernaut', 'drifter'];
    const cardW = 155;
    const spacing = 16;
    const startX = 360 - (cardW * 4 + spacing * 3) / 2;

    // Add buttons for selecting P1 vehicle
    classList.forEach((cId, idx) => {
      const cx = startX + idx * (cardW + spacing);
      this.ui.addButton({
        id: `btn_select_p1_${cId}`,
        x: cx + 6,
        y: 495,
        w: cardW - 12,
        h: 36,
        text: '選為 P1',
        color: this.p1Class === cId ? '#0284c7' : '#334155',
        hoverColor: '#0369a1',
        onClick: () => {
          this.p1Class = cId;
          this.p1Car.setVehicleClass(cId);
          this.saveData.settings.p1Class = cId;
          StorageManager.save(this.saveData);
          this.openCarSelect();
        },
      });

      // Add buttons for selecting P2 / AI vehicle
      this.ui.addButton({
        id: `btn_select_p2_${cId}`,
        x: cx + 6,
        y: 538,
        w: cardW - 12,
        h: 36,
        text: '選為 P2/AI',
        color: this.p2Class === cId ? '#be123c' : '#334155',
        hoverColor: '#9f1239',
        onClick: () => {
          this.p2Class = cId;
          this.p2Car.setVehicleClass(cId);
          this.saveData.settings.p2Class = cId;
          StorageManager.save(this.saveData);
          this.openCarSelect();
        },
      });
    });

    // Start battle button
    this.ui.addButton({
      id: 'btn_car_start',
      x: 170,
      y: 605,
      w: 180,
      h: 52,
      text: '🚀 出戰！(Battle)',
      color: '#059669',
      hoverColor: '#047857',
      onClick: () => {
        this.startMatch('1P_AI');
      },
    });

    // Back to menu button
    this.ui.addButton({
      id: 'btn_car_back',
      x: 370,
      y: 605,
      w: 180,
      h: 52,
      text: '返回主選單 (Menu)',
      color: '#475569',
      hoverColor: '#334155',
      onClick: () => {
        this.state = 'TITLE';
        this.setupTitleUI();
        this.initTitleDemo();
      },
    });
  }

  private getDifficultyName(): string {
    if (this.aiDifficulty === 'easy') return '輕鬆 (Casual)';
    if (this.aiDifficulty === 'normal') return '老手 (Veteran)';
    return '相撲宗師 (Grandmaster)';
  }

  private getArenaName(): string {
    if (this.selectedArena === 'classic') return '經典水泥';
    if (this.selectedArena === 'frost') return '極地溜冰場';
    return '熔岩工廠';
  }

  private initTitleDemo() {
    this.arena.reset();
    this.p1Car.setVehicleClass(this.p1Class);
    this.p2Car.setVehicleClass(this.p2Class);
    this.p1Car.reset({ x: 260, y: 360 }, 0);
    this.p2Car.reset({ x: 460, y: 360 }, Math.PI);
    this.items.reset();
  }

  private startTournament(mode: 'TOURNAMENT' | 'TOURNAMENT_2P') {
    this.tournament = {
      active: true,
      currentStageIndex: 0,
      stages: ['classic', 'frost', 'magma'],
      p1Wins: 0,
      p2Wins: 0,
    };

    this.gameMode = mode;
    this.selectedArena = this.tournament.stages[0];
    this.arena.setTheme(this.selectedArena);
    this.targetScore = 2; // BO3 in tournament stages
    this.p1Score = 0;
    this.p2Score = 0;
    this.currentRound = 1;
    this.ui.clearButtons();

    // Playroom Run session for 1P tournament
    this.currentRunId = null;
    this.currentRunPromise = null;
    if (mode === 'TOURNAMENT') {
      try {
        this.currentRunPromise = Playroom.startRun()
          .then((res) => {
            if (res && res.runId) {
              this.currentRunId = res.runId;
            }
            return res;
          })
          .catch((err) => {
            console.warn('Playroom startRun failed:', err);
            return null;
          });
      } catch (err) {
        console.warn('Playroom startRun sync exception:', err);
      }
    }

    this.p1Car.setVehicleClass(this.p1Class);
    this.p2Car.setVehicleClass(this.p2Class);
    this.startRound();
  }

  private startMatch(mode: GameMode) {
    this.tournament.active = false;
    this.gameMode = mode;
    this.targetScore = 3; // First to 3
    this.p1Score = 0;
    this.p2Score = 0;
    this.currentRound = 1;
    this.ui.clearButtons();

    // Playroom run session for 1P vs AI
    this.currentRunId = null;
    this.currentRunPromise = null;
    if (mode === '1P_AI') {
      try {
        this.currentRunPromise = Playroom.startRun()
          .then((res) => {
            if (res && res.runId) {
              this.currentRunId = res.runId;
            }
            return res;
          })
          .catch((err) => {
            console.warn('Playroom startRun failed:', err);
            return null;
          });
      } catch (err) {
        console.warn('Playroom startRun sync exception:', err);
      }
    }

    this.p1Car.setVehicleClass(this.p1Class);
    this.p2Car.setVehicleClass(this.p2Class);
    this.arena.setTheme(this.selectedArena);
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

    if (this.state === 'CAR_SELECT') {
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
      this.arena.update(dt, this.roundTimer, this.particles);

      // Tactical Bomb & Mystery items
      this.items.update(
        dt,
        this.arena.currentRadius,
        this.arena.center,
        this.roundTimer,
        this.particles,
        [this.p1Car, this.p2Car]
      );

      // Check proximity of cars to edge for hazard light warning
      this.arena.checkEdgeDanger([this.p1Car.pos, this.p2Car.pos]);

      // 1. Gather player inputs
      const p1In = this.input.getP1Input();
      let p2Held = false;

      if (this.gameMode === '1P_AI' || this.gameMode === 'TOURNAMENT') {
        p2Held = this.ai.update(dt, this.p2Car, this.p1Car, this.arena, this.items);
      } else {
        p2Held = this.input.getP2Input().holding;
      }

      // 2. Arena edge slope forces
      const p1Slope = this.arena.getEdgeSlopeForce(this.p1Car.pos, this.p1Car.currentRadius);
      const p2Slope = this.arena.getEdgeSlopeForce(this.p2Car.pos, this.p2Car.currentRadius);

      // 3. Update Car physics with Arena Theme friction
      const arenaConfig = this.arena.getThemeConfig();
      this.p1Car.update(dt, p1In.holding, p1Slope, this.particles, arenaConfig.friction);
      this.p2Car.update(dt, p2Held, p2Slope, this.particles, arenaConfig.friction);

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
          arenaConfig.restitution
        );

        if (col.collided) {
          SoundEffects.playClang(col.relativeSpeed / 160);

          // Intense sparks & expanding shockwave ring
          this.particles.addIntenseCollisionSparks(col.contactPoint, 26, col.relativeSpeed / 180);
          this.particles.addShockwave(
            col.contactPoint,
            70 + Math.min(100, col.relativeSpeed * 0.25),
            '#ffd700'
          );
          this.particles.triggerShake(Math.min(col.relativeSpeed * 0.045, 14), 0.18);

          // Apply squash & stretch impact deformation
          this.p1Car.applyDeformation(col.normal, col.relativeSpeed);
          this.p2Car.applyDeformation({ x: -col.normal.x, y: -col.normal.y }, col.relativeSpeed);

          // Reverse rotation directions on bump
          this.p1Car.reverseSpin();
          this.p2Car.reverseSpin();

          // Weak spot hit penalties
          if (col.weakSpotHitP1) {
            this.p1Car.triggerWeakSpotStun();
            this.particles.addIntenseCollisionSparks(this.p1Car.pos, 14, 1.2);
          }
          if (col.weakSpotHitP2) {
            this.p2Car.triggerWeakSpotStun();
            this.particles.addIntenseCollisionSparks(this.p2Car.pos, 14, 1.2);
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
        } else if (p1Item === 'emp') {
          SoundEffects.playEmpShock();
          this.particles.addEmpShockwave(this.p1Car.pos, 220);
          this.p2Car.triggerEmpStun();
        } else {
          this.p1Car.applyItem(p1Item);
        }
        this.particles.addIntenseCollisionSparks(this.p1Car.pos, 18, 0.9);
      }

      const p2Item = this.items.checkCollisionsWithCar(this.p2Car.pos, this.p2Car.currentRadius);
      if (p2Item) {
        SoundEffects.playItemPickup();
        if (p2Item === 'oil') {
          this.items.addOilPuddle(this.p2Car.pos);
        } else if (p2Item === 'emp') {
          SoundEffects.playEmpShock();
          this.particles.addEmpShockwave(this.p2Car.pos, 220);
          this.p1Car.triggerEmpStun();
        } else {
          this.p2Car.applyItem(p2Item);
        }
        this.particles.addIntenseCollisionSparks(this.p2Car.pos, 18, 0.9);
      }

      // 6. Oil puddle check
      if (this.items.checkOilPuddle(this.p1Car.pos, this.p1Car.currentRadius)) {
        this.p1Car.triggerOilSlip();
      }
      if (this.items.checkOilPuddle(this.p2Car.pos, this.p2Car.currentRadius)) {
        this.p2Car.triggerOilSlip();
      }

      // 7. Ring-Out / Fall check
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
      const arenaConfig = this.arena.getThemeConfig();
      this.p1Car.update(dt, false, { x: 0, y: 0 }, this.particles, arenaConfig.friction);
      this.p2Car.update(dt, false, { x: 0, y: 0 }, this.particles, arenaConfig.friction);

      this.roundOverTimer += dt;
      if (this.roundOverTimer >= 1.9) {
        if (this.p1Score >= this.targetScore || this.p2Score >= this.targetScore) {
          if (this.tournament.active) {
            this.handleTournamentStageEnd();
          } else {
            this.finishMatch();
          }
        } else {
          this.currentRound += 1;
          this.startRound();
        }
      }
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

  private handleTournamentStageEnd() {
    this.stageWinner = this.p1Score >= this.targetScore ? 1 : 2;
    if (this.stageWinner === 1) this.tournament.p1Wins += 1;
    else this.tournament.p2Wins += 1;

    // Check if tournament is finished (after 3 stages or decisive lead)
    const isLastStage = this.tournament.currentStageIndex >= 2;

    if (isLastStage) {
      this.finishTournament();
    } else {
      // Transition to STAGE_OVER screen
      this.state = 'STAGE_OVER';
      SoundEffects.playRoundWin();

      this.ui.clearButtons();
      const nextStageIndex = this.tournament.currentStageIndex + 1;
      const nextTheme = this.tournament.stages[nextStageIndex];
      const nextConfig = ARENA_THEMES[nextTheme];

      this.ui.addButton({
        id: 'btn_next_stage',
        x: 210,
        y: 450,
        w: 300,
        h: 56,
        text: `前往下一站：【${nextConfig.name}】`,
        color: '#d97706',
        hoverColor: '#b45309',
        onClick: () => {
          this.tournament.currentStageIndex = nextStageIndex;
          this.selectedArena = nextTheme;
          this.arena.setTheme(this.selectedArena);
          this.p1Score = 0;
          this.p2Score = 0;
          this.currentRound = 1;
          this.startRound();
        },
      });
    }
  }

  private finishTournament() {
    this.state = 'MATCH_OVER';
    SoundEffects.playCupVictory();
    this.particles.addConfetti(this.arena.center, 110);

    const winnerId: 1 | 2 = this.tournament.p1Wins >= this.tournament.p2Wins ? 1 : 2;
    const isAi = this.gameMode === 'TOURNAMENT';

    if (winnerId === 1) {
      this.saveData = StorageManager.recordTournamentWin();
    } else {
      this.saveData = StorageManager.recordMatch(isAi ? 'ai' : 'p2', isAi);
    }

    // Leaderboard streak reporting
    if (isAi && winnerId === 1) {
      const currentStreak = Math.max(0, Math.floor(this.saveData.stats.currentStreak));
      const runPromise = this.currentRunPromise;
      const initialRunId = this.currentRunId;

      (async () => {
        try {
          let runId = initialRunId;
          if (!runId && runPromise) {
            const res = await runPromise;
            runId = res?.runId ?? null;
          }
          if (runId) {
            await Playroom.finishRun({ runId, score: currentStreak });
          }
        } catch (e) {
          console.warn('Playroom finishRun failed:', e);
        }
      })();
    }

    this.ui.clearButtons();
    this.ui.addButton({
      id: 'btn_rematch_cup',
      x: 210,
      y: 400,
      w: 300,
      h: 56,
      text: '再戰大獎賽 (Replay Cup)',
      color: '#d97706',
      hoverColor: '#b45309',
      onClick: () => {
        this.startTournament('TOURNAMENT');
      },
    });

    this.ui.addButton({
      id: 'btn_menu',
      x: 210,
      y: 470,
      w: 300,
      h: 50,
      text: '返回主選單 (Menu)',
      color: '#334155',
      hoverColor: '#475569',
      onClick: () => {
        this.currentRunId = null;
        this.currentRunPromise = null;
        this.state = 'TITLE';
        this.setupTitleUI();
        this.initTitleDemo();
      },
    });
  }

  private finishMatch() {
    this.state = 'MATCH_OVER';
    SoundEffects.playMatchVictory();
    this.particles.addConfetti(this.arena.center, 80);

    const winner =
      this.p1Score >= this.targetScore
        ? 'p1'
        : this.gameMode === '1P_AI'
        ? 'ai'
        : 'p2';
    this.saveData = StorageManager.recordMatch(winner, this.gameMode === '1P_AI');

    // Report streak to Playroom leaderboard on 1P vs AI victory
    if (this.gameMode === '1P_AI' && winner === 'p1') {
      const currentStreak = Math.max(0, Math.floor(this.saveData.stats.currentStreak));
      const runPromise = this.currentRunPromise;
      const initialRunId = this.currentRunId;

      (async () => {
        try {
          let runId = initialRunId;
          if (!runId && runPromise) {
            const res = await runPromise;
            runId = res?.runId ?? null;
          }
          if (runId) {
            await Playroom.finishRun({ runId, score: currentStreak });
          }
        } catch (e) {
          console.warn('Playroom finishRun failed:', e);
        }
      })();
    }

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
        this.currentRunId = null;
        this.currentRunPromise = null;
        this.state = 'TITLE';
        this.setupTitleUI();
        this.initTitleDemo();
      },
    });
  }

  private updateTitleDemo(dt: number) {
    this.arena.update(dt, 0, this.particles);

    const p1Held = this.titleAiP1.update(dt, this.p1Car, this.p2Car, this.arena, this.items);
    const p2Held = this.titleAiP2.update(dt, this.p2Car, this.p1Car, this.arena, this.items);

    const arenaConfig = this.arena.getThemeConfig();
    this.p1Car.update(dt, p1Held, { x: 0, y: 0 }, this.particles, arenaConfig.friction);
    this.p2Car.update(dt, p2Held, { x: 0, y: 0 }, this.particles, arenaConfig.friction);

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
      arenaConfig.restitution
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

    // 2. Draw Items & Tactical Bomb
    this.items.draw(this.ctx);

    // 3. Draw Cars
    this.p1Car.draw(this.ctx);
    this.p2Car.draw(this.ctx);

    // 4. Draw Particles
    this.particles.drawParticles(this.ctx);

    this.ctx.restore();

    // 5. Draw UI Overlay
    const touchPoints = this.input.getActiveTouchPoints();

    if (this.state === 'TITLE') {
      this.ui.drawTitleScreen(
        this.ctx,
        this.saveData.stats,
        this.selectedArena,
        this.p1Class,
        this.p2Class
      );
      this.ui.drawButtons(this.ctx);
    } else if (this.state === 'CAR_SELECT') {
      this.ui.drawVehicleSelectScreen(this.ctx, this.p1Class, this.p2Class);
      this.ui.drawButtons(this.ctx);
    } else if (this.state === 'ROUND_READY') {
      this.ui.drawTouchIndicators(
        this.ctx,
        this.p1Car.isHolding,
        this.p2Car.isHolding,
        this.gameMode,
        touchPoints
      );
      this.ui.drawHUD(
        this.ctx,
        this.p1Score,
        this.p2Score,
        this.targetScore,
        this.roundTimer,
        this.arena.isSuddenDeath,
        this.gameMode,
        SoundEffects.isMuted(),
        this.selectedArena,
        this.aiDifficulty,
        this.tournament,
        this.p1Class,
        this.p2Class
      );
      this.ui.drawRoundCountdown(this.ctx, this.currentRound, this.countdownTimer);
    } else if (this.state === 'IN_ROUND') {
      this.ui.drawTouchIndicators(
        this.ctx,
        this.p1Car.isHolding,
        this.p2Car.isHolding,
        this.gameMode,
        touchPoints
      );
      this.ui.drawHUD(
        this.ctx,
        this.p1Score,
        this.p2Score,
        this.targetScore,
        this.roundTimer,
        this.arena.isSuddenDeath,
        this.gameMode,
        SoundEffects.isMuted(),
        this.selectedArena,
        this.aiDifficulty,
        this.tournament,
        this.p1Class,
        this.p2Class
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
        SoundEffects.isMuted(),
        this.selectedArena,
        this.aiDifficulty,
        this.tournament,
        this.p1Class,
        this.p2Class
      );
      this.ui.drawRoundOver(
        this.ctx,
        this.roundWinner,
        this.gameMode === '1P_AI' || this.gameMode === 'TOURNAMENT'
      );
    } else if (this.state === 'STAGE_OVER') {
      const nextTheme = this.tournament.stages[this.tournament.currentStageIndex + 1] || 'classic';
      this.ui.drawStageOver(
        this.ctx,
        this.stageWinner,
        this.tournament.currentStageIndex + 1,
        ARENA_THEMES[nextTheme].name,
        this.tournament,
        this.gameMode === '1P_AI' || this.gameMode === 'TOURNAMENT'
      );
      this.ui.drawButtons(this.ctx);
    } else if (this.state === 'MATCH_OVER') {
      if (this.tournament.active) {
        const winnerId: 1 | 2 = this.tournament.p1Wins >= this.tournament.p2Wins ? 1 : 2;
        this.ui.drawTournamentVictory(
          this.ctx,
          winnerId,
          this.gameMode === 'TOURNAMENT',
          this.tournament.p1Wins,
          this.tournament.p2Wins
        );
      } else {
        const winner = this.p1Score >= this.targetScore ? 1 : 2;
        this.ui.drawMatchVictory(
          this.ctx,
          winner,
          this.gameMode === '1P_AI',
          this.p1Score,
          this.p2Score,
          this.gameMode === '1P_AI' && winner === 1
            ? this.saveData.stats.currentStreak
            : undefined
        );
      }
      this.ui.drawButtons(this.ctx);
    }
  }
}
