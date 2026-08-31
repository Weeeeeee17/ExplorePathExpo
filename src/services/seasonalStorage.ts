import AsyncStorage from '@react-native-async-storage/async-storage';

import { emptySeasonalPromise, normalizeSeasonalPromise } from '../domain/seasonalPromise';
import { SeasonalPromiseState, TrackingMode } from '../domain/types';

const keyForMode = (mode: TrackingMode) => `explorepath.seasonal-promise.${mode}.v1`;

export async function loadSeasonalPromise(mode: TrackingMode): Promise<SeasonalPromiseState> {
  try {
    const raw = await AsyncStorage.getItem(keyForMode(mode));
    return raw ? normalizeSeasonalPromise(JSON.parse(raw) as SeasonalPromiseState) : emptySeasonalPromise();
  } catch {
    return emptySeasonalPromise();
  }
}

export async function saveSeasonalPromise(mode: TrackingMode, state: SeasonalPromiseState): Promise<void> {
  await AsyncStorage.setItem(keyForMode(mode), JSON.stringify(state));
}

export async function resetShowcaseSeasonalPromise(): Promise<void> {
  await AsyncStorage.removeItem(keyForMode('demo'));
}
