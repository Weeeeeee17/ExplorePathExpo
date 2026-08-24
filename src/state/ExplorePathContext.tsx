import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';

import { destinations } from '../data/destinations';
import { advanceDwellState, arrivalRadiusMeters, distanceMeters } from '../domain/geo';
import {
  applyPetReward,
  eligibleDestinations,
  noResultSuggestions,
  xpBreakdown,
} from '../domain/rules';
import {
  ActiveJourney,
  AppPhase,
  AppTab,
  Destination,
  ExplorationTheme,
  GeoPoint,
  JourneyMood,
  JourneyRecord,
  LiveTrackingStatus,
  MotionStatus,
  PetState,
  ReviewDraft,
  RewardSummary,
  SearchIssue,
  TimeSuggestion,
  TrackedLocation,
  TrackingMode,
} from '../domain/types';
import { OverpassServiceError, searchNearbyDestinations } from '../services/overpass';
import { loadRealState, saveRealState } from '../services/storage';
import {
  getCurrentTrackedLocation,
  requestForegroundLocationPermission,
  requestMotionAccess,
  stepsSince,
  watchDeviceHeading,
  watchSteps,
  watchTrackedLocation,
} from '../services/tracking';

const emptyReview: ReviewDraft = { mood: null, note: '', hasPhoto: false };
const emptyPet: PetState = { hasEgg: false, species: null, experience: 0 };
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
  pet: PetState;
  records: JourneyRecord[];
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
  setTab: (tab: AppTab) => void;
  setMode: (mode: TrackingMode) => void;
  chooseDuration: (minutes: number) => void;
  chooseTheme: (theme: ExplorationTheme) => void;
  search: () => Promise<void>;
  replaceCandidate: () => Promise<void>;
  addTimeAndSearch: (minutes: 10 | 20 | 30) => Promise<void>;
  resetPreparation: () => void;
  startJourney: () => Promise<void>;
  simulateWalk: () => void;
  simulateArrival: () => void;
  replaceActiveDestination: () => Promise<void>;
  clearReplacementMessage: () => void;
  revealAndOpenMap: () => Promise<void>;
  saveIncompleteJourney: () => void;
  discardJourney: () => void;
  setMood: (mood: JourneyMood) => void;
  setNote: (note: string) => void;
  togglePhoto: () => void;
  submitReview: () => void;
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
  const [realPet, setRealPet] = useState<PetState>(emptyPet);
  const [realRecords, setRealRecords] = useState<JourneyRecord[]>([]);
  const [demoPet, setDemoPet] = useState<PetState>(emptyPet);
  const [demoRecords, setDemoRecords] = useState<JourneyRecord[]>([]);
  const [replacementMessage, setReplacementMessage] = useState<string | null>(null);
  const [searchIssue, setSearchIssue] = useState<SearchIssue | null>(null);
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [currentLocation, setCurrentLocation] = useState<TrackedLocation | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [motionStatus, setMotionStatus] = useState<MotionStatus>('unknown');
  const [trackingStatus, setTrackingStatus] = useState<LiveTrackingStatus>('idle');
  const [trackingMessage, setTrackingMessage] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const candidateRef = useRef(candidate);
  const activeJourneyRef = useRef(activeJourney);
  candidateRef.current = candidate;
  activeJourneyRef.current = activeJourney;

  const pet = mode === 'real' ? realPet : demoPet;
  const records = mode === 'real' ? realRecords : demoRecords;
  const arrivalRadius = arrivalRadiusMeters(currentLocation?.accuracyMeters ?? null);

  useEffect(() => {
    let mounted = true;
    void loadRealState().then((stored) => {
      if (!mounted) return;
      if (stored) {
        setRealPet(stored.pet);
        setRealRecords(stored.records);
        setDurationMinutes(stored.durationMinutes);
        setTheme(stored.theme);
        setCandidate(stored.candidate);
        setCandidatePool(stored.candidate ? [stored.candidate] : []);
        setActiveJourney(stored.activeJourney);
        setReview(stored.review);
        setReward(stored.reward);
        setMotionStatus(
          stored.activeJourney?.stepBonusAvailable === false ? 'denied' : 'available',
        );
        setPhase(stored.phase);
      }
      setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || mode !== 'real') return;
    const persistablePhase = ['candidate', 'active', 'review', 'reward'].includes(phase)
      ? (phase as 'candidate' | 'active' | 'review' | 'reward')
      : 'preparation';
    const timeout = setTimeout(() => {
      void saveRealState({
        version: 1,
        pet: realPet,
        records: realRecords,
        phase: persistablePhase,
        durationMinutes,
        theme,
        candidate: persistablePhase === 'preparation' ? null : candidate,
        activeJourney,
        review,
        reward,
      }).catch(() => undefined);
    }, 180);
    return () => clearTimeout(timeout);
  }, [
    hydrated,
    mode,
    phase,
    realPet,
    realRecords,
    durationMinutes,
    theme,
    candidate,
    activeJourney,
    review,
    reward,
  ]);

  const updateFromLocation = (location: TrackedLocation) => {
    setCurrentLocation(location);
    const destination = candidateRef.current;
    if (!destination) return;
    const target = { latitude: destination.latitude, longitude: destination.longitude };
    const remainingDistance = Math.round(distanceMeters(location, target));
    const now = Date.now();
    if (location.accuracyMeters !== null && location.accuracyMeters > 100) {
      setTrackingStatus('waitingForAccuracy');
      setTrackingMessage(`目前定位誤差約 ${Math.round(location.accuracyMeters)} 公尺，等精準到 100 公尺內再繼續停留判定。`);
    } else {
      setTrackingStatus('live');
      setTrackingMessage(null);
    }

    setActiveJourney((current) => {
      if (!current) return current;
      if (location.accuracyMeters !== null && location.accuracyMeters > 100) {
        return { ...current, distanceMeters: remainingDistance, lastDwellSampleAt: null };
      }
      const radius = arrivalRadiusMeters(location.accuracyMeters);
      const inside = remainingDistance <= radius;
      const nextDwell = advanceDwellState(
        {
          dwellMilliseconds: current.dwellMilliseconds ?? current.dwellSeconds * 1000,
          outsideSince: current.outsideSince ?? null,
          lastDwellSampleAt: current.lastDwellSampleAt ?? null,
        },
        inside,
        now,
      );

      return {
        ...current,
        distanceMeters: remainingDistance,
        dwellMilliseconds: nextDwell.dwellMilliseconds,
        dwellSeconds: Math.min(45, Math.floor(nextDwell.dwellMilliseconds / 1000)),
        outsideSince: nextDwell.outsideSince,
        lastDwellSampleAt: nextDwell.lastDwellSampleAt,
      };
    });
  };

  useEffect(() => {
    if (mode !== 'real' || phase !== 'active' || !candidate) return;
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
            setActiveJourney((current) =>
              current ? { ...current, steps: Math.max(current.steps, historical) } : current,
            );
          }
          if (!cancelled) {
            stepSubscription = watchSteps((liveSteps) => {
              setActiveJourney((current) =>
                current ? { ...current, steps: Math.max(current.steps, baseSteps + liveSteps) } : current,
              );
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
      if (nextState === 'active') {
        void start();
      } else {
        stop();
        setTrackingStatus('paused');
        setTrackingMessage('App 在背景時會暫停 GPS 與停留秒數；回到前景後會自動恢復，並嘗試補回 iPhone 步數。');
      }
    };

    const appStateSubscription = AppState.addEventListener('change', onAppStateChange);
    if (AppState.currentState === 'active') void start();

    return () => {
      cancelled = true;
      stop();
      appStateSubscription.remove();
    };
  }, [mode, phase, candidate?.id]);

  useEffect(() => {
    if (phase === 'active' && (activeJourney?.dwellSeconds ?? 0) >= 45) {
      setPhase('review');
      setTrackingStatus('idle');
      setTrackingMessage(null);
    }
  }, [phase, activeJourney?.dwellSeconds]);

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
          setSearchIssue({
            title: '需要「使用 App 期間」的位置權限',
            detail: '真實探索必須從你目前的 GPS 位置開始。拒絕後不會偷偷改用假位置。',
          });
          setPhase('permissionRequired');
          return;
        }
        const location = await getCurrentTrackedLocation();
        const nextOrigin = { latitude: location.latitude, longitude: location.longitude };
        setOrigin(nextOrigin);
        setCurrentLocation(location);
        pool = await searchNearbyDestinations(nextOrigin, nextDuration + 30);
      } catch (error) {
        const detail =
          error instanceof OverpassServiceError
            ? error.message
            : '無法取得目前位置。請確認 iPhone 定位與網路後再試一次。';
        setSearchIssue({
          title: '目前無法搜尋真實地點',
          detail: `${detail} 我們沒有改動你的時間、主題，也沒有切換成付費服務。`,
        });
        setPhase('serviceError');
        return;
      }
    }

    const resolvedPool = pool ?? [];
    setCandidatePool(resolvedPool);
    const results = eligibleDestinations(resolvedPool, nextDuration, nextTheme, nextExcludedIds);
    if (results.length === 0) {
      setCandidate(null);
      setSuggestions(
        noResultSuggestions(resolvedPool, nextDuration, nextTheme, nextExcludedIds),
      );
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
    let results = eligibleDestinations(candidatePool, durationMinutes, theme, nextExcludedIds);
    if (results.length === 0) {
      nextExcludedIds = [current.id];
      results = eligibleDestinations(candidatePool, durationMinutes, theme, nextExcludedIds);
    }
    const next = results[0] ?? null;
    if (!next && active) {
      setReplacementMessage('這組條件目前只有這一個可用地點。原任務、時間與步數都已保留。');
    }
    if (next) setExcludedIds(nextExcludedIds);
    return next;
  };

  const replaceCandidate = async () => {
    if (!candidate) return;
    const next = nextCandidateFromPool(candidate);
    if (next) {
      setCandidate(next);
      return;
    }
    await performSearch(durationMinutes, theme, [], mode === 'demo' ? destinations : undefined);
  };

  const addTimeAndSearch = async (minutes: 10 | 20 | 30) => {
    const nextDuration = durationMinutes + minutes;
    setDurationMinutes(nextDuration);
    await performSearch(nextDuration, theme, excludedIds, candidatePool);
  };

  const resetPreparation = () => {
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
    setPhase('preparation');
    setTab('explore');
  };

  const setMode = (nextMode: TrackingMode) => {
    if (['candidate', 'active', 'review', 'reward', 'searching'].includes(phase) || nextMode === mode) return;
    setModeState(nextMode);
    setCandidatePool(nextMode === 'demo' ? destinations : []);
    setOrigin(nextMode === 'demo' ? { latitude: 25.033, longitude: 121.5654 } : null);
    setCurrentLocation(null);
    setSearchIssue(null);
    setSuggestions([]);
    setExcludedIds([]);
  };

  const startJourney = async () => {
    if (!candidate) return;
    let nextMotionStatus: MotionStatus = 'available';
    if (mode === 'real') {
      nextMotionStatus = await requestMotionAccess();
      setMotionStatus(nextMotionStatus);
    }
    const now = Date.now();
    setActiveJourney({
      id: `journey-${now}`,
      startedAt: now,
      destinationId: candidate.id,
      steps: 0,
      distanceMeters: candidate.distanceMeters,
      dwellSeconds: 0,
      dwellMilliseconds: 0,
      lastDwellSampleAt: null,
      outsideSince: null,
      walkStage: 0,
      stepCaptureStartedAt: now,
      stepBonusAvailable: mode === 'demo' || nextMotionStatus === 'available',
    });
    setReview(emptyReview);
    setReplacementMessage(
      mode === 'real' && nextMotionStatus !== 'available'
        ? '步數權限未開啟或感測器不可用；GPS 探索仍可完成，抵達獎勵照常，這趟步數加成為 0。'
        : null,
    );
    setRevealed(false);
    setPhase('active');
  };

  const simulateWalk = () => {
    if (!candidate || mode !== 'demo') return;
    setActiveJourney((current) => {
      if (!current) return current;
      const nextStage = Math.min(current.walkStage + 1, 3);
      const distanceFactors = [1, 0.62, 0.28, 0.08];
      return {
        ...current,
        walkStage: nextStage,
        steps: current.steps + 720,
        distanceMeters: Math.max(
          55,
          Math.round(candidate.distanceMeters * (distanceFactors[nextStage] ?? 0.08)),
        ),
      };
    });
  };

  const simulateArrival = () => {
    if (mode !== 'demo') return;
    setActiveJourney((current) =>
      current
        ? {
            ...current,
            steps: Math.max(current.steps, 2450),
            distanceMeters: 55,
            dwellSeconds: 45,
            dwellMilliseconds: 45_000,
          }
        : current,
    );
    setPhase('review');
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
        const nextOrigin = { latitude: location.latitude, longitude: location.longitude };
        const nextPool = await searchNearbyDestinations(nextOrigin, durationMinutes + 30);
        setOrigin(nextOrigin);
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
    if (!nextCandidate && mode === 'demo') {
      nextCandidate = nextCandidateFromPool(candidate, true);
    }
    if (!nextCandidate) {
      setReplacementMessage('這組條件目前只有這一個可用地點。原任務、時間與步數都已保留。');
      return;
    }
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
    });
    setRevealed(false);
    setReplacementMessage('已換成新的神秘地點；已走步數與開始時間不變。');
  };

  const revealAndOpenMap = async () => {
    if (!candidate) return;
    setRevealed(true);
    const label = encodeURIComponent(candidate.internalName);
    const url = `https://maps.apple.com/?daddr=${candidate.latitude},${candidate.longitude}&q=${label}&dirflg=w`;
    try {
      await Linking.openURL(url);
    } catch {
      setReplacementMessage('無法開啟 Apple 地圖，但目的地名稱已安全揭曉。');
    }
  };

  const saveIncompleteJourney = () => {
    if (!activeJourney) return;
    const elapsedMinutes = Math.max(
      1,
      Math.round((Date.now() - activeJourney.startedAt) / 60000),
    );
    const record: JourneyRecord = {
      id: activeJourney.id,
      destinationName: candidate?.internalName ?? '未完成的探索',
      theme,
      endedAt: Date.now(),
      elapsedMinutes,
      steps: activeJourney.steps,
      mood: null,
      hasPhoto: false,
      note: '',
      earnedXP: 0,
      completed: false,
    };
    if (mode === 'real') setRealRecords((current) => [record, ...current]);
    else setDemoRecords((current) => [record, ...current]);
    resetPreparation();
  };

  const discardJourney = () => resetPreparation();
  const setMood = (mood: JourneyMood) => setReview((current) => ({ ...current, mood }));
  const setNote = (note: string) => setReview((current) => ({ ...current, note }));
  const togglePhoto = () =>
    setReview((current) => ({ ...current, hasPhoto: !current.hasPhoto }));

  const submitReview = () => {
    if (!activeJourney || !candidate || !review.mood) return;
    const xp = xpBreakdown(activeJourney.stepBonusAvailable === false ? 0 : activeJourney.steps);
    const completedCount = records.filter((item) => item.completed).length;
    const result = applyPetReward(pet, xp, completedCount, activeJourney.id);
    const elapsedMinutes = Math.max(
      1,
      Math.round((Date.now() - activeJourney.startedAt) / 60000),
    );
    const record: JourneyRecord = {
      id: activeJourney.id,
      destinationName: candidate.internalName,
      theme,
      endedAt: Date.now(),
      elapsedMinutes,
      steps: activeJourney.steps,
      mood: review.mood,
      hasPhoto: review.hasPhoto,
      note: review.note.trim(),
      earnedXP: xp.totalXP,
      completed: true,
    };
    if (mode === 'real') {
      setRealPet(result.pet);
      setRealRecords((current) => [record, ...current]);
    } else {
      setDemoPet(result.pet);
      setDemoRecords((current) => [record, ...current]);
    }
    setReward(result.reward);
    setPhase('reward');
  };

  const value: ExplorePathContextValue = {
    hydrated,
    mode,
    phase,
    tab,
    durationMinutes,
    theme,
    candidate,
    activeJourney,
    review,
    reward,
    pet,
    records,
    suggestions,
    replacementMessage,
    searchIssue,
    origin,
    currentLocation,
    heading,
    motionStatus,
    trackingStatus,
    trackingMessage,
    revealed,
    arrivalRadius,
    setTab,
    setMode,
    chooseDuration,
    chooseTheme,
    search,
    replaceCandidate,
    addTimeAndSearch,
    resetPreparation,
    startJourney,
    simulateWalk,
    simulateArrival,
    replaceActiveDestination,
    clearReplacementMessage: () => setReplacementMessage(null),
    revealAndOpenMap,
    saveIncompleteJourney,
    discardJourney,
    setMood,
    setNote,
    togglePhoto,
    submitReview,
    finishReward: resetPreparation,
  };

  return <ExplorePathContext.Provider value={value}>{children}</ExplorePathContext.Provider>;
}

export function useExplorePath() {
  const context = useContext(ExplorePathContext);
  if (!context) throw new Error('useExplorePath must be used inside ExplorePathProvider');
  return context;
}
