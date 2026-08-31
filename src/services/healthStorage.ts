import AsyncStorage from '@react-native-async-storage/async-storage';

import { defaultHealthProfile, normalizeHealthProfile } from '../domain/health';
import { HealthProfile } from '../domain/types';

const healthProfileStorageKey = 'explorepath.health-profile.v1';

export async function loadHealthProfile(): Promise<HealthProfile> {
  try {
    const value = await AsyncStorage.getItem(healthProfileStorageKey);
    return value ? normalizeHealthProfile(JSON.parse(value) as Partial<HealthProfile>) : defaultHealthProfile;
  } catch {
    return defaultHealthProfile;
  }
}

export async function saveHealthProfile(profile: HealthProfile): Promise<void> {
  await AsyncStorage.setItem(healthProfileStorageKey, JSON.stringify(normalizeHealthProfile(profile)));
}
