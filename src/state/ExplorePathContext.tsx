import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { xpBreakdown } from '../domain/rules';
import { AppState, AppStateStatus, Linking, Vibration } from 'react-native';

import { destinations } from '../data/destinations';
import { selectMicroTask } from '../data/microTasks';
import {
  advanceDwellState,
  arrivalRadiusMeters,
  destinationTarget,
  distanceMeters,
  dwellTargetSeconds,
  estimatedTotalMinutes,
  estimatedWalkingMinutes,
  updateDeviationState,
} from '../domain/geo';
import {
  eligibleDestinations,
  noResultSuggestions,
} from '../domain/rules';
import {
  activePet as getActivePet,
  beginItemRescue,
  cleanPet as applyCleaning,
  companionPet as applyCompanionship,
  completeRescueJourney,
  emptyPetCollection,
  renamePet as applyRename,
  settlePetCollection,
  sharedRescueRecords,
  switchActivePet as applyPetSwitch,
  undoActivePetSwitch as applyPetSwitchUndo,
  applyNormalJourneyReward, bindPetJourney, endPetJourney, reconcileTeamPetJourneys,
  revivePetFromSeasonalPromise,
} from '../domain/petRules';
import { abandonSeasonalPending, addSeasonalEntry, candidatesFromRecords, claimSeasonalReward, emptySeasonalPromise, markSeasonalVisitPending, revealSeasonalTarget, sealCandidates, seasonForDate, settleExpiredSeasonalPromise } from '../domain/seasonalPromise';
import {
  ActiveJourney,
  AppPhase,
  AppTab,
  Destination,
  ExplorationTheme,
  GeoPoint,
  HealthProfile,
  JourneyMicroTask,
  JourneyMood,
  JourneyRecord,
  LiveTrackingStatus,
  MotionStatus,
  MotionPermissionState,
  JourneyKind,
  PetCollectionState,
  PetProfile,
  ReviewDraft,
  RewardSummary,
  BackupPreview,
  SearchIssue,
  TimeSuggestion,
  TrackedLocation,
  TrackingMode,
  SeasonalCandidate,
  SeasonalEntryKind,
  SeasonalPromiseState,
} from '../domain/types';
import { createBackupPayload, ExplorePathBackupPayload } from '../domain/backupFormat';
import { healthMilestonesForJourney, journeyHealthMetrics, normalizeHealthProfile } from '../domain/health';
import { chooseValidFeaturedMemories, isActivityJourney, journeyOutcome, monthKey, normalizeMemoryRecords } from '../domain/memories';
import { createShowcaseSeed, ShowcaseScenario } from '../domain/showcase';
import { OverpassServiceError, searchNearbyDestinations } from '../services/overpass';
import {
  loadRealState,
  loadShowcaseState,
  resetStoredShowcaseState,
  saveRealState,
  saveShowcaseState,
  defaultMotionPermissionState,
} from '../services/storage';
import { chooseBackupFile, exportBackupFile } from '../services/backup';
import {
  captureMemoryPhoto as takeMemoryPhoto,
  deleteMemoryPhoto,
  pickMemoryPhoto,
} from '../services/memoryMedia';
import { cancelPetNotifications, requestPetNotificationPermission, syncPetNotifications } from '../services/petNotifications';
import { loadHealthProfile, saveHealthProfile } from '../services/healthStorage';
import { captureTaskPhoto, saveTaskPhotoToLibrary } from '../services/taskMedia';
import { loadSeasonalPromise, resetShowcaseSeasonalPromise, saveSeasonalPromise } from '../services/seasonalStorage';
import { requestSeasonalNotificationPermission, syncSeasonalNotifications } from '../services/seasonalNotifications';
import {
  getCurrentTrackedLocation,
  checkMotionAccess,
  requestForegroundLocationPermission,
  requestMotionAccess,
  stepsBetween,
  stepsSince,
  watchDeviceHeading,
  watchSteps,
  watchTrackedLocation,
} from '../services/tracking';

const emptyReview: ReviewDraft = { mood: null, effort: null, note: '', hasPhoto: false, photoUri: null };
const appVersion = '0.9.1';
const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

interface ExplorePathContextValue {
  hydrated: boolean;
  mode: TrackingMode;
  phase: AppPhase;
  tab: AppTab;
  durationMinutes: number;
  theme: ExplorationTheme;
  candidate: Destination | null;
  activeJourney: ActiveJourney | null;
  review: ReviewDraft;
  reward: RewardSummary | null;
  healthProfile: HealthProfile;
  petCollection: PetCollectionState;
  activePet: PetProfile | null;
  records: JourneyRecord[];
  featuredMemoryByMonth: Record<string, string>;
  backupPreview: BackupPreview | null;
  memoryMessage: string | null;
  suggestions: TimeSuggestion[];
  replacementMessage: string | null;
  searchIssue: SearchIssue | null;
  origin: GeoPoint | null;
  currentLocation: TrackedLocation | null;
  heading: number | null;
  motionStatus: MotionStatus;
  trackingStatus: LiveTrackingStatus;
  trackingMessage: string | null;
  revealed: boolean;
  arrivalRadius: number;
  journeyIntent: JourneyKind;
  rescueMessage: string | null;
  showcaseNow: number;
  seasonalPromise: SeasonalPromiseState;
  seasonalCandidates: SeasonalCandidate[];
  motionPermissionState: MotionPermissionState;
  motionExplanationVisible: boolean;
  motionSettingsReminderVisible: boolean;
  journeyEndMessage: string | null;
  setTab: (tab: AppTab) => void;
  saveTeamRecord: (record: JourneyRecord) => void;
  startTeamPetJourney: (id: string, startedAt: number) => void;
  reconcileTeamPetJourneys: (retainedId: string | null) => void;
  setMode: (mode: TrackingMode) => void;
  enterShowcaseMode: () => Promise<void>;
  exitShowcaseMode: () => Promise<void>;
  resetShowcaseData: () => Promise<void>;
  openShowcaseScenario: (scenario: ShowcaseScenario) => void;
  addShowcaseSteps: (steps: number) => void;
  setShowcaseDistance: (meters: number) => void;
  fastForwardShowcaseTime: (milliseconds: number) => void;
  chooseDuration: (minutes: number) => void;
  chooseTheme: (theme: ExplorationTheme) => void;
  search: () => Promise<void>;
  replaceCandidate: () => Promise<void>;
  addTimeAndSearch: (minutes: 10 | 20 | 30) => Promise<void>;
  resetPreparation: () => void;
  startJourney: () => Promise<void>;
  confirmMotionExplanation: () => Promise<void>;
  cancelMotionExplanation: () => void;
  dismissMotionSettingsReminder: () => void;
  dismissJourneyEndMessage: () => void;
  openMotionSettings: () => Promise<void>;
  resumeRecoveredJourney: () => Promise<void>;
  endRecoveredJourney: () => Promise<void>;
  simulateWalk: () => void;
  simulateArrival: () => void;
  replaceActiveDestination: () => Promise<void>;
  clearReplacementMessage: () => void;
  revealAndOpenMap: () => Promise<void>;
  saveIncompleteJourney: () => Promise<void>;
  returnToStart: () => Promise<void>;
  discardJourney: () => void;
  dismissDeviationSuggestion: () => void;
  beginMicroTask: () => void;
  replaceMicroTask: () => void;
  skipMicroTask: () => void;
  completeMicroTask: (response: string) => void;
  captureMicroTaskPhoto: () => Promise<void>;
  saveMicroTaskPhoto: () => Promise<void>;
  continueAfterArrival: () => void;
  setMood: (mood: JourneyMood) => void;
  setNote: (note: string) => void;
  setEffort: (effort: ReviewDraft['effort']) => void;
  updateHealthProfile: (patch: Partial<HealthProfile>) => void;
  captureReviewPhoto: () => Promise<void>;
  removeReviewPhoto: () => Promise<void>;
  submitReview: () => void;
  setFeaturedMemory: (month: string, recordId: string) => void;
  updateMemoryNote: (recordId: string, note: string) => void;
  addMemoryPhoto: (recordId: string, source: 'camera' | 'library') => Promise<void>;
  removeMemoryPhoto: (recordId: string) => Promise<void>;
  hideMemory: (recordId: string) => Promise<void>;
  markMemoryStepsInaccurate: (recordId: string) => void;
  exportBackup: () => Promise<void>;
  chooseBackup: () => Promise<void>;
  confirmBackupRestore: () => void;
  cancelBackupRestore: () => void;
  clearMemoryMessage: () => void;
  companionActivePet: () => void;
  cleanActivePet: () => void;
  switchActivePet: (petId: string) => void;
  undoPetSwitch: () => void;
  renamePet: (petId: string, nickname: string) => void;
  rescueWithCareItem: () => void;
  searchRescueMemory: (addedMinutes?: 0 | 10 | 20 | 30) => Promise<void>;
  searchNearbyRescue: () => Promise<void>;
  completeRescueArrival: () => void;
  togglePetNotifications: () => Promise<void>;
  beginSeasonalSelection: () => void;
  toggleSeasonalCandidate: (candidate: SeasonalCandidate) => void;
  sealSeasonalCandidates: () => void;
  revealSeasonalBox: (index: number) => void;
  startSeasonalJourney: () => Promise<void>;
  completeSeasonalVisit: (kind: SeasonalEntryKind, observation: string, photoUri?: string, useSafetyRadius?: boolean) => Promise<void>;
  abandonSeasonalVisit: () => void;
  claimSeasonalCompletion: () => void;
  reviveWithSeasonalToken: (petId: string) => void;
  finishReward: () => void;
}

const ExplorePathContext = createContext<ExplorePathContextValue | null>(null);

export function ExplorePathProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [mode, setModeState] = useState<TrackingMode>('real');
  const [phase, setPhase] = useState<AppPhase>('preparation');
  const [tab, setTab] = useState<AppTab>('explore');
  const [durationMinutes, setDurationMinutes] = useState(40);
  const [theme, setTheme] = useState<ExplorationTheme>('surprise');
  const [candidate, setCandidate] = useState<Destination | null>(null);
  const [candidatePool, setCandidatePool] = useState<Destination[]>(destinations);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<TimeSuggestion[]>([]);
  const [activeJourney, setActiveJourney] = useState<ActiveJourney | null>(null);
  const [review, setReview] = useState<ReviewDraft>(emptyReview);
  const [reward, setReward] = useState<RewardSummary | null>(null);
  const [realHealthProfile, setRealHealthProfile] = useState<HealthProfile>(() => normalizeHealthProfile());
  const [demoHealthProfile, setDemoHealthProfile] = useState<HealthProfile>(() => normalizeHealthProfile());
  const healthProfile = mode === 'real' ? realHealthProfile : demoHealthProfile;
  const setHealthProfile = mode === 'real' ? setRealHealthProfile : setDemoHealthProfile;
  const [realPetCollection, setRealPetCollection] = useState<PetCollectionState>(emptyPetCollection());
  const [realRecords, setRealRecords] = useState<JourneyRecord[]>([]);
  const [realUsedTaskIds, setRealUsedTaskIds] = useState<string[]>([]);
  const [demoPetCollection, setDemoPetCollection] = useState<PetCollectionState>(emptyPetCollection());
  const [demoRecords, setDemoRecords] = useState<JourneyRecord[]>([]);
  const [demoUsedTaskIds, setDemoUsedTaskIds] = useState<string[]>([]);
  const [realSeasonalPromise, setRealSeasonalPromise] = useState<SeasonalPromiseState>(emptySeasonalPromise());
  const [demoSeasonalPromise, setDemoSeasonalPromise] = useState<SeasonalPromiseState>(emptySeasonalPromise());
  const [realFeaturedMemoryByMonth, setRealFeaturedMemoryByMonth] = useState<Record<string, string>>({});
  const [demoFeaturedMemoryByMonth, setDemoFeaturedMemoryByMonth] = useState<Record<string, string>>({});
  const [showcaseClockOffsetMilliseconds, setShowcaseClockOffsetMilliseconds] = useState(0);
  const [pendingBackup, setPendingBackup] = useState<ExplorePathBackupPayload | null>(null);
  const [memoryMessage, setMemoryMessage] = useState<string | null>(null);
  const [replacementMessage, setReplacementMessage] = useState<string | null>(null);
  const [searchIssue, setSearchIssue] = useState<SearchIssue | null>(null);
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [currentLocation, setCurrentLocation] = useState<TrackedLocation | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [motionStatus, setMotionStatus] = useState<MotionStatus>('unknown');
  const [motionPermissionState, setMotionPermissionState] = useState<MotionPermissionState>(defaultMotionPermissionState());
  const [motionExplanationVisible, setMotionExplanationVisible] = useState(false);
  const [motionSettingsReminderVisible, setMotionSettingsReminderVisible] = useState(false);
  const [journeyEndMessage, setJourneyEndMessage] = useState<string | null>(null);
  const [pendingJourneyStart, setPendingJourneyStart] = useState<{
    destination: Destination;
    intent: JourneyKind;
    rescueId?: string;
    season?: ReturnType<typeof seasonForDate>;
  } | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<LiveTrackingStatus>('idle');
  const [trackingMessage, setTrackingMessage] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [journeyIntent, setJourneyIntent] = useState<JourneyKind>('normal');
  const [rescuePetId, setRescuePetId] = useState<string | null>(null);
  const [rescueMessage, setRescueMessage] = useState<string | null>(null);

  const candidateRef = useRef(candidate);
  const activeJourneyRef = useRef(activeJourney);
  const realUsedTaskIdsRef = useRef(realUsedTaskIds);
  const demoUsedTaskIdsRef = useRef(demoUsedTaskIds);
  const arrivalVibratedJourneyRef = useRef<string | null>(null);
  const arrivalEntryVibratedJourneyRef = useRef<string | null>(null);
  const arrivalFinalizingJourneyRef = useRef<string | null>(null);
  candidateRef.current = candidate;
  activeJourneyRef.current = activeJourney;
  realUsedTaskIdsRef.current = realUsedTaskIds;
  demoUsedTaskIdsRef.current = demoUsedTaskIds;

  const realPetsRef = useRef(realPetCollection);
  const demoPetsRef = useRef(demoPetCollection);
  realPetsRef.current = realPetCollection;
  demoPetsRef.current = demoPetCollection;
  const currentPets = () => mode === 'real' ? realPetsRef.current : demoPetsRef.current;
  const petCollection = mode === 'real' ? realPetCollection : demoPetCollection;
  const activePet = getActivePet(petCollection);
  const records = mode === 'real' ? realRecords : demoRecords;
  const seasonalPromise = mode === 'real' ? realSeasonalPromise : demoSeasonalPromise;
  const seasonalCandidates = candidatesFromRecords(records, mode === 'demo');
  const featuredMemoryByMonth = mode === 'real'
    ? realFeaturedMemoryByMonth
    : demoFeaturedMemoryByMonth;
  const showcaseNow = Date.now() + (mode === 'demo' ? showcaseClockOffsetMilliseconds : 0);
  const currentTimestamp = () => Date.now() + (mode === 'demo' ? showcaseClockOffsetMilliseconds : 0);
  const backupPreview: BackupPreview | null = pendingBackup ? {
    petCount: pendingBackup.data.petCollection.pets.length,
    archiveCount: pendingBackup.data.petCollection.legacyArchives.length,
    exportedAt: pendingBackup.exportedAt,
    recordCount: pendingBackup.data.records.length,
    completedCount: pendingBackup.data.records.filter((record) => record.completed).length,
    totalSteps: pendingBackup.data.records.reduce((sum, record) => sum + (['unavailable', 'excluded'].includes(record.stepStatus ?? 'complete') ? 0 : Math.max(0, record.steps)), 0),
    appVersion: pendingBackup.appVersion,
  } : null;
  const arrivalRadius = arrivalRadiusMeters(currentLocation?.accuracyMeters ?? null);

  const setCurrentPetCollection = (
    updater: (current: PetCollectionState) => PetCollectionState,
  ) => {
    const ref = mode === 'real' ? realPetsRef : demoPetsRef;
    const next = updater(ref.current);
    if (next === ref.current) return;
    ref.current = next;
    if (mode === 'real') setRealPetCollection(next);
    else setDemoPetCollection(next);
  };

  const setCurrentSeasonalPromise = (updater: (current: SeasonalPromiseState) => SeasonalPromiseState) => {
    if (mode === 'real') setRealSeasonalPromise(updater);
    else setDemoSeasonalPromise(updater);
  };

  const setCurrentRecords = (
    updater: (current: JourneyRecord[]) => JourneyRecord[],
  ) => {
    if (mode === 'real') setRealRecords(updater);
    else setDemoRecords(updater);
  };

  const setCurrentFeaturedMemories = (
    updater: (current: Record<string, string>) => Record<string, string>,
  ) => {
    if (mode === 'real') setRealFeaturedMemoryByMonth(updater);
    else setDemoFeaturedMemoryByMonth(updater);
  };

  useEffect(() => {
    let mounted = true;
    void Promise.all([loadRealState(), loadShowcaseState(), loadSeasonalPromise('real'), loadSeasonalPromise('demo'), loadHealthProfile()]).then(([stored, showcase, realSeasonal, demoSeasonal, storedHealthProfile]) => {
      if (!mounted) return;
      setRealHealthProfile(storedHealthProfile);
      setDemoPetCollection(showcase.petCollection);
      setDemoRecords(showcase.records);
      setDemoUsedTaskIds(showcase.usedMicroTaskIds);
      setDemoFeaturedMemoryByMonth(showcase.featuredMemoryByMonth);
      setShowcaseClockOffsetMilliseconds(showcase.clockOffsetMilliseconds);
      setRealSeasonalPromise(settleExpiredSeasonalPromise(realSeasonal, Date.now()));
      setDemoSeasonalPromise(settleExpiredSeasonalPromise(demoSeasonal, Date.now() + showcase.clockOffsetMilliseconds));
      if (stored) {
        setRealPetCollection(settlePetCollection(stored.petCollection, Date.now()));
        setRealRecords(stored.records);
        setRealUsedTaskIds(stored.usedMicroTaskIds);
        setRealFeaturedMemoryByMonth(stored.featuredMemoryByMonth);
        setDurationMinutes(stored.durationMinutes);
        setTheme(stored.theme);
        setCandidate(stored.candidate);
        setCandidatePool(stored.candidate ? [stored.candidate] : []);
        setActiveJourney(stored.activeJourney && stored.phase === 'active'
          ? { ...stored.activeJourney, recoveryPending: true }
          : stored.activeJourney);
        setReview(stored.review);
        setReward(stored.reward);
        setMotionPermissionState(stored.motionPermissionState);
        setMotionStatus(stored.motionPermissionState.lastStatus);
        setPhase(stored.phase);
        const storedIntent = stored.activeJourney?.kind ?? stored.journeyIntent ?? 'normal';
        setJourneyIntent(storedIntent);
        setRescuePetId(stored.activeJourney?.rescuePetId ?? stored.rescuePetId ?? null);
      }
      setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = setTimeout(() => { void saveHealthProfile(realHealthProfile); }, 180);
    return () => clearTimeout(timeout);
  }, [hydrated, realHealthProfile]);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = setTimeout(() => { void saveSeasonalPromise('real', realSeasonalPromise); }, 180);
    return () => clearTimeout(timeout);
  }, [hydrated, realSeasonalPromise]);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = setTimeout(() => { void saveSeasonalPromise('demo', demoSeasonalPromise); }, 180);
    return () => clearTimeout(timeout);
  }, [hydrated, demoSeasonalPromise]);

  const petNotificationQueue = useRef(Promise.resolve());
  const petNotificationSignature = JSON.stringify({ enabled: realPetCollection.notificationsEnabled, pet: getActivePet(realPetCollection) });
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      petNotificationQueue.current = petNotificationQueue.current.then(async () => {
        if (cancelled) return;
        const ids = await syncPetNotifications(realPetsRef.current, Date.now());
        if (cancelled) await cancelPetNotifications(ids);
        else setRealPetCollection((current) => ({ ...current, notificationIds: ids }));
      }).catch(() => undefined);
    }, 250);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [hydrated, petNotificationSignature]);

  const seasonalNotificationSignature = JSON.stringify({ enabled: realSeasonalPromise.notificationsEnabled, status: realSeasonalPromise.status, expiresAt: realSeasonalPromise.expiresAt, target: realSeasonalPromise.target?.id });
  useEffect(() => {
    if (!hydrated) return;
    const timeout = setTimeout(() => {
      void syncSeasonalNotifications(realSeasonalPromise, Date.now()).then((ids) => setRealSeasonalPromise((current) => current.notificationIds.join('|') === ids.join('|') ? current : { ...current, notificationIds: ids }));
    }, 250);
    return () => clearTimeout(timeout);
  }, [hydrated, seasonalNotificationSignature]);

  useEffect(() => {
    if (!hydrated) return;
    const settleNow = () => {
      const now = Date.now();
      setRealPetCollection((current) => settlePetCollection(current, now));
      setDemoPetCollection((current) => settlePetCollection(current, now + showcaseClockOffsetMilliseconds));
      setRealSeasonalPromise((current) => settleExpiredSeasonalPromise(current, now));
      setDemoSeasonalPromise((current) => settleExpiredSeasonalPromise(
        current,
        now + showcaseClockOffsetMilliseconds,
      ));
    };
    const interval = setInterval(settleNow, 60_000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') settleNow();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [hydrated, showcaseClockOffsetMilliseconds]);

  useEffect(() => {
    if (!hydrated || mode !== 'real') return;
    const persistablePhase = ['candidate', 'active', 'arrival', 'review', 'reward'].includes(phase)
      ? (phase as 'candidate' | 'active' | 'arrival' | 'review' | 'reward')
      : 'preparation';
    const timeout = setTimeout(() => {
      void saveRealState({
        version: 6,
        petCollection: realPetCollection,
        records: realRecords,
        phase: persistablePhase,
        durationMinutes,
        theme,
        candidate: persistablePhase === 'preparation' ? null : candidate,
        activeJourney,
        review,
        reward,
        usedMicroTaskIds: realUsedTaskIds,
        journeyIntent,
        rescuePetId,
        featuredMemoryByMonth: realFeaturedMemoryByMonth,
        motionPermissionState,
      }).catch(() => undefined);
    }, 180);
    return () => clearTimeout(timeout);
  }, [hydrated, mode, phase, realPetCollection, realRecords, realUsedTaskIds, realFeaturedMemoryByMonth, durationMinutes, theme, candidate, activeJourney, review, reward, journeyIntent, rescuePetId, motionPermissionState]);

  useEffect(() => {
    if (!hydrated || mode !== 'demo') return;
    const timeout = setTimeout(() => {
      void saveShowcaseState({
        version: 3,
        petCollection: demoPetCollection,
        records: demoRecords,
        usedMicroTaskIds: demoUsedTaskIds,
        featuredMemoryByMonth: demoFeaturedMemoryByMonth,
        clockOffsetMilliseconds: showcaseClockOffsetMilliseconds,
      }).catch(() => undefined);
    }, 180);
    return () => clearTimeout(timeout);
  }, [hydrated, mode, demoPetCollection, demoRecords, demoUsedTaskIds, demoFeaturedMemoryByMonth, showcaseClockOffsetMilliseconds]);

  const markTaskUsed = (id: string) => {
    if (mode === 'real') {
      setRealUsedTaskIds((current) => (current.includes(id) ? current : [...current, id]));
    } else {
      setDemoUsedTaskIds((current) => (current.includes(id) ? current : [...current, id]));
    }
  };

  const createJourneyTask = (
    journeyId: string,
    distance: number,
    excludedTaskIds: string[] = [],
    replacementUsed = false,
  ): JourneyMicroTask => {
    const currentUsedIds = mode === 'real' ? realUsedTaskIdsRef.current : demoUsedTaskIdsRef.current;
    const definition = selectMicroTask(theme, currentUsedIds, `${journeyId}-${currentTimestamp()}`, excludedTaskIds);
    markTaskUsed(definition.id);
    return {
      ...definition,
      status: distance <= 300 ? 'available' : 'pending',
      replacementUsed,
      hintUnlocked: false,
    };
  };

  const updateFromLocation = (location: TrackedLocation) => {
    setCurrentLocation(location);
    const destination = candidateRef.current;
    if (!destination) return;
    const remainingDistance = Math.round(distanceMeters(location, destinationTarget(destination)));
    const now = Date.now();
    const accurate = location.accuracyMeters === null || location.accuracyMeters <= 100;
    if (!accurate) {
      setTrackingStatus('waitingForAccuracy');
      setTrackingMessage(`目前定位誤差約 ${Math.round(location.accuracyMeters ?? 0)} 公尺，等精準到 100 公尺內再繼續停留判定。`);
    } else {
      setTrackingStatus('live');
      setTrackingMessage(null);
    }
    if (remainingDistance <= 50 && (location.accuracyMeters === null || location.accuracyMeters <= 60)) setRevealed(true);

    setActiveJourney((current) => {
      if (!current) return current;
      const task = current.microTask?.status === 'pending' && remainingDistance <= 300
        ? { ...current.microTask, status: 'available' as const }
        : current.microTask;
      const deviation = updateDeviationState(
        {
          windowStartedAt: current.deviationWindowStartedAt ?? null,
          startDistanceMeters: current.deviationStartDistanceMeters ?? null,
          suggested: current.deviationSuggested ?? false,
        },
        remainingDistance,
        location.accuracyMeters,
        now,
      );
      const targetSeconds = dwellTargetSeconds(location.accuracyMeters);
      if (!accurate) {
        return {
          ...current,
          distanceMeters: remainingDistance,
          dwellTargetSeconds: targetSeconds,
          lastDwellSampleAt: null,
          microTask: task,
          deviationWindowStartedAt: deviation.windowStartedAt,
          deviationStartDistanceMeters: deviation.startDistanceMeters,
          deviationSuggested: deviation.suggested,
        };
      }
      const nextDwell = advanceDwellState(
        {
          dwellMilliseconds: current.dwellMilliseconds ?? current.dwellSeconds * 1000,
          outsideSince: current.outsideSince ?? null,
          lastDwellSampleAt: current.lastDwellSampleAt ?? null,
        },
        remainingDistance <= arrivalRadiusMeters(location.accuracyMeters),
        now,
      );
      return {
        ...current,
        distanceMeters: remainingDistance,
        dwellTargetSeconds: targetSeconds,
        dwellMilliseconds: nextDwell.dwellMilliseconds,
        dwellSeconds: Math.min(targetSeconds, Math.floor(nextDwell.dwellMilliseconds / 1000)),
        outsideSince: nextDwell.outsideSince,
        lastDwellSampleAt: nextDwell.lastDwellSampleAt,
        microTask: task,
        deviationWindowStartedAt: deviation.windowStartedAt,
        deviationStartDistanceMeters: deviation.startDistanceMeters,
        deviationSuggested: deviation.suggested,
      };
    });
  };

  useEffect(() => {
    if (mode !== 'real' || phase !== 'active' || !candidate || activeJourney?.recoveryPending) return;
    let cancelled = false;
    let locationSubscription: { remove: () => void } | null = null;
    let headingSubscription: { remove: () => void } | null = null;
    let stepSubscription: { remove: () => void } | null = null;
    let starting = false;

    const stop = () => {
      locationSubscription?.remove();
      headingSubscription?.remove();
      stepSubscription?.remove();
      locationSubscription = null;
      headingSubscription = null;
      stepSubscription = null;
    };

    const start = async () => {
      if (starting || cancelled || locationSubscription) return;
      starting = true;
      setTrackingStatus('starting');
      setTrackingMessage('正在連接 iPhone 定位與感測器⋯');
      try {
        const journey = activeJourneyRef.current;
        if (journey?.stepBonusAvailable && journey.stepCaptureStartedAt) {
          const historical = await stepsSince(journey.stepCaptureStartedAt);
          const baseSteps = historical ?? journey.steps;
          if (historical !== null) {
            setActiveJourney((current) => current ? {
              ...current,
              steps: Math.max(current.steps, historical),
              stepStatus: 'complete',
              lastConfirmedStepsAt: Date.now(),
            } : current);
          }
          if (!cancelled) {
            stepSubscription = watchSteps((liveSteps) => {
              setActiveJourney((current) => current ? {
                ...current,
                steps: Math.max(current.steps, baseSteps + liveSteps),
                lastConfirmedStepsAt: Date.now(),
              } : current);
            });
          }
        }
        if (cancelled) return;
        const nextLocationSubscription = await watchTrackedLocation(updateFromLocation);
        if (cancelled || AppState.currentState !== 'active') {
          nextLocationSubscription.remove();
          return;
        }
        locationSubscription = nextLocationSubscription;
        const nextHeadingSubscription = await watchDeviceHeading(setHeading);
        if (cancelled || AppState.currentState !== 'active') {
          nextHeadingSubscription.remove();
          return;
        }
        headingSubscription = nextHeadingSubscription;
        if (!cancelled) {
          setTrackingStatus('live');
          setTrackingMessage(null);
        }
      } catch {
        if (!cancelled) {
          setTrackingStatus('error');
          setTrackingMessage('感測器暫時無法更新。請確認定位已開啟，並保持 App 在前景。');
        }
      } finally {
        starting = false;
      }
    };

    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') void start();
      else {
        stop();
        setTrackingStatus('paused');
        setTrackingMessage('App 在背景時會暫停 GPS 與停留進度；回到前景後會自動恢復，並嘗試補回 iPhone 步數。');
      }
    };

    const appStateSubscription = AppState.addEventListener('change', onAppStateChange);
    if (AppState.currentState === 'active') void start();
    return () => {
      cancelled = true;
      stop();
      appStateSubscription.remove();
    };
  }, [mode, phase, candidate?.id, activeJourney?.recoveryPending]);

  useEffect(() => {
    if (phase !== 'active' || !activeJourney) return;
    if (
      activeJourney.distanceMeters <= arrivalRadius &&
      arrivalEntryVibratedJourneyRef.current !== activeJourney.id
    ) {
      arrivalEntryVibratedJourneyRef.current = activeJourney.id;
      Vibration.vibrate(120);
    }
  }, [phase, activeJourney?.id, activeJourney?.distanceMeters, arrivalRadius]);

  useEffect(() => {
    if (phase !== 'active' || !activeJourney) return;
    const target = activeJourney.dwellTargetSeconds ?? 45;
    if (activeJourney.dwellSeconds < target || activeJourney.recoveryPending) return;
    if (arrivalFinalizingJourneyRef.current === activeJourney.id) return;
    arrivalFinalizingJourneyRef.current = activeJourney.id;
    if (arrivalVibratedJourneyRef.current !== activeJourney.id) {
      arrivalVibratedJourneyRef.current = activeJourney.id;
      Vibration.vibrate([0, 120, 90, 180]);
    }
    const finishArrival = async () => {
      const endedAt = currentTimestamp();
      let finalSteps = activeJourney.steps;
      let stepStatus = activeJourney.stepStatus
        ?? (activeJourney.stepBonusAvailable === false ? 'unavailable' : 'complete');
      if (mode === 'real' && activeJourney.stepBonusAvailable && activeJourney.stepCaptureStartedAt) {
        const historical = await stepsBetween(activeJourney.stepCaptureStartedAt, endedAt);
        if (historical === null) stepStatus = finalSteps > 0 ? 'partial' : 'unavailable';
        else {
          finalSteps = Math.max(finalSteps, historical);
          stepStatus = 'complete';
        }
      }
      setActiveJourney((current) => current?.id === activeJourney.id
        ? { ...current, steps: finalSteps, stepStatus, endedAt, recoveryPending: false }
        : current);
      setRevealed(true);
      setPhase('arrival');
      setTrackingStatus('idle');
      setTrackingMessage(null);
    };
    void finishArrival();
  }, [phase, activeJourney]);

  const performSearch = async (
    nextDuration: number,
    nextTheme: ExplorationTheme,
    nextExcludedIds: string[],
    poolOverride?: Destination[],
  ) => {
    setPhase('searching');
    setSuggestions([]);
    setSearchIssue(null);
    setTrackingMessage(null);
    let pool = poolOverride;
    if (mode === 'demo') {
      await wait(450);
      pool = destinations;
      setOrigin({ latitude: 25.033, longitude: 121.5654 });
    } else if (!pool) {
      try {
        const granted = await requestForegroundLocationPermission();
        if (!granted) {
          setSearchIssue({ title: '需要「使用 App 期間」的位置權限', detail: '真實探索必須從你目前的 GPS 位置開始。拒絕後不會偷偷改用假位置。' });
          setPhase('permissionRequired');
          return;
        }
        const location = await getCurrentTrackedLocation();
        const nextOrigin = { latitude: location.latitude, longitude: location.longitude };
        setOrigin(nextOrigin);
        setCurrentLocation(location);
        pool = await searchNearbyDestinations(nextOrigin, nextDuration + 30);
      } catch (error) {
        const detail = error instanceof OverpassServiceError ? error.message : '無法取得目前位置。請確認 iPhone 定位與網路後再試一次。';
        setSearchIssue({ title: '目前無法搜尋真實地點', detail: `${detail} 我們沒有改動你的時間、主題，也沒有切換成付費服務。` });
        setPhase('serviceError');
        return;
      }
    }
    const resolvedPool = pool ?? [];
    setCandidatePool(resolvedPool);
    const results = eligibleDestinations(resolvedPool, nextDuration, nextTheme, nextExcludedIds);
    if (results.length === 0) {
      setCandidate(null);
      setSuggestions(noResultSuggestions(resolvedPool, nextDuration, nextTheme, nextExcludedIds));
      setPhase('noResults');
      return;
    }
    setCandidate(results[0] ?? null);
    setPhase('candidate');
  };

  const chooseDuration = (minutes: number) => {
    setDurationMinutes(minutes);
    setCandidate(null);
    setExcludedIds([]);
    setPhase('preparation');
  };

  const chooseTheme = (nextTheme: ExplorationTheme) => {
    setTheme(nextTheme);
    setCandidate(null);
    setExcludedIds([]);
    setPhase('preparation');
  };

  const search = async () => {
    setExcludedIds([]);
    await performSearch(durationMinutes, theme, []);
  };

  const nextCandidateFromPool = (current: Destination, active = false) => {
    let nextExcludedIds = [...excludedIds, current.id];
    const filterTheme = journeyIntent === 'rescue' ? 'surprise' : theme;
    let results = eligibleDestinations(candidatePool, durationMinutes, filterTheme, nextExcludedIds);
    if (results.length === 0) {
      nextExcludedIds = [current.id];
      results = eligibleDestinations(candidatePool, durationMinutes, filterTheme, nextExcludedIds);
    }
    const next = results[0] ?? null;
    if (!next && active) setReplacementMessage('這組條件目前只有這一個可用地點。原任務、時間與步數都已保留。');
    if (next) setExcludedIds(nextExcludedIds);
    return next;
  };

  const replaceCandidate = async () => {
    if (!candidate) return;
    const next = nextCandidateFromPool(candidate);
    if (next) setCandidate(next);
    else if (journeyIntent === 'rescue') setReplacementMessage('目前這次尋回搜尋只有一個可用地點；沒有自動改成其他條件。');
    else await performSearch(durationMinutes, theme, [], mode === 'demo' ? destinations : undefined);
  };

  const addTimeAndSearch = async (minutes: 10 | 20 | 30) => {
    const nextDuration = durationMinutes + minutes;
    setDurationMinutes(nextDuration);
    await performSearch(nextDuration, theme, excludedIds, candidatePool);
  };

  const resetPreparation = () => {
    const journey = activeJourneyRef.current;
    if (journey) setCurrentPetCollection((current) => endPetJourney(current, journey.id));
    setCandidate(null);
    setExcludedIds([]);
    setSuggestions([]);
    setActiveJourney(null);
    setReview(emptyReview);
    setReward(null);
    setReplacementMessage(null);
    setSearchIssue(null);
    setCurrentLocation(null);
    setHeading(null);
    setMotionStatus('unknown');
    setTrackingStatus('idle');
    setTrackingMessage(null);
    setRevealed(false);
    setJourneyIntent('normal');
    setRescuePetId(null);
    setRescueMessage(null);
    setPhase('preparation');
    setTab('explore');
  };

  const setMode = (nextMode: TrackingMode) => {
    if (['candidate', 'active', 'arrival', 'review', 'reward', 'searching'].includes(phase) || nextMode === mode) return;
    setModeState(nextMode);
    setCandidatePool(nextMode === 'demo' ? destinations : []);
    setOrigin(nextMode === 'demo' ? { latitude: 25.033, longitude: 121.5654 } : null);
    setCurrentLocation(null);
    setSearchIssue(null);
    setSuggestions([]);
    setExcludedIds([]);
  };

  const enterShowcaseMode = async () => {
    if (Object.values(realPetsRef.current.journeyBindings).some((b) => !b.ended) || ['candidate', 'active', 'arrival', 'review', 'reward'].includes(phase)) return;
    if (mode === 'demo') {
      setTab('pets');
      return;
    }
    const persistablePhase = ['candidate', 'active', 'arrival', 'review', 'reward'].includes(phase)
      ? (phase as 'candidate' | 'active' | 'arrival' | 'review' | 'reward')
      : 'preparation';
    await saveRealState({
      version: 6,
      petCollection: realPetCollection,
      records: realRecords,
      phase: persistablePhase,
      durationMinutes,
      theme,
      candidate: persistablePhase === 'preparation' ? null : candidate,
      activeJourney,
      review,
      reward,
      usedMicroTaskIds: realUsedTaskIds,
      journeyIntent,
      rescuePetId,
      featuredMemoryByMonth: realFeaturedMemoryByMonth,
      motionPermissionState,
    });
    resetPreparation();
    setModeState('demo');
    setCandidatePool(destinations);
    setOrigin({ latitude: 25.033, longitude: 121.5654 });
    setTab('pets');
    setMemoryMessage('已進入完整展示模式；所有操作只會改動展示資料。');
  };

  const exitShowcaseMode = async () => {
    if (mode !== 'demo') return;
    await saveShowcaseState({
      version: 3,
      petCollection: demoPetCollection,
      records: demoRecords,
      usedMicroTaskIds: demoUsedTaskIds,
      featuredMemoryByMonth: demoFeaturedMemoryByMonth,
      clockOffsetMilliseconds: showcaseClockOffsetMilliseconds,
    });
    const stored = await loadRealState();
    resetPreparation();
    setModeState('real');
    setCandidatePool(stored?.candidate ? [stored.candidate] : []);
    setOrigin(null);
    if (stored) {
      setRealPetCollection(settlePetCollection(stored.petCollection, Date.now()));
      setRealRecords(stored.records);
      setRealUsedTaskIds(stored.usedMicroTaskIds);
      setRealFeaturedMemoryByMonth(stored.featuredMemoryByMonth);
      setDurationMinutes(stored.durationMinutes);
      setTheme(stored.theme);
      setCandidate(stored.candidate);
      setActiveJourney(stored.activeJourney && stored.phase === 'active'
        ? { ...stored.activeJourney, recoveryPending: true }
        : stored.activeJourney);
      setReview(stored.review);
      setReward(stored.reward);
      setPhase(stored.phase);
      setJourneyIntent(stored.activeJourney?.kind ?? stored.journeyIntent ?? 'normal');
      setRescuePetId(stored.activeJourney?.rescuePetId ?? stored.rescuePetId ?? null);
      setMotionPermissionState(stored.motionPermissionState);
      setMotionStatus(stored.motionPermissionState.lastStatus);
    }
    setTab('health');
    setMemoryMessage(null);
    setRescueMessage('已返回真實模式；展示資料沒有改動你的真實進度。');
  };

  const resetShowcaseData = async () => {
    if (mode !== 'demo') return;
    const photoUris = new Set(
      [
        ...demoRecords.flatMap((record) => [record.memoryPhotoUri, record.microTaskPhotoUri]),
        review.photoUri,
        activeJourney?.microTask?.photoUri,
      ]
        .filter((uri): uri is string => Boolean(uri)),
    );
    await Promise.all([...photoUris].map((uri) => deleteMemoryPhoto(uri)));
    await resetStoredShowcaseState();
    await resetShowcaseSeasonalPromise();
    const seed = createShowcaseSeed(Date.now());
    setDemoPetCollection(seed.petCollection);
    setDemoRecords(seed.records);
    setDemoUsedTaskIds(seed.usedMicroTaskIds);
    setDemoFeaturedMemoryByMonth(seed.featuredMemoryByMonth);
    setShowcaseClockOffsetMilliseconds(0);
    setDemoSeasonalPromise(emptySeasonalPromise());
    resetPreparation();
    setModeState('demo');
    setCandidatePool(destinations);
    setOrigin({ latitude: 25.033, longitude: 121.5654 });
    setTab('pets');
    setMemoryMessage('展示資料已重設為完整預設狀態。');
  };

  const startJourneyNow = async (
    nextCandidate: Destination,
    nextIntent: JourneyKind,
    nextRescuePetId?: string,
    seasonalSeason?: ReturnType<typeof seasonForDate>,
  ) => {
    let nextMotionStatus: MotionStatus = 'available';
    if (mode === 'real') {
      nextMotionStatus = ['denied', 'unavailable'].includes(motionPermissionState.lastStatus)
        ? await checkMotionAccess()
        : await requestMotionAccess();
      setMotionStatus(nextMotionStatus);
      setMotionPermissionState((current) => ({ ...current, lastStatus: nextMotionStatus }));
    }
    const now = currentTimestamp();
    const journeyId = `journey-${now}`;
    setCurrentPetCollection((current) => bindPetJourney(current, journeyId, now));
    const task = nextIntent !== 'rescue'
      ? createJourneyTask(journeyId, nextCandidate.distanceMeters)
      : undefined;
    setCandidate(nextCandidate);
    setJourneyIntent(nextIntent);
    setActiveJourney({
      id: journeyId,
      startedAt: now,
      destinationId: nextCandidate.id,
      steps: 0,
      distanceMeters: nextCandidate.distanceMeters,
      dwellSeconds: 0,
      dwellMilliseconds: 0,
      dwellTargetSeconds: 45,
      lastDwellSampleAt: null,
      outsideSince: null,
      walkStage: 0,
      origin: currentLocation ?? origin ?? undefined,
      microTask: task,
      deviationWindowStartedAt: null,
      deviationStartDistanceMeters: null,
      deviationSuggested: false,
      stepCaptureStartedAt: now,
      stepBonusAvailable: mode === 'demo' || nextMotionStatus === 'available',
      stepStatus: mode === 'demo' || nextMotionStatus === 'available' ? 'complete' : 'unavailable',
      kind: nextIntent,
      rescuePetId: nextIntent === 'rescue' ? nextRescuePetId : undefined,
      seasonalSeason,
    });
    setReview(emptyReview);
    setReplacementMessage(mode === 'real' && nextMotionStatus !== 'available' ? '步數權限未開啟或感測器不可用；GPS 探索仍可完成，但這趟不會產生步數、距離與活動強度統計。' : null);
    setRevealed(false);
    setPhase('active');
  };

  const requestJourneyStart = async (
    nextCandidate: Destination,
    nextIntent: JourneyKind,
    nextRescuePetId?: string,
    seasonalSeason?: ReturnType<typeof seasonForDate>,
  ) => {
    if (mode === 'real' && !motionPermissionState.explanationShown) {
      setPendingJourneyStart({ destination: nextCandidate, intent: nextIntent, rescueId: nextRescuePetId, season: seasonalSeason });
      setMotionExplanationVisible(true);
      return;
    }
    await startJourneyNow(nextCandidate, nextIntent, nextRescuePetId, seasonalSeason);
  };

  const startJourney = async () => {
    if (!candidate) return;
    await requestJourneyStart(candidate, journeyIntent, rescuePetId ?? undefined);
  };

  const confirmMotionExplanation = async () => {
    const pending = pendingJourneyStart;
    setMotionPermissionState((current) => ({ ...current, explanationShown: true }));
    setMotionExplanationVisible(false);
    setPendingJourneyStart(null);
    if (pending) await startJourneyNow(pending.destination, pending.intent, pending.rescueId, pending.season);
  };

  const cancelMotionExplanation = () => {
    setMotionExplanationVisible(false);
    setPendingJourneyStart(null);
  };

  const dismissMotionSettingsReminder = () => setMotionSettingsReminderVisible(false);
  const dismissJourneyEndMessage = () => setJourneyEndMessage(null);
  const openMotionSettings = async () => {
    setMotionSettingsReminderVisible(false);
    try { await Linking.openSettings(); } catch { setReplacementMessage('目前無法開啟系統設定。'); }
  };

  const simulateWalk = () => {
    if (!candidate || mode !== 'demo') return;
    setActiveJourney((current) => {
      if (!current) return current;
      const nextStage = Math.min(current.walkStage + 1, 3);
      const distanceFactors = [1, 0.62, 0.28, 0.04];
      const nextDistance = Math.max(45, Math.round(candidate.distanceMeters * (distanceFactors[nextStage] ?? 0.04)));
      const task = current.microTask?.status === 'pending' && nextDistance <= 300 ? { ...current.microTask, status: 'available' as const } : current.microTask;
      if (nextDistance <= 50) setRevealed(true);
      return { ...current, walkStage: nextStage, steps: current.steps + 720, distanceMeters: nextDistance, microTask: task };
    });
  };

  const simulateArrival = () => {
    if (mode !== 'demo') return;
    setActiveJourney((current) => current ? {
      ...current,
      steps: Math.max(current.steps, 2450),
      distanceMeters: 38,
      dwellSeconds: current.dwellTargetSeconds ?? 45,
      dwellMilliseconds: (current.dwellTargetSeconds ?? 45) * 1000,
    } : current);
    setRevealed(true);
  };

  const addShowcaseSteps = (steps: number) => {
    if (mode !== 'demo') return;
    setActiveJourney((current) => current ? {
      ...current,
      steps: Math.max(0, current.steps + Math.round(steps)),
    } : current);
    setReplacementMessage(`已在展示模式增加 ${Math.round(steps).toLocaleString()} 步。`);
  };

  const setShowcaseDistance = (meters: number) => {
    if (mode !== 'demo') return;
    const nextDistance = Math.max(0, Math.round(meters));
    setActiveJourney((current) => {
      if (!current) return current;
      const nextTask = current.microTask?.status === 'pending' && nextDistance <= 300
        ? { ...current.microTask, status: 'available' as const }
        : current.microTask;
      return {
        ...current,
        distanceMeters: nextDistance,
        walkStage: nextDistance <= 50 ? 3 : current.walkStage,
        microTask: nextTask,
      };
    });
    setRevealed(nextDistance <= 50);
    setReplacementMessage(`已把展示距離調整為 ${nextDistance} 公尺。`);
  };

  const fastForwardShowcaseTime = (milliseconds: number) => {
    if (mode !== 'demo') return;
    const safeMilliseconds = Math.max(0, Math.round(milliseconds));
    const nextOffset = showcaseClockOffsetMilliseconds + safeMilliseconds;
    const nextNow = Date.now() + nextOffset;
    setShowcaseClockOffsetMilliseconds(nextOffset);
    setDemoPetCollection((current) => settlePetCollection(current, nextNow));
    setDemoSeasonalPromise((current) => settleExpiredSeasonalPromise(current, nextNow));
    const hours = Math.round(safeMilliseconds / (60 * 60 * 1000));
    setRescueMessage(`展示時間已快轉 ${hours >= 48 ? `${Math.round(hours / 24)} 天` : `${hours} 小時`}。`);
  };

  const openShowcaseScenario = (scenario: ShowcaseScenario) => {
    if (mode !== 'demo') return;
    const now = currentTimestamp();
    const destination = destinations[0];
    if (!destination) return;
    const taskDefinition = selectMicroTask('nature', [], `showcase-scenario-${now}`);
    const journey: ActiveJourney = {
      id: `showcase-journey-${now}`,
      startedAt: now - 12 * 60 * 1000,
      destinationId: destination.id,
      steps: 1380,
      distanceMeters: 260,
      dwellSeconds: 0,
      dwellMilliseconds: 0,
      dwellTargetSeconds: 45,
      lastDwellSampleAt: null,
      outsideSince: null,
      walkStage: 2,
      origin: { latitude: 25.033, longitude: 121.5654 },
      microTask: {
        ...taskDefinition,
        status: 'available',
        replacementUsed: false,
        hintUnlocked: false,
      },
      deviationWindowStartedAt: null,
      deviationStartDistanceMeters: null,
      deviationSuggested: false,
      stepCaptureStartedAt: now - 12 * 60 * 1000,
      stepBonusAvailable: true,
      kind: 'normal',
    };

    const openJourneyPhase = (
      nextPhase: Extract<AppPhase, 'candidate' | 'active' | 'arrival' | 'review' | 'reward'>,
    ) => {
      resetPreparation();
      setCandidate(destination);
      setCandidatePool(destinations);
      setOrigin({ latitude: 25.033, longitude: 121.5654 });
      setTheme('nature');
      setDurationMinutes(40);
      setActiveJourney(nextPhase === 'candidate' ? null : journey);
      setPhase(nextPhase);
      setTab('explore');
    };

    const openPet = (
      petId: string,
      message: string,
      switchLock: PetCollectionState['switchLock'] = null,
    ) => {
      const seed = createShowcaseSeed(now);
      const template = seed.petCollection.pets.find((item) => item.id === petId);
      if (!template) return;
      resetPreparation();
      setDemoPetCollection((current) => ({
        ...current,
        activePetId: petId,
        switchLock,
        pets: current.pets.some((item) => item.id === petId)
          ? current.pets.map((item) => item.id === petId ? template : item)
          : [...current.pets, template],
      }));
      setTab('pets');
      setRescueMessage(message);
    };

    if (scenario === 'preparation') {
      resetPreparation();
      return;
    }
    if (scenario === 'candidate') {
      openJourneyPhase('candidate');
      return;
    }
    if (scenario === 'active') {
      openJourneyPhase('active');
      return;
    }
    if (scenario === 'arrival') {
      openJourneyPhase('arrival');
      setActiveJourney({
        ...journey,
        steps: 2680,
        distanceMeters: 32,
        dwellSeconds: 45,
        dwellMilliseconds: 45_000,
        walkStage: 3,
      });
      setRevealed(true);
      return;
    }
    if (scenario === 'stepsPartial' || scenario === 'stepsUnavailable') {
      openJourneyPhase('arrival');
      setActiveJourney({
        ...journey,
        steps: scenario === 'stepsPartial' ? 1680 : 0,
        stepStatus: scenario === 'stepsPartial' ? 'partial' : 'unavailable',
        stepBonusAvailable: scenario === 'stepsPartial',
        distanceMeters: 32,
        dwellSeconds: 45,
        dwellMilliseconds: 45_000,
        walkStage: 3,
        endedAt: now,
      });
      setRevealed(true);
      return;
    }
    if (scenario === 'journeyRecovery') {
      openJourneyPhase('active');
      setActiveJourney({ ...journey, recoveryPending: true, stepStatus: 'partial' });
      return;
    }
    if (scenario === 'review') {
      openJourneyPhase('review');
      setReview({ mood: null, effort: null, note: '', hasPhoto: false, photoUri: null });
      setRevealed(true);
      return;
    }
    if (scenario === 'reward') {
      openJourneyPhase('reward');
      setReview({ mood: 'happy', effort: 'steady', note: '這是一筆展示模式回顧。', hasPhoto: false, photoUri: null });
      setReward({
        journeyId: journey.id,
        xp: { arrivalXP: 100, stepBonusXP: 26, totalXP: 126 },
        appliedPetXP: 126,
        petEvent: 'progressed',
        previousStage: 'mature',
        nextStage: 'mature',
        petId: 'showcase-mature',
      });
      return;
    }

    const petScenarios: Partial<Record<ShowcaseScenario, [string, string]>> = {
      petEgg: ['showcase-egg', '蛋階段：完成探索後會累積孵化進度。'],
      petJuvenile: ['showcase-juvenile', '幼年階段：持續探索即可成長。'],
      petGrowing: ['showcase-growing', '經驗已達成長門檻；缺少成長素材，所以仍保留幼年外觀。'],
      petMature: ['showcase-mature', '經驗已達3,000，可累積新蛋進度；仍等待後續形態素材。'],
      petCountdown: ['showcase-countdown', '心情歸零，已進入 72 小時離開倒數。'],
      petDeparted: ['showcase-departed', '夥伴已暫時離開，可測試共同回憶地尋回。'],
      petRescuing: ['showcase-rescuing', '已使用照顧道具，快轉一天可測試自動回來。'],
      petMemory: ['showcase-memory', '尋回期限已結束，目前是永久回憶狀態。'],
      petCollection: ['showcase-mature', '點「查看收藏」可測試圖鑑、篩選、個性外觀與詳細資料。'],
      petSwitchReady: ['showcase-mature', '目前沒有切換限制；可從收藏詳細頁選擇其他夥伴。'],
      petSwitchLocked: ['showcase-juvenile', '已完成切換但尚未一起探索，因此其他夥伴暫時無法切換。'],
      petSwitchUndo: ['showcase-juvenile', '切換後尚未探索，目前可以使用唯一一次的復原機會。'],
      rescueExpired: ['showcase-memory', '已模擬超過七天的尋回期限。'],
    };
    const petScenario = petScenarios[scenario];
    if (petScenario) {
      const switchLock = scenario === 'petSwitchLocked' || scenario === 'petSwitchUndo'
        ? {
          activePetId: 'showcase-juvenile',
          previousPetId: scenario === 'petSwitchUndo' ? 'showcase-mature' : null,
          switchedAt: now - 5 * 60 * 1000,
          undoAvailable: scenario === 'petSwitchUndo',
        }
        : null;
      openPet(...petScenario, switchLock);
      return;
    }

    resetPreparation();
    if (scenario === 'seasonalPending') {
      setDemoSeasonalPromise({
        ...emptySeasonalPromise(),
        status: 'active',
        target: {
          id: 'seasonal-showcase-pending', recordId: 'showcase-record-01', destinationId: destination.id,
          destinationName: destination.internalName, latitude: destination.latitude, longitude: destination.longitude,
          cityLabel: '台北市', isShowcase: true,
        },
        startedAt: now - 30 * 24 * 60 * 60 * 1000,
        expiresAt: now + 14 * 30 * 24 * 60 * 60 * 1000,
        pendingVisit: { journeyId: 'showcase-record-partial', season: seasonForDate(now), arrivedAt: now - 10 * 60 * 1000 },
        isShowcase: true,
        lastRewardMessage: '已抵達並保存旅程；本季紀錄待完成。',
      });
      setTab('records');
      return;
    }
    if (scenario === 'memories' || scenario === 'backup' || scenario === 'invalidBackup' || scenario === 'noPhotoShare' || scenario === 'journeyUnreached' || scenario === 'stepsExcluded') {
      setTab('records');
      if (scenario === 'backup') setMemoryMessage('展示備份會真的開啟 iOS 分享與檔案選擇，但只取代展示資料。');
      if (scenario === 'invalidBackup') setMemoryMessage('無效備份示範：這不是 ExplorePath v0.7.1 支援的備份檔，資料沒有被改動。');
      if (scenario === 'noPhotoShare') setMemoryMessage('請開啟沒有代表照片的足跡；內容仍會保留旅程健康數據。');
      if (scenario === 'journeyUnreached') setMemoryMessage('展示時間軸已包含一趟有 920 步的未抵達旅程。');
      if (scenario === 'stepsExcluded') setMemoryMessage('展示時間軸已包含一筆保留原始數字、但排除統計的紀錄。');
      return;
    }
    if (scenario === 'permissionDenied') {
      setSearchIssue({
        title: '需要「使用 App 期間」的位置權限',
        detail: '展示情境：使用者拒絕定位後，不會偷偷改用假位置或放寬條件。',
      });
      setPhase('permissionRequired');
      setTab('explore');
      return;
    }
    if (scenario === 'noResults') {
      setSuggestions([
        { addedMinutes: 10, resultCount: 2 },
        { addedMinutes: 20, resultCount: 5 },
        { addedMinutes: 30, resultCount: 8 },
      ]);
      setCandidatePool(destinations);
      setPhase('noResults');
      setTab('explore');
      return;
    }
    if (scenario === 'serviceError') {
      setSearchIssue({
        title: '目前無法搜尋真實地點',
        detail: '展示情境：OpenStreetMap 公開服務暫時失敗。時間與主題保持不變，也不會切換付費服務。',
      });
      setPhase('serviceError');
      setTab('explore');
    }
  };

  const replaceActiveDestination = async () => {
    if (!candidate || !activeJourney) return;
    let nextCandidate = nextCandidateFromPool(candidate, false);
    if (!nextCandidate && mode === 'real') {
      try {
        setReplacementMessage('正在用目前 GPS 位置尋找另一個地點⋯');
        const granted = await requestForegroundLocationPermission();
        if (!granted) throw new Error('location denied');
        const location = await getCurrentTrackedLocation();
        const nextPool = await searchNearbyDestinations(location, durationMinutes + 30);
        setCurrentLocation(location);
        setCandidatePool(nextPool);
        const results = eligibleDestinations(nextPool, durationMinutes, theme, [candidate.id]);
        nextCandidate = results[0] ?? null;
        setExcludedIds([candidate.id]);
      } catch {
        setReplacementMessage('目前無法重新取得附近地點。原任務、開始時間與步數都已保留，請稍後再試。');
        return;
      }
    }
    if (!nextCandidate && mode === 'demo') nextCandidate = nextCandidateFromPool(candidate, true);
    if (!nextCandidate) {
      setReplacementMessage('這組條件目前只有這一個可用地點。原任務、時間與步數都已保留。');
      return;
    }
    const task = activeJourney.kind === 'rescue'
      ? undefined
      : createJourneyTask(activeJourney.id, nextCandidate.distanceMeters, activeJourney.microTask ? [activeJourney.microTask.id] : []);
    setCandidate(nextCandidate);
    setActiveJourney({
      ...activeJourney,
      destinationId: nextCandidate.id,
      distanceMeters: nextCandidate.distanceMeters,
      dwellSeconds: 0,
      dwellMilliseconds: 0,
      outsideSince: null,
      lastDwellSampleAt: null,
      walkStage: 0,
      microTask: task,
      deviationWindowStartedAt: null,
      deviationStartDistanceMeters: null,
      deviationSuggested: false,
      destinationReplaced: true,
    });
    setRevealed(false);
    setReplacementMessage('已換成新的神秘地點；已走步數與開始時間不變。');
  };

  const revealAndOpenMap = async () => {
    if (!candidate) return;
    if (!revealed) {
      setReplacementMessage('目的地會在約 50 公尺內揭曉；目前可用 App 內的模糊範圍地圖確認方向。');
      return;
    }
    const label = encodeURIComponent(candidate.internalName);
    const url = `https://maps.apple.com/?daddr=${candidate.latitude},${candidate.longitude}&q=${label}&dirflg=w`;
    try {
      await Linking.openURL(url);
    } catch {
      setReplacementMessage('目前無法開啟 Apple 地圖，目的地名稱仍已安全揭曉。');
    }
  };

  const resolveJourneySteps = async (journey: ActiveJourney, endedAt: number): Promise<ActiveJourney> => {
    if (mode !== 'real' || !journey.stepBonusAvailable || !journey.stepCaptureStartedAt) {
      return {
        ...journey,
        endedAt,
        stepStatus: journey.stepBonusAvailable === false ? 'unavailable' : (journey.stepStatus ?? 'complete'),
      };
    }
    const historical = await stepsBetween(journey.stepCaptureStartedAt, endedAt);
    if (historical === null) {
      return { ...journey, endedAt, stepStatus: journey.steps > 0 ? 'partial' : 'unavailable' };
    }
    return {
      ...journey,
      endedAt,
      steps: Math.max(journey.steps, historical),
      stepStatus: 'complete',
      lastConfirmedStepsAt: endedAt,
    };
  };

  const registerUnavailableJourneyAttempt = (journey: ActiveJourney) => {
    if (mode !== 'real' || journey.stepStatus !== 'unavailable') return;
    if ((journey.endedAt ?? currentTimestamp()) - journey.startedAt < 30_000 && journey.steps === 0) return;
    setMotionPermissionState((current) => {
      const unavailableJourneyAttempts = current.unavailableJourneyAttempts + 1;
      if (unavailableJourneyAttempts >= 3 && !current.followupShown) {
        setMotionSettingsReminderVisible(true);
        return { ...current, unavailableJourneyAttempts, followupShown: true };
      }
      return { ...current, unavailableJourneyAttempts };
    });
  };

  const addIncompleteRecord = (journey: ActiveJourney) => {
    if (journey.steps <= 0 || journey.stepStatus === 'unavailable' || journey.stepStatus === 'excluded') return false;
    const now = journey.endedAt ?? currentTimestamp();
    const elapsedMinutes = Math.max(1, Math.round((now - journey.startedAt) / 60000));
    const task = journey.microTask;
    const destinationRevealed = revealed;
    const metrics = journeyHealthMetrics({
      steps: journey.steps,
      elapsedMinutes,
      strideLengthCm: healthProfile.strideLengthCm,
      stepStatus: journey.stepStatus,
    });
    const baseRecord: JourneyRecord = {
      id: journey.id,
      destinationName: destinationRevealed ? candidate?.internalName ?? '未抵達的探索' : '尚未揭曉的目的地',
      theme: candidate?.theme ?? theme,
      endedAt: now,
      elapsedMinutes,
      steps: journey.steps,
      estimatedActiveMinutes: metrics.estimatedActiveMinutes,
      stoppedMinutes: metrics.stoppedMinutes,
      estimatedDistanceMeters: metrics.estimatedDistanceMeters,
      averageCadence: metrics.averageCadence,
      healthIntensity: metrics.intensity,
      effort: null,
      mood: null,
      hasPhoto: false,
      memoryHidden: false,
      note: '',
      earnedXP: 0,
      completed: false,
      outcome: 'unreached',
      stepStatus: journey.stepStatus ?? 'complete',
      destinationRevealed,
      destinationReplaced: journey.destinationReplaced === true,
      microTaskTitle: task?.title,
      microTaskType: task?.type,
      microTaskResponse: task?.response,
      microTaskPhotoUri: task?.photoUri,
      microTaskCompleted: task?.status === 'completed',
      kind: journey.kind ?? 'normal',
      destinationId: candidate?.id,
      destinationLatitude: destinationRevealed ? candidate?.latitude : undefined,
      destinationLongitude: destinationRevealed ? candidate?.longitude : undefined,
      arrivalLatitude: destinationRevealed ? candidate?.arrivalLatitude : undefined,
      arrivalLongitude: destinationRevealed ? candidate?.arrivalLongitude : undefined,
    };
    const milestones = healthMilestonesForJourney(baseRecord, records, healthProfile);
    const record: JourneyRecord = { ...baseRecord, healthMilestones: milestones.map((item) => item.kind) };
    if (mode === 'real') setRealRecords((current) => [record, ...current]);
    else setDemoRecords((current) => [record, ...current]);
    return true;
  };

  const saveIncompleteJourney = async () => {
    const journey = activeJourneyRef.current;
    if (!journey) return;
    const resolved = await resolveJourneySteps(journey, currentTimestamp());
    const saved = addIncompleteRecord(resolved);
    registerUnavailableJourneyAttempt(resolved);
    resetPreparation();
    const resultMessage = saved
      ? `這趟沒有抵達，但仍走了 ${resolved.stepStatus === 'partial' ? '至少 ' : ''}${resolved.steps.toLocaleString()} 步，已保存為未抵達旅程。`
      : '這趟沒有有效步數，因此未建立活動旅程。';
    setMemoryMessage(resultMessage);
    setJourneyEndMessage(resultMessage);
  };

  const returnToStart = async () => {
    const journey = activeJourneyRef.current;
    if (!journey) return;
    const start = journey.origin ?? origin;
    const resolved = await resolveJourneySteps(journey, currentTimestamp());
    const saved = addIncompleteRecord(resolved);
    registerUnavailableJourneyAttempt(resolved);
    resetPreparation();
    if (saved) {
      const resultMessage = `這趟沒有抵達，但仍走了 ${resolved.stepStatus === 'partial' ? '至少 ' : ''}${resolved.steps.toLocaleString()} 步，已保存為未抵達旅程。`;
      setMemoryMessage(resultMessage);
      setJourneyEndMessage(resultMessage);
    }
    if (!start) return;
    const url = `https://maps.apple.com/?daddr=${start.latitude},${start.longitude}&q=${encodeURIComponent('探索起點')}&dirflg=w`;
    try {
      await Linking.openURL(url);
    } catch {
      setReplacementMessage(saved ? '未能開啟 Apple 地圖；未抵達旅程已保存。' : '未能開啟 Apple 地圖。');
    }
  };

  const resumeRecoveredJourney = async () => {
    const journey = activeJourneyRef.current;
    if (!journey) return;
    const resolved = await resolveJourneySteps(journey, currentTimestamp());
    setActiveJourney({ ...resolved, endedAt: undefined, recoveryPending: false });
    setReplacementMessage(resolved.stepStatus === 'partial'
      ? `已恢復旅程；目前確認至少 ${resolved.steps.toLocaleString()} 步。`
      : resolved.stepStatus === 'unavailable'
        ? '已恢復旅程，但這趟目前無法取得步數。'
        : '旅程與步數已恢復，請繼續探索。');
  };

  const endRecoveredJourney = async () => {
    await saveIncompleteJourney();
  };

  const dismissDeviationSuggestion = () => {
    setActiveJourney((current) => current ? {
      ...current,
      deviationSuggested: false,
      deviationWindowStartedAt: currentTimestamp(),
      deviationStartDistanceMeters: current.distanceMeters,
    } : current);
  };

  const beginMicroTask = () => {
    setActiveJourney((current) => current?.microTask?.status === 'available' ? { ...current, microTask: { ...current.microTask, status: 'active' } } : current);
  };

  const replaceMicroTask = () => {
    setActiveJourney((current) => {
      const currentTask = current?.microTask;
      if (!current || !currentTask || currentTask.replacementUsed || currentTask.status === 'completed') return current;
      const nextTask = createJourneyTask(current.id, current.distanceMeters, [currentTask.id], true);
      return { ...current, microTask: { ...nextTask, status: 'active' } };
    });
  };

  const skipMicroTask = () => {
    setActiveJourney((current) => current?.microTask ? { ...current, microTask: { ...current.microTask, status: 'skipped' } } : current);
  };

  const completeMicroTask = (response: string) => {
    setActiveJourney((current) => current?.microTask ? {
      ...current,
      microTask: { ...current.microTask, response: response.trim(), status: 'completed', hintUnlocked: true },
    } : current);
    Vibration.vibrate(100);
  };

  const captureMicroTaskPhoto = async () => {
    const journey = activeJourneyRef.current;
    if (!journey?.microTask || journey.microTask.type !== 'photo') return;
    const result = await captureTaskPhoto(journey.id);
    if (result.status === 'saved') {
      setActiveJourney((current) => current?.microTask ? {
        ...current,
        microTask: { ...current.microTask, photoUri: result.uri, response: '已完成照片任務', status: 'completed', hintUnlocked: true },
      } : current);
      Vibration.vibrate(100);
    } else if (result.status === 'denied') {
      setReplacementMessage('相機權限未開啟。你可以到 iPhone「設定」允許相機，或略過這個選填小任務。');
    } else if (result.status === 'error') {
      setReplacementMessage('相機暫時無法使用。小任務仍可更換或略過，不影響抵達與健康紀錄。');
    }
  };

  const saveMicroTaskPhoto = async () => {
    const photoUri = activeJourneyRef.current?.microTask?.photoUri;
    if (!photoUri) return;
    const saved = await saveTaskPhotoToLibrary(photoUri);
    if (saved) {
      setActiveJourney((current) => current?.microTask ? { ...current, microTask: { ...current.microTask, savedToPhotoLibrary: true } } : current);
      setReplacementMessage('照片已另存到 iPhone「照片」。App 內的任務照片仍會保留。');
    } else {
      setReplacementMessage('沒有取得照片權限，因此照片只保留在 ExplorePath App 內。');
    }
  };

  const discardJourney = () => {
    if ((activeJourneyRef.current?.steps ?? 0) > 0) {
      void saveIncompleteJourney();
      return;
    }
    resetPreparation();
    setMemoryMessage('沒有有效步數，這次沒有建立活動旅程。');
  };
  const continueAfterArrival = () => setPhase('review');
  const setMood = (mood: JourneyMood) => setReview((current) => ({ ...current, mood }));
  const setEffort = (effort: ReviewDraft['effort']) => setReview((current) => ({ ...current, effort }));
  const setNote = (note: string) => setReview((current) => ({ ...current, note }));
  const updateHealthProfile = (patch: Partial<HealthProfile>) => {
    setHealthProfile((current) => normalizeHealthProfile({ ...current, ...patch }));
  };

  const captureReviewPhoto = async () => {
    if (!activeJourney) return;
    const result = await takeMemoryPhoto(activeJourney.id);
    if (result.status === 'saved') {
      const previousPhoto = review.photoUri;
      setReview((current) => ({ ...current, hasPhoto: true, photoUri: result.uri }));
      if (previousPhoto && previousPhoto !== result.uri) await deleteMemoryPhoto(previousPhoto);
      setMemoryMessage('代表照片已保存在這支 iPhone。');
    } else if (result.status === 'denied') {
      setMemoryMessage('相機權限未開啟；照片是選填，不影響完成探索。');
    } else if (result.status === 'error') {
      setMemoryMessage('目前無法使用相機；你可以完成後再從回憶補上照片。');
    }
  };

  const removeReviewPhoto = async () => {
    const photoUri = review.photoUri;
    setReview((current) => ({ ...current, hasPhoto: false, photoUri: null }));
    await deleteMemoryPhoto(photoUri);
    setMemoryMessage('已移除這趟的代表照片。');
  };

  const setFeaturedMemory = (month: string, recordId: string) => {
    const record = records.find((item) => item.id === recordId);
    if (!record || !record.completed || record.memoryHidden === true || monthKey(record.endedAt) !== month) return;
    setCurrentFeaturedMemories((current) => ({ ...current, [month]: recordId }));
    setMemoryMessage('已設為這個月的代表回憶。');
  };

  const updateMemoryNote = (recordId: string, note: string) => {
    setCurrentRecords((current) => current.map((record) => (
      record.id === recordId ? { ...record, note: note.slice(0, 160) } : record
    )));
    setMemoryMessage('回憶筆記已更新。');
  };

  const addMemoryPhoto = async (recordId: string, source: 'camera' | 'library') => {
    const target = records.find((record) => record.id === recordId && record.completed);
    if (!target || target.memoryHidden === true) return;
    const result = source === 'camera'
      ? await takeMemoryPhoto(recordId)
      : await pickMemoryPhoto(recordId);
    if (result.status === 'saved') {
      const previousPhoto = target.memoryPhotoUri;
      setCurrentRecords((current) => current.map((record) => (
        record.id === recordId
          ? { ...record, hasPhoto: true, memoryPhotoUri: result.uri }
          : record
      )));
      if (previousPhoto && previousPhoto !== result.uri) await deleteMemoryPhoto(previousPhoto);
      setMemoryMessage('代表照片已更新。');
    } else if (result.status === 'denied') {
      setMemoryMessage('照片權限未開啟；你仍可保留文字回憶。');
    } else if (result.status === 'error') {
      setMemoryMessage('目前無法讀取照片，請稍後再試。');
    }
  };

  const removeMemoryPhoto = async (recordId: string) => {
    const target = records.find((record) => record.id === recordId);
    if (!target?.memoryPhotoUri) return;
    if (target.memoryPhotoUri !== target.microTaskPhotoUri) {
      await deleteMemoryPhoto(target.memoryPhotoUri);
    }
    setCurrentRecords((current) => current.map((record) => (
      record.id === recordId
        ? { ...record, hasPhoto: false, memoryPhotoUri: undefined }
        : record
    )));
    setMemoryMessage('代表照片已移除，文字回憶仍然保留。');
  };

  const hideMemory = async (recordId: string) => {
    const target = records.find((record) => record.id === recordId);
    if (!target) return;
    setCurrentRecords((current) => current.map((record) => (
      record.id === recordId
        ? { ...record, memoryHidden: true }
        : record
    )));
    setCurrentFeaturedMemories((current) => Object.fromEntries(
      Object.entries(current).filter(([, featuredId]) => featuredId !== recordId),
    ));
    setMemoryMessage('已從時間軸隱藏；旅程、健康統計與私人筆記仍保留。');
  };

  const markMemoryStepsInaccurate = (recordId: string) => {
    const target = records.find((record) => record.id === recordId);
    if (!target || target.stepStatus === 'excluded') return;
    setCurrentRecords((current) => current.map((record) => record.id === recordId
      ? { ...record, stepStatus: 'excluded' }
      : record));
    if (journeyOutcome(target) === 'unreached' && target.petId) {
      const destinationStillShared = records.some((record) => record.id !== target.id
        && record.petId === target.petId
        && record.destinationId === target.destinationId
        && isActivityJourney(record));
      setCurrentPetCollection((current) => ({
        ...current,
        pets: current.pets.map((pet) => pet.id === target.petId ? {
          ...pet,
          sharedJourneyCount: Math.max(0, pet.sharedJourneyCount - 1),
          sharedDestinationIds: !destinationStillShared && target.destinationId
            ? pet.sharedDestinationIds.filter((id) => id !== target.destinationId)
            : pet.sharedDestinationIds,
        } : pet),
      }));
    }
    setMemoryMessage('已標記步數不準確：原始數字仍保留在詳情，但不再計入總步數與平均。');
  };

  const exportBackup = async () => {
    try {
      const payload = createBackupPayload({
        appVersion,
        petCollection: currentPets(),
        records,
        healthProfile,
        usedMicroTaskIds: mode === 'real' ? realUsedTaskIds : demoUsedTaskIds,
        durationMinutes,
        theme,
        featuredMemoryByMonth,
        motionPermissionState,
        seasonalPromise,
        recoveryState: { activeJourney, candidate, revealed },
      });
      await exportBackupFile(payload);
      setMemoryMessage(`${mode === 'demo' ? '展示' : '真實'}備份檔已交給 iPhone 分享選單；照片不包含在備份內。`);
    } catch (error) {
      setMemoryMessage(error instanceof Error ? error.message : '目前無法建立備份。');
    }
  };

  const chooseBackup = async () => {
    if (Object.values(currentPets().journeyBindings).some((binding) => !binding.ended)) {
      setMemoryMessage('請先完成或結束進行中的個人／組隊旅程，再還原備份。'); return;
    }
    try {
      const selected = await chooseBackupFile();
      if (!selected) return;
      setPendingBackup(selected);
      setMemoryMessage(`已讀取備份，確認後只會取代${mode === 'demo' ? '展示沙盒' : '目前真實'}資料。`);
    } catch (error) {
      setPendingBackup(null);
      setMemoryMessage(error instanceof Error ? error.message : '無法讀取這個備份檔。');
    }
  };

  const confirmBackupRestore = () => {
    if (!pendingBackup) return;
    const restoredRecords = normalizeMemoryRecords(pendingBackup.data.records);
    const restoredFeatured = chooseValidFeaturedMemories(
      restoredRecords,
      pendingBackup.data.featuredMemoryByMonth,
    );
    void cancelPetNotifications(currentPets().notificationIds);
    resetPreparation();
    setCurrentPetCollection(() => settlePetCollection({ ...pendingBackup.data.petCollection, notificationsEnabled: false, notificationIds: [],
      journeyBindings: Object.fromEntries(Object.entries(pendingBackup.data.petCollection.journeyBindings).map(([id, binding]) => [id, { ...binding, ended: id === pendingBackup.data.recoveryState.activeJourney?.id ? binding.ended : true }])) }, currentTimestamp()));
    setCurrentRecords(() => restoredRecords);
    setHealthProfile(pendingBackup.data.healthProfile);
    setCurrentFeaturedMemories(() => restoredFeatured);
    if (mode === 'real') setRealUsedTaskIds(pendingBackup.data.usedMicroTaskIds);
    else setDemoUsedTaskIds(pendingBackup.data.usedMicroTaskIds);
    setDurationMinutes(pendingBackup.data.durationMinutes);
    setTheme(pendingBackup.data.theme);
    setCurrentSeasonalPromise(() => pendingBackup.data.seasonalPromise);
    if (mode === 'real') {
      setMotionPermissionState(pendingBackup.data.motionPermissionState);
      setMotionStatus(pendingBackup.data.motionPermissionState.lastStatus);
    }
    const recovery = pendingBackup.data.recoveryState;
    if (recovery.activeJourney && recovery.candidate) {
      setCandidate(recovery.candidate);
      setCandidatePool([recovery.candidate]);
      setActiveJourney({ ...recovery.activeJourney, recoveryPending: true });
      setRevealed(recovery.revealed);
      setJourneyIntent(recovery.activeJourney.kind ?? 'normal');
      setRescuePetId(recovery.activeJourney.rescuePetId ?? null);
      setPhase('active');
      setTab('explore');
    }
    setPendingBackup(null);
    setTab('records');
    setMemoryMessage(`備份已完整取代${mode === 'demo' ? '展示沙盒' : '目前真實'}資料；照片依照設定不會從備份還原。`);
  };

  const cancelBackupRestore = () => {
    setPendingBackup(null);
    setMemoryMessage('已取消還原，手機內原有資料沒有變動。');
  };

  const companionActivePet = () => {
    const result = applyCompanionship(currentPets(), currentTimestamp());
    setCurrentPetCollection(() => result.collection);
    setRescueMessage(result.message);
  };

  const cleanActivePet = () => {
    const result = applyCleaning(currentPets(), currentTimestamp());
    setCurrentPetCollection(() => result.collection);
    setRescueMessage(result.message);
  };

  const switchActivePet = (petId: string) => {
    const result = applyPetSwitch(currentPets(), petId, currentTimestamp());
    setCurrentPetCollection(() => result.collection);
    setRescueMessage(result.message);
  };

  const undoPetSwitch = () => {
    const result = applyPetSwitchUndo(currentPets(), currentTimestamp());
    setCurrentPetCollection(() => result.collection);
    setRescueMessage(result.message);
  };

  const renamePet = (petId: string, nickname: string) => {
    const result = applyRename(currentPets(), petId, nickname);
    setCurrentPetCollection(() => result.collection);
    setRescueMessage(result.message);
  };

  const rescueWithCareItem = () => {
    const result = beginItemRescue(currentPets(), currentTimestamp());
    setCurrentPetCollection(() => result.collection);
    setRescueMessage(result.message);
  };

  const togglePetNotifications = async () => {
    if (mode !== 'real') {
      setRescueMessage('展示模式不會建立真實通知；這可避免測試提醒混入日常使用。');
      return;
    }
    if (realPetCollection.notificationsEnabled === true) {
      setRealPetCollection((current) => ({ ...current, notificationsEnabled: false }));
      setRescueMessage('夥伴提醒已關閉；App 內的狀態仍會正常更新。');
      return;
    }
    const granted = await requestPetNotificationPermission();
    setRealPetCollection((current) => ({ ...current, notificationsEnabled: granted }));
    setRescueMessage(granted
      ? '已開啟免費的本機夥伴提醒；不需要帳號、伺服器、API 金鑰或付費方案。'
      : '通知權限未開啟；App 仍可完整使用，夥伴狀態會顯示在收藏頁。');
  };

  const rescueOrigin = async (): Promise<GeoPoint | null> => {
    if (mode === 'demo') return origin ?? { latitude: 25.033, longitude: 121.5654 };
    const granted = await requestForegroundLocationPermission();
    if (!granted) {
      setRescueMessage('尋回探索必須從目前 GPS 位置開始；請先允許「使用 App 期間」的位置權限。');
      return null;
    }
    try {
      const location = await getCurrentTrackedLocation();
      setCurrentLocation(location);
      const point = { latitude: location.latitude, longitude: location.longitude };
      setOrigin(point);
      return point;
    } catch {
      setRescueMessage('目前無法取得 GPS 位置。沒有改用假位置，請確認定位後再試。');
      return null;
    }
  };

  const openRescueCandidate = (
    nextCandidate: Destination,
    nextOrigin: GeoPoint,
    pool: Destination[],
    petId: string,
  ) => {
    setCandidatePool(pool);
    setCandidate(nextCandidate);
    setExcludedIds([]);
    setOrigin(nextOrigin);
    setJourneyIntent('rescue');
    setRescuePetId(petId);
    setRescueMessage(null);
    setPhase('candidate');
    setTab('explore');
  };

  const searchRescueMemory = async (addedMinutes: 0 | 10 | 20 | 30 = 0) => {
    const settled = settlePetCollection(petCollection, currentTimestamp());
    setCurrentPetCollection(() => settled);
    const departedPet = getActivePet(settled);
    if (!departedPet || departedPet.lifecycle !== 'departed') {
      setRescueMessage('目前沒有需要尋回的同行夥伴。');
      return;
    }
    setRescueMessage('正在用目前位置檢查你們共同走過的地方⋯');
    const nextOrigin = await rescueOrigin();
    if (!nextOrigin) return;
    const budget = durationMinutes + addedMinutes;
    const memoryCandidates = sharedRescueRecords(records, departedPet.id)
      .map((record): Destination | null => {
        if (
          typeof record.destinationLatitude !== 'number' ||
          typeof record.destinationLongitude !== 'number'
        ) return null;
        const point = {
          latitude: record.destinationLatitude,
          longitude: record.destinationLongitude,
        };
        const meters = Math.round(distanceMeters(nextOrigin, point));
        const walkingMinutes = estimatedWalkingMinutes(meters);
        const totalMinutes = estimatedTotalMinutes(meters);
        const resolvedTheme = record.theme === 'surprise' ? 'nature' : record.theme;
        return {
          id: `memory-${record.destinationId ?? record.id}`,
          internalName: record.destinationName,
          theme: resolvedTheme,
          walkingMinutes,
          totalMinutes,
          distanceMeters: meters,
          latitude: record.destinationLatitude,
          longitude: record.destinationLongitude,
          arrivalLatitude: record.arrivalLatitude,
          arrivalLongitude: record.arrivalLongitude,
          arrivalKind: record.arrivalLatitude ? 'boundary' : 'point',
          environmentHint: '一個你和夥伴曾經一起抵達的地方。',
          source: mode === 'demo' ? 'demo' : 'openstreetmap',
        };
      })
      .filter((item): item is Destination => item !== null)
      .sort((left, right) => left.totalMinutes - right.totalMinutes);
    const eligible = memoryCandidates.filter((item) => item.totalMinutes <= budget);
    if (eligible.length === 0) {
      setRescueMessage(
        memoryCandidates.length === 0
          ? '目前沒有可用的共同回憶地點。請明確選擇「附近新地點」，或先完成更多一般探索留下共同足跡。'
          : `在 ${budget} 分鐘內找不到可抵達的共同回憶。你可以增加 10／20／30 分鐘，或明確改用附近新地點。`,
      );
      return;
    }
    const firstEligible = eligible[0];
    if (!firstEligible) return;
    setDurationMinutes(budget);
    openRescueCandidate(firstEligible, nextOrigin, eligible, departedPet.id);
  };

  const searchNearbyRescue = async () => {
    const settled = settlePetCollection(petCollection, currentTimestamp());
    setCurrentPetCollection(() => settled);
    const departedPet = getActivePet(settled);
    if (!departedPet || departedPet.lifecycle !== 'departed') {
      setRescueMessage('目前沒有需要尋回的同行夥伴。');
      return;
    }
    setRescueMessage('你已選擇附近新地點，正在搜尋免費的 OpenStreetMap 公開資料⋯');
    const nextOrigin = await rescueOrigin();
    if (!nextOrigin) return;
    try {
      const pool = mode === 'demo'
        ? destinations
        : await searchNearbyDestinations(nextOrigin, durationMinutes + 30);
      const eligible = eligibleDestinations(pool, durationMinutes, 'surprise', []);
      if (eligible.length === 0) {
        setRescueMessage('目前時間內找不到附近新地點。沒有自動增加時間，請自行增加探索時間後再試。');
        return;
      }
      const firstEligible = eligible[0];
      if (!firstEligible) return;
      openRescueCandidate(firstEligible, nextOrigin, eligible, departedPet.id);
    } catch (error) {
      const detail = error instanceof OverpassServiceError ? error.message : '目前無法連上地點服務。';
      setRescueMessage(`${detail} 沒有切換付費服務，請稍後重試。`);
    }
  };

  const completeRescueArrival = () => {
    if (!activeJourney || !candidate || activeJourney.kind !== 'rescue' || !activeJourney.rescuePetId) return;
    const now = activeJourney.endedAt ?? currentTimestamp();
    const rescue = completeRescueJourney(currentPets(), activeJourney.rescuePetId, now);
    const record: JourneyRecord = {
      id: activeJourney.id,
      destinationName: candidate.internalName,
      theme: candidate.theme,
      endedAt: now,
      elapsedMinutes: Math.max(1, Math.round((now - activeJourney.startedAt) / 60000)),
      steps: activeJourney.steps,
      mood: null,
      hasPhoto: false,
      memoryHidden: false,
      note: '尋回探索完成',
      earnedXP: 0,
      completed: true,
      outcome: 'arrived',
      stepStatus: activeJourney.stepStatus ?? (activeJourney.stepBonusAvailable === false ? 'unavailable' : 'complete'),
      destinationRevealed: true,
      destinationReplaced: activeJourney.destinationReplaced === true,
      kind: 'rescue',
      petId: activeJourney.rescuePetId,
      destinationId: candidate.id,
      destinationLatitude: candidate.latitude,
      destinationLongitude: candidate.longitude,
      arrivalLatitude: candidate.arrivalLatitude,
      arrivalLongitude: candidate.arrivalLongitude,
    };
    setCurrentPetCollection(() => rescue.collection);
    if (mode === 'real') setRealRecords((current) => [record, ...current]);
    else setDemoRecords((current) => [record, ...current]);
    registerUnavailableJourneyAttempt(activeJourney);
    resetPreparation();
    setRescueMessage(rescue.message);
    setTab('health');
  };

  const submitReview = () => {
    if (!activeJourney || !candidate || !review.mood || !review.effort) return;
    if (currentPets().rewardLedger[activeJourney.id]) { setPhase('reward'); return; }
    const now = activeJourney.endedAt ?? currentTimestamp();
    const elapsedMinutes = Math.max(1, Math.round((now - activeJourney.startedAt) / 60000));
    const task = activeJourney.microTask;
    const stepStatus = activeJourney.stepStatus ?? (activeJourney.stepBonusAvailable === false ? 'unavailable' : 'complete');
    const metrics = journeyHealthMetrics({
      steps: activeJourney.steps,
      elapsedMinutes,
      strideLengthCm: healthProfile.strideLengthCm,
      stepStatus,
    });
    const baseRecord: JourneyRecord = {
      id: activeJourney.id,
      destinationName: candidate.internalName,
      theme: candidate.theme,
      endedAt: now,
      elapsedMinutes,
      steps: activeJourney.steps,
      estimatedActiveMinutes: metrics.estimatedActiveMinutes,
      stoppedMinutes: metrics.stoppedMinutes,
      estimatedDistanceMeters: metrics.estimatedDistanceMeters,
      averageCadence: metrics.averageCadence,
      healthIntensity: metrics.intensity,
      effort: review.effort,
      mood: review.mood,
      hasPhoto: Boolean(review.photoUri),
      memoryPhotoUri: review.photoUri ?? undefined,
      memoryHidden: false,
      note: review.note.trim(),
      earnedXP: 0,
      completed: true,
      outcome: 'arrived',
      stepStatus,
      destinationRevealed: true,
      destinationReplaced: activeJourney.destinationReplaced === true,
      microTaskTitle: task?.title,
      microTaskType: task?.type,
      microTaskResponse: task?.response,
      microTaskPhotoUri: task?.photoUri,
      microTaskCompleted: task?.status === 'completed',
      kind: activeJourney.kind === 'seasonal' ? 'seasonal' : 'normal',
      destinationId: candidate.id,
      destinationLatitude: candidate.latitude,
      destinationLongitude: candidate.longitude,
      arrivalLatitude: candidate.arrivalLatitude,
      arrivalLongitude: candidate.arrivalLongitude,
    };
    if (baseRecord.kind === 'normal') {
      const validSteps = ['excluded', 'unavailable'].includes(stepStatus) ? 0 : activeJourney.steps;
      const result = applyNormalJourneyReward(currentPets(), xpBreakdown(validSteps), activeJourney.id, candidate.id, now, validSteps);
      setCurrentPetCollection(() => result.collection);
      baseRecord.earnedXP = result.reward.appliedPetXP;
      baseRecord.petId = result.reward.petId;
      setReward(result.reward);
    } else setCurrentPetCollection((current) => endPetJourney(current, activeJourney.id));
    const milestones = healthMilestonesForJourney(baseRecord, records, healthProfile);
    const record: JourneyRecord = { ...baseRecord, healthMilestones: milestones.map((item) => item.kind) };
    if (mode === 'real') {
      setRealRecords((current) => [record, ...current]);
    } else {
      setDemoRecords((current) => [record, ...current]);
    }
    registerUnavailableJourneyAttempt(activeJourney);
    if (activeJourney.kind === 'seasonal') {
      setCurrentSeasonalPromise((current) => ({
        ...markSeasonalVisitPending(current, activeJourney.id, now),
        lastRewardMessage: '已抵達並保存這趟旅程；本季紀錄待完成。',
      }));
    }
    setPhase('reward');
  };

  const beginSeasonalSelection = () => setCurrentSeasonalPromise((current) => ({ ...current, status: 'selecting', selectedCandidates: [], sealedCandidates: [], target: null, entries: [], pendingVisit: null, startedAt: null, expiresAt: null, lastRewardMessage: null }));

  const toggleSeasonalCandidate = (nextCandidate: SeasonalCandidate) => setCurrentSeasonalPromise((current) => {
    if (current.status !== 'selecting') return current;
    const selected = current.selectedCandidates.some((item) => item.id === nextCandidate.id);
    return { ...current, selectedCandidates: selected ? current.selectedCandidates.filter((item) => item.id !== nextCandidate.id) : current.selectedCandidates.length < 3 ? [...current.selectedCandidates, nextCandidate] : current.selectedCandidates };
  });

  const sealSeasonalCandidates = () => setCurrentSeasonalPromise((current) => current.status === 'selecting' && current.selectedCandidates.length === 3 ? { ...current, status: 'sealed', sealedCandidates: sealCandidates(current.selectedCandidates, currentTimestamp()), lastRewardMessage: null } : current);

  const revealSeasonalBox = (index: number) => {
    setCurrentSeasonalPromise((current) => revealSeasonalTarget(current, index, currentTimestamp()));
    Vibration.vibrate([0, 80, 70, 160]);
    if (mode === 'real' && realSeasonalPromise.notificationsEnabled !== true) {
      void requestSeasonalNotificationPermission().then((granted) => setRealSeasonalPromise((current) => ({ ...current, notificationsEnabled: granted, lastRewardMessage: granted ? '已開啟免費本機提醒：季初一次、季末前 14 天一次。' : '通知未開啟；任務仍可完整使用，足跡頁會顯示季節進度。' })));
    }
  };

  const startSeasonalJourney = async () => {
    const target = seasonalPromise.target;
    const now = currentTimestamp();
    const season = seasonForDate(now);
    if (seasonalPromise.status !== 'active' || !target || seasonalPromise.pendingVisit) return;
    if (seasonalPromise.entries.some((entry) => entry.season === season)) {
      setCurrentSeasonalPromise((current) => ({ ...current, lastRewardMessage: '這個季節已經留下紀錄；下一季再回來看看變化。' }));
      return;
    }
    let startPoint = currentLocation ?? origin;
    if (mode === 'real') {
      const granted = await requestForegroundLocationPermission();
      if (!granted) {
        setCurrentSeasonalPromise((current) => ({ ...current, lastRewardMessage: '本季旅程需要目前 GPS 位置；沒有改用假位置。' }));
        return;
      }
      try {
        const location = await getCurrentTrackedLocation();
        setCurrentLocation(location);
        startPoint = location;
      } catch {
        setCurrentSeasonalPromise((current) => ({ ...current, lastRewardMessage: '目前無法取得 GPS，本季旅程尚未開始。' }));
        return;
      }
    }
    const directDistance = startPoint
      ? Math.round(distanceMeters(startPoint, { latitude: target.latitude, longitude: target.longitude }))
      : 900;
    const seasonalDestination: Destination = {
      id: target.destinationId,
      internalName: target.destinationName,
      theme: 'nature',
      walkingMinutes: Math.max(1, Math.ceil((directDistance * 1.35) / 70)),
      totalMinutes: 0,
      distanceMeters: directDistance,
      latitude: target.latitude,
      longitude: target.longitude,
      environmentHint: '回到四季之約的固定地點，看看這一季有什麼不同。',
      source: mode === 'demo' ? 'demo' : 'openstreetmap',
    };
    setTab('explore');
    await requestJourneyStart(seasonalDestination, 'seasonal', undefined, season);
  };

  const completeSeasonalVisit = async (kind: SeasonalEntryKind, observation: string, photoUri?: string, useSafetyRadius = false) => {
    const state = seasonalPromise;
    const target = state.target;
    const now = currentTimestamp();
    if (state.status !== 'active' || !target || !state.pendingVisit) return;
    if (state.expiresAt && now >= state.expiresAt) {
      setCurrentSeasonalPromise((current) => settleExpiredSeasonalPromise(current, now));
      return;
    }
    if (state.entries.some((entry) => entry.season === state.pendingVisit?.season)) {
      setCurrentSeasonalPromise((current) => ({ ...current, lastRewardMessage: '這個季節已經留下紀錄；下一季再回來看看變化。' }));
      return;
    }
    if (mode === 'real') {
      const granted = await requestForegroundLocationPermission();
      if (!granted) {
        setRealSeasonalPromise((current) => ({ ...current, lastRewardMessage: '四季紀錄需要目前 GPS 位置；沒有改用假位置。' }));
        return;
      }
      try {
        const verify = async () => {
          const location = await getCurrentTrackedLocation();
          return { meters: distanceMeters(location, { latitude: target.latitude, longitude: target.longitude }), allowed: useSafetyRadius ? 150 : arrivalRadiusMeters(location.accuracyMeters) };
        };
        const first = await verify();
        if (first.meters > first.allowed) {
          setRealSeasonalPromise((current) => ({ ...current, lastRewardMessage: useSafetyRadius ? `目前距離約 ${Math.round(first.meters)} 公尺；安全例外仍需在 150 公尺內。` : `目前距離約 ${Math.round(first.meters)} 公尺，尚未進入抵達範圍。` }));
          return;
        }
      } catch {
        setRealSeasonalPromise((current) => ({ ...current, lastRewardMessage: '目前無法取得 GPS，條件與季節進度都沒有被更改。' }));
        return;
      }
    }
    const pending = state.pendingVisit;
    setCurrentSeasonalPromise((current) => ({
      ...addSeasonalEntry(current, kind, observation, photoUri, useSafetyRadius, pending.arrivedAt, pending.journeyId),
      lastRewardMessage: '本季紀錄已完成；原本抵達時保存的旅程與獎勵沒有重複計算。',
    }));
    Vibration.vibrate([0, 100, 60, 120]);
  };

  const abandonSeasonalVisit = () => setCurrentSeasonalPromise((current) => ({
    ...abandonSeasonalPending(current),
    lastRewardMessage: '已放棄本季待完成內容；抵達旅程與當次獎勵仍保留，但本季不蓋章。',
  }));

  const claimSeasonalCompletion = () => {
    if (seasonalPromise.status !== 'completed') return;
    setCurrentSeasonalPromise(claimSeasonalReward);
  };

  const reviveWithSeasonalToken = (petId: string) => {
    if (mode !== 'real' || realSeasonalPromise.reunionTokens !== 1) return;
    const result = revivePetFromSeasonalPromise(realPetCollection, petId, Date.now());
    if (!result.ok) {
      setRealSeasonalPromise((current) => ({ ...current, lastRewardMessage: result.message }));
      return;
    }
    setRealPetCollection(result.collection);
    setRealSeasonalPromise((current) => ({ ...current, reunionTokens: 0, lastRewardMessage: result.message }));
  };

  const finishReward = () => {
    const seasonal = activeJourneyRef.current?.kind === 'seasonal';
    resetPreparation();
    if (seasonal) setTab('records');
  };

  const value: ExplorePathContextValue = {
    reconcileTeamPetJourneys: (retainedId) => {
      if (mode !== 'real' || !hydrated) return;
      setCurrentPetCollection((current) => reconcileTeamPetJourneys(current, retainedId));
    },
    startTeamPetJourney: (id, startedAt) => {
      if (mode !== 'real' || !hydrated) return;
      setCurrentPetCollection((current) => bindPetJourney(current, id, startedAt));
    },
    saveTeamRecord: (record) => {
      if (mode !== 'real') return;
      let nextPets = realPetsRef.current;
      if (record.completed && !realRecords.some((r) => r.id === record.id && r.completed)) {
        const steps = ['excluded', 'unavailable'].includes(record.stepStatus ?? '') ? 0 : record.steps;
        const result = applyNormalJourneyReward(nextPets, xpBreakdown(steps), record.id, record.destinationId ?? record.destinationName, record.endedAt, steps);
        nextPets = result.collection;
        record = { ...record, earnedXP: result.reward.appliedPetXP, petId: result.reward.petId };
      } else if (!record.completed) nextPets = endPetJourney(nextPets, record.id);
      setCurrentPetCollection(() => nextPets);
      if (!record.completed && record.steps <= 0) return;
      setRealRecords((current) => {
      const previous = current.find((item) => item.id === record.id);
      if (previous && previous.steps >= record.steps && (previous.completed || !record.completed)) return current;
      const merged = previous ? { ...record, completed: previous.completed || record.completed, steps: Math.max(previous.steps, record.steps),
        earnedXP: Math.max(previous.earnedXP, record.earnedXP), petId: previous.petId ?? record.petId,
        note: previous.note, mood: previous.mood, effort: previous.effort, memoryHidden: previous.memoryHidden,
        hasPhoto: previous.hasPhoto, memoryPhotoUri: previous.memoryPhotoUri,
        stepStatus: previous.stepStatus === 'excluded' ? 'excluded' as const : record.stepStatus } : record;
      return [merged, ...current.filter((item) => item.id !== record.id)];
      });
    },
    hydrated, mode, phase, tab, durationMinutes, theme, candidate, activeJourney, review, reward, healthProfile,
    petCollection, activePet, records, featuredMemoryByMonth, backupPreview, memoryMessage,
    suggestions, replacementMessage, searchIssue, origin, currentLocation, heading,
    motionStatus, trackingStatus, trackingMessage, revealed, arrivalRadius, journeyIntent, rescueMessage,
    showcaseNow, seasonalPromise, seasonalCandidates, motionPermissionState,
    motionExplanationVisible, motionSettingsReminderVisible, journeyEndMessage,
    setTab, setMode, enterShowcaseMode, exitShowcaseMode, resetShowcaseData,
    openShowcaseScenario, addShowcaseSteps, setShowcaseDistance, fastForwardShowcaseTime,
    chooseDuration, chooseTheme, search, replaceCandidate, addTimeAndSearch, resetPreparation,
    startJourney, confirmMotionExplanation, cancelMotionExplanation,
    dismissMotionSettingsReminder, dismissJourneyEndMessage, openMotionSettings, resumeRecoveredJourney, endRecoveredJourney,
    simulateWalk, simulateArrival, replaceActiveDestination,
    clearReplacementMessage: () => setReplacementMessage(null), revealAndOpenMap,
    saveIncompleteJourney, returnToStart, discardJourney, dismissDeviationSuggestion,
    beginMicroTask, replaceMicroTask, skipMicroTask, completeMicroTask, captureMicroTaskPhoto,
    saveMicroTaskPhoto, continueAfterArrival, setMood, setEffort, setNote, updateHealthProfile, captureReviewPhoto, removeReviewPhoto, submitReview,
    setFeaturedMemory, updateMemoryNote, addMemoryPhoto, removeMemoryPhoto, hideMemory, markMemoryStepsInaccurate,
    exportBackup, chooseBackup, confirmBackupRestore, cancelBackupRestore,
    clearMemoryMessage: () => setMemoryMessage(null),
    companionActivePet, cleanActivePet, switchActivePet, undoPetSwitch, renamePet, rescueWithCareItem,
    searchRescueMemory, searchNearbyRescue, completeRescueArrival,
    togglePetNotifications,
    beginSeasonalSelection, toggleSeasonalCandidate, sealSeasonalCandidates, revealSeasonalBox,
    startSeasonalJourney, completeSeasonalVisit, abandonSeasonalVisit, claimSeasonalCompletion, reviveWithSeasonalToken,
    finishReward,
  };

  return <ExplorePathContext.Provider value={value}>{children}</ExplorePathContext.Provider>;
}

export function useExplorePath() {
  const context = useContext(ExplorePathContext);
  if (!context) throw new Error('useExplorePath must be used inside ExplorePathProvider');
  return context;
}
