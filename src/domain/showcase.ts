import {
  JourneyRecord,
  PetCollectionState,
  PetLifecycle,
  PetPersonality,
  PetProfile,
  PetVisualId,
} from './types';
import { growingXP, matureXP } from './rules';
import { dayMilliseconds, emptyPetCollection } from './petRules';
import { monthKey } from './memories';
import { hasStageArt } from './petCatalog';

export type ShowcaseScenario =
  | 'preparation'
  | 'candidate'
  | 'active'
  | 'arrival'
  | 'review'
  | 'reward'
  | 'petEgg'
  | 'petJuvenile'
  | 'petGrowing'
  | 'petMature'
  | 'petCountdown'
  | 'petDeparted'
  | 'petRescuing'
  | 'petMemory'
  | 'petCollection'
  | 'petSwitchReady'
  | 'memories'
  | 'backup'
  | 'permissionDenied'
  | 'noResults'
  | 'serviceError'
  | 'invalidBackup'
  | 'noPhotoShare'
  | 'petSwitchLocked'
  | 'petSwitchUndo'
  | 'rescueExpired'
  | 'stepsPartial'
  | 'journeyUnreached'
  | 'stepsUnavailable'
  | 'stepsExcluded'
  | 'journeyRecovery'
  | 'seasonalPending';

export interface ShowcaseSeedData {
  petCollection: PetCollectionState;
  records: JourneyRecord[];
  usedMicroTaskIds: string[];
  featuredMemoryByMonth: Record<string, string>;
  clockOffsetMilliseconds: number;
}

function pet(input: {
  id: string;
  visualId: PetVisualId;
  nickname: string;
  personality: PetPersonality;
  experience: number;
  mood?: number;
  cleanliness?: number;
  lifecycle?: PetLifecycle;
  createdAt: number;
  lastNeedsUpdatedAt?: number;
  countdownStartedAt?: number | null;
  departedAt?: number | null;
  rescueReadyAt?: number | null;
  memoryAt?: number | null;
  destinations?: string[];
}): PetProfile {
  return {
    id: input.id,
    seriesId: input.visualId,
    stage: input.experience >= 300 && hasStageArt(input.visualId, 'juvenile') ? 'juvenile' : 'egg',
    stageHistory: [{ stage: 'egg', unlockedAt: input.createdAt }, ...(input.experience >= 300 && hasStageArt(input.visualId, 'juvenile') ? [{ stage: 'juvenile' as const, unlockedAt: input.createdAt }] : [])],
    sharedSteps: 0,
    nickname: input.nickname,
    personality: input.personality,
    experience: input.experience,
    mood: input.mood ?? 82,
    cleanliness: input.cleanliness ?? 74,
    lifecycle: input.lifecycle ?? 'available',
    createdAt: input.createdAt,
    lastNeedsUpdatedAt: input.lastNeedsUpdatedAt ?? input.createdAt,
    lastCompanionAt: null,
    lastCleanedAt: null,
    countdownStartedAt: input.countdownStartedAt ?? null,
    departedAt: input.departedAt ?? null,
    rescueReadyAt: input.rescueReadyAt ?? null,
    memoryAt: input.memoryAt ?? null,
    sharedDestinationIds: input.destinations ?? [],
    sharedJourneyCount: input.destinations?.length ?? 0,
  };
}

function record(input: {
  id: string;
  destinationName: string;
  destinationId: string;
  theme: JourneyRecord['theme'];
  endedAt: number;
  steps: number;
  mood: JourneyRecord['mood'];
  petId: string;
  note: string;
  kind?: JourneyRecord['kind'];
  outcome?: JourneyRecord['outcome'];
  stepStatus?: JourneyRecord['stepStatus'];
  task?: string;
}): JourneyRecord {
  return {
    id: input.id,
    destinationName: input.destinationName,
    theme: input.theme,
    endedAt: input.endedAt,
    elapsedMinutes: 34,
    steps: input.steps,
    mood: input.mood,
    hasPhoto: false,
    memoryHidden: false,
    note: input.note,
    earnedXP: input.kind === 'rescue' || input.outcome === 'unreached' ? 0 : 124,
    completed: input.outcome !== 'unreached',
    outcome: input.outcome ?? 'arrived',
    stepStatus: input.stepStatus ?? 'complete',
    destinationRevealed: input.outcome !== 'unreached',
    microTaskTitle: input.task ?? '找到一個帶著歲月痕跡的招牌',
    microTaskType: input.kind === 'rescue' ? undefined : 'observation',
    microTaskResponse: input.kind === 'rescue' ? undefined : '我注意到招牌褪色後留下的藍綠色。',
    microTaskCompleted: input.kind !== 'rescue',
    kind: input.kind ?? 'normal',
    petId: input.petId,
    destinationId: input.destinationId,
    destinationLatitude: 25.033,
    destinationLongitude: 121.5654,
  };
}

export function createShowcaseSeed(now = Date.now()): ShowcaseSeedData {
  const pets: PetProfile[] = [
    pet({
      id: 'showcase-egg',
      visualId: 'porcelain',
      nickname: '晨光蛋',
      personality: 'curious',
      experience: 120,
      createdAt: now - 3 * dayMilliseconds,
      lastNeedsUpdatedAt: now,
    }),
    pet({
      id: 'showcase-juvenile',
      visualId: 'thought',
      nickname: '小焰',
      personality: 'lively',
      experience: 520,
      createdAt: now - 18 * dayMilliseconds,
      lastNeedsUpdatedAt: now,
      destinations: ['food-01'],
    }),
    pet({
      id: 'showcase-growing',
      visualId: 'water',
      nickname: '小波',
      personality: 'relaxed',
      experience: growingXP + 260,
      createdAt: now - 45 * dayMilliseconds,
      lastNeedsUpdatedAt: now,
      destinations: ['nature-01', 'nature-02'],
    }),
    pet({
      id: 'showcase-mature',
      visualId: 'pebble',
      nickname: '墨墨',
      personality: 'curious',
      experience: matureXP + 860,
      mood: 88,
      cleanliness: 71,
      createdAt: now - 100 * dayMilliseconds,
      lastNeedsUpdatedAt: now,
      destinations: ['architecture-01', 'architecture-02', 'nature-01'],
    }),
    pet({
      id: 'showcase-countdown',
      visualId: 'frosted',
      nickname: '晚霞',
      personality: 'relaxed',
      experience: matureXP,
      mood: 0,
      cleanliness: 24,
      lifecycle: 'countdown',
      countdownStartedAt: now - 6 * 60 * 60 * 1000,
      createdAt: now - 130 * dayMilliseconds,
      lastNeedsUpdatedAt: now,
      destinations: ['food-02'],
    }),
    pet({
      id: 'showcase-departed',
      visualId: 'marble',
      nickname: '漣漪',
      personality: 'lively',
      experience: matureXP + 240,
      mood: 0,
      cleanliness: 18,
      lifecycle: 'departed',
      departedAt: now - 2 * dayMilliseconds,
      createdAt: now - 170 * dayMilliseconds,
      lastNeedsUpdatedAt: now,
      destinations: ['nature-02', 'architecture-02'],
    }),
    pet({
      id: 'showcase-rescuing',
      visualId: 'brass',
      nickname: '暖暖',
      personality: 'curious',
      experience: 1800,
      mood: 12,
      cleanliness: 20,
      lifecycle: 'rescuing',
      rescueReadyAt: now + 18 * 60 * 60 * 1000,
      departedAt: now - dayMilliseconds,
      createdAt: now - 80 * dayMilliseconds,
      lastNeedsUpdatedAt: now,
      destinations: ['food-01'],
    }),
    pet({
      id: 'showcase-memory',
      visualId: 'voyager',
      nickname: '星塵',
      personality: 'relaxed',
      experience: matureXP + 1200,
      mood: 0,
      cleanliness: 0,
      lifecycle: 'memory',
      departedAt: now - 12 * dayMilliseconds,
      memoryAt: now - 5 * dayMilliseconds,
      createdAt: now - 240 * dayMilliseconds,
      lastNeedsUpdatedAt: now,
      destinations: ['architecture-03'],
    }),
  ];

  const records = [
    record({ id: 'showcase-record-01', destinationName: '松菸生態池', destinationId: 'nature-01', theme: 'nature', endedAt: now - 2 * dayMilliseconds, steps: 3260, mood: 'calm', petId: 'showcase-mature', note: '風穿過樹葉的聲音，比目的地更讓我記得。' }),
    record({ id: 'showcase-record-02', destinationName: '四四南村', destinationId: 'architecture-02', theme: 'architecture', endedAt: now - 8 * dayMilliseconds, steps: 2840, mood: 'curious', petId: 'showcase-mature', note: '第一次注意到矮房和城市天際線放在一起的反差。' }),
    record({ id: 'showcase-record-03', destinationName: '中強公園', destinationId: 'nature-02', theme: 'nature', endedAt: now - 16 * dayMilliseconds, steps: 4120, mood: 'happy', petId: 'showcase-departed', note: '沒有特別趕路，卻不知不覺走了很多步。' }),
    record({ id: 'showcase-record-04', destinationName: '信義公民會館', destinationId: 'architecture-01', theme: 'architecture', endedAt: now - 39 * dayMilliseconds, steps: 2380, mood: 'surprised', petId: 'showcase-juvenile', note: '轉進巷子後，城市忽然變得很安靜。' }),
    record({ id: 'showcase-record-05', destinationName: '巷口豆花', destinationId: 'food-01', theme: 'food', endedAt: now - 47 * dayMilliseconds, steps: 1980, mood: 'happy', petId: 'showcase-juvenile', note: '只是想散步，最後得到一份剛剛好的甜味。' }),
    record({ id: 'showcase-record-06', destinationName: '再次相遇・中強公園', destinationId: 'nature-02', theme: 'nature', endedAt: now - 55 * dayMilliseconds, steps: 3550, mood: null, petId: 'showcase-departed', note: '尋回探索完成', kind: 'rescue' }),
    record({ id: 'showcase-record-07', destinationName: '臺北市政大樓公共藝術', destinationId: 'architecture-03', theme: 'architecture', endedAt: now - 76 * dayMilliseconds, steps: 4420, mood: 'tired', petId: 'showcase-memory', note: '走累了，但找到平常不會停下來看的作品。' }),
    record({ id: 'showcase-record-08', destinationName: '永吉路米粉湯', destinationId: 'food-02', theme: 'food', endedAt: now - 84 * dayMilliseconds, steps: 3780, mood: 'curious', petId: 'showcase-countdown', note: '跟著市場的聲音找到一條新的路。' }),
    record({ id: 'showcase-record-partial', destinationName: '河濱轉角', destinationId: 'nature-partial', theme: 'nature', endedAt: now - 4 * dayMilliseconds, steps: 1680, mood: 'calm', petId: 'showcase-mature', note: '背景復原只取得部分步數。', stepStatus: 'partial' }),
    record({ id: 'showcase-record-unreached', destinationName: '尚未揭曉的目的地', destinationId: 'food-unreached', theme: 'food', endedAt: now - 5 * dayMilliseconds, steps: 920, mood: 'tired', petId: 'showcase-mature', note: '今天先走到這裡。', outcome: 'unreached' }),
    record({ id: 'showcase-record-unavailable', destinationName: '街角小公園', destinationId: 'nature-unavailable', theme: 'nature', endedAt: now - 10 * dayMilliseconds, steps: 0, mood: 'happy', petId: 'showcase-mature', note: '本趟沒有取得動作資料。', stepStatus: 'unavailable' }),
    record({ id: 'showcase-record-excluded', destinationName: '老屋立面', destinationId: 'architecture-excluded', theme: 'architecture', endedAt: now - 12 * dayMilliseconds, steps: 6430, mood: 'curious', petId: 'showcase-mature', note: '使用者標記此步數不準確。', stepStatus: 'excluded' }),
  ];

  const currentMonth = monthKey(records[0]?.endedAt ?? now);
  return {
    petCollection: {
      ...emptyPetCollection(),
      pets,
      activePetId: 'showcase-mature',
      switchLock: null,
      careItems: 3,
      normalJourneysTowardCareItem: 4,
      matureJourneysTowardEgg: 9,
      nextPetSequence: 9,
      notificationsEnabled: false,
      notificationIds: [],
    },
    records,
    usedMicroTaskIds: ['nature-observation-01', 'architecture-observation-01'],
    featuredMemoryByMonth: { [currentMonth]: records[0]?.id ?? '' },
    clockOffsetMilliseconds: 0,
  };
}
