import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chooseValidFeaturedMemories,
  memoriesByMonth,
  monthlySummary,
  normalizeMemoryRecord,
  visibleMemories,
  isActivityJourney,
  stepDisplayText,
} from '../src/domain/memories';
import {
  createBackupPayload,
  parseBackupPayload,
} from '../src/domain/backupFormat';
import { defaultHealthProfile } from '../src/domain/health';
import { emptySeasonalPromise } from '../src/domain/seasonalPromise';
import { JourneyRecord } from '../src/domain/types';

function journey(overrides: Partial<JourneyRecord> = {}): JourneyRecord {
  return {
    id: 'journey-1',
    destinationName: '測試公園',
    theme: 'nature',
    endedAt: Date.parse('2026-08-18T12:00:00Z'),
    elapsedMinutes: 40,
    steps: 3200,
    mood: 'calm',
    hasPhoto: false,
    note: '一段安靜的路。',
    earnedXP: 132,
    completed: true,
    kind: 'normal',
    petId: 'pet-1',
    ...overrides,
  };
}

test('月份時間軸顯示抵達與有步數的未抵達旅程', () => {
  const visible = journey();
  const hidden = journey({ id: 'hidden', memoryHidden: true });
  const incomplete = journey({ id: 'incomplete', completed: false, outcome: 'unreached', steps: 900 });
  const emptyIncomplete = journey({ id: 'empty-incomplete', completed: false, outcome: 'unreached', steps: 0 });
  assert.deepEqual(visibleMemories([hidden, incomplete, emptyIncomplete, visible]).map((item) => item.id), ['incomplete', 'journey-1']);
  assert.equal(memoriesByMonth([visible])[0]?.key, '2026-08');
});

test('月度統計仍包含已移除回憶的完成步數與進度', () => {
  const summary = monthlySummary([
    journey(),
    journey({ id: 'hidden', steps: 800, memoryHidden: true, theme: 'food' }),
  ], '2026-08');
  assert.equal(summary.journeyCount, 2);
  assert.equal(summary.arrivedCount, 2);
  assert.equal(summary.totalSteps, 4000);
  assert.equal(summary.themeCounts.nature, 1);
  assert.equal(summary.themeCounts.food, 1);
});

test('部分步數納入總數但排除平均，未抵達零步不算活動旅程', () => {
  const summary = monthlySummary([
    journey({ id: 'complete', steps: 1000, stepStatus: 'complete' }),
    journey({ id: 'partial', steps: 600, stepStatus: 'partial' }),
    journey({ id: 'unreached', completed: false, outcome: 'unreached', steps: 400, stepStatus: 'complete' }),
    journey({ id: 'zero', completed: false, outcome: 'unreached', steps: 0, stepStatus: 'complete' }),
  ], '2026-08');
  assert.equal(summary.totalSteps, 2000);
  assert.equal(summary.completeStepJourneyCount, 2);
  assert.equal(summary.averageCompleteSteps, 700);
  assert.equal(summary.partialCount, 1);
  assert.equal(isActivityJourney(journey({ completed: false, outcome: 'unreached', steps: 0 })), false);
  assert.equal(stepDisplayText(journey({ stepStatus: 'partial', steps: 600 })), '至少 600 步');
});

test('v0.1 舊紀錄會自動取得回憶欄位且不重發獎勵', () => {
  const old = journey({ hasPhoto: true, microTaskPhotoUri: 'file://task.jpg' });
  const migrated = normalizeMemoryRecord(old);
  assert.equal(migrated.memoryHidden, false);
  assert.equal(migrated.memoryPhotoUri, 'file://task.jpg');
  assert.equal(migrated.earnedXP, old.earnedXP);
});

test('舊版有步數的未完成紀錄遷移為隱藏地點的未抵達旅程', () => {
  const migrated = normalizeMemoryRecord(journey({
    completed: false,
    steps: 480,
    memoryHidden: true,
    destinationLatitude: 25,
    destinationLongitude: 121,
  }));
  assert.equal(migrated.outcome, 'unreached');
  assert.equal(migrated.stepStatus, 'complete');
  assert.equal(migrated.memoryHidden, false);
  assert.equal(migrated.destinationName, '尚未揭曉的目的地');
  assert.equal(migrated.destinationLatitude, undefined);
});

test('被移除的回憶不能繼續擔任月份代表', () => {
  const records = [journey(), journey({ id: 'hidden', memoryHidden: true })];
  assert.deepEqual(
    chooseValidFeaturedMemories(records, { '2026-08': 'hidden', '2026-07': 'missing' }),
    {},
  );
});

test('備份保留紀錄與進度但移除所有照片路徑', () => {
  const payload = createBackupPayload({
    appVersion: '0.2.0',
    exportedAt: 123,
    records: [journey({ memoryPhotoUri: 'file://cover.jpg', microTaskPhotoUri: 'file://task.jpg', hasPhoto: true })],
    healthProfile: defaultHealthProfile,
    usedMicroTaskIds: ['nature-photo-01'],
    durationMinutes: 40,
    theme: 'nature',
    featuredMemoryByMonth: { '2026-08': 'journey-1' },
    motionPermissionState: { explanationShown: true, unavailableJourneyAttempts: 3, followupShown: true, lastStatus: 'denied' },
    seasonalPromise: emptySeasonalPromise(),
  });
  const record = payload.data.records[0];
  assert.equal(record?.memoryPhotoUri, undefined);
  assert.equal(record?.microTaskPhotoUri, undefined);
  assert.equal(record?.hasPhoto, false);
  assert.equal(record?.note, '一段安靜的路。');
  assert.equal(parseBackupPayload(JSON.stringify(payload)).data.records.length, 1);
  assert.equal(parseBackupPayload(JSON.stringify(payload)).data.motionPermissionState.unavailableJourneyAttempts, 3);
});

test('非 ExplorePath 格式的 JSON 不會被還原', () => {
  assert.throws(() => parseBackupPayload('{"hello":"world"}'), /不是 ExplorePath/);
});
