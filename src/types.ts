export type GameState =
  | 'TITLE'
  | 'CAR_SELECT'
  | 'ROUND_READY'
  | 'IN_ROUND'
  | 'ROUND_OVER'
  | 'STAGE_OVER'
  | 'MATCH_OVER';

export type GameMode = '1P_AI' | '2P_LOCAL' | 'TOURNAMENT' | 'TOURNAMENT_2P';
export type AIDifficulty = 'easy' | 'normal' | 'hard';
export type ArenaTheme = 'classic' | 'frost' | 'magma';
export type ItemType = 'heavy' | 'rocket' | 'oil' | 'bomb' | 'emp' | 'anchor';

export type VehicleClassId = 'classic' | 'speedster' | 'juggernaut' | 'drifter';

export interface VehicleClassConfig {
  id: VehicleClassId;
  name: string;
  nameEn: string;
  tag: string;
  description: string;
  icon: string;
  badgeColor: string;
  massMultiplier: number;
  speedMultiplier: number;
  accelMultiplier: number;
  spinMultiplier: number;
  driftFactor: number; // Lower means slide more
  radiusBonus: number;
}

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

export interface TournamentStageInfo {
  theme: ArenaTheme;
  name: string;
  targetScore: number;
}

export interface TournamentData {
  active: boolean;
  currentStageIndex: number;
  stages: ArenaTheme[];
  p1Wins: number;
  p2Wins: number;
}

export interface SumoSaveData {
  version: 1;
  stats: {
    matchesPlayed: number;
    p1Wins: number;
    p2Wins: number;
    aiWins: number;
    tournamentsWon: number;
    highestStreak: number;
    currentStreak: number;
  };
  settings: {
    soundMuted: boolean;
    aiDifficulty: AIDifficulty;
    selectedArena: ArenaTheme;
    p1Class: VehicleClassId;
    p2Class: VehicleClassId;
  };
}

export interface PlayerInput {
  holding: boolean;
  justPressed: boolean;
  justReleased: boolean;
}

export interface TacticalBomb {
  id: number;
  pos: Vector2D;
  vel: Vector2D;
  radius: number;
  mass: number;
  fuseTimer: number; // 5.0 seconds
  maxFuse: number;
  isDropping: boolean;
  dropProgress: number; // 0 (in air) to 1 (landed)
  targetPos: Vector2D;
  exploded: boolean;
}
