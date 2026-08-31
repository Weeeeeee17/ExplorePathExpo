import { ORIGIN } from '../data/destinations';
import {
  Destination,
  ExplorationTheme,
  JourneyMood,
  PetStage,
  TimeSuggestion,
  XPBreakdown,
} from './types';

export const durationOptions = [20, 40, 60] as const;
export const incrementOptions = [10, 20, 30] as const;
export const hatchXP = 300;
export const growingXP = 1200;
export const matureXP = 3000;

export const themeMeta: Record<ExplorationTheme, { title: string; icon: string }> = {
  food: { title: '美食', icon: '🍜' },
  nature: { title: '自然', icon: '🌿' },
  architecture: { title: '建築', icon: '🏛️' },
  surprise: { title: '隨機驚喜', icon: '✨' },
};

export const moodMeta: Record<JourneyMood, { title: string; emoji: string }> = {
  surprised: { title: '驚喜', emoji: '😮' },
  happy: { title: '開心', emoji: '😊' },
  calm: { title: '平靜', emoji: '😌' },
  curious: { title: '好奇', emoji: '🤔' },
  tired: { title: '有點累', emoji: '😮‍💨' },
  disappointed: { title: '失望', emoji: '😕' },
};

export const stageTitle: Record<PetStage, string> = {
  emptyRoom: '尚未相遇',
  egg: '寵物蛋',
  juvenile: '幼年',
  growing: '成長',
  mature: '成熟',
};

export function eligibleDestinations(
  candidates: Destination[],
  durationMinutes: number,
  theme: ExplorationTheme,
  excludedIds: string[],
): Destination[] {
  const excluded = new Set(excludedIds);
  return candidates.filter(
    (candidate) =>
      candidate.totalMinutes <= durationMinutes &&
      (theme === 'surprise' || candidate.theme === theme) &&
      !excluded.has(candidate.id),
  );
}

export function noResultSuggestions(
  candidates: Destination[],
  durationMinutes: number,
  theme: ExplorationTheme,
  excludedIds: string[],
): TimeSuggestion[] {
  return incrementOptions.map((addedMinutes) => ({
    addedMinutes,
    resultCount: eligibleDestinations(
      candidates,
      durationMinutes + addedMinutes,
      theme,
      excludedIds,
    ).length,
  }));
}

export function broadDirection(destination: Destination): string {
  if (destination.longitude >= ORIGIN.longitude && destination.latitude >= ORIGIN.latitude) {
    return '東北方';
  }
  if (destination.longitude >= ORIGIN.longitude) return '東南方';
  if (destination.latitude >= ORIGIN.latitude) return '西北方';
  return '西南方';
}

export function distanceText(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

export function xpBreakdown(steps: number): XPBreakdown {
  const arrivalXP = 100;
  const stepBonusXP = Math.min(Math.floor(Math.max(0, steps) / 100), 50);
  return { arrivalXP, stepBonusXP, totalXP: arrivalXP + stepBonusXP };
}
