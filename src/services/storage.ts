import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ActiveJourney,
  AppPhase,
  Destination,
  ExplorationTheme,
  JourneyRecord,
  PetState,
  ReviewDraft,
  RewardSummary,
} from '../domain/types';

const storageKey = 'explorepath.real-state.v1';

export interface PersistedRealState {
  version: 1;
  pet: PetState;
  records: JourneyRecord[];
  phase: Extract<AppPhase, 'preparation' | 'candidate' | 'active' | 'review' | 'reward'>;
  durationMinutes: number;
  theme: ExplorationTheme;
  candidate: Destination | null;
  activeJourney: ActiveJourney | null;
  review: ReviewDraft;
  reward: RewardSummary | null;
}

export async function loadRealState(): Promise<PersistedRealState | null> {
  try {
    const value = await AsyncStorage.getItem(storageKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as PersistedRealState;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveRealState(state: PersistedRealState): Promise<void> {
  await AsyncStorage.setItem(storageKey, JSON.stringify(state));
}
