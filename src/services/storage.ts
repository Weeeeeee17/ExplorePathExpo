import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ActiveJourney,
  AppPhase,
  Destination,
  ExplorationTheme,
  JourneyRecord,
  JourneyKind,
  MotionPermissionState,
  PetCollectionState,
  PetState,
  ReviewDraft,
  RewardSummary,
} from '../domain/types';
import { migrateLegacyPet, normalizePetCollection } from '../domain/petRules';
import { chooseValidFeaturedMemories, normalizeMemoryRecords } from '../domain/memories';
import { createShowcaseSeed, ShowcaseSeedData } from '../domain/showcase';

const storageKey = 'explorepath.real-state.v1';
const showcaseStorageKey = 'explorepath.showcase-state.v1';

export interface PersistedRealState {
  version: 6;
  petCollection: PetCollectionState;
  records: JourneyRecord[];
  phase: Extract<AppPhase, 'preparation' | 'candidate' | 'active' | 'arrival' | 'review' | 'reward'>;
  durationMinutes: number;
  theme: ExplorationTheme;
  candidate: Destination | null;
  activeJourney: ActiveJourney | null;
  review: ReviewDraft;
  reward: RewardSummary | null;
  usedMicroTaskIds: string[];
  journeyIntent?: JourneyKind;
  rescuePetId?: string | null;
  featuredMemoryByMonth: Record<string, string>;
  motionPermissionState: MotionPermissionState;
}

type V5PersistedRealState = Omit<PersistedRealState, 'version' | 'motionPermissionState'> & {
  version: 5;
};

type V4PersistedRealState = Omit<V5PersistedRealState, 'version'> & {
  version: 4;
};

type V3PersistedRealState = Omit<PersistedRealState, 'version' | 'featuredMemoryByMonth'> & {
  version: 3;
};

type V2PersistedRealState = Omit<PersistedRealState, 'version' | 'petCollection' | 'featuredMemoryByMonth'> & {
  version: 2;
  pet: PetState;
};

type LegacyPersistedRealState = Omit<V2PersistedRealState, 'version' | 'usedMicroTaskIds' | 'phase'> & {
  version: 1;
  phase: Extract<AppPhase, 'preparation' | 'candidate' | 'active' | 'review' | 'reward'>;
};

export async function loadRealState(): Promise<PersistedRealState | null> {
  try {
    const value = await AsyncStorage.getItem(storageKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as PersistedRealState | V5PersistedRealState | V4PersistedRealState | V3PersistedRealState | V2PersistedRealState | LegacyPersistedRealState;
    const now = Date.now();
    if (parsed.version === 6) {
      const records = normalizeMemoryRecords(parsed.records);
      return {
        ...parsed,
        records,
        review: normalizeReview(parsed.review),
        featuredMemoryByMonth: chooseValidFeaturedMemories(records, parsed.featuredMemoryByMonth ?? {}),
        petCollection: normalizePetCollection(parsed.petCollection, now),
        motionPermissionState: parsed.motionPermissionState ?? defaultMotionPermissionState(),
      };
    }
    if (parsed.version === 5) {
      const records = normalizeMemoryRecords(parsed.records);
      return {
        ...parsed,
        version: 6,
        records,
        review: normalizeReview(parsed.review),
        featuredMemoryByMonth: chooseValidFeaturedMemories(records, parsed.featuredMemoryByMonth ?? {}),
        petCollection: normalizePetCollection(parsed.petCollection, now),
        motionPermissionState: defaultMotionPermissionState(),
      };
    }
    if (parsed.version === 4) {
      const records = normalizeMemoryRecords(parsed.records);
      return {
        ...parsed,
        version: 6,
        records,
        review: normalizeReview(parsed.review),
        featuredMemoryByMonth: chooseValidFeaturedMemories(records, parsed.featuredMemoryByMonth ?? {}),
        petCollection: normalizePetCollection(parsed.petCollection, now),
        motionPermissionState: defaultMotionPermissionState(),
      };
    }
    if (parsed.version === 3) {
      const records = normalizeMemoryRecords(parsed.records);
      return {
        ...parsed,
        version: 6,
        records,
        review: normalizeReview({ ...parsed.review, photoUri: null }),
        featuredMemoryByMonth: {},
        petCollection: normalizePetCollection(parsed.petCollection, now),
        motionPermissionState: defaultMotionPermissionState(),
      };
    }
    if (parsed.version === 2) {
      const { pet, ...rest } = parsed;
      return {
        ...rest,
        version: 6,
        records: normalizeMemoryRecords(rest.records),
        review: normalizeReview({ ...rest.review, photoUri: null }),
        featuredMemoryByMonth: {},
        petCollection: migrateLegacyPet(pet, now),
        motionPermissionState: defaultMotionPermissionState(),
      };
    }
    if (parsed.version === 1) {
      const { pet, ...rest } = parsed;
      return {
        ...rest,
        version: 6,
        records: normalizeMemoryRecords(rest.records),
        review: normalizeReview({ ...rest.review, photoUri: null }),
        usedMicroTaskIds: [],
        featuredMemoryByMonth: {},
        petCollection: migrateLegacyPet(pet, now),
        motionPermissionState: defaultMotionPermissionState(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeReview(review: ReviewDraft): ReviewDraft {
  return {
    ...review,
    effort: review.effort ?? null,
    photoUri: review.photoUri ?? null,
  };
}

export function defaultMotionPermissionState(): MotionPermissionState {
  return {
    explanationShown: false,
    unavailableJourneyAttempts: 0,
    followupShown: false,
    lastStatus: 'unknown',
  };
}

export async function saveRealState(state: PersistedRealState): Promise<void> {
  await AsyncStorage.setItem(storageKey, JSON.stringify(state));
}

export interface PersistedShowcaseState extends ShowcaseSeedData {
  version: 3;
}

type LegacyPersistedShowcaseState = Omit<PersistedShowcaseState, 'version'> & { version: 1 | 2 };

export async function loadShowcaseState(now = Date.now()): Promise<PersistedShowcaseState> {
  try {
    const value = await AsyncStorage.getItem(showcaseStorageKey);
    if (!value) return { version: 3, ...createShowcaseSeed(now) };
    const parsed = JSON.parse(value) as Partial<PersistedShowcaseState | LegacyPersistedShowcaseState>;
    if (parsed.version !== 3 || !Array.isArray(parsed.records) || !parsed.petCollection) {
      return { version: 3, ...createShowcaseSeed(now) };
    }
    const records = normalizeMemoryRecords(parsed.records);
    return {
      version: 3,
      petCollection: normalizePetCollection(parsed.petCollection, now),
      records,
      usedMicroTaskIds: Array.isArray(parsed.usedMicroTaskIds)
        ? parsed.usedMicroTaskIds.filter((id): id is string => typeof id === 'string')
        : [],
      featuredMemoryByMonth: chooseValidFeaturedMemories(
        records,
        parsed.featuredMemoryByMonth ?? {},
      ),
      clockOffsetMilliseconds: Math.max(0, Number(parsed.clockOffsetMilliseconds) || 0),
    };
  } catch {
    return { version: 3, ...createShowcaseSeed(now) };
  }
}

export async function saveShowcaseState(state: PersistedShowcaseState): Promise<void> {
  await AsyncStorage.setItem(showcaseStorageKey, JSON.stringify(state));
}

export async function resetStoredShowcaseState(): Promise<void> {
  await AsyncStorage.removeItem(showcaseStorageKey);
}
