import { JourneyRecord, PetCollectionState, PetProfile, RewardSummary, XPBreakdown } from './types';
import { hasStageArt, isPetSeriesId, OwnedStage, petSeriesIds, seriesFor, stages, stageXP } from './petCatalog';

export const dayMilliseconds = 86_400_000;
export const moodDecayPerDay = 8, cleanlinessDecayPerDay = 12;
export const companionMoodGain = 12, cleanGain = 35, explorationMoodGain = 25;
export const careCooldownMilliseconds = dayMilliseconds;
export const departureCountdownMilliseconds = 3 * dayMilliseconds;
export const memoryDeadlineMilliseconds = 7 * dayMilliseconds;
export const itemRescueMilliseconds = dayMilliseconds;
export const careItemJourneyCount = 5, careItemCapacity = 3, matureEggJourneyCount = 10;
export const personalityMeta = {
  curious: { title: '好奇', detail: '喜歡注意路上的小小發現。' },
  relaxed: { title: '悠閒', detail: '喜歡照著自己的步調前進。' },
  lively: { title: '活潑', detail: '對下一個轉角充滿期待。' },
};
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const finite = (n: unknown, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
const count = (n: unknown) => Math.max(0, Math.floor(finite(n)));
const timestamp = (n: unknown): number | null => typeof n === 'number' && Number.isFinite(n) ? n : null;
const strings = (n: unknown): string[] => Array.isArray(n) ? n.filter((s): s is string => typeof s === 'string') : [];
const object = (n: unknown): n is Record<string, unknown> => !!n && typeof n === 'object' && !Array.isArray(n);

export function emptyPetCollection(): PetCollectionState {
  return { schemaVersion: 2, pets: [], activePetId: null, switchLock: null, careItems: 0,
    normalJourneysTowardCareItem: 0, matureJourneysTowardEgg: 0, seriesBag: [], nextPetSequence: 1,
    notificationsEnabled: false, notificationIds: [], legacyArchives: [], journeyBindings: {}, rewardLedger: {} };
}
function clone(c: PetCollectionState): PetCollectionState {
  return { ...c, pets: c.pets.map((p) => ({ ...p, sharedDestinationIds: [...p.sharedDestinationIds], stageHistory: p.stageHistory.map((s) => ({ ...s })) })),
    seriesBag: [...c.seriesBag], legacyArchives: [...c.legacyArchives], notificationIds: [...c.notificationIds],
    journeyBindings: Object.fromEntries(Object.entries(c.journeyBindings).map(([id, b]) => [id, { ...b }])), rewardLedger: { ...c.rewardLedger },
    switchLock: c.switchLock ? { ...c.switchLock } : null };
}
export function activePet(c: PetCollectionState): PetProfile | null { return c.pets.find((p) => p.id === c.activePetId) ?? null; }
export function profileStage(p: PetProfile | null) { return p?.stage ?? 'emptyRoom'; }
/** Legacy data is kept verbatim, not converted or assigned XP in the new system. */
export function migrateLegacyPet(value: unknown, now: number): PetCollectionState {
  const result = emptyPetCollection();
  if (object(value) && (value.hasEgg || (Array.isArray(value.pets) && value.pets.length))) result.legacyArchives.push({ archivedAt: now, data: value });
  return result;
}
export function normalizePetCollection(value: unknown, now: number): PetCollectionState {
  if (!object(value) || value.schemaVersion !== 2) return migrateLegacyPet(value, now);
  const result = emptyPetCollection(), seen = new Set<string>(), rejected: unknown[] = [];
  for (const raw of Array.isArray(value.pets) ? value.pets : []) {
    if (!object(raw) || typeof raw.id !== 'string' || !isPetSeriesId(raw.seriesId) || seen.has(raw.id)) { rejected.push(raw); continue; }
    seen.add(raw.id);
    const stage = stages.includes(raw.stage as OwnedStage) ? raw.stage as OwnedStage : 'egg';
    const createdAt = finite(raw.createdAt, now);
    const history = Array.isArray(raw.stageHistory) ? raw.stageHistory.filter(object) : [];
    result.pets.push({ id: raw.id, seriesId: raw.seriesId, stage,
      stageHistory: stages.slice(0, stages.indexOf(stage) + 1).map((s) => ({ stage: s, unlockedAt: finite(history.find((h) => h.stage === s)?.unlockedAt, createdAt) })),
      nickname: typeof raw.nickname === 'string' && raw.nickname.trim() ? Array.from(raw.nickname.trim()).slice(0, 16).join('') : seriesFor(raw.seriesId)!.name,
      personality: ['curious', 'relaxed', 'lively'].includes(String(raw.personality)) ? raw.personality as PetProfile['personality'] : 'curious',
      experience: count(raw.experience), sharedSteps: count(raw.sharedSteps), mood: clamp(finite(raw.mood, 100)), cleanliness: clamp(finite(raw.cleanliness, 100)),
      lifecycle: ['available', 'countdown', 'departed', 'rescuing', 'memory'].includes(String(raw.lifecycle)) ? raw.lifecycle as PetProfile['lifecycle'] : 'available',
      createdAt, lastNeedsUpdatedAt: Math.min(now, finite(raw.lastNeedsUpdatedAt, now)),
      lastCompanionAt: timestamp(raw.lastCompanionAt), lastCleanedAt: timestamp(raw.lastCleanedAt), countdownStartedAt: timestamp(raw.countdownStartedAt),
      departedAt: timestamp(raw.departedAt), rescueReadyAt: timestamp(raw.rescueReadyAt), memoryAt: timestamp(raw.memoryAt),
      sharedDestinationIds: [...new Set(strings(raw.sharedDestinationIds))], sharedJourneyCount: count(raw.sharedJourneyCount) });
  }
  result.activePetId = typeof value.activePetId === 'string' && seen.has(value.activePetId) ? value.activePetId : null;
  if (object(value.switchLock) && value.switchLock.activePetId === result.activePetId && result.activePetId) result.switchLock = {
    activePetId: result.activePetId, previousPetId: typeof value.switchLock.previousPetId === 'string' && seen.has(value.switchLock.previousPetId) ? value.switchLock.previousPetId : null,
    switchedAt: finite(value.switchLock.switchedAt, now), undoAvailable: value.switchLock.undoAvailable === true };
  result.careItems = Math.min(3, count(value.careItems)); result.normalJourneysTowardCareItem = count(value.normalJourneysTowardCareItem) % 5;
  result.matureJourneysTowardEgg = count(value.matureJourneysTowardEgg) % 10;
  result.seriesBag = [...new Set(strings(value.seriesBag).filter(isPetSeriesId))];
  result.nextPetSequence = Math.max(1, count(value.nextPetSequence), result.pets.length + 1);
  result.notificationsEnabled = value.notificationsEnabled === true; result.notificationIds = strings(value.notificationIds);
  result.legacyArchives = Array.isArray(value.legacyArchives) ? value.legacyArchives.filter(object).map((a) => ({ archivedAt: finite(a.archivedAt, now), data: a.data })) : [];
  if (rejected.length) result.legacyArchives.push({ archivedAt: now, data: { unrecognizedPets: rejected } });
  if (object(value.journeyBindings)) for (const [id, b] of Object.entries(value.journeyBindings)) {
    if (object(b)) result.journeyBindings[id] = { petId: typeof b.petId === 'string' && seen.has(b.petId) ? b.petId : null, qualifiedForEgg: b.qualifiedForEgg === true,
      startedAt: finite(b.startedAt, now), ended: b.ended === true };
  }
  if (object(value.rewardLedger)) for (const [id, r] of Object.entries(value.rewardLedger)) {
    if (object(r) && r.journeyId === id && object(r.xp) && typeof r.appliedPetXP === 'number') result.rewardLedger[id] = r as unknown as RewardSummary;
  }
  return settlePetCollection(result, now);
}
export function advancePet(p: PetProfile, now: number, ready = hasStageArt): PetProfile {
  const next = { ...p, stageHistory: [...p.stageHistory] };
  for (const stage of stages.slice(stages.indexOf(p.stage) + 1)) {
    if (p.experience < stageXP[stage] || !ready(p.seriesId, stage)) break;
    if (next.stage === 'egg') next.lastNeedsUpdatedAt = now;
    next.stage = stage;
    if (!next.stageHistory.some((h) => h.stage === stage)) next.stageHistory.push({ stage, unlockedAt: now });
  }
  return next;
}
function restore(p: PetProfile, now: number) {
  p.lifecycle = 'available'; p.mood = Math.max(40, p.mood); p.cleanliness = Math.max(35, p.cleanliness);
  p.countdownStartedAt = null; p.departedAt = null; p.rescueReadyAt = null; p.memoryAt = null; p.lastNeedsUpdatedAt = now;
}
function settleLifecycle(p: PetProfile, now: number) {
  if (p.lifecycle === 'rescuing') { if (p.rescueReadyAt != null && now >= p.rescueReadyAt) restore(p, now); return; }
  if (p.lifecycle === 'memory') return;
  if (p.lifecycle === 'departed') {
    if (p.departedAt != null && now >= p.departedAt + memoryDeadlineMilliseconds) { p.lifecycle = 'memory'; p.memoryAt = p.departedAt + memoryDeadlineMilliseconds; } return;
  }
  if (p.stage === 'egg') { p.lastNeedsUpdatedAt = now; return; }
  const elapsed = Math.max(0, now - p.lastNeedsUpdatedAt), zeroAt = p.lastNeedsUpdatedAt + p.mood / moodDecayPerDay * dayMilliseconds;
  p.mood = clamp(p.mood - elapsed / dayMilliseconds * moodDecayPerDay);
  p.cleanliness = clamp(p.cleanliness - elapsed / dayMilliseconds * cleanlinessDecayPerDay);
  p.lastNeedsUpdatedAt = Math.max(now, p.lastNeedsUpdatedAt);
  if (p.mood <= 0) {
    p.countdownStartedAt ??= Math.min(now, zeroAt); p.lifecycle = 'countdown';
    if (now >= p.countdownStartedAt + departureCountdownMilliseconds) {
      p.departedAt = p.countdownStartedAt + departureCountdownMilliseconds; p.lifecycle = 'departed';
      if (now >= p.departedAt + memoryDeadlineMilliseconds) { p.lifecycle = 'memory'; p.memoryAt = p.departedAt + memoryDeadlineMilliseconds; }
    }
  }
}
export function settlePetCollection(c: PetCollectionState, now: number): PetCollectionState {
  const next = clone(c); next.pets = next.pets.map((p) => advancePet(p, now)); const p = activePet(next);
  if (p) { settleLifecycle(p, now); if (p.lifecycle === 'memory') { next.activePetId = null; next.switchLock = null; } }
  return next;
}
export function remainingCooldown(last: number | null, now: number) { return last == null ? 0 : Math.max(0, last + dayMilliseconds - now); }
function result(collection: PetCollectionState, ok: boolean, message: string) { return { collection, ok, message }; }
function traveling(c: PetCollectionState) { return Object.values(c.journeyBindings).some((b) => !b.ended); }
export function bindPetJourney(c: PetCollectionState, id: string, now: number): PetCollectionState {
  if (c.journeyBindings[id]) return c;
  const next = settlePetCollection(c, now), p = activePet(next);
  next.journeyBindings[id] = { petId: p?.id ?? null, qualifiedForEgg: !!p && p.experience >= 3000 && ['available', 'countdown'].includes(p.lifecycle), startedAt: now };
  if (next.switchLock) next.switchLock.undoAvailable = false; return next;
}
export function endPetJourney(c: PetCollectionState, id: string): PetCollectionState {
  if (!c.journeyBindings[id] || c.journeyBindings[id].ended) return c;
  const next = clone(c); next.journeyBindings[id]!.ended = true; return next;
}
/** Call only after an authoritative cloud snapshot; preserve the current room for settlement. */
export function reconcileTeamPetJourneys(c: PetCollectionState, retainedId: string | null): PetCollectionState {
  let next = c;
  for (const [id, binding] of Object.entries(c.journeyBindings)) {
    if (id.startsWith('team-') && id !== retainedId && !binding.ended) next = endPetJourney(next, id);
  }
  return next;
}
export function switchActivePet(c: PetCollectionState, id: string, now: number) {
  const next = settlePetCollection(c, now), current = activePet(next), chosen = next.pets.find((p) => p.id === id);
  if (traveling(next) || next.switchLock || (current && current.lifecycle !== 'available')) return result(next, false, '旅程或照顧狀態尚未解除，暫時不能切換。');
  if (!chosen || chosen.lifecycle !== 'available' || chosen.id === current?.id) return result(next, false, '請選擇另一位可同行夥伴。');
  chosen.lastNeedsUpdatedAt = now; next.activePetId = id;
  next.switchLock = { activePetId: id, previousPetId: current?.id ?? null, switchedAt: now, undoAvailable: !!current };
  return result(next, true, '已切換；完成一次一般探索後可再次切換。出發前可撤回一次。');
}
export function undoActivePetSwitch(c: PetCollectionState, now: number) {
  const next = settlePetCollection(c, now), current = activePet(next), lock = next.switchLock, previous = next.pets.find((p) => p.id === lock?.previousPetId);
  if (traveling(next) || !lock?.undoAvailable || !previous || previous.lifecycle !== 'available' || current?.lifecycle !== 'available') return result(next, false, '目前不能撤回切換。');
  next.activePetId = previous.id; previous.lastNeedsUpdatedAt = now; next.switchLock = { ...lock, activePetId: previous.id, undoAvailable: false };
  return result(next, true, '已撤回；仍須完成一次一般探索才能再次切換。');
}
export function renamePet(c: PetCollectionState, id: string, name: string) {
  const next = clone(c), p = next.pets.find((p) => p.id === id), nickname = Array.from(name.trim()).slice(0, 16).join('');
  if (!p || !nickname) return result(next, false, '請輸入 1–16 字的暱稱。');
  p.nickname = nickname; return result(next, true, '暱稱已儲存。');
}
function care(c: PetCollectionState, now: number, clean: boolean) {
  const next = settlePetCollection(c, now), p = activePet(next);
  if (!p || p.stage === 'egg' || !['available', 'countdown'].includes(p.lifecycle)) return result(next, false, '只有已孵化且在身邊的夥伴可以照顧；蛋不消耗心情與清潔。');
  if (remainingCooldown(clean ? p.lastCleanedAt : p.lastCompanionAt, now)) return result(next, false, '這項照顧需要間隔 24 小時，另一項照顧獨立計時。');
  if (clean) { p.cleanliness = clamp(p.cleanliness + cleanGain); p.lastCleanedAt = now; }
  else { p.mood = clamp(p.mood + companionMoodGain); p.lastCompanionAt = now; p.lifecycle = 'available'; p.countdownStartedAt = null; }
  return result(next, true, clean ? '清潔 +35；清潔不會解除離家倒數。' : '心情 +12，謝謝你的陪伴。');
}
export const companionPet = (c: PetCollectionState, now: number) => care(c, now, false);
export const cleanPet = (c: PetCollectionState, now: number) => care(c, now, true);
export function createEgg(c: PetCollectionState, now: number, random = Math.random): PetProfile {
  if (!c.seriesBag.length) {
    c.seriesBag = [...petSeriesIds];
    for (let i = c.seriesBag.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
      [c.seriesBag[i], c.seriesBag[j]] = [c.seriesBag[j]!, c.seriesBag[i]!];
    }
  }
  const seriesId = c.seriesBag.shift()!, id = `pet-${c.nextPetSequence++}-${now}`;
  const p: PetProfile = { id, seriesId, stage: 'egg', stageHistory: [{ stage: 'egg', unlockedAt: now }], nickname: seriesFor(seriesId)!.name,
    personality: (['curious', 'relaxed', 'lively'] as const)[Math.min(2, Math.max(0, Math.floor(random() * 3)))]!, experience: 0,
    mood: 100, cleanliness: 100, lifecycle: 'available', createdAt: now, lastNeedsUpdatedAt: now, lastCompanionAt: null, lastCleanedAt: null,
    countdownStartedAt: null, departedAt: null, rescueReadyAt: null, memoryAt: null, sharedDestinationIds: [], sharedJourneyCount: 0, sharedSteps: 0 };
  c.pets.push(p); if (!c.activePetId) c.activePetId = id; return p;
}
/** Only a successfully completed, self-participating NORMAL journey may call this. */
export function applyNormalJourneyReward(c: PetCollectionState, xp: XPBreakdown, id: string, destinationId: string, now: number, validSteps = 0) {
  if (c.rewardLedger[id]) return { collection: c, reward: c.rewardLedger[id]! };
  const next = settlePetCollection(c, now), binding = next.journeyBindings[id];
  const p = binding ? next.pets.find((p) => p.id === binding.petId) : undefined;
  const reward: RewardSummary = { journeyId: id, xp, appliedPetXP: 0, petEvent: 'noCompanion', previousStage: profileStage(p ?? null), nextStage: profileStage(p ?? null) };
  if (!binding || binding.ended) return { collection: next, reward };
  binding.ended = true;
  if (++next.normalJourneysTowardCareItem >= 5) { next.normalJourneysTowardCareItem = 0; if (next.careItems < 3) { next.careItems++; reward.careItemAwarded = true; } }
  if ((!p || p.lifecycle === 'memory') && !next.pets.some((p) => p.lifecycle !== 'memory')) {
    const egg = createEgg(next, now); reward.petId = egg.id; reward.petEvent = 'foundEgg'; reward.nextStage = 'egg';
    egg.sharedJourneyCount = 1; egg.sharedSteps = count(validSteps); egg.sharedDestinationIds = destinationId ? [destinationId] : [];
  } else if (p && ['available', 'countdown'].includes(p.lifecycle)) {
    reward.petId = p.id; reward.appliedPetXP = Math.min(150, count(xp.totalXP)); p.experience += reward.appliedPetXP;
    p.sharedJourneyCount++; p.sharedSteps += count(validSteps);
    if (destinationId && !p.sharedDestinationIds.includes(destinationId)) p.sharedDestinationIds.push(destinationId);
    if (p.stage !== 'egg') { p.mood = clamp(p.mood + explorationMoodGain); p.lifecycle = 'available'; p.countdownStartedAt = null; }
    const advanced = advancePet(p, now); next.pets[next.pets.findIndex((item) => item.id === p.id)] = advanced;
    reward.nextStage = advanced.stage;
    reward.petEvent = p.stage !== advanced.stage ? p.stage === 'egg' ? 'hatched' : 'evolved' : p.stage === 'egg' ? 'eggProgressed' : 'progressed';
    if (next.switchLock?.activePetId === p.id) next.switchLock = null;
    if (binding.qualifiedForEgg && ++next.matureJourneysTowardEgg >= 10) { next.matureJourneysTowardEgg = 0; createEgg(next, now); reward.newEggFound = true; }
  }
  next.rewardLedger[id] = reward; return { collection: next, reward };
}
export function beginItemRescue(c: PetCollectionState, now: number) {
  const next = settlePetCollection(c, now), p = activePet(next);
  if (!p || p.lifecycle !== 'departed' || !next.careItems) return result(next, false, '需要一位仍在 7 天尋回期限內的夥伴，以及一個照顧道具。');
  next.careItems--; p.lifecycle = 'rescuing'; p.rescueReadyAt = now + dayMilliseconds; return result(next, true, '道具已使用，24 小時後夥伴會回來。');
}
export function completeRescueJourney(c: PetCollectionState, id: string, now: number) {
  const next = settlePetCollection(c, now), p = next.pets.find((p) => p.id === id);
  if (!p || !['departed', 'rescuing'].includes(p.lifecycle)) return result(next, false, '尋回期限已結束，或夥伴已在身邊。旅程仍會保存為健康紀錄。');
  restore(p, now); next.activePetId = id; return result(next, true, '你們再次相遇了。經驗與共同回憶完整保留；尋回不增加一般探索獎勵。');
}
export function revivePetFromSeasonalPromise(c: PetCollectionState, id: string, now: number) {
  const next = settlePetCollection(c, now), p = next.pets.find((p) => p.id === id);
  if (!p || !['departed', 'memory'].includes(p.lifecycle)) return result(next, false, '這位夥伴目前不需要重逢信物。');
  restore(p, now); if (!next.activePetId) next.activePetId = id; return result(next, true, '重逢成功，原本的經驗與回憶仍在。');
}
export function sharedRescueRecords(records: JourneyRecord[], id: string) {
  return records.filter((r) => r.petId === id && r.completed && r.kind !== 'rescue' && typeof r.destinationLatitude === 'number' && typeof r.destinationLongitude === 'number');
}
