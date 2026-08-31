import {
  ExplorationTheme,
  JourneyRecord,
  MonthlyMemorySummary,
} from './types';

export const memoryDataVersion = 2;

export function journeyOutcome(record: JourneyRecord): 'arrived' | 'unreached' {
  return record.outcome ?? (record.completed ? 'arrived' : 'unreached');
}

export function journeyStepStatus(record: JourneyRecord): NonNullable<JourneyRecord['stepStatus']> {
  // Every pre-v0.6 numeric value, including zero, was a confirmed reading.
  return record.stepStatus ?? 'complete';
}

export function knownJourneySteps(record: JourneyRecord): number {
  return Math.max(0, Number(record.steps) || 0);
}

export function isActivityJourney(record: JourneyRecord): boolean {
  if (journeyOutcome(record) === 'arrived') return true;
  const status = journeyStepStatus(record);
  return knownJourneySteps(record) > 0 && status !== 'unavailable' && status !== 'excluded';
}

export function stepDisplayText(record: JourneyRecord): string | null {
  const status = journeyStepStatus(record);
  if (status === 'unavailable') return '本趟未取得步數';
  if (status === 'excluded') return '步數已排除統計';
  const prefix = status === 'partial' ? '至少 ' : '';
  return `${prefix}${knownJourneySteps(record).toLocaleString()} 步`;
}

export function monthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function visibleMemories(records: JourneyRecord[]): JourneyRecord[] {
  return records
    .filter((record) => isActivityJourney(record) && record.memoryHidden !== true)
    .sort((left, right) => right.endedAt - left.endedAt);
}

export function memoriesByMonth(records: JourneyRecord[]): Array<{
  key: string;
  records: JourneyRecord[];
}> {
  const groups = new Map<string, JourneyRecord[]>();
  for (const record of visibleMemories(records)) {
    const key = monthKey(record.endedAt);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, monthRecords]) => ({ key, records: monthRecords }));
}

function emptyThemeCounts(): Record<ExplorationTheme, number> {
  return { food: 0, nature: 0, architecture: 0, surprise: 0 };
}

export function monthlySummary(records: JourneyRecord[], key: string): MonthlyMemorySummary {
  const activityRecords = records.filter(
    (record) => isActivityJourney(record) && monthKey(record.endedAt) === key,
  );
  const themeCounts = emptyThemeCounts();
  const petIds = new Set<string>();
  let totalSteps = 0;
  let completedSteps = 0;
  let unreachedSteps = 0;
  let totalMinutes = 0;
  let completeStepJourneyCount = 0;
  let completeStepTotal = 0;
  let partialCount = 0;
  let unavailableCount = 0;
  let excludedCount = 0;
  let arrivedCount = 0;
  let unreachedCount = 0;
  for (const record of activityRecords) {
    const steps = knownJourneySteps(record);
    const outcome = journeyOutcome(record);
    const status = journeyStepStatus(record);
    if (outcome === 'arrived') arrivedCount += 1;
    else unreachedCount += 1;
    if (status !== 'unavailable' && status !== 'excluded') {
      totalSteps += steps;
      if (outcome === 'arrived') completedSteps += steps;
      else unreachedSteps += steps;
    }
    if (status === 'complete') {
      completeStepJourneyCount += 1;
      completeStepTotal += steps;
    } else if (status === 'partial') partialCount += 1;
    else if (status === 'unavailable') unavailableCount += 1;
    else excludedCount += 1;
    totalMinutes += Math.max(0, record.elapsedMinutes);
    themeCounts[record.theme] += 1;
    if (record.petId) petIds.add(record.petId);
  }
  return {
    monthKey: key,
    journeyCount: activityRecords.length,
    arrivedCount,
    unreachedCount,
    totalSteps,
    completedSteps,
    unreachedSteps,
    completeStepJourneyCount,
    averageCompleteSteps: completeStepJourneyCount > 0
      ? Math.round(completeStepTotal / completeStepJourneyCount)
      : 0,
    partialCount,
    unavailableCount,
    excludedCount,
    totalMinutes,
    themeCounts,
    petIds: [...petIds],
  };
}

export function normalizeMemoryRecord(record: JourneyRecord): JourneyRecord {
  const legacyUnreached = record.outcome === undefined && !record.completed;
  const legacyActivityUnreached = legacyUnreached && knownJourneySteps(record) > 0;
  const inheritedPhoto = record.memoryPhotoUri
    ?? (record.hasPhoto && record.microTaskPhotoUri ? record.microTaskPhotoUri : undefined);
  return {
    ...record,
    hasPhoto: Boolean(inheritedPhoto ?? record.hasPhoto),
    memoryPhotoUri: inheritedPhoto,
    memoryHidden: legacyActivityUnreached ? false : record.memoryHidden === true,
    outcome: journeyOutcome(record),
    stepStatus: journeyStepStatus(record),
    destinationRevealed: record.destinationRevealed ?? record.completed,
    destinationReplaced: record.destinationReplaced === true,
    destinationName: legacyUnreached ? '尚未揭曉的目的地' : record.destinationName,
    destinationLatitude: legacyUnreached ? undefined : record.destinationLatitude,
    destinationLongitude: legacyUnreached ? undefined : record.destinationLongitude,
    arrivalLatitude: legacyUnreached ? undefined : record.arrivalLatitude,
    arrivalLongitude: legacyUnreached ? undefined : record.arrivalLongitude,
  };
}

export function normalizeMemoryRecords(records: JourneyRecord[]): JourneyRecord[] {
  return records.map(normalizeMemoryRecord);
}

export function chooseValidFeaturedMemories(
  records: JourneyRecord[],
  featuredByMonth: Record<string, string>,
): Record<string, string> {
  const visibleIds = new Set(visibleMemories(records)
    .filter((record) => journeyOutcome(record) === 'arrived')
    .map((record) => record.id));
  return Object.fromEntries(
    Object.entries(featuredByMonth).filter(([, recordId]) => visibleIds.has(recordId)),
  );
}
