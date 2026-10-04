export type GameState =
  | 'TITLE'
  | 'MODE_SELECT'
  | 'ROUND_READY'
  | 'IN_ROUND'
  | 'ROUND_OVER'
  | 'MATCH_OVER';

export type GameMode = '1P_AI' | '2P_LOCAL';
export type AIDifficulty = 'easy' | 'normal' | 'hard';
export type ItemType = 'heavy' | 'rocket' | 'oil' | 'bomb';

export interface Vector2D {
  x: number;
  y: number;
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
    mirrorP2View: boolean;
  };
}

export interface PlayerInput {
  holding: boolean;
  justPressed: boolean;
  justReleased: boolean;
}
