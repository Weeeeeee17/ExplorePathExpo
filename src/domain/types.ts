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
  | 'arrival'
  | 'review'
  | 'reward';
export type AppTab = 'explore' | 'health' | 'records' | 'friends' | 'showcase' | 'pets';
export type JourneyMood =
  | 'surprised'
  | 'happy'
  | 'calm'
  | 'curious'
  | 'tired'
  | 'disappointed';
export type JourneyEffort = 'easy' | 'steady' | 'challenging' | 'hard';
export type HealthIntensity = 'restful' | 'light' | 'moderate' | 'brisk';
export type HealthMilestoneKind = 'firstJourney' | 'dailyGoal' | 'personalBest' | 'threeDayStreak';
/** Legacy values are retained only as opaque, exportable archives. */
export type PetSpecies = string;
export type PetVisualId =
  | 'thought'
  | 'porcelain'
  | 'wood'
  | 'pebble'
  | 'frosted'
  | 'water'
  | 'marble'
  | 'brass'
  | 'cloud'
  | 'stargazer'
  | 'compass'
  | 'voyager';
export type PetStage = 'emptyRoom' | 'egg' | 'juvenile' | 'growing' | 'mature';
export type PetPersonality = 'curious' | 'relaxed' | 'lively';
export type PetLifecycle = 'available' | 'countdown' | 'departed' | 'rescuing' | 'memory';
export type JourneyKind = 'normal' | 'rescue' | 'seasonal';
export type JourneyOutcome = 'arrived' | 'unreached';
export type StepStatus = 'complete' | 'partial' | 'unavailable' | 'excluded';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type SeasonalEntryKind = 'photo' | 'observation';
export type SeasonalPromiseStatus = 'idle' | 'selecting' | 'sealed' | 'active' | 'completed';

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
  arrivalLatitude?: number;
  arrivalLongitude?: number;
  arrivalKind?: 'point' | 'boundary';
  environmentHint: string;
  hintSource?: 'openstreetmap' | 'fallback';
  source?: 'demo' | 'openstreetmap';
}

export type MicroTaskType = 'photo' | 'observation' | 'imagination';
export type MicroTaskStatus = 'pending' | 'available' | 'active' | 'completed' | 'skipped';

export interface MicroTaskDefinition {
  id: string;
  theme: ExplorationTheme;
  type: MicroTaskType;
  title: string;
  prompt: string;
  instruction: string;
  options?: string[];
}

export interface JourneyMicroTask extends MicroTaskDefinition {
  status: MicroTaskStatus;
  replacementUsed: boolean;
  response?: string;
  photoUri?: string;
  savedToPhotoLibrary?: boolean;
  hintUnlocked: boolean;
}

export interface ActiveJourney {
  id: string;
  startedAt: number;
  endedAt?: number;
  destinationId: string;
  steps: number;
  distanceMeters: number;
  dwellSeconds: number;
  walkStage: number;
  origin?: GeoPoint;
  dwellTargetSeconds?: 30 | 45 | 60;
  microTask?: JourneyMicroTask;
  deviationWindowStartedAt?: number | null;
  deviationStartDistanceMeters?: number | null;
  deviationSuggested?: boolean;
  stepCaptureStartedAt?: number;
  stepBonusAvailable?: boolean;
  stepStatus?: StepStatus;
  lastConfirmedStepsAt?: number;
  recoveryPending?: boolean;
  destinationReplaced?: boolean;
  dwellMilliseconds?: number;
  lastDwellSampleAt?: number | null;
  outsideSince?: number | null;
  kind?: JourneyKind;
  rescuePetId?: string;
  seasonalSeason?: Season;
}

export interface ReviewDraft {
  mood: JourneyMood | null;
  effort: JourneyEffort | null;
  note: string;
  hasPhoto: boolean;
  photoUri: string | null;
}

export interface HealthProfile {
  strideLengthCm: number;
  dailyStepGoal: number;
}

export interface JourneyHealthMetrics {
  steps: number;
  elapsedMinutes: number;
  estimatedActiveMinutes: number;
  stoppedMinutes: number;
  estimatedDistanceMeters: number;
  averageCadence: number;
  intensity: HealthIntensity;
}

export interface HealthMilestone {
  kind: HealthMilestoneKind;
  title: string;
  detail: string;
}

export interface DailyHealthSummary {
  dateKey: string;
  steps: number;
  journeyCount: number;
  elapsedMinutes: number;
  activeMinutes: number;
  estimatedDistanceMeters: number;
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

export interface PetProfile {
  id: string;
  seriesId: PetVisualId;
  stage: Exclude<PetStage, 'emptyRoom'>;
  stageHistory: Array<{ stage: Exclude<PetStage, 'emptyRoom'>; unlockedAt: number }>;
  sharedSteps: number;
  nickname: string;
  personality: PetPersonality;
  experience: number;
  mood: number;
  cleanliness: number;
  lifecycle: PetLifecycle;
  createdAt: number;
  lastNeedsUpdatedAt: number;
  lastCompanionAt: number | null;
  lastCleanedAt: number | null;
  countdownStartedAt: number | null;
  departedAt: number | null;
  rescueReadyAt: number | null;
  memoryAt: number | null;
  sharedDestinationIds: string[];
  sharedJourneyCount: number;
}

export interface PetSwitchLock {
  activePetId: string;
  previousPetId: string | null;
  switchedAt: number;
  undoAvailable: boolean;
}

export interface PetCollectionState {
  schemaVersion: 2;
  pets: PetProfile[];
  activePetId: string | null;
  switchLock: PetSwitchLock | null;
  careItems: number;
  normalJourneysTowardCareItem: number;
  matureJourneysTowardEgg: number;
  seriesBag: PetVisualId[];
  legacyArchives: Array<{ archivedAt: number; data: unknown }>;
  journeyBindings: Record<string, { petId: string | null; qualifiedForEgg: boolean; startedAt: number; ended?: boolean }>;
  rewardLedger: Record<string, RewardSummary>;
  nextPetSequence: number;
  notificationsEnabled: boolean | null;
  notificationIds: string[];
}

export interface RewardSummary {
  journeyId: string;
  xp: XPBreakdown;
  appliedPetXP: number;
  petEvent: 'foundEgg' | 'eggProgressed' | 'hatched' | 'evolved' | 'progressed' | 'noCompanion';
  previousStage: PetStage;
  nextStage: PetStage;
  petId?: string;
  careItemAwarded?: boolean;
  newEggFound?: boolean;
}

export interface JourneyRecord {
  id: string;
  destinationName: string;
  theme: ExplorationTheme;
  endedAt: number;
  elapsedMinutes: number;
  steps: number;
  estimatedActiveMinutes?: number;
  stoppedMinutes?: number;
  estimatedDistanceMeters?: number;
  averageCadence?: number;
  healthIntensity?: HealthIntensity;
  effort?: JourneyEffort | null;
  healthMilestones?: HealthMilestoneKind[];
  mood: JourneyMood | null;
  hasPhoto: boolean;
  memoryPhotoUri?: string;
  memoryHidden?: boolean;
  note: string;
  earnedXP: number;
  completed: boolean;
  outcome?: JourneyOutcome;
  stepStatus?: StepStatus;
  destinationRevealed?: boolean;
  destinationReplaced?: boolean;
  microTaskTitle?: string;
  microTaskType?: MicroTaskType;
  microTaskResponse?: string;
  microTaskPhotoUri?: string;
  microTaskCompleted?: boolean;
  kind?: JourneyKind;
  petId?: string;
  destinationId?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  arrivalLatitude?: number;
  arrivalLongitude?: number;
}

export interface SeasonalCandidate {
  id: string;
  recordId: string;
  destinationId: string;
  destinationName: string;
  latitude: number;
  longitude: number;
  cityLabel: string;
  isShowcase: boolean;
}

export interface SeasonalEntry {
  id: string;
  season: Season;
  completedAt: number;
  kind: SeasonalEntryKind;
  observation: string;
  photoUri?: string;
  usedSafetyRadius: boolean;
  journeyId?: string;
}

export interface SeasonalPendingVisit {
  journeyId: string;
  season: Season;
  arrivedAt: number;
}

export interface SeasonalPromiseState {
  status: SeasonalPromiseStatus;
  selectedCandidates: SeasonalCandidate[];
  sealedCandidates: SeasonalCandidate[];
  target: SeasonalCandidate | null;
  startedAt: number | null;
  expiresAt: number | null;
  entries: SeasonalEntry[];
  pendingVisit: SeasonalPendingVisit | null;
  isShowcase: boolean;
  reunionTokens: 0 | 1;
  seasonalBadges: number;
  lastRewardMessage: string | null;
  notificationsEnabled: boolean | null;
  notificationIds: string[];
}

export interface MonthlyMemorySummary {
  monthKey: string;
  journeyCount: number;
  arrivedCount: number;
  unreachedCount: number;
  totalSteps: number;
  completedSteps: number;
  unreachedSteps: number;
  completeStepJourneyCount: number;
  averageCompleteSteps: number;
  partialCount: number;
  unavailableCount: number;
  excludedCount: number;
  totalMinutes: number;
  themeCounts: Record<ExplorationTheme, number>;
  petIds: string[];
}

export interface BackupPreview {
  petCount: number;
  archiveCount: number;
  exportedAt: number;
  recordCount: number;
  completedCount: number;
  totalSteps: number;
  appVersion: string;
}

export interface TimeSuggestion {
  addedMinutes: 10 | 20 | 30;
  resultCount: number;
}

export type MotionStatus = 'unknown' | 'available' | 'denied' | 'unavailable';
export interface MotionPermissionState {
  explanationShown: boolean;
  unavailableJourneyAttempts: number;
  followupShown: boolean;
  lastStatus: MotionStatus;
}
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
