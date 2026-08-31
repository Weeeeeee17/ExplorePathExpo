import assert from 'node:assert/strict';
import test from 'node:test';

import {
  currentActivityStreak,
  dailyHealthSummaries,
  healthMilestonesForJourney,
  journeyHealthMetrics,
  normalizeHealthProfile,
} from '../src/domain/health';
import { JourneyRecord } from '../src/domain/types';

function record(id: string, endedAt: number, steps: number, overrides: Partial<JourneyRecord> = {}): JourneyRecord {
  return {
    id,
    destinationName: '健康測試旅程',
    theme: 'nature',
    endedAt,
    elapsedMinutes: 40,
    steps,
    mood: 'calm',
    effort: 'steady',
    hasPhoto: false,
    note: '',
    earnedXP: 0,
    completed: true,
    outcome: 'arrived',
    stepStatus: 'complete',
    ...overrides,
  };
}

test('旅程健康指標會依步幅計算距離、活動時間與平均步頻', () => {
  const metrics = journeyHealthMetrics({ steps: 3200, elapsedMinutes: 40, strideLengthCm: 70 });
  assert.equal(metrics.estimatedDistanceMeters, 2240);
  assert.equal(metrics.estimatedActiveMinutes, 32);
  assert.equal(metrics.stoppedMinutes, 8);
  assert.equal(metrics.averageCadence, 80);
  assert.equal(metrics.intensity, 'moderate');
});

test('未授權或已排除步數不會進入健康統計', () => {
  const unavailable = journeyHealthMetrics({ steps: 5000, elapsedMinutes: 40, stepStatus: 'unavailable' });
  assert.equal(unavailable.steps, 0);
  assert.equal(unavailable.estimatedDistanceMeters, 0);
  assert.equal(unavailable.estimatedActiveMinutes, 0);
});

test('健康設定會限制在合理範圍並將目標對齊 500 步', () => {
  assert.deepEqual(normalizeHealthProfile({ strideLengthCm: 10, dailyStepGoal: 6251 }), {
    strideLengthCm: 35,
    dailyStepGoal: 6500,
  });
});

test('七日統計與連續活動天數只計算有效步數旅程', () => {
  const now = new Date(2026, 7, 30, 18).getTime();
  const records = [
    record('today', new Date(2026, 7, 30, 10).getTime(), 1800),
    record('yesterday', new Date(2026, 7, 29, 10).getTime(), 2200),
    record('two-days', new Date(2026, 7, 28, 10).getTime(), 2600),
    record('excluded', new Date(2026, 7, 30, 12).getTime(), 9000, { stepStatus: 'excluded' }),
  ];
  const days = dailyHealthSummaries(records, { strideLengthCm: 70, dailyStepGoal: 6000 }, now, 7);
  assert.equal(days.at(-1)?.steps, 1800);
  assert.equal(days.reduce((sum, day) => sum + day.steps, 0), 6600);
  assert.equal(currentActivityStreak(records, now), 3);
});

test('健康里程碑可獨立提供給未來新寵物系統', () => {
  const previous = record('previous', new Date(2026, 7, 29, 10).getTime(), 3000);
  const current = record('current', new Date(2026, 7, 30, 10).getTime(), 6500);
  const milestones = healthMilestonesForJourney(current, [previous], { strideLengthCm: 70, dailyStepGoal: 6000 });
  assert.deepEqual(milestones.map((item) => item.kind), ['personalBest', 'dailyGoal']);
});
