export type GameState =
  | 'TITLE'
  | 'MODE_SELECT'
  | 'ROUND_READY'
  | 'IN_ROUND'
  | 'ROUND_OVER'
  | 'MATCH_OVER';

export type GameMode = '1P_AI' | '2P_LOCAL';
export type AIDifficulty = 'easy' | 'normal' | 'hard';
export type ArenaTheme = 'classic' | 'frost' | 'magma';
export type ItemType = 'heavy' | 'rocket' | 'oil' | 'bomb' | 'emp' | 'anchor';

export interface Vector2D {
  x: number;
  y: number;
}

export interface ArenaThemeConfig {
  id: ArenaTheme;
  name: string;
  subname: string;
  description: string;
  friction: number;
  restitution: number;
  suddenDeathTime: number;
  collapseSpeed: number;
  rimColor: string;
  warningColor: string;
  bgColor: string;
  floorGradient: [string, string, string];
}

export interface SumoSaveData {
  version: 1;
  stats: {
    matchesPlayed: number;
    p1Wins: number;
    p2Wins: number;
    aiWins: number;
    highestStreak: number;
    currentStreak: number;
  };
  settings: {
    soundMuted: boolean;
    aiDifficulty: AIDifficulty;
    selectedArena: ArenaTheme;
    mirrorP2View: boolean;
  };
}

export interface PlayerInput {
  holding: boolean;
  justPressed: boolean;
  justReleased: boolean;
}
