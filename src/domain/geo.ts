import { Destination, GeoPoint } from './types';

const earthRadiusMeters = 6_371_000;
const walkingMetersPerMinute = 70;
const routeDetourFactor = 1.35;
const dwellAllowanceMinutes = 1;

export interface DwellState {
  dwellMilliseconds: number;
  lastDwellSampleAt: number | null;
  outsideSince: number | null;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function normalizeDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

export function distanceMeters(from: GeoPoint, to: GeoPoint): number {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function initialBearing(from: GeoPoint, to: GeoPoint): number {
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);
  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI);
}

export function relativeCompassRotation(bearing: number, heading: number | null): number {
  return normalizeDegrees(bearing - (heading ?? 0));
}

export function broadDirectionFromBearing(bearing: number): string {
  const directions = ['北方', '東北方', '東方', '東南方', '南方', '西南方', '西方', '西北方'];
  return directions[Math.round(normalizeDegrees(bearing) / 45) % 8] ?? '北方';
}

export function arrivalRadiusMeters(accuracyMeters: number | null): number {
  const accuracy = accuracyMeters ?? 40;
  return Math.round(Math.max(40, Math.min(100, accuracy * 1.5)));
}

export function estimatedWalkingMinutes(straightLineMeters: number): number {
  return Math.max(1, Math.ceil((straightLineMeters * routeDetourFactor) / walkingMetersPerMinute));
}

export function estimatedTotalMinutes(straightLineMeters: number): number {
  return estimatedWalkingMinutes(straightLineMeters) + dwellAllowanceMinutes;
}

export function searchRadiusMeters(durationMinutes: number): number {
  const walkingMinutes = Math.max(1, durationMinutes - dwellAllowanceMinutes);
  const straightLineBudget = (walkingMinutes * walkingMetersPerMinute) / routeDetourFactor;
  return Math.round(Math.max(350, Math.min(3500, straightLineBudget)));
}

export function destinationDirection(origin: GeoPoint, destination: Destination): string {
  return broadDirectionFromBearing(initialBearing(origin, destination));
}

export function advanceDwellState(
  state: DwellState,
  insideArrivalRadius: boolean,
  now: number,
): DwellState {
  let { dwellMilliseconds, lastDwellSampleAt, outsideSince } = state;
  if (insideArrivalRadius) {
    if (outsideSince !== null) {
      outsideSince = null;
      lastDwellSampleAt = now;
    } else if (lastDwellSampleAt !== null) {
      dwellMilliseconds += Math.min(4_000, Math.max(0, now - lastDwellSampleAt));
      lastDwellSampleAt = now;
    } else {
      lastDwellSampleAt = now;
    }
  } else if (outsideSince === null) {
    outsideSince = now;
    lastDwellSampleAt = null;
  } else if (now - outsideSince > 10_000) {
    dwellMilliseconds = 0;
    lastDwellSampleAt = null;
  }
  return { dwellMilliseconds, lastDwellSampleAt, outsideSince };
}
