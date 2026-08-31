import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addMonths,
  addSeasonalEntry,
  claimSeasonalReward,
  emptySeasonalPromise,
  revealSeasonalTarget,
  sealCandidates,
  seasonForDate,
  seasonalReminderSchedule,
  settleExpiredSeasonalPromise,
  markSeasonalVisitPending,
  abandonSeasonalPending,
} from '../src/domain/seasonalPromise';
import { SeasonalCandidate } from '../src/domain/types';

const candidate = (id: string, isShowcase = false): SeasonalCandidate => ({
  id, recordId: id, destinationId: id, destinationName: id,
  latitude: 25, longitude: 121, cityLabel: '台中市', isShowcase,
});

test('台灣月份正確映射四季', () => {
  assert.equal(seasonForDate(new Date(2026, 2, 1).getTime()), 'spring');
  assert.equal(seasonForDate(new Date(2026, 5, 1).getTime()), 'summer');
  assert.equal(seasonForDate(new Date(2026, 8, 1).getTime()), 'autumn');
  assert.equal(seasonForDate(new Date(2026, 11, 1).getTime()), 'winter');
});

test('季中開始任務仍會排入當季結束前十四天提醒', () => {
  const now = new Date(2026, 6, 10, 12).getTime();
  const expiresAt = addMonths(now, 15);
  const reminders = seasonalReminderSchedule(now, expiresAt);
  const currentSeasonEnding = reminders.find((reminder) => reminder.kind === 'seasonEnding');
  assert.equal(currentSeasonEnding?.season, 'summer');
  assert.equal(currentSeasonEnding?.at, new Date(2026, 7, 18, 9).getTime());
  assert.ok(reminders.every((reminder) => reminder.at > now && reminder.at < expiresAt));
});

test('提醒依時間排序並同時涵蓋下一季開始與結束', () => {
  const now = new Date(2026, 6, 10, 12).getTime();
  const reminders = seasonalReminderSchedule(now, addMonths(now, 15));
  const autumnStart = reminders.find((reminder) => reminder.kind === 'seasonStart' && reminder.season === 'autumn');
  const autumnEnding = reminders.find((reminder) => reminder.kind === 'seasonEnding' && reminder.season === 'autumn');
  assert.equal(autumnStart?.at, new Date(2026, 8, 1, 9).getTime());
  assert.equal(autumnEnding?.at, new Date(2026, 10, 17, 9).getTime());
  assert.deepEqual(reminders, [...reminders].sort((left, right) => left.at - right.at));
});

test('盲盒必須三選一且揭曉後鎖定十五個月', () => {
  const now = new Date(2026, 7, 29).getTime();
  const sealed = sealCandidates([candidate('a'), candidate('b'), candidate('c')], 42);
  const state = revealSeasonalTarget({ ...emptySeasonalPromise(), status: 'sealed', sealedCandidates: sealed }, 1, now);
  assert.equal(state.status, 'active');
  assert.equal(state.target?.id, sealed[1]?.id);
  assert.equal(state.expiresAt, addMonths(now, 15));
  assert.equal(state.sealedCandidates.length, 0);
});

test('同一季只能留下單一章且文字紀錄不可為空', () => {
  const now = new Date(2026, 3, 1).getTime();
  const active = { ...emptySeasonalPromise(), status: 'active' as const, target: candidate('a'), expiresAt: addMonths(now, 15) };
  const empty = addSeasonalEntry(active, 'observation', '  ', undefined, false, now);
  assert.equal(empty.entries.length, 0);
  const first = addSeasonalEntry(active, 'observation', '春天的圍籬長出新葉。', undefined, true, now);
  const duplicate = addSeasonalEntry(first, 'photo', '', 'file://spring.jpg', false, now + 1);
  assert.equal(duplicate.entries.length, 1);
  assert.equal(duplicate.entries[0]?.usedSafetyRadius, true);
});

test('四季抵達先留下待完成狀態，補內容或放棄都不會建立第二次獎勵', () => {
  const now = new Date(2026, 3, 1).getTime();
  const active = { ...emptySeasonalPromise(), status: 'active' as const, target: candidate('a'), expiresAt: addMonths(now, 15) };
  const pending = markSeasonalVisitPending(active, 'journey-seasonal-1', now);
  assert.equal(pending.pendingVisit?.journeyId, 'journey-seasonal-1');
  const completed = addSeasonalEntry(pending, 'observation', '春天的新葉。', undefined, false, now, 'journey-seasonal-1');
  assert.equal(completed.entries[0]?.journeyId, 'journey-seasonal-1');
  assert.equal(completed.pendingVisit, null);
  assert.equal(abandonSeasonalPending(pending).pendingVisit, null);
});

test('逾期清除任務內容但保留重逢印記與徽章', () => {
  const state = {
    ...emptySeasonalPromise(), status: 'active' as const, target: candidate('a'),
    expiresAt: 100, reunionTokens: 1 as const, seasonalBadges: 2,
  };
  const expired = settleExpiredSeasonalPromise(state, 101);
  assert.equal(expired.status, 'idle');
  assert.equal(expired.target, null);
  assert.equal(expired.reunionTokens, 1);
  assert.equal(expired.seasonalBadges, 2);
});

test('正式任務最多一枚印記，溢出改發徽章；展示任務不發正式獎勵', () => {
  const completed = { ...emptySeasonalPromise(), status: 'completed' as const };
  const token = claimSeasonalReward(completed);
  assert.equal(token.reunionTokens, 1);
  const badge = claimSeasonalReward({ ...completed, reunionTokens: 1 });
  assert.equal(badge.reunionTokens, 1);
  assert.equal(badge.seasonalBadges, 1);
  const demo = claimSeasonalReward({ ...completed, isShowcase: true });
  assert.equal(demo.reunionTokens, 0);
  assert.equal(demo.seasonalBadges, 0);
});
