import { GameMode, SumoSaveData } from '../types';

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
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      // Button background
      ctx.fillStyle = isHovered ? btn.hoverColor : btn.color;
      ctx.beginPath();
      ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 12);
      ctx.fill();

      // Border highlight
      ctx.lineWidth = 2;
      ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
      ctx.stroke();

      // Text
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (btn.subtext) {
        ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2 - 10);
        ctx.font = '13px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(btn.subtext, btn.x + btn.w / 2, btn.y + btn.h / 2 + 13);
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
    isMuted: boolean
  ) {
    ctx.save();

    // 1. Top scoreboard bar
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(160, 16, 400, 56, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // P1 side (Blue)
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('P1', 185, 48);

    for (let i = 0; i < targetScore; i++) {
      ctx.beginPath();
      ctx.arc(225 + i * 22, 45, 7, 0, Math.PI * 2);
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
    for (let i = 0; i < targetScore; i++) {
      ctx.beginPath();
      ctx.arc(430 + i * 22, 45, 7, 0, Math.PI * 2);
      ctx.fillStyle = i < p2Score ? '#fb7185' : 'rgba(251, 113, 133, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.fillStyle = '#fb7185';
    ctx.font = 'bold 18px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(gameMode === '1P_AI' ? 'AI' : 'P2', 535, 48);

    // Sudden death banner if active
    if (isSuddenDeath) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ 驟死崩塌中 ⚠', 360, 92);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      const sec = Math.floor(roundElapsed);
      ctx.fillText(`00:${sec < 10 ? '0' : ''}${sec}`, 360, 90);
    }

    // Sound mute indicator in top right
    ctx.fillStyle = isMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.6)';
    ctx.font = '14px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(isMuted ? '🔇 靜音' : '🔊 音效', 700, 36);

    ctx.restore();
  }

  public drawTouchIndicators(
    ctx: CanvasRenderingContext2D,
    p1Holding: boolean,
    p2Holding: boolean,
    gameMode: GameMode
  ) {
    ctx.save();

    // Left Zone (P1)
    const p1Alpha = p1Holding ? 0.3 : 0.08;
    ctx.fillStyle = `rgba(56, 189, 248, ${p1Alpha})`;
    ctx.fillRect(0, 0, 100, 720);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(40, 360);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(p1Holding ? '衝刺中！' : 'P1 按住衝刺 [A]', 0, 0);
    ctx.restore();

    // Right Zone (P2)
    const p2Alpha = p2Holding ? 0.3 : 0.08;
    ctx.fillStyle = `rgba(251, 113, 133, ${p2Alpha})`;
    ctx.fillRect(620, 0, 100, 720);
    ctx.fillStyle = '#fb7185';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(680, 360);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(
      gameMode === '1P_AI' ? 'AI 對戰' : (p2Holding ? '衝刺中！' : 'P2 按住衝刺 [L]'),
      0,
      0
    );
    ctx.restore();

    ctx.restore();
  }

  public drawTitleScreen(ctx: CanvasRenderingContext2D, stats: SumoSaveData['stats']) {
    ctx.save();

    // Title logo
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px system-ui';
    ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
    ctx.shadowBlur = 24;
    ctx.fillText('雙人旋轉碰碰車', 360, 130);

    ctx.shadowBlur = 0;
    ctx.font = 'bold 22px system-ui';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('SPIN SUMO', 360, 170);

    ctx.font = '15px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('一鍵旋轉瞄準 · 按住全力衝刺 · 擂台相撲大亂鬥', 360, 205);

    // Stats box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(140, 480, 440, 120, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.stroke();

    ctx.font = 'bold 15px system-ui';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('對戰紀錄統計', 360, 510);

    ctx.font = '14px system-ui';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      `總場次: ${stats.matchesPlayed}   |   P1 勝率: ${
        stats.matchesPlayed > 0
          ? Math.round((stats.p1Wins / stats.matchesPlayed) * 100)
          : 0
      }%`,
      360,
      540
    );

    ctx.fillStyle = '#fbbf24';
    ctx.fillText(
      `最高連勝: ${stats.highestStreak}   |   當前連勝: ${stats.currentStreak}`,
      360,
      572
    );

    // Bottom copyright / instructions
    ctx.font = '12px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('電腦操作：P1 [A] 鍵，P2 [L] 鍵 | 行動裝置：點擊螢幕兩端', 360, 680);

    ctx.restore();
  }

  public drawRoundCountdown(ctx: CanvasRenderingContext2D, roundNumber: number, countdown: number) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Round number title
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 24px system-ui';
    ctx.fillText(`ROUND ${roundNumber}`, 360, 300);

    // Countdown 3, 2, 1, GO!
    ctx.shadowBlur = 20;
    if (countdown > 0.3) {
      const num = Math.ceil(countdown);
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.font = '900 84px system-ui';
      ctx.fillText(num.toString(), 360, 370);
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.shadowColor = '#22c55e';
      ctx.font = '900 96px system-ui';
      ctx.fillText('GO!', 360, 370);
    }

    ctx.restore();
  }

  public drawRoundOver(ctx: CanvasRenderingContext2D, winnerId: 1 | 2, isAiMode: boolean) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const winnerName = winnerId === 1 ? 'P1 藍色選手' : (isAiMode ? 'AI 電腦' : 'P2 紅色選手');
    const color = winnerId === 1 ? '#38bdf8' : '#fb7185';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 290, 720, 140);

    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.font = '900 42px system-ui';
    ctx.fillText(`${winnerName} 回合獲勝！`, 360, 340);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText('+1 POINT', 360, 390);

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

    // Trophy icon
    ctx.font = '72px system-ui';
    ctx.fillText('🏆', 360, 160);

    // Title
    ctx.shadowColor = color;
    ctx.shadowBlur = 25;
    ctx.fillStyle = color;
    ctx.font = '900 44px system-ui';
    ctx.fillText(`${winnerName} 獲得冠軍！`, 360, 240);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(`最終比分  ${p1Score} : ${p2Score}`, 360, 290);

    if (streak !== undefined && streak > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px system-ui';
      ctx.fillText(`🔥 當前連勝: ${streak} 連勝`, 360, 325);
    }

    ctx.restore();
  }
}
