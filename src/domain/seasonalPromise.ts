import {
  JourneyRecord,
  Season,
  SeasonalCandidate,
  SeasonalEntry,
  SeasonalEntryKind,
  SeasonalPromiseState,
} from './types';

export const seasonalPromiseDurationMonths = 15;
export const seasonalSafetyRadiusMeters = 150;

export interface SeasonalReminder {
  at: number;
  kind: 'seasonStart' | 'seasonEnding';
  season: Season;
}

export const seasonMeta: Record<Season, { title: string; months: string; icon: string; color: string }> = {
  spring: { title: '春', months: '3–5 月', icon: '🌱', color: '#A9C98D' },
  summer: { title: '夏', months: '6–8 月', icon: '☀️', color: '#E9BD62' },
  autumn: { title: '秋', months: '9–11 月', icon: '🍂', color: '#CF8459' },
  winter: { title: '冬', months: '12–2 月', icon: '❄️', color: '#91B7C7' },
};

export function seasonForDate(timestamp: number): Season {
  const month = new Date(timestamp).getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

export function seasonalReminderSchedule(now: number, expiresAt: number): SeasonalReminder[] {
  if (!Number.isFinite(now) || !Number.isFinite(expiresAt) || expiresAt <= now) return [];
  const reminders: SeasonalReminder[] = [];
  const cursor = new Date(now);
  cursor.setDate(1);
  cursor.setHours(9, 0, 0, 0);

  for (let monthOffset = 0; monthOffset <= seasonalPromiseDurationMonths + 3; monthOffset += 1) {
    const boundary = new Date(cursor);
    boundary.setMonth(boundary.getMonth() + monthOffset);
    if (![2, 5, 8, 11].includes(boundary.getMonth())) continue;
    const seasonStart = boundary.getTime();

    const endingReminder = new Date(boundary);
    endingReminder.setDate(endingReminder.getDate() - 14);
    const endingAt = endingReminder.getTime();
    if (endingAt > now && endingAt < expiresAt) {
      reminders.push({
        at: endingAt,
        kind: 'seasonEnding',
        season: seasonForDate(endingAt),
      });
    }

    if (seasonStart > now && seasonStart < expiresAt) {
      reminders.push({
        at: seasonStart,
        kind: 'seasonStart',
        season: seasonForDate(seasonStart),
      });
    }
  }

  return reminders.sort((left, right) => left.at - right.at);
}

export function addMonths(timestamp: number, months: number): number {
  const date = new Date(timestamp);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return date.getTime();
}

export function emptySeasonalPromise(): SeasonalPromiseState {
  return {
    status: 'idle',
    selectedCandidates: [],
    sealedCandidates: [],
    target: null,
    startedAt: null,
    expiresAt: null,
    entries: [],
    pendingVisit: null,
    isShowcase: false,
    reunionTokens: 0,
    seasonalBadges: 0,
    lastRewardMessage: null,
    notificationsEnabled: null,
    notificationIds: [],
  };
}

export function normalizeSeasonalPromise(value: Partial<SeasonalPromiseState> | null | undefined): SeasonalPromiseState {
  const empty = emptySeasonalPromise();
  if (!value) return empty;
  const entries = Array.isArray(value.entries)
    ? value.entries.filter((entry): entry is SeasonalEntry => Boolean(entry?.season && entry?.completedAt))
    : [];
  return {
    ...empty,
    ...value,
    selectedCandidates: Array.isArray(value.selectedCandidates) ? value.selectedCandidates.slice(0, 3) : [],
    sealedCandidates: Array.isArray(value.sealedCandidates) ? value.sealedCandidates.slice(0, 3) : [],
    entries,
    pendingVisit: value.pendingVisit?.journeyId && value.pendingVisit?.season
      ? value.pendingVisit
      : null,
    reunionTokens: value.reunionTokens === 1 ? 1 : 0,
    seasonalBadges: Math.max(0, Number(value.seasonalBadges) || 0),
    notificationIds: Array.isArray(value.notificationIds) ? value.notificationIds.filter((id): id is string => typeof id === 'string') : [],
  };
}

function coordinateKey(record: JourneyRecord): string {
  if (record.destinationId) return record.destinationId;
  return `${record.destinationName}-${record.destinationLatitude?.toFixed(4)}-${record.destinationLongitude?.toFixed(4)}`;
}

export function candidatesFromRecords(records: JourneyRecord[], isShowcaseMode: boolean): SeasonalCandidate[] {
  const seen = new Set<string>();
  const candidates: SeasonalCandidate[] = [];
  for (const record of records) {
    if (!record.completed || typeof record.destinationLatitude !== 'number' || typeof record.destinationLongitude !== 'number') continue;
    const key = coordinateKey(record);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      id: `seasonal-${key}`,
      recordId: record.id,
      destinationId: record.destinationId ?? key,
      destinationName: record.destinationName,
      latitude: record.destinationLatitude,
      longitude: record.destinationLongitude,
      cityLabel: '所在城市',
      isShowcase: isShowcaseMode,
    });
  }
  return candidates;
}

export function sealCandidates(candidates: SeasonalCandidate[], seed: number): SeasonalCandidate[] {
  if (candidates.length !== 3) throw new Error('Exactly three candidates are required');
  return [...candidates].sort((left, right) => {
    const score = (value: string) => {
      let hash = seed >>> 0;
      for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
      return hash;
    };
    return score(left.id) - score(right.id);
  });
}

export function revealSeasonalTarget(state: SeasonalPromiseState, boxIndex: number, now: number): SeasonalPromiseState {
  const target = state.sealedCandidates[boxIndex];
  if (!target || state.status !== 'sealed') return state;
  return {
    ...state,
    status: 'active',
    target,
    selectedCandidates: [],
    sealedCandidates: [],
    startedAt: now,
    expiresAt: addMonths(now, seasonalPromiseDurationMonths),
    entries: [],
    pendingVisit: null,
    isShowcase: target.isShowcase,
    lastRewardMessage: null,
  };
}

export function addSeasonalEntry(
  state: SeasonalPromiseState,
  kind: SeasonalEntryKind,
  observation: string,
  photoUri: string | undefined,
  usedSafetyRadius: boolean,
  now: number,
  journeyId?: string,
): SeasonalPromiseState {
  if (state.status !== 'active' || !state.target || (state.expiresAt ?? 0) <= now) return state;
  const season = seasonForDate(now);
  if (state.entries.some((entry) => entry.season === season)) return state;
  if (kind === 'observation' && !observation.trim()) return state;
  if (kind === 'photo' && !photoUri) return state;
  const entries = [...state.entries, {
    id: `season-${season}-${now}`,
    season,
    completedAt: now,
    kind,
    observation: observation.trim(),
    photoUri,
    usedSafetyRadius,
    journeyId: journeyId ?? state.pendingVisit?.journeyId,
  }];
  return { ...state, entries, pendingVisit: null, status: entries.length === 4 ? 'completed' : 'active' };
}

export function markSeasonalVisitPending(
  state: SeasonalPromiseState,
  journeyId: string,
  now: number,
): SeasonalPromiseState {
  if (state.status !== 'active' || !state.target) return state;
  const season = seasonForDate(now);
  if (state.entries.some((entry) => entry.season === season)) return state;
  return { ...state, pendingVisit: { journeyId, season, arrivedAt: now } };
}

export function abandonSeasonalPending(state: SeasonalPromiseState): SeasonalPromiseState {
  return { ...state, pendingVisit: null };
}

export function settleExpiredSeasonalPromise(state: SeasonalPromiseState, now: number): SeasonalPromiseState {
  if (state.status !== 'active' || !state.expiresAt || now < state.expiresAt) return state;
  const fresh = emptySeasonalPromise();
  return {
    ...fresh,
    reunionTokens: state.reunionTokens,
    seasonalBadges: state.seasonalBadges,
    notificationsEnabled: state.notificationsEnabled,
    notificationIds: state.notificationIds,
    lastRewardMessage: '上一輪四季之約已逾期，任務內紀錄已清除。iPhone 相簿中的原始照片不受影響。',
  };
}

export function claimSeasonalReward(state: SeasonalPromiseState): SeasonalPromiseState {
  if (state.status !== 'completed') return state;
  const hadToken = state.reunionTokens === 1;
  return {
    ...emptySeasonalPromise(),
    reunionTokens: hadToken || state.isShowcase ? state.reunionTokens : 1,
    seasonalBadges: hadToken && !state.isShowcase ? state.seasonalBadges + 1 : state.seasonalBadges,
    notificationsEnabled: state.notificationsEnabled,
    notificationIds: state.notificationIds,
    lastRewardMessage: state.isShowcase
      ? '展示版四季之約已完成；正式印記、徽章與道具沒有被改動。'
      : hadToken
        ? '重逢印記已達上限：獲得四季紀念徽章與照顧獎勵。'
        : '獲得一枚四季重逢印記，可在需要時帶回一位夥伴。',
  };
}
