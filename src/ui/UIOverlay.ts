import { GameMode, SumoSaveData, AIDifficulty, ArenaTheme, VehicleClassId, TournamentData } from '../types';
import { ARENA_THEMES } from '../entities/Arena';
import { VEHICLE_CLASSES } from '../entities/Car';
import { TouchPoint } from '../core/Input';

export interface UIButton {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  subtext?: string;
  color: string;
  hoverColor: string;
  onClick: () => void;
}

export class UIOverlay {
  private buttons: UIButton[] = [];
  public hoveredButtonId: string | null = null;

  public clearButtons() {
    this.buttons = [];
  }

  public addButton(btn: UIButton) {
    this.buttons.push(btn);
  }

  public handleClick(canvasX: number, canvasY: number): boolean {
    for (const btn of this.buttons) {
      if (
        canvasX >= btn.x &&
        canvasX <= btn.x + btn.w &&
        canvasY >= btn.y &&
        canvasY <= btn.y + btn.h
      ) {
        btn.onClick();
        return true;
      }
    }
    return false;
  }

  public handleMouseMove(canvasX: number, canvasY: number) {
    for (const btn of this.buttons) {
      if (
        canvasX >= btn.x &&
        canvasX <= btn.x + btn.w &&
        canvasY >= btn.y &&
        canvasY <= btn.y + btn.h
      ) {
        this.hoveredButtonId = btn.id;
        return;
      }
    }
    this.hoveredButtonId = null;
  }

  public drawButtons(ctx: CanvasRenderingContext2D) {
    for (const btn of this.buttons) {
      const isHovered = this.hoveredButtonId === btn.id;
      ctx.save();

      // Shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      // Button background
      ctx.fillStyle = isHovered ? btn.hoverColor : btn.color;
      ctx.beginPath();
      ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 12);
      ctx.fill();

      // Border highlight
      ctx.lineWidth = 2;
      ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.35)';
      ctx.stroke();

      // Text
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (btn.subtext) {
        ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2 - 9);
        ctx.font = '12px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(btn.subtext, btn.x + btn.w / 2, btn.y + btn.h / 2 + 12);
      } else {
        ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2);
      }

      ctx.restore();
    }
  }

  public drawHUD(
    ctx: CanvasRenderingContext2D,
    p1Score: number,
    p2Score: number,
    targetScore: number,
    roundElapsed: number,
    isSuddenDeath: boolean,
    gameMode: GameMode,
    isMuted: boolean,
    arenaTheme: ArenaTheme,
    aiDifficulty: AIDifficulty,
    tournament?: TournamentData,
    p1Class: VehicleClassId = 'classic',
    p2Class: VehicleClassId = 'classic'
  ) {
    ctx.save();

    const themeConfig = ARENA_THEMES[arenaTheme];
    const isTournament = tournament && tournament.active;

    // 1. Top scoreboard bar
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(140, 12, 440, 64, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // P1 side (Blue)
    const p1Cfg = VEHICLE_CLASSES[p1Class];
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 17px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`P1 ${p1Cfg.icon}`, 155, 42);
    ctx.font = '11px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(p1Cfg.name, 155, 59);

    for (let i = 0; i < targetScore; i++) {
      ctx.beginPath();
      ctx.arc(235 + i * 22, 45, 7, 0, Math.PI * 2);
      ctx.fillStyle = i < p1Score ? '#38bdf8' : 'rgba(56, 189, 248, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // VS center divider
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'italic bold 15px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('VS', 360, 48);

    // P2 side (Red / AI)
    const p2Cfg = VEHICLE_CLASSES[p2Class];
    for (let i = 0; i < targetScore; i++) {
      ctx.beginPath();
      ctx.arc(440 + i * 22, 45, 7, 0, Math.PI * 2);
      ctx.fillStyle = i < p2Score ? '#fb7185' : 'rgba(251, 113, 133, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.fillStyle = '#fb7185';
    ctx.font = 'bold 17px system-ui';
    ctx.textAlign = 'right';
    let p2Label = `P2 ${p2Cfg.icon}`;
    if (gameMode === '1P_AI' || gameMode === 'TOURNAMENT') {
      const diffName = aiDifficulty === 'easy' ? '輕鬆' : (aiDifficulty === 'normal' ? '老手' : '宗師');
      p2Label = `AI ${p2Cfg.icon} (${diffName})`;
    }
    ctx.fillText(p2Label, 565, 42);
    ctx.font = '11px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(p2Cfg.name, 565, 59);

    // 2. Tournament Banner or Arena Banner below Scoreboard
    ctx.textAlign = 'center';
    if (isTournament) {
      const stageIdx = tournament.currentStageIndex + 1;
      const stageName = themeConfig.name;
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 13px system-ui';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8;
      ctx.fillText(
        `🏆 大獎賽巡迴盃 第 ${stageIdx}/3 站：【${stageName}】  巡迴比分: P1 🏆 ${tournament.p1Wins} - ${tournament.p2Wins} 🏆 敵方`,
        360,
        96
      );
      ctx.shadowBlur = 0;
    } else {
      if (isSuddenDeath) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 14px system-ui';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
        ctx.fillText('⚠ 擂台驟死崩塌中 ⚠', 360, 96);
        ctx.shadowBlur = 0;
      } else {
        const secRemaining = Math.max(0, Math.ceil(themeConfig.suddenDeathTime - roundElapsed));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.font = '12px system-ui';
        ctx.fillText(`【${themeConfig.name}】 崩塌倒數: ${secRemaining}s`, 360, 96);
      }
    }

    // 3. Sound mute indicator in top right
    ctx.fillStyle = isMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.7)';
    ctx.font = '14px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(isMuted ? '🔇 靜音' : '🔊 音效', 700, 36);

    ctx.restore();
  }

  public drawTouchIndicators(
    ctx: CanvasRenderingContext2D,
    p1Holding: boolean,
    p2Holding: boolean,
    gameMode: GameMode,
    touchPoints: TouchPoint[] = []
  ) {
    ctx.save();

    // Left Zone (P1)
    const p1Alpha = p1Holding ? 0.32 : 0.08;
    ctx.fillStyle = `rgba(56, 189, 248, ${p1Alpha})`;
    ctx.fillRect(0, 0, 110, 720);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(45, 360);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(p1Holding ? '🚀 P1 衝刺中！' : 'P1 按住衝刺 [A]', 0, 0);
    ctx.restore();

    // Right Zone (P2)
    const p2Alpha = p2Holding ? 0.32 : 0.08;
    ctx.fillStyle = `rgba(251, 113, 133, ${p2Alpha})`;
    ctx.fillRect(610, 0, 110, 720);
    ctx.fillStyle = '#fb7185';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(675, 360);
    ctx.rotate(Math.PI / 2);
    const isAi = gameMode === '1P_AI' || gameMode === 'TOURNAMENT';
    ctx.fillText(
      isAi ? '🤖 AI 對戰' : (p2Holding ? '🚀 P2 衝刺中！' : 'P2 按住衝刺 [L]'),
      0,
      0
    );
    ctx.restore();

    // Dynamic Touch Halos at finger positions
    for (const pt of touchPoints) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 40, 0, Math.PI * 2);
      ctx.fillStyle = pt.player === 1 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(251, 113, 133, 0.4)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 22, 0, Math.PI * 2);
      ctx.strokeStyle = pt.player === 1 ? '#38bdf8' : '#fb7185';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  public drawTitleScreen(
    ctx: CanvasRenderingContext2D,
    stats: SumoSaveData['stats'],
    currentTheme: ArenaTheme,
    p1Class: VehicleClassId,
    p2Class: VehicleClassId
  ) {
    ctx.save();

    const themeConfig = ARENA_THEMES[currentTheme];
    const p1Cfg = VEHICLE_CLASSES[p1Class];
    const p2Cfg = VEHICLE_CLASSES[p2Class];

    // Title logo
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 46px system-ui';
    ctx.shadowColor = 'rgba(56, 189, 248, 0.7)';
    ctx.shadowBlur = 24;
    ctx.fillText('雙人旋轉碰碰車', 360, 110);

    ctx.shadowBlur = 0;
    ctx.font = 'bold 19px system-ui';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('SPIN SUMO  v1.3.0', 360, 142);

    ctx.font = '13px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('🏆 大獎賽巡迴盃 · 4大特色車型 · 戰術空投核彈 · 聚光燈與金屬高光', 360, 168);

    // Current setup status banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(100, 180, 520, 30, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '12px system-ui';
    ctx.fillStyle = '#facc15';
    ctx.fillText(
      `P1 車型: ${p1Cfg.icon} ${p1Cfg.name}   |   P2 車型: ${p2Cfg.icon} ${p2Cfg.name}   |   擂台: ${themeConfig.name}`,
      360,
      200
    );

    // Stats box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(140, 535, 440, 95, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.stroke();

    ctx.font = 'bold 13px system-ui';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('選手競技戰報紀錄', 360, 557);

    ctx.font = '13px system-ui';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      `總場次: ${stats.matchesPlayed}   |   P1 勝率: ${
        stats.matchesPlayed > 0
          ? Math.round((stats.p1Wins / stats.matchesPlayed) * 100)
          : 0
      }%   |   🏆 巡迴盃冠軍: ${stats.tournamentsWon || 0}`,
      360,
      582
    );

    ctx.fillStyle = '#fbbf24';
    ctx.fillText(
      `最高連勝紀錄: ${stats.highestStreak}   |   當前連勝: ${stats.currentStreak}`,
      360,
      608
    );

    // Bottom instructions
    ctx.font = '12px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText('電腦操作：P1 [A] 鍵，P2 [L] 鍵 | 行動裝置：觸控左右分區衝刺', 360, 680);

    ctx.restore();
  }

  public drawVehicleSelectScreen(
    ctx: CanvasRenderingContext2D,
    p1Class: VehicleClassId,
    p2Class: VehicleClassId
  ) {
    ctx.save();
    ctx.textAlign = 'center';

    // Background panel
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(0, 0, 720, 720);

    // Header
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px system-ui';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 18;
    ctx.fillText('戰車工坊與性能挑選', 360, 70);
    ctx.shadowBlur = 0;

    ctx.font = '14px system-ui';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('挑選最符合你戰術手感的碰碰車，碾壓所有擂台對手！', 360, 100);

    // Draw 4 Vehicle Class Cards
    const classList: VehicleClassId[] = ['classic', 'speedster', 'juggernaut', 'drifter'];
    const cardY = 125;
    const cardH = 345;
    const cardW = 155;
    const spacing = 16;
    const startX = 360 - (cardW * 4 + spacing * 3) / 2;

    classList.forEach((cId, idx) => {
      const cfg = VEHICLE_CLASSES[cId];
      const cx = startX + idx * (cardW + spacing);

      const isP1 = p1Class === cId;
      const isP2 = p2Class === cId;

      // Card Background
      ctx.save();
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cx, cardY, cardW, cardH, 14);
      ctx.fill();

      // Card Border Highlight
      ctx.lineWidth = isP1 || isP2 ? 3 : 1.5;
      if (isP1 && isP2) ctx.strokeStyle = '#a855f7';
      else if (isP1) ctx.strokeStyle = '#38bdf8';
      else if (isP2) ctx.strokeStyle = '#fb7185';
      else ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.stroke();

      // Vehicle Icon & Title
      ctx.font = '34px system-ui';
      ctx.fillText(cfg.icon, cx + cardW / 2, cardY + 45);

      ctx.fillStyle = cfg.badgeColor;
      ctx.font = 'bold 16px system-ui';
      ctx.fillText(cfg.name, cx + cardW / 2, cardY + 76);

      ctx.font = '11px system-ui';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(cfg.tag, cx + cardW / 2, cardY + 94);

      // Attribute Stat Bars
      const drawStatBar = (label: string, value: number, y: number, color: string) => {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '10px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(label, cx + 12, y);

        const barX = cx + 54;
        const barW = cardW - 66;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(barX, y - 8, barW, 8);

        ctx.fillStyle = color;
        const fillW = Math.min(barW, Math.max(8, barW * (value / 1.5)));
        ctx.fillRect(barX, y - 8, fillW, 8);
      };

      drawStatBar('速度', cfg.speedMultiplier, cardY + 125, '#38bdf8');
      drawStatBar('衝撞', cfg.massMultiplier, cardY + 148, '#eab308');
      drawStatBar('轉向', cfg.spinMultiplier, cardY + 171, '#a855f7');
      drawStatBar('漂移', cfg.driftFactor >= 1.0 ? cfg.driftFactor : 0.8, cardY + 194, '#f97316');

      // Description text wrapped
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = '10.5px system-ui';
      const words = cfg.description;
      // split into roughly two lines
      ctx.fillText(words.slice(0, 13), cx + cardW / 2, cardY + 228);
      ctx.fillText(words.slice(13, 26), cx + cardW / 2, cardY + 244);
      ctx.fillText(words.slice(26), cx + cardW / 2, cardY + 260);

      // Badges if chosen
      if (isP1) {
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.roundRect(cx + 8, cardY + 295, cardW - 16, 20, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px system-ui';
        ctx.fillText('P1 藍色選擇', cx + cardW / 2, cardY + 309);
      }

      if (isP2) {
        ctx.fillStyle = '#be123c';
        ctx.beginPath();
        ctx.roundRect(cx + 8, cardY + (isP1 ? 320 : 295), cardW - 16, 20, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px system-ui';
        ctx.fillText('P2/AI 選擇', cx + cardW / 2, cardY + (isP1 ? 334 : 309));
      }

      ctx.restore();
    });

    ctx.restore();
  }

  public drawRoundCountdown(ctx: CanvasRenderingContext2D, roundNumber: number, countdown: number) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 24px system-ui';
    ctx.fillText(`ROUND ${roundNumber}`, 360, 295);

    ctx.shadowBlur = 22;
    if (countdown > 0.3) {
      const num = Math.ceil(countdown);
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.font = '900 84px system-ui';
      ctx.fillText(num.toString(), 360, 365);
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.shadowColor = '#22c55e';
      ctx.font = '900 96px system-ui';
      ctx.fillText('GO!', 360, 365);
    }

    ctx.restore();
  }

  public drawRoundOver(ctx: CanvasRenderingContext2D, winnerId: 1 | 2, isAiMode: boolean) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const winnerName = winnerId === 1 ? 'P1 藍色選手' : (isAiMode ? 'AI 電腦' : 'P2 紅色選手');
    const color = winnerId === 1 ? '#38bdf8' : '#fb7185';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 285, 720, 150);

    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = color;
    ctx.font = '900 42px system-ui';
    ctx.fillText(`${winnerName} 回合獲勝！`, 360, 335);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText('+1 POINT', 360, 385);

    ctx.restore();
  }

  public drawStageOver(
    ctx: CanvasRenderingContext2D,
    stageWinner: 1 | 2,
    stageNumber: number,
    nextStageName: string,
    tournament: TournamentData,
    isAiMode: boolean
  ) {
    ctx.save();
    ctx.textAlign = 'center';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, 720, 720);

    const winnerName = stageWinner === 1 ? 'P1 藍色車手' : (isAiMode ? 'AI 電腦' : 'P2 紅色車手');
    const color = stageWinner === 1 ? '#38bdf8' : '#fb7185';

    ctx.font = '54px system-ui';
    ctx.fillText('🏁', 360, 160);

    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.font = '900 38px system-ui';
    ctx.fillText(`第 ${stageNumber} 站巡迴賽 獲勝！`, 360, 220);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui';
    ctx.fillText(`${winnerName} 奪得分站冠軍獎盃！`, 360, 265);

    // Current Cup Standings
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.beginPath();
    ctx.roundRect(180, 295, 360, 70, 12);
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 18px system-ui';
    ctx.fillText(`🏆 巡迴盃總比分: P1 🏆 ${tournament.p1Wins} - ${tournament.p2Wins} 🏆 ${isAiMode ? 'AI' : 'P2'}`, 360, 336);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '14px system-ui';
    ctx.fillText(`即將前往下一站：【${nextStageName}】`, 360, 400);

    ctx.restore();
  }

  public drawMatchVictory(
    ctx: CanvasRenderingContext2D,
    winnerId: 1 | 2,
    isAiMode: boolean,
    p1Score: number,
    p2Score: number,
    streak?: number
  ) {
    ctx.save();
    ctx.textAlign = 'center';

    const winnerName = winnerId === 1 ? 'P1 藍色車手' : (isAiMode ? 'AI 電腦' : 'P2 紅色車手');
    const color = winnerId === 1 ? '#38bdf8' : '#fb7185';

    ctx.font = '72px system-ui';
    ctx.fillText('🏆', 360, 155);

    ctx.shadowColor = color;
    ctx.shadowBlur = 25;
    ctx.fillStyle = color;
    ctx.font = '900 44px system-ui';
    ctx.fillText(`${winnerName} 獲得單場冠軍！`, 360, 235);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(`最終比分  ${p1Score} : ${p2Score}`, 360, 285);

    if (streak !== undefined && streak > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px system-ui';
      ctx.fillText(`🔥 當前連勝: ${streak} 連勝`, 360, 320);
    }

    ctx.restore();
  }

  public drawTournamentVictory(
    ctx: CanvasRenderingContext2D,
    winnerId: 1 | 2,
    isAiMode: boolean,
    p1Wins: number,
    p2Wins: number
  ) {
    ctx.save();
    ctx.textAlign = 'center';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.fillRect(0, 0, 720, 720);

    const winnerName = winnerId === 1 ? 'P1 藍色車手' : (isAiMode ? 'AI 電腦' : 'P2 紅色車手');
    const color = winnerId === 1 ? '#38bdf8' : '#fb7185';

    ctx.font = '84px system-ui';
    ctx.fillText('🏆✨', 360, 140);

    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#facc15';
    ctx.font = '900 44px system-ui';
    ctx.fillText('大獎賽巡迴盃 總冠軍！', 360, 220);

    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.font = 'bold 28px system-ui';
    ctx.fillText(`榮耀歸於 ${winnerName}`, 360, 268);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`巡迴分站總比分  ${p1Wins} : ${p2Wins}`, 360, 315);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '15px system-ui';
    ctx.fillText('跨越水泥擂台、極地溜冰場、熔岩工廠三連戰的終極相撲王者！', 360, 355);

    ctx.restore();
  }
}
