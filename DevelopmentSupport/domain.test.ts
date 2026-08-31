import assert from 'node:assert/strict';
import test from 'node:test';

import {
  arrivalRadiusMeters,
  advanceDwellState,
  broadDirectionFromBearing,
  destinationTarget,
  distanceMeters,
  dwellTargetSeconds,
  estimatedTotalMinutes,
  initialBearing,
  relativeCompassRotation,
  searchRadiusMeters,
  updateDeviationState,
} from '../src/domain/geo';
import { microTasks, selectMicroTask, tasksForTheme } from '../src/data/microTasks';
import { buildOverpassQuery, displayPointFor } from '../src/services/overpass';

test('OpenStreetMap 查詢只使用合法的 geometry 輸出格式', () => {
  const query = buildOverpassQuery({ latitude: 25.04, longitude: 121.52 }, 1200);
  assert.match(query, /out body geom;/);
  assert.doesNotMatch(query, /out center bounds tags geom;/);
  assert.match(query, /\(around:1200,25\.04,121\.52\)/);
});

test('面狀地點可在本機從 geometry 推算顯示中心', () => {
  const point = displayPointFor({
    type: 'way',
    id: 42,
    geometry: [
      { lat: 25, lon: 121 },
      { lat: 25.002, lon: 121.004 },
      { lat: 25.001, lon: 121.001 },
    ],
  });
  assert.ok(point);
  assert.ok(Math.abs(point.latitude - 25.001) < 0.0000001);
  assert.ok(Math.abs(point.longitude - 121.002) < 0.0000001);
});

test('節點地點保留 OpenStreetMap 回傳的精確座標', () => {
  const point = displayPointFor({ type: 'node', id: 7, lat: 25.05, lon: 121.53 });
  assert.deepEqual(point, { latitude: 25.05, longitude: 121.53 });
});

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

test('單程時間預算讓較長任務得到較大搜尋半徑', () => {
  assert.ok(searchRadiusMeters(60) > searchRadiusMeters(20));
  assert.equal(searchRadiusMeters(1), 300);
  assert.ok(estimatedTotalMinutes(1000) > estimatedTotalMinutes(200));
  assert.ok(estimatedTotalMinutes(1000) > 20);
});

test('定位精準度決定 30、45 或 60 秒停留目標', () => {
  assert.equal(dwellTargetSeconds(20), 30);
  assert.equal(dwellTargetSeconds(50), 45);
  assert.equal(dwellTargetSeconds(90), 60);
});

test('大型目的地優先使用可到達邊界點', () => {
  const target = destinationTarget({
    id: 'boundary', internalName: '公園', theme: 'nature', walkingMinutes: 8,
    totalMinutes: 24, distanceMeters: 500, latitude: 25, longitude: 121,
    arrivalLatitude: 25.001, arrivalLongitude: 121.002, arrivalKind: 'boundary',
    environmentHint: '留意公共入口',
  });
  assert.deepEqual(target, { latitude: 25.001, longitude: 121.002 });
});

test('距離持續兩分鐘增加一百公尺才提示偏航', () => {
  const initial = updateDeviationState(
    { windowStartedAt: null, startDistanceMeters: null, suggested: false },
    400,
    30,
    1_000,
  );
  const early = updateDeviationState(initial, 480, 30, 61_000);
  assert.equal(early.suggested, false);
  const suggested = updateDeviationState(early, 510, 30, 121_001);
  assert.equal(suggested.suggested, true);
});

test('四個主題各有十二題，且各題型各四題', () => {
  assert.equal(microTasks.length, 48);
  for (const theme of ['food', 'nature', 'architecture', 'surprise'] as const) {
    const tasks = tasksForTheme(theme);
    assert.equal(tasks.length, 12);
    assert.equal(tasks.filter((task) => task.type === 'photo').length, 4);
    assert.equal(tasks.filter((task) => task.type === 'observation').length, 4);
    assert.equal(tasks.filter((task) => task.type === 'imagination').length, 4);
  }
});

test('同主題題庫用完前不重複，換題會排除目前題目', () => {
  const pool = tasksForTheme('food');
  const used = pool.slice(0, 11).map((task) => task.id);
  assert.equal(selectMicroTask('food', used, 'only-one').id, pool[11]?.id);
  const first = selectMicroTask('nature', [], 'journey');
  const replacement = selectMicroTask('nature', [], 'journey', [first.id]);
  assert.notEqual(replacement.id, first.id);
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
