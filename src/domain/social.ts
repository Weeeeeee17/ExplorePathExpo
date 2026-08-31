import { GeoPoint, TrackedLocation } from './types';

export type FriendCategory = 'family' | 'friend' | 'coworker';
export type SocialConnectionMode = 'cloud' | 'preview' | 'setup';
export type TeamRoomPhase = 'waiting' | 'active' | 'completed' | 'closed';
export type TeamJourneyMode = 'gather' | 'sharedStart';
export type TeamDifficulty = 'relaxed' | 'standard' | 'challenge';
export type TeamTaskKind = 'steps' | 'activeMinutes' | 'observation' | 'photo';
export type TeamTaskStatus = 'pending' | 'completed';
export type TeamLocationState = 'fresh' | 'delayed' | 'stale' | 'offline';

export interface SocialPetDisplay {
  name: string;
  visualKey: string;
  stage: string;
  storyChapter: string;
  symbol: string;
}

export interface SocialProfile {
  id: string;
  nickname: string;
  friendCode: string;
  availabilityUntil: number | null;
  pet: SocialPetDisplay;
}

export interface SocialFriend {
  profile: SocialProfile;
  category: FriendCategory;
  favorite: boolean;
}

export interface SocialFriendRequest {
  id: string;
  sender: SocialProfile;
  createdAt: number;
  expiresAt: number;
}

export interface SocialRoomInvite {
  id: string;
  roomId: string;
  host: SocialProfile;
  mode: TeamJourneyMode;
  durationMinutes: TeamRoom['durationMinutes'];
  difficulty: TeamDifficulty;
  destinationName: string;
  expiresAt: number;
}

export interface TeamLocation extends TrackedLocation {
  profileId: string;
}

export interface TeamMember {
  profile: SocialProfile;
  joinedAt: number;
  readyAt: number | null;
  leftAt: number | null;
  isHost: boolean;
  location: TeamLocation | null;
  arrivedAt: number | null;
  lastLocationAt?: number | null;
  locationIssue?: string | null;
}

export interface TeamTask {
  id: string;
  kind: TeamTaskKind;
  title: string;
  prompt: string;
  required: boolean;
  status: TeamTaskStatus;
  stepTarget?: number;
  activeMinuteTarget?: number;
  confirmedByMe?: boolean;
}

export interface TeamRoom {
  id: string;
  phase: TeamRoomPhase;
  mode: TeamJourneyMode;
  durationMinutes: 30 | 60 | 90 | 120;
  difficulty: TeamDifficulty;
  destinationName: string;
  destination: GeoPoint | null;
  createdAt: number;
  startedAt: number | null;
  expectedEndAt: number | null;
  maxEndAt: number | null;
  completedAt: number | null;
  members: TeamMember[];
  tasks: TeamTask[];
  solo?: boolean;
  kickVotes?: { id: string; targetId: string; expiresAt: number; approvals: number; needed: number; votedByMe: boolean }[];
}

export interface SocialSnapshot {
  profile: SocialProfile;
  friends: SocialFriend[];
  requests: SocialFriendRequest[];
  roomInvites: SocialRoomInvite[];
  activeRoom: TeamRoom | null;
  shares?: FriendLocationShare[];
}

export interface FriendLocationShare {
  id: string;
  friend: SocialProfile;
  incoming: boolean;
  status: 'pending' | 'active';
  hours: 1 | 4 | 8;
  expiresAt: number;
  myPrecision: 'approximate' | 'precise';
  location: TeamLocation | null;
}

export const friendCategoryMeta: Record<FriendCategory, { label: string; symbol: string }> = {
  family: { label: '家人', symbol: '⌂' },
  friend: { label: '好友', symbol: '✦' },
  coworker: { label: '同事', symbol: '▦' },
};

export const teamDifficultyMeta: Record<TeamDifficulty, { label: string; detail: string }> = {
  relaxed: { label: '輕鬆', detail: '單一明顯目標' },
  standard: { label: '標準', detail: '雙條件或比較' },
  challenge: { label: '挑戰', detail: '多段線索與共同作答' },
};

export const teamModeMeta: Record<TeamJourneyMode, { label: string; detail: string }> = {
  gather: { label: '異地集合', detail: '從不同地方前往同一集合點' },
  sharedStart: { label: '同地探索', detail: '從彼此 100 公尺內一起出發' },
};

export function requiredTaskCount(durationMinutes: TeamRoom['durationMinutes']) {
  return ({ 30: 2, 60: 3, 90: 4, 120: 5 } as const)[durationMinutes];
}

export function teamLocationState(capturedAt: number, now = Date.now()): TeamLocationState {
  const age = Math.max(0, now - capturedAt);
  if (age <= 60_000) return 'fresh';
  if (age <= 120_000) return 'delayed';
  if (age <= 300_000) return 'stale';
  return 'offline';
}

export function canUseLocationForArrival(location: TeamLocation | null, now = Date.now()) {
  if (!location) return false;
  return teamLocationState(location.timestamp, now) !== 'stale'
    && teamLocationState(location.timestamp, now) !== 'offline'
    && location.accuracyMeters != null && location.accuracyMeters <= 100;
}

export function requiredKickVotes(eligibleVoterCount: number) {
  return Math.floor(Math.max(0, eligibleVoterCount) / 2) + 1;
}

export function nextHostProfileId(members: TeamMember[], departingProfileId: string) {
  return members
    .filter((member) => member.profile.id !== departingProfileId && member.leftAt == null)
    .sort((left, right) => left.joinedAt - right.joinedAt)[0]?.profile.id ?? null;
}

export function shouldBecomeSolo(members: TeamMember[]) {
  return members.filter((member) => member.leftAt == null).length === 1;
}

export function isAvailabilityActive(profile: SocialProfile, now = Date.now()) {
  return profile.availabilityUntil != null && profile.availabilityUntil > now;
}

export function normalizeFriendCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
}

export function isValidFriendCode(value: string) {
  return /^[A-Z0-9]{8,10}$/.test(normalizeFriendCode(value));
}

export function friendQrValue(friendCode: string) {
  return `explorepath://friend/${normalizeFriendCode(friendCode)}`;
}

export function friendCodeFromQr(value: string) {
  const match = value.trim().match(/^explorepath:\/\/friend\/([a-z0-9]{8,10})$/i);
  return match?.[1] ? normalizeFriendCode(match[1]) : null;
}

function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

const activityTasks: Omit<TeamTask, 'id' | 'required' | 'status'>[] = [
  { kind: 'steps', title: '一起前進', prompt: '每位成員再走 300 步，保持自己的舒服節奏。', stepTarget: 300 },
  { kind: 'activeMinutes', title: '五分鐘同行', prompt: '全隊再活動 5 分鐘，不需要比速度。', activeMinuteTarget: 5 },
];

const contentTasks: Record<TeamDifficulty, Omit<TeamTask, 'id' | 'required' | 'status'>[]> = {
  relaxed: [
    { kind: 'observation', title: '找到一種顏色', prompt: '安全停下後，全隊找出一個今天最醒目的顏色。' },
    { kind: 'observation', title: '聽見一個聲音', prompt: '在安全位置安靜幾秒，一起選出最先注意到的環境聲音。' },
    { kind: 'photo', title: '共同形狀', prompt: '找一個圓形或三角形街景，照片只保存在各自手機。' },
  ],
  standard: [
    { kind: 'observation', title: '雙條件搜查', prompt: '找出同時具有自然材質與人工線條的公共空間細節。' },
    { kind: 'observation', title: '兩處比較', prompt: '比較附近兩個街角，選出讓全隊更想停留的一處並說明原因。' },
    { kind: 'photo', title: '光影對照', prompt: '找出同時有亮面與陰影的安全位置，照片只保存在各自手機。' },
  ],
  challenge: [
    { kind: 'observation', title: '三段線索', prompt: '先找重複形狀，再找相同顏色，最後共同選出最符合兩項線索的目標。' },
    { kind: 'observation', title: '城市小推理', prompt: '分別觀察聲音、材質與人流，再共同推理這個地方最像哪種城市角色。' },
    { kind: 'photo', title: '故事拼圖', prompt: '依序找到時間痕跡、自然元素與方向記號，選一處作為故事終點。' },
  ],
};

export function createTeamTasks(
  durationMinutes: TeamRoom['durationMinutes'],
  difficulty: TeamDifficulty,
  seed: string,
): TeamTask[] {
  const count = requiredTaskCount(durationMinutes);
  const pool = contentTasks[difficulty];
  const start = hash(seed) % pool.length;
  const required: TeamTask[] = [];
  for (let index = 0; index < count; index += 1) {
    const source = index % 2 === 0
      ? activityTasks[Math.floor(index / 2) % activityTasks.length]!
      : pool[(start + index) % pool.length]!;
    required.push({ ...source, id: `${seed}-required-${index}`, required: true, status: 'pending' });
  }
  const optional = [0, 1].map((offset) => ({
    ...pool[(start + count + offset) % pool.length]!,
    id: `${seed}-optional-${offset}`,
    required: false,
    status: 'pending' as const,
  }));
  return [...required, ...optional];
}

export function canStartRoom(room: TeamRoom) {
  const activeMembers = room.members.filter((member) => member.leftAt == null);
  return room.phase === 'waiting'
    && activeMembers.length >= 2
    && activeMembers.length <= 6
    && activeMembers.every((member) => member.readyAt != null);
}

export function requiredTasksComplete(room: TeamRoom) {
  return room.tasks.filter((task) => task.required).every((task) => task.status === 'completed');
}

export function friendTokenFromQr(value: string) {
  return value.trim().match(/^explorepath:\/\/invite\/([a-f0-9]{48})$/i)?.[1]?.toLowerCase() ?? null;
}

// Physical tasks unlock sequentially; repeated tasks require an additional target.
export function physicalTaskTarget(tasks: TeamTask[], taskId: string) {
  const target = tasks.find((task) => task.id === taskId);
  if (!target) return 0;
  let total = 0;
  for (const task of tasks) {
    if (task.kind === target.kind) total += task.stepTarget ?? task.activeMinuteTarget ?? 0;
    if (task.id === taskId) break;
  }
  return total;
}
