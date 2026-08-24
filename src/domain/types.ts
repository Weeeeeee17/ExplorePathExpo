export type ExplorationTheme = 'food' | 'nature' | 'architecture' | 'surprise';
export type TrackingMode = 'real' | 'demo';
export type AppPhase =
  | 'preparation'
  | 'searching'
  | 'candidate'
  | 'noResults'
  | 'permissionRequired'
  | 'serviceError'
  | 'active'
  | 'review'
  | 'reward';
export type AppTab = 'explore' | 'pet' | 'records';
export type JourneyMood =
  | 'surprised'
  | 'happy'
  | 'calm'
  | 'curious'
  | 'tired'
  | 'disappointed';
export type PetSpecies = 'fox' | 'otter' | 'raccoon';
export type PetStage = 'emptyRoom' | 'egg' | 'juvenile' | 'growing' | 'mature';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface TrackedLocation extends GeoPoint {
  accuracyMeters: number | null;
  timestamp: number;
}

export interface Destination {
  id: string;
  internalName: string;
  theme: Exclude<ExplorationTheme, 'surprise'>;
  walkingMinutes: number;
  totalMinutes: number;
  distanceMeters: number;
  latitude: number;
  longitude: number;
  environmentHint: string;
  source?: 'demo' | 'openstreetmap';
}

export interface ActiveJourney {
  id: string;
  startedAt: number;
  destinationId: string;
  steps: number;
  distanceMeters: number;
  dwellSeconds: number;
  walkStage: number;
  stepCaptureStartedAt?: number;
  stepBonusAvailable?: boolean;
  dwellMilliseconds?: number;
  lastDwellSampleAt?: number | null;
  outsideSince?: number | null;
}

export interface ReviewDraft {
  mood: JourneyMood | null;
  note: string;
  hasPhoto: boolean;
}

export interface XPBreakdown {
  arrivalXP: number;
  stepBonusXP: number;
  totalXP: number;
}

export interface PetState {
  hasEgg: boolean;
  species: PetSpecies | null;
  experience: number;
}

export interface RewardSummary {
  journeyId: string;
  xp: XPBreakdown;
  appliedPetXP: number;
  petEvent: 'foundEgg' | 'eggProgressed' | 'hatched' | 'evolved' | 'progressed';
  previousStage: PetStage;
  nextStage: PetStage;
}

export interface JourneyRecord {
  id: string;
  destinationName: string;
  theme: ExplorationTheme;
  endedAt: number;
  elapsedMinutes: number;
  steps: number;
  mood: JourneyMood | null;
  hasPhoto: boolean;
  note: string;
  earnedXP: number;
  completed: boolean;
}

export interface TimeSuggestion {
  addedMinutes: 10 | 20 | 30;
  resultCount: number;
}

export type MotionStatus = 'unknown' | 'available' | 'denied' | 'unavailable';
export type LiveTrackingStatus =
  | 'idle'
  | 'starting'
  | 'live'
  | 'paused'
  | 'waitingForAccuracy'
  | 'error';

export interface SearchIssue {
  title: string;
  detail: string;
}
