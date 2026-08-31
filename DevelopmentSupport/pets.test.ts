import assert from 'node:assert/strict';
import test from 'node:test';
import { URL } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { PetCollectionState, PetProfile } from '../src/domain/types';
import { advancePet, activePet, applyNormalJourneyReward, beginItemRescue, bindPetJourney, cleanPet, companionPet, completeRescueJourney, createEgg, dayMilliseconds as day, emptyPetCollection, endPetJourney, migrateLegacyPet, normalizePetCollection, remainingCooldown, renamePet, revivePetFromSeasonalPromise, settlePetCollection, switchActivePet, undoActivePetSwitch } from '../src/domain/petRules';
import { hasStageArt, petCatalog, petSeriesIds, unlockedStories } from '../src/domain/petCatalog';
import { publicPetDisplay, publicPetStory } from '../src/domain/petDisplay';
import { reconcileTeamPetJourneys } from '../src/domain/petRules';
import { xpBreakdown } from '../src/domain/rules';
import { createBackupPayload, parseBackupPayload } from '../src/domain/backupFormat';
import { defaultHealthProfile } from '../src/domain/health';
import { emptySeasonalPromise } from '../src/domain/seasonalPromise';

const now = Date.UTC(2026, 7, 31);
test('authoritative room reconciliation ends orphan team bindings without rewarding or closing solo/current settlement', () => {
  let c = bindPetJourney(seed(300), 'solo', now);
  c = bindPetJourney(bindPetJourney(c, 'team-old', now), 'team-current', now);
  const next = reconcileTeamPetJourneys(c, 'team-current');
  assert.equal(next.journeyBindings['team-old']!.ended, true);
  assert.notEqual(next.journeyBindings['team-current']!.ended, true);
  assert.notEqual(next.journeyBindings.solo!.ended, true);
  assert.equal(next.pets[0]!.experience, 300);
  assert.deepEqual(next.rewardLedger, {});
  assert.equal(reconcileTeamPetJourneys(next, 'team-current'), next);
});
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function seed(xp = 0, series: PetProfile['seriesId'] = 'water'): PetCollectionState {
  const c = emptyPetCollection(); c.seriesBag = [series]; createEgg(c, now, () => 0); c.pets[0]!.experience = xp;
  return settlePetCollection(c, now);
}
function success(c: PetCollectionState, id = 'trip', steps = 1000, at = now) {
  return applyNormalJourneyReward(bindPetJourney(c, id, at), xpBreakdown(steps), id, 'place', at, steps);
}
test('12 independent series, 12 eggs and exactly 8 supplied juvenile assets', () => {
  assert.equal(new Set(petSeriesIds).size, 12); assert.equal(petCatalog.filter((p) => hasStageArt(p.id, 'juvenile')).length, 8);
  for (const series of petCatalog) {
    assert.ok(existsSync(new URL(`../assets/pets/${series.id}/egg.jpg`, import.meta.url)));
    assert.equal(existsSync(new URL(`../assets/pets/${series.id}/juvenile.jpg`, import.meta.url)), hasStageArt(series.id, 'juvenile'));
    assert.equal(hasStageArt(series.id, 'growing'), false); assert.equal(hasStageArt(series.id, 'mature'), false);
  }
});
test('new first success awards a zero-XP egg; next success awards only own 110 XP', () => {
  const first = success(emptyPetCollection()); assert.equal(first.reward.petEvent, 'foundEgg'); assert.equal(first.reward.appliedPetXP, 0);
  assert.equal(activePet(first.collection)!.experience, 0);
  const second = success(first.collection, 'second'); assert.equal(second.reward.appliedPetXP, 110); assert.equal(activePet(second.collection)!.experience, 110);
});
test('XP boundaries are 100 per arrival plus floor(steps/100), capped at150', () => {
  for (const [steps, xp] of [[0,100],[99,100],[100,101],[1000,110],[5000,150],[99999,150]]) assert.equal(xpBreakdown(steps!).totalXP, xp);
});
test('missing juvenile art retains egg and uncapped experience', () => {
  const c = success(seed(10000, 'cloud')).collection; assert.equal(activePet(c)!.stage, 'egg'); assert.equal(activePet(c)!.experience, 10110);
  assert.equal(unlockedStories(activePet(c)!).length, 1);
});
test('available juvenile hatches at300; missing growing art holds XP at1290', () => {
  assert.equal(activePet(success(seed(190)).collection)!.stage, 'juvenile');
  const c = success(seed(1180)).collection; assert.equal(activePet(c)!.experience, 1290); assert.equal(activePet(c)!.stage, 'juvenile');
});
test('contiguous assets required: juvenile+mature cannot skip growing', () => {
  const egg = seed(0).pets[0]!; egg.experience = 3200;
  const waiting = advancePet(egg, now, (_id, stage) => stage !== 'growing');
  assert.equal(waiting.stage, 'juvenile'); assert.equal(waiting.stageHistory.length, 2);
  const evolved = advancePet(waiting, now, () => true); assert.equal(evolved.stage, 'mature'); assert.equal(evolved.experience, 3200);
  assert.equal(evolved.stageHistory.length, 4); assert.deepEqual(advancePet(evolved, now + day, () => true).stageHistory, evolved.stageHistory);
});
test('temporary asset failure never downgrades an unlocked pet', () => {
  const pet = seed(600).pets[0]!; assert.equal(advancePet(pet, now, () => false).stage, 'juvenile');
});
test('normal reward ledger survives reopening and blocks duplicated XP/items/eggs', () => {
  const first = success(seed(3000)); const snapshot = JSON.stringify(first.collection);
  const second = applyNormalJourneyReward(normalizePetCollection(JSON.parse(snapshot), now), xpBreakdown(99999), 'trip', 'other', now);
  assert.equal(second.reward.appliedPetXP, 110); assert.deepEqual(second.collection, JSON.parse(snapshot));
});
test('historical unbound arrivals and ended/removed journeys do not earn rewards', () => {
  const c = seed(); assert.equal(applyNormalJourneyReward(c, xpBreakdown(1000), 'old', '', now).reward.appliedPetXP, 0);
  const ended = endPetJourney(bindPetJourney(c, 'kicked', now), 'kicked');
  const result = applyNormalJourneyReward(ended, xpBreakdown(1000), 'kicked', '', now);
  assert.equal(result.collection.normalJourneysTowardCareItem, 0); assert.equal(result.collection.pets[0]!.experience, 0);
});
test('reward recipient is bound to start, not whoever is active at completion', () => {
  let c = seed(); const original = c.activePetId; createEgg(c, now + 1); c = bindPetJourney(c, 'fixed', now);
  c.activePetId = c.pets[1]!.id;
  const r = applyNormalJourneyReward(c, xpBreakdown(1000), 'fixed', '', now);
  assert.equal(r.reward.petId, original); assert.equal(r.collection.pets[0]!.experience, 110); assert.equal(r.collection.pets[1]!.experience, 0);
});
test('crossing 3000 does not retroactively count; next10 trips award egg even without mature art', () => {
  let c = success(seed(2990), 'cross').collection; assert.equal(c.matureJourneysTowardEgg, 0); const id = c.activePetId;
  for (let i = 0; i < 10; i++) c = success(c, `after-${i}`).collection;
  assert.equal(c.pets.length, 2); assert.equal(c.pets[1]!.experience, 0); assert.equal(c.activePetId, id); assert.equal(c.pets[0]!.stage, 'juvenile');
  assert.equal(c.matureJourneysTowardEgg, 0);
});
test('lowXP companion pauses shared next-egg counter without resetting it', () => {
  let c = seed(); c.matureJourneysTowardEgg = 7; c = success(c).collection; assert.equal(c.matureJourneysTowardEgg, 7);
});
test('each twelve-egg bag covers all series once; repeated series are separate individuals', () => {
  const c = emptyPetCollection(); for (let i = 0; i < 24; i++) createEgg(c, now, () => 0.37);
  assert.equal(new Set(c.pets.slice(0, 12).map((p) => p.seriesId)).size, 12);
  assert.equal(new Set(c.pets.slice(12).map((p) => p.seriesId)).size, 12);
  assert.equal(new Set(c.pets.map((p) => p.id)).size, 24);
});
test('first bag draw can reach each of the twelve series without rarity weights', () => {
  const first = new Set<string>();
  // Exhaust all first-position swaps in Fisher-Yates, keeping other swaps fixed.
  for (let index = 0; index < 12; index++) { const c = emptyPetCollection(); let i = 11; createEgg(c, now, () => i-- === index ? 0 : 0.999999); first.add(c.pets[0]!.seriesId); }
  assert.equal(first.size, 12);
});
test('only active hatched pet decays 8 mood/12 cleanliness per24h', () => {
  const c = seed(600); c.pets[0]!.mood = 80; c.pets[0]!.cleanliness = 90; createEgg(c, now); const inactive = c.pets[1]!;
  const next = settlePetCollection(c, now + day); assert.equal(next.pets[0]!.mood, 72); assert.equal(next.pets[0]!.cleanliness, 78);
  assert.equal(next.pets[1]!.mood, inactive.mood); assert.equal(settlePetCollection(seed(), now + 50 * day).pets[0]!.mood, 100);
});
test('art-update hatching does not backcharge years of egg time', () => {
  const c = seed(); c.pets[0]!.experience = 400; const next = settlePetCollection(c, now + 365 * day);
  assert.equal(next.pets[0]!.stage, 'juvenile'); assert.equal(next.pets[0]!.mood, 100);
});
test('care has independent rolling24h cooldowns, caps100, eggs use no cooldown', () => {
  let c = seed(600); c.pets[0]!.mood = 40; c.pets[0]!.cleanliness = 40;
  const r = companionPet(c, now); assert.equal(r.collection.pets[0]!.mood, 52);
  c = cleanPet(r.collection, now).collection; assert.equal(c.pets[0]!.cleanliness, 75);
  assert.equal(companionPet(c, now + 1).ok, false); assert.equal(cleanPet(c, now + 1).ok, false);
  assert.equal(companionPet(c, now + day).ok, true); assert.equal(remainingCooldown(0, day - 1), 1);
  assert.equal(companionPet(seed(), now).collection.pets[0]!.lastCompanionAt, null);
  c.pets[0]!.mood = 99; c.pets[0]!.lastCompanionAt = null; assert.equal(companionPet(c, now).collection.pets[0]!.mood, 100);
});
test('normal exploration gives25 mood without consuming care cooldowns or cleanliness penalty', () => {
  const c = seed(600); c.pets[0]!.mood = 40; c.pets[0]!.cleanliness = 0;
  const result = success(c); assert.equal(result.collection.pets[0]!.mood, 65); assert.equal(result.reward.appliedPetXP, 110);
  assert.equal(result.collection.pets[0]!.lastCompanionAt, null); assert.equal(result.collection.pets[0]!.lastCleanedAt, null);
});
test('switch requires successful trip, one undo before departure, no offline backfill', () => {
  let c = seed(600); const oldId = c.activePetId!; const second = createEgg(c, now).id;
  c = switchActivePet(c, second, now + day).collection; assert.equal(c.pets[0]!.mood, 92);
  assert.equal(switchActivePet(c, oldId, now + day).ok, false);
  const undone = undoActivePetSwitch(c, now + 2 * day); assert.equal(undone.ok, true); assert.equal(undone.collection.pets[0]!.mood, 92);
  assert.equal(undoActivePetSwitch(undone.collection, now + 2 * day).ok, false);
  const after = success(undone.collection, 'unlock', 1000, now + 2 * day).collection;
  assert.equal(after.switchLock, null); assert.equal(switchActivePet(after, second, now + 2 * day).ok, true);
});
test('travel binding prevents switch and undo even when no XP earned', () => {
  let c = seed(); const second = createEgg(c, now).id; c = switchActivePet(c, second, now).collection;
  c = bindPetJourney(c, 'rescue-test', now); assert.equal(undoActivePetSwitch(c, now).ok, false);
  c = endPetJourney(c, 'rescue-test'); assert.ok(c.switchLock); assert.equal(c.switchLock.undoAvailable, false);
});
test('mood0 countdown lasts72h; cleaning cannot cancel, companionship can', () => {
  const c = seed(600); c.pets[0]!.mood = 0;
  const countdown = settlePetCollection(c, now); assert.equal(countdown.pets[0]!.lifecycle, 'countdown');
  assert.equal(cleanPet(countdown, now).collection.pets[0]!.lifecycle, 'countdown');
  assert.equal(companionPet(countdown, now).collection.pets[0]!.lifecycle, 'available');
  assert.equal(settlePetCollection(countdown, now + 3 * day - 1).pets[0]!.lifecycle, 'countdown');
  assert.equal(settlePetCollection(countdown, now + 3 * day).pets[0]!.lifecycle, 'departed');
});
test('departure7day boundary becomes preserved memory; rescue cannot bypass deadline', () => {
  let c = seed(600); c.pets[0]!.mood = 0; c = settlePetCollection(c, now + 10 * day);
  assert.equal(c.pets[0]!.lifecycle, 'memory'); assert.equal(c.pets[0]!.experience, 600); assert.equal(c.activePetId, null);
  assert.equal(completeRescueJourney(c, c.pets[0]!.id, now + 10 * day).ok, false);
  const revived = revivePetFromSeasonalPromise(c, c.pets[0]!.id, now + 10 * day); assert.equal(revived.ok, true); assert.equal(revived.collection.pets[0]!.mood, 40);
});
test('item rescue uses1 item and waits24h preserving XP, cleanliness>=35', () => {
  let c = seed(600); c.pets[0]!.mood = 0; c.careItems = 1; c = settlePetCollection(c, now + 3 * day);
  const r = beginItemRescue(c, now + 3 * day); assert.equal(r.ok, true); assert.equal(r.collection.careItems, 0);
  assert.equal(settlePetCollection(r.collection, now + 4 * day - 1).pets[0]!.lifecycle, 'rescuing');
  const back = settlePetCollection(r.collection, now + 4 * day); assert.equal(back.pets[0]!.lifecycle, 'available'); assert.equal(back.pets[0]!.experience, 600); assert.ok(back.pets[0]!.cleanliness >= 35);
});
test('successful rescue preserves counts, switch lock and XP, with no general rewards', () => {
  let c = seed(600); c.pets[0]!.mood = 0; c = settlePetCollection(c, now + 3 * day); const id = c.activePetId!;
  c.switchLock = { activePetId: id, previousPetId: null, undoAvailable: false, switchedAt: now };
  const back = completeRescueJourney(c, id, now + 4 * day).collection;
  assert.ok(back.switchLock); assert.equal(back.normalJourneysTowardCareItem, 0); assert.equal(back.matureJourneysTowardEgg, 0); assert.equal(back.pets[0]!.experience, 600);
});
test('every5 normal successes award1 item cap3, overflow not banked', () => {
  let c = seed(); for (let i=0;i<20;i++) c=success(c, `item-${i}`).collection;
  assert.equal(c.careItems, 3); assert.equal(c.normalJourneysTowardCareItem, 0);
  c.careItems=2; c=success(c, 'next').collection; assert.equal(c.careItems, 2); assert.equal(c.normalJourneysTowardCareItem, 1);
});
test('all-memory collection can meet new egg, recoverable companion prevents free egg', () => {
  let c=seed(600); c.pets[0]!.mood=0; c=settlePetCollection(c, now+10*day);
  const next=success(c, 'new', 1000, now+10*day).collection; assert.equal(next.pets.length,2); assert.equal(next.pets[0]!.lifecycle,'memory'); assert.equal(next.pets[1]!.experience,0);
  const recovering=seed(600); recovering.pets[0]!.lifecycle='departed'; recovering.pets[0]!.departedAt=now;
  assert.equal(success(recovering).collection.pets.length,1);
});
test('legacy classification is archived verbatim without conversion/XP transfer', () => {
  const legacy={ pets:[{id:'old',species:'fox',experience:9999,nickname:'原名'}],activePetId:'old',careItems:3 };
  const migrated=normalizePetCollection(legacy,now); assert.equal(migrated.pets.length,0); assert.equal(migrated.careItems,0); assert.deepEqual(migrated.legacyArchives[0]!.data,legacy);
  assert.equal(migrateLegacyPet({hasEgg:true,species:'otter',experience:200},now).pets.length,0);
  const next=success(migrated).collection; assert.equal(next.pets[0]!.experience,0); assert.deepEqual(next.legacyArchives[0]!.data,legacy);
});
test('backup v4 round-trip includes ledger and archives, v3 remains readable', () => {
  const c=success(seed(600)).collection; c.legacyArchives=[{archivedAt:now,data:{species:'raccoon',experience:3500}}];
  const payload=createBackupPayload({appVersion:'0.9.0',petCollection:c,records:[],healthProfile:defaultHealthProfile,usedMicroTaskIds:[],durationMinutes:40,theme:'nature',featuredMemoryByMonth:{},motionPermissionState:{explanationShown:false,unavailableJourneyAttempts:0,followupShown:false,lastStatus:'unknown'},seasonalPromise:emptySeasonalPromise()});
  const restored=parseBackupPayload(JSON.stringify(payload)); assert.equal(restored.version,4); assert.equal(restored.data.petCollection.pets[0]!.experience,710); assert.equal(restored.data.petCollection.rewardLedger.trip!.appliedPetXP,110); assert.deepEqual(restored.data.petCollection.legacyArchives,c.legacyArchives);
  const old=JSON.parse(JSON.stringify(payload)); old.version=3; delete old.data.petCollection;
  assert.equal(parseBackupPayload(JSON.stringify(old)).data.petCollection.pets.length,0);
  old.version=4; assert.throws(()=>parseBackupPayload(JSON.stringify(old)),/缺少完整寵物/);
});
test('only actual unlocked stages expose story, and no private fields leave pet display', () => {
  const egg=seed(1000,'cloud').pets[0]!; assert.equal(unlockedStories(egg).length,1);
  const juvenile=seed(600).pets[0]!; assert.equal(unlockedStories(juvenile).length,2);
  const display=publicPetDisplay(juvenile); assert.deepEqual(Object.keys(display).sort(),['name','stage','storyChapter','symbol','visualKey']);
  assert.equal(publicPetDisplay(null).visualKey,'badge'); assert.match(publicPetStory({...display,visualKey:'future-series'}),/徽章/);
  assert.equal(renamePet(seed(),seed().pets[0]!.id,'😀'.repeat(17)).collection.pets[0]!.nickname,'😀'.repeat(16));
});
test('normal rewards are wired only into successful review; hydration never resets pet collection', () => {
  const source=read('src/state/ExplorePathContext.tsx');
  assert.doesNotMatch(source.split('const addIncompleteRecord')[1]!.split('const saveIncompleteJourney')[0]!,/applyNormalJourneyReward/);
  assert.match(source.split('const submitReview')[1]!.split('const beginSeasonalSelection')[0]!,/applyNormalJourneyReward/);
  assert.doesNotMatch(source,/setRealPetCollection\(emptyPetCollection\(\)\)/);
  assert.match(source,/saveHealthProfile\(realHealthProfile\)/);
  assert.doesNotMatch(source,/grantSeasonalCareReward/);
});
test('old classification and sprite-crop implementation removed from shipped active source', () => {
  for(const path of ['src/domain/rules.ts','src/domain/petRules.ts','src/domain/showcase.ts']) assert.doesNotMatch(read(path),/fox|otter|raccoon/);
  assert.match(read('src/components/PetImage.tsx'),/resizeMode="contain"/);
  assert.match(read('src/state/SocialContext.tsx'),/completed = completed && !!self && self.leftAt == null/);
});
