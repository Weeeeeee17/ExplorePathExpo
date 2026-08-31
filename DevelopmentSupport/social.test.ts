import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canStartRoom,
  createTeamTasks,
  friendCodeFromQr,
  friendQrValue,
  nextHostProfileId,
  requiredKickVotes,
  requiredTaskCount,
  shouldBecomeSolo,
  teamLocationState,
  canUseLocationForArrival,
  friendTokenFromQr,
  physicalTaskTarget,
  TeamMember,
  TeamRoom,
} from '../src/domain/social';

const profile = (id: string) => ({
  id,
  nickname: id,
  friendCode: `${id.toUpperCase()}12345678`.slice(0, 8),
  availabilityUntil: null,
  pet: { name: '未孵化蛋', visualKey: 'egg', stage: '等待相遇', storyChapter: '序章', symbol: '◉' },
});

const member = (id: string, joinedAt: number, ready = true): TeamMember => ({
  profile: profile(id),
  joinedAt,
  readyAt: ready ? joinedAt + 1 : null,
  leftAt: null,
  isHost: id === 'a',
  location: null,
  arrivedAt: null,
});

const room = (members: TeamMember[]): TeamRoom => ({
  id: 'room',
  phase: 'waiting',
  mode: 'gather',
  durationMinutes: 60,
  difficulty: 'standard',
  destinationName: '集合點',
  destination: null,
  createdAt: 1,
  startedAt: null,
  expectedEndAt: null,
  maxEndAt: null,
  completedAt: null,
  members,
  tasks: createTeamTasks(60, 'standard', 'room'),
});

test('team journey duration maps to the confirmed required task counts', () => {
  assert.equal(requiredTaskCount(30), 2);
  assert.equal(requiredTaskCount(60), 3);
  assert.equal(requiredTaskCount(90), 4);
  assert.equal(requiredTaskCount(120), 5);
});

test('team tasks include required tasks plus two optional tasks', () => {
  const tasks = createTeamTasks(120, 'challenge', 'seed');
  assert.equal(tasks.filter((task) => task.required).length, 5);
  assert.equal(tasks.filter((task) => !task.required).length, 2);
  assert.ok(tasks.some((task) => task.kind === 'steps' || task.kind === 'activeMinutes'));
  assert.ok(tasks.some((task) => task.kind === 'activeMinutes'));
});

test('difficulty changes content, not counts or physical thresholds', () => {
  const thresholds = (difficulty: 'relaxed' | 'standard' | 'challenge') => createTeamTasks(120, difficulty, 'seed').filter((task) => ['steps', 'activeMinutes'].includes(task.kind)).map((task) => [task.kind, task.stepTarget, task.activeMinuteTarget]);
  assert.deepEqual(thresholds('relaxed'), thresholds('standard'));
  assert.deepEqual(thresholds('standard'), thresholds('challenge'));
});

test('repeated physical tasks require additional activity', () => {
  const tasks = createTeamTasks(120, 'relaxed', 'seed');
  const walking = tasks.filter((task) => task.kind === 'steps');
  assert.equal(physicalTaskTarget(tasks, walking[0]!.id), 300);
  assert.equal(physicalTaskTarget(tasks, walking[1]!.id), 600);
});

test('missing accuracy and stale location never qualify for arrival', () => {
  const location = { profileId: 'me', latitude: 25, longitude: 121, timestamp: 1_000_000, accuracyMeters: null };
  assert.equal(canUseLocationForArrival(location, 1_000_000), false);
  assert.equal(canUseLocationForArrival({ ...location, accuracyMeters: 20 }, 1_120_001), false);
  assert.equal(canUseLocationForArrival({ ...location, accuracyMeters: 20 }, 1_030_000), true);
});

test('QR token parser only accepts the invite scheme with 192-bit token', () => {
  assert.equal(friendTokenFromQr(`explorepath://invite/${'a'.repeat(48)}`), 'a'.repeat(48));
  assert.equal(friendTokenFromQr('https://example.com/invite/token'), null);
  assert.equal(friendTokenFromQr('explorepath://friend/ABCD1234'), null);
});

test('location freshness follows the 60, 120 and 300 second boundaries', () => {
  const now = 1_000_000;
  assert.equal(teamLocationState(now - 60_000, now), 'fresh');
  assert.equal(teamLocationState(now - 60_001, now), 'delayed');
  assert.equal(teamLocationState(now - 120_001, now), 'stale');
  assert.equal(teamLocationState(now - 300_001, now), 'offline');
});

test('friend QR values round-trip and reject unrelated links', () => {
  assert.equal(friendCodeFromQr(friendQrValue('ab12cd34')), 'AB12CD34');
  assert.equal(friendCodeFromQr('https://example.com/AB12CD34'), null);
});

test('kick votes require a strict majority of eligible voters', () => {
  assert.equal(requiredKickVotes(1), 1);
  assert.equal(requiredKickVotes(2), 2);
  assert.equal(requiredKickVotes(3), 2);
  assert.equal(requiredKickVotes(5), 3);
});

test('room readiness, host transfer and solo conversion are deterministic', () => {
  const members = [member('a', 1), member('b', 2), member('c', 3)];
  assert.equal(canStartRoom(room(members)), true);
  assert.equal(canStartRoom(room([member('a', 1), member('b', 2, false)])), false);
  assert.equal(nextHostProfileId(members, 'a'), 'b');
  assert.equal(shouldBecomeSolo([{ ...members[0]!, leftAt: 10 }, { ...members[1]!, leftAt: 11 }, members[2]!]), true);
});
