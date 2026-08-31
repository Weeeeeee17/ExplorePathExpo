import {
  DailyHealthSummary,
  HealthIntensity,
  HealthMilestone,
  HealthProfile,
  JourneyHealthMetrics,
  JourneyRecord,
} from './types';

export const defaultHealthProfile: HealthProfile = {
  strideLengthCm: 70,
  dailyStepGoal: 6000,
};

export const intensityMeta: Record<HealthIntensity, { title: string; detail: string }> = {
  restful: { title: '輕鬆移動', detail: '這趟以停留和緩慢移動為主。' },
  light: { title: '輕度活動', detail: '步伐輕鬆，適合日常累積活動量。' },
  moderate: { title: '中等活動', detail: '旅程中維持了穩定的步行節奏。' },
  brisk: { title: '快速活動', detail: '這趟的平均步頻較高，活動節奏明顯。' },
};

export function normalizeHealthProfile(value?: Partial<HealthProfile> | null): HealthProfile {
  const strideLengthCm = Number(value?.strideLengthCm);
  const dailyStepGoal = Number(value?.dailyStepGoal);
  return {
    strideLengthCm: Number.isFinite(strideLengthCm)
      ? Math.max(35, Math.min(120, Math.round(strideLengthCm)))
      : defaultHealthProfile.strideLengthCm,
    dailyStepGoal: Number.isFinite(dailyStepGoal)
      ? Math.max(1000, Math.min(50000, Math.round(dailyStepGoal / 500) * 500))
      : defaultHealthProfile.dailyStepGoal,
  };
}

export function isCountedStepRecord(record: JourneyRecord): boolean {
  return !['unavailable', 'excluded'].includes(record.stepStatus ?? 'complete')
    && Math.max(0, Number(record.steps) || 0) > 0;
}

export function intensityForCadence(cadence: number): HealthIntensity {
  if (cadence < 30) return 'restful';
  if (cadence < 60) return 'light';
  if (cadence < 90) return 'moderate';
  return 'brisk';
}

export function journeyHealthMetrics(input: {
  steps: number;
  elapsedMinutes: number;
  strideLengthCm?: number;
  stepStatus?: JourneyRecord['stepStatus'];
}): JourneyHealthMetrics {
  const elapsedMinutes = Math.max(1, Math.round(Number(input.elapsedMinutes) || 1));
  const excluded = ['unavailable', 'excluded'].includes(input.stepStatus ?? 'complete');
  const steps = excluded ? 0 : Math.max(0, Math.round(Number(input.steps) || 0));
  const strideLengthCm = normalizeHealthProfile({ strideLengthCm: input.strideLengthCm }).strideLengthCm;
  const estimatedActiveMinutes = steps === 0
    ? 0
    : Math.min(elapsedMinutes, Math.max(1, Math.round((steps / 100) * 10) / 10));
  const averageCadence = steps === 0 ? 0 : Math.round(steps / elapsedMinutes);
  return {
    steps,
    elapsedMinutes,
    estimatedActiveMinutes,
    stoppedMinutes: Math.max(0, Math.round((elapsedMinutes - estimatedActiveMinutes) * 10) / 10),
    estimatedDistanceMeters: Math.round(steps * (strideLengthCm / 100)),
    averageCadence,
    intensity: intensityForCadence(averageCadence),
  };
}

export function recordHealthMetrics(
  record: JourneyRecord,
  profile: HealthProfile = defaultHealthProfile,
): JourneyHealthMetrics {
  const calculated = journeyHealthMetrics({
    steps: record.steps,
    elapsedMinutes: record.elapsedMinutes,
    strideLengthCm: profile.strideLengthCm,
    stepStatus: record.stepStatus,
  });
  return {
    ...calculated,
    estimatedActiveMinutes: record.estimatedActiveMinutes ?? calculated.estimatedActiveMinutes,
    stoppedMinutes: record.stoppedMinutes ?? calculated.stoppedMinutes,
    estimatedDistanceMeters: record.estimatedDistanceMeters ?? calculated.estimatedDistanceMeters,
    averageCadence: record.averageCadence ?? calculated.averageCadence,
    intensity: record.healthIntensity ?? calculated.intensity,
  };
}

export function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function dailyHealthSummaries(
  records: JourneyRecord[],
  profile: HealthProfile = defaultHealthProfile,
  now = Date.now(),
  dayCount = 7,
): DailyHealthSummary[] {
  const result: DailyHealthSummary[] = [];
  const startToday = startOfLocalDay(now);
  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const dayTimestamp = startToday - offset * 24 * 60 * 60 * 1000;
    const key = localDateKey(dayTimestamp);
    const dayRecords = records.filter((record) => localDateKey(record.endedAt) === key && isCountedStepRecord(record));
    const metrics = dayRecords.map((record) => recordHealthMetrics(record, profile));
    result.push({
      dateKey: key,
      steps: metrics.reduce((sum, item) => sum + item.steps, 0),
      journeyCount: dayRecords.length,
      elapsedMinutes: metrics.reduce((sum, item) => sum + item.elapsedMinutes, 0),
      activeMinutes: Math.round(metrics.reduce((sum, item) => sum + item.estimatedActiveMinutes, 0)),
      estimatedDistanceMeters: metrics.reduce((sum, item) => sum + item.estimatedDistanceMeters, 0),
    });
  }
  return result;
}

export function currentActivityStreak(records: JourneyRecord[], now = Date.now()): number {
  const activeDays = new Set(records.filter(isCountedStepRecord).map((record) => localDateKey(record.endedAt)));
  let cursor = startOfLocalDay(now);
  if (!activeDays.has(localDateKey(cursor))) cursor -= 24 * 60 * 60 * 1000;
  let streak = 0;
  while (activeDays.has(localDateKey(cursor))) {
    streak += 1;
    cursor -= 24 * 60 * 60 * 1000;
  }
  return streak;
}

export function healthMilestonesForJourney(
  record: JourneyRecord,
  previousRecords: JourneyRecord[],
  profile: HealthProfile = defaultHealthProfile,
): HealthMilestone[] {
  if (!isCountedStepRecord(record)) return [];
  const milestones: HealthMilestone[] = [];
  const previousCounted = previousRecords.filter(isCountedStepRecord);
  if (previousCounted.length === 0) {
    milestones.push({ kind: 'firstJourney', title: '第一趟活動足跡', detail: '健康紀錄從這趟旅程開始累積。' });
  }
  const previousBest = previousCounted.reduce((best, item) => Math.max(best, item.steps), 0);
  if (record.steps > previousBest && previousBest > 0) {
    milestones.push({ kind: 'personalBest', title: '刷新單趟步數', detail: `新的單趟紀錄是 ${record.steps.toLocaleString()} 步。` });
  }
  const dayKey = localDateKey(record.endedAt);
  const previousTodaySteps = previousCounted
    .filter((item) => localDateKey(item.endedAt) === dayKey)
    .reduce((sum, item) => sum + item.steps, 0);
  if (previousTodaySteps < profile.dailyStepGoal && previousTodaySteps + record.steps >= profile.dailyStepGoal) {
    milestones.push({ kind: 'dailyGoal', title: '完成今日步數目標', detail: `今日累積已達 ${profile.dailyStepGoal.toLocaleString()} 步。` });
  }
  const streak = currentActivityStreak([...previousRecords, record], record.endedAt);
  const previousStreak = currentActivityStreak(previousRecords, record.endedAt - 24 * 60 * 60 * 1000);
  if (streak >= 3 && streak > previousStreak) {
    milestones.push({ kind: 'threeDayStreak', title: `${streak} 天連續活動`, detail: '持續累積比一次走很多更重要。' });
  }
  return milestones;
}

export function formatHealthDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.max(0, Math.round(meters))} m`;
}
