import {
  ExplorationTheme,
  HealthProfile,
  JourneyRecord,
  MotionPermissionState,
  SeasonalPromiseState,
  ActiveJourney,
  Destination,
  PetCollectionState,
} from './types';
import { chooseValidFeaturedMemories, normalizeMemoryRecords } from './memories';
import { emptyPetCollection, normalizePetCollection } from './petRules';
import { defaultHealthProfile, normalizeHealthProfile } from './health';

export const backupFormat = 'explorepath-backup';
export const backupVersion = 4;

export interface ExplorePathBackupPayload {
  format: typeof backupFormat;
  version: typeof backupVersion;
  appVersion: string;
  exportedAt: number;
  data: {
    petCollection: PetCollectionState;
    records: JourneyRecord[];
    healthProfile: HealthProfile;
    usedMicroTaskIds: string[];
    durationMinutes: number;
    theme: ExplorationTheme;
    featuredMemoryByMonth: Record<string, string>;
    motionPermissionState: MotionPermissionState;
    seasonalPromise: SeasonalPromiseState;
    recoveryState: {
      activeJourney: ActiveJourney | null;
      candidate: Destination | null;
      revealed: boolean;
    };
  };
}

export function stripPhotos(records: JourneyRecord[]): JourneyRecord[] {
  return records.map(({ memoryPhotoUri: _memoryPhoto, microTaskPhotoUri: _taskPhoto, ...record }) => ({
    ...record,
    hasPhoto: false,
  }));
}

export function createBackupPayload(input: {
  appVersion: string;
  exportedAt?: number;
  petCollection?: PetCollectionState;
  records: JourneyRecord[];
  healthProfile: HealthProfile;
  usedMicroTaskIds: string[];
  durationMinutes: number;
  theme: ExplorationTheme;
  featuredMemoryByMonth: Record<string, string>;
  motionPermissionState: MotionPermissionState;
  seasonalPromise: SeasonalPromiseState;
  recoveryState?: {
    activeJourney: ActiveJourney | null;
    candidate: Destination | null;
    revealed: boolean;
  };
}): ExplorePathBackupPayload {
  return {
    format: backupFormat,
    version: backupVersion,
    appVersion: input.appVersion,
    exportedAt: input.exportedAt ?? Date.now(),
    data: {
      records: stripPhotos(input.records),
      petCollection: { ...(input.petCollection ?? emptyPetCollection()), notificationIds: [] },
      healthProfile: normalizeHealthProfile(input.healthProfile),
      usedMicroTaskIds: [...input.usedMicroTaskIds],
      durationMinutes: input.durationMinutes,
      theme: input.theme,
      featuredMemoryByMonth: { ...input.featuredMemoryByMonth },
      motionPermissionState: { ...input.motionPermissionState },
      seasonalPromise: {
        ...input.seasonalPromise,
        entries: input.seasonalPromise.entries.map(({ photoUri: _photo, ...entry }) => entry),
      },
      recoveryState: {
        activeJourney: input.recoveryState?.activeJourney ? {
          ...input.recoveryState.activeJourney,
          recoveryPending: true,
          microTask: input.recoveryState.activeJourney.microTask
            ? { ...input.recoveryState.activeJourney.microTask, photoUri: undefined }
            : undefined,
        } : null,
        candidate: input.recoveryState?.candidate ?? null,
        revealed: input.recoveryState?.revealed === true,
      },
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseBackupPayload(text: string): ExplorePathBackupPayload {
  const parsed: unknown = JSON.parse(text);
  const parsedVersion = isObject(parsed) ? Number(parsed.version) : 0;
  if (!isObject(parsed) || parsed.format !== backupFormat || ![1, 2, 3, backupVersion].includes(parsedVersion)) {
    throw new Error('這不是 ExplorePath 支援的備份檔。');
  }
  if (
    !isObject(parsed.data)
    || !Array.isArray(parsed.data.records)
  ) {
    throw new Error('備份內容不完整。');
  }
  const durationMinutes = Number(parsed.data.durationMinutes);
  if (parsedVersion === 4 && (!isObject(parsed.data.petCollection) || parsed.data.petCollection.schemaVersion !== 2 || !Array.isArray(parsed.data.petCollection.pets))) {
    throw new Error('v4 備份缺少完整寵物收藏，已拒絕還原以避免清空進度。');
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes < 1) {
    throw new Error('備份的探索時間設定無效。');
  }
  const theme = parsed.data.theme;
  if (!['food', 'nature', 'architecture', 'surprise'].includes(String(theme))) {
    throw new Error('備份的探索主題無效。');
  }
  const records = normalizeMemoryRecords(parsed.data.records as JourneyRecord[]);
  const featured = isObject(parsed.data.featuredMemoryByMonth)
    ? Object.fromEntries(
      Object.entries(parsed.data.featuredMemoryByMonth)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    )
    : {};
  return {
    format: backupFormat,
    version: backupVersion,
    appVersion: typeof parsed.appVersion === 'string' ? parsed.appVersion : '未知版本',
    exportedAt: Number(parsed.exportedAt) || Date.now(),
    data: {
      records,
      petCollection: normalizePetCollection(parsed.data.petCollection ?? parsed.data.pet, Date.now()),
      healthProfile: isObject(parsed.data.healthProfile)
        ? normalizeHealthProfile(parsed.data.healthProfile as Partial<HealthProfile>)
        : defaultHealthProfile,
      usedMicroTaskIds: Array.isArray(parsed.data.usedMicroTaskIds)
        ? parsed.data.usedMicroTaskIds.filter((id): id is string => typeof id === 'string')
        : [],
      durationMinutes,
      theme: theme as ExplorationTheme,
      featuredMemoryByMonth: chooseValidFeaturedMemories(records, featured),
      motionPermissionState: isObject(parsed.data.motionPermissionState)
        ? {
          explanationShown: parsed.data.motionPermissionState.explanationShown === true,
          unavailableJourneyAttempts: Math.max(0, Number(parsed.data.motionPermissionState.unavailableJourneyAttempts) || 0),
          followupShown: parsed.data.motionPermissionState.followupShown === true,
          lastStatus: ['available', 'denied', 'unavailable'].includes(String(parsed.data.motionPermissionState.lastStatus))
            ? parsed.data.motionPermissionState.lastStatus as MotionPermissionState['lastStatus']
            : 'unknown',
        }
        : { explanationShown: false, unavailableJourneyAttempts: 0, followupShown: false, lastStatus: 'unknown' },
      seasonalPromise: isObject(parsed.data.seasonalPromise)
        ? parsed.data.seasonalPromise as unknown as SeasonalPromiseState
        : {
          status: 'idle', selectedCandidates: [], sealedCandidates: [], target: null,
          startedAt: null, expiresAt: null, entries: [], pendingVisit: null,
          isShowcase: false, reunionTokens: 0, seasonalBadges: 0,
          lastRewardMessage: null, notificationsEnabled: null, notificationIds: [],
        },
      recoveryState: isObject(parsed.data.recoveryState)
        ? {
          activeJourney: isObject(parsed.data.recoveryState.activeJourney)
            ? parsed.data.recoveryState.activeJourney as unknown as ActiveJourney
            : null,
          candidate: isObject(parsed.data.recoveryState.candidate)
            ? parsed.data.recoveryState.candidate as unknown as Destination
            : null,
          revealed: parsed.data.recoveryState.revealed === true,
        }
        : { activeJourney: null, candidate: null, revealed: false },
    },
  };
}
