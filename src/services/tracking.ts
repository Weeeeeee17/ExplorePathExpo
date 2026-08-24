import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';

import { TrackedLocation } from '../domain/types';

function trackedLocation(location: Location.LocationObject): TrackedLocation {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy,
    timestamp: location.timestamp,
  };
}

export async function requestForegroundLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

export async function getCurrentTrackedLocation(): Promise<TrackedLocation> {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
    mayShowUserSettingsDialog: true,
  });
  return trackedLocation(location);
}

export async function watchTrackedLocation(
  onLocation: (location: TrackedLocation) => void,
): Promise<Location.LocationSubscription> {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 3,
      timeInterval: 2000,
    },
    (location) => onLocation(trackedLocation(location)),
  );
}

export async function watchDeviceHeading(
  onHeading: (heading: number | null) => void,
): Promise<Location.LocationSubscription> {
  return Location.watchHeadingAsync((heading) => {
    const value = heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading;
    onHeading(Number.isFinite(value) ? value : null);
  });
}

export async function requestMotionAccess(): Promise<'available' | 'denied' | 'unavailable'> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return 'unavailable';
    const current = await Pedometer.getPermissionsAsync();
    if (current.granted) return 'available';
    const requested = await Pedometer.requestPermissionsAsync();
    return requested.granted ? 'available' : 'denied';
  } catch {
    return 'unavailable';
  }
}

export async function stepsSince(timestamp: number): Promise<number | null> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return null;
    const result = await Pedometer.getStepCountAsync(new Date(timestamp), new Date());
    return Math.max(0, result.steps);
  } catch {
    return null;
  }
}

export function watchSteps(onSteps: (steps: number) => void) {
  return Pedometer.watchStepCount((result) => onSteps(Math.max(0, result.steps)));
}
