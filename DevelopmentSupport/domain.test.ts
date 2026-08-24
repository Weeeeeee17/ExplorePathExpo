import assert from 'node:assert/strict';
import test from 'node:test';

import {
  arrivalRadiusMeters,
  advanceDwellState,
  broadDirectionFromBearing,
  distanceMeters,
  estimatedTotalMinutes,
  initialBearing,
  relativeCompassRotation,
  searchRadiusMeters,
} from '../src/domain/geo';
import { applyPetReward, xpBreakdown } from '../src/domain/rules';

test('地理距離與方位使用真實座標計算', () => {
  const origin = { latitude: 25, longitude: 121 };
  const north = { latitude: 25.001, longitude: 121 };
  const distance = distanceMeters(origin, north);
  assert.ok(distance > 110 && distance < 112);
  assert.ok(initialBearing(origin, north) < 1 || initialBearing(origin, north) > 359);
  assert.equal(broadDirectionFromBearing(46), '東北方');
  assert.equal(relativeCompassRotation(20, 350), 30);
});

test('抵達範圍依精準度限制在 40 到 100 公尺', () => {
  assert.equal(arrivalRadiusMeters(5), 40);
  assert.equal(arrivalRadiusMeters(50), 75);
  assert.equal(arrivalRadiusMeters(200), 100);
});

test('較長時間得到較大搜尋半徑與步行預估', () => {
  assert.ok(searchRadiusMeters(60) > searchRadiusMeters(20));
  assert.equal(searchRadiusMeters(1), 350);
  assert.ok(estimatedTotalMinutes(1000) > estimatedTotalMinutes(200));
});

test('停留判定容許十秒內 GPS 飄移，超過十秒才歸零', () => {
  let state = advanceDwellState(
    { dwellMilliseconds: 0, lastDwellSampleAt: null, outsideSince: null },
    true,
    1_000,
  );
  state = advanceDwellState(state, true, 5_000);
  assert.equal(state.dwellMilliseconds, 4_000);
  state = advanceDwellState(state, false, 6_000);
  state = advanceDwellState(state, true, 14_000);
  assert.equal(state.dwellMilliseconds, 4_000);
  state = advanceDwellState(state, false, 15_000);
  state = advanceDwellState(state, false, 25_001);
  assert.equal(state.dwellMilliseconds, 0);
});

test('抵達為 100 XP，步數加成每百步一點且上限 50', () => {
  assert.deepEqual(xpBreakdown(2450), { arrivalXP: 100, stepBonusXP: 24, totalXP: 124 });
  assert.deepEqual(xpBreakdown(99999), { arrivalXP: 100, stepBonusXP: 50, totalXP: 150 });
});

test('第一次成功探索找到蛋但不把當次 XP 放進蛋', () => {
  const result = applyPetReward(
    { hasEgg: false, species: null, experience: 0 },
    xpBreakdown(1000),
    0,
    'journey-test',
  );
  assert.equal(result.reward.petEvent, 'foundEgg');
  assert.equal(result.reward.appliedPetXP, 0);
  assert.equal(result.pet.experience, 0);
});
