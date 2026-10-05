import { SumoSaveData } from '../types';

const STORAGE_KEY = 'spin-sumo:save:v1';

export class StorageManager {
  private static defaultData: SumoSaveData = {
    version: 1,
    stats: {
      matchesPlayed: 0,
      p1Wins: 0,
      p2Wins: 0,
      aiWins: 0,
      tournamentsWon: 0,
      highestStreak: 0,
      currentStreak: 0,
    },
    settings: {
      soundMuted: false,
      aiDifficulty: 'normal',
      selectedArena: 'classic',
      p1Class: 'classic',
      p2Class: 'classic',
    },
  };

  public static load(): SumoSaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...this.defaultData };
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1) {
        return {
          version: 1,
          stats: {
            ...this.defaultData.stats,
            ...parsed.stats,
            tournamentsWon: parsed.stats?.tournamentsWon ?? 0,
          },
          settings: {
            ...this.defaultData.settings,
            ...parsed.settings,
            p1Class: parsed.settings?.p1Class ?? 'classic',
            p2Class: parsed.settings?.p2Class ?? 'classic',
          },
        };
      }
    } catch (e) {
      console.warn('Storage load failed or restricted:', e);
    }
    return { ...this.defaultData };
  }

  public static save(data: SumoSaveData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage save failed (e.g. Incognito QuotaExceeded):', e);
    }
  }

  public static recordMatch(winner: 'p1' | 'p2' | 'ai', isAiMode: boolean): SumoSaveData {
    const data = this.load();
    data.stats.matchesPlayed += 1;

    if (winner === 'p1') {
      data.stats.p1Wins += 1;
      data.stats.currentStreak += 1;
      if (data.stats.currentStreak > data.stats.highestStreak) {
        data.stats.highestStreak = data.stats.currentStreak;
      }
    } else {
      data.stats.currentStreak = 0;
      if (isAiMode) {
        data.stats.aiWins += 1;
      } else {
        data.stats.p2Wins += 1;
      }
    }

    this.save(data);
    return data;
  }

  public static recordTournamentWin(): SumoSaveData {
    const data = this.load();
    data.stats.tournamentsWon = (data.stats.tournamentsWon || 0) + 1;
    data.stats.matchesPlayed += 1;
    data.stats.p1Wins += 1;
    data.stats.currentStreak += 1;
    if (data.stats.currentStreak > data.stats.highestStreak) {
      data.stats.highestStreak = data.stats.currentStreak;
    }
    this.save(data);
    return data;
  }
}
