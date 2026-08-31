import {
  FriendCategory,
  SocialFriend,
  SocialFriendRequest,
  SocialRoomInvite,
  SocialPetDisplay,
  SocialProfile,
  SocialSnapshot,
  TeamDifficulty,
  TeamJourneyMode,
  TeamLocation,
  TeamMember,
  TeamRoom,
  TeamTask,
} from '../domain/social';
import { TrackedLocation } from '../domain/types';
import { supabase } from './supabaseClient';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function timestamp(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function petFrom(value: unknown): SocialPetDisplay {
  const item = object(value);
  return {
    name: text(item.name, '未孵化蛋'),
    visualKey: text(item.visualKey, 'egg'),
    stage: text(item.stage, '等待相遇'),
    storyChapter: text(item.storyChapter, '序章'),
    symbol: text(item.symbol, '◉'),
  };
}

function profileFrom(value: unknown): SocialProfile {
  const item = object(value);
  return {
    id: text(item.id),
    nickname: text(item.nickname, '新探索者'),
    friendCode: text(item.friendCode),
    availabilityUntil: timestamp(item.availabilityUntil),
    pet: petFrom(item.pet),
  };
}

function locationFrom(value: unknown): TeamLocation | null {
  if (!value) return null;
  const item = object(value);
  const profileId = text(item.profileId);
  const capturedAt = timestamp(item.timestamp);
  if (!profileId || capturedAt == null) return null;
  return {
    profileId,
    latitude: number(item.latitude),
    longitude: number(item.longitude),
    accuracyMeters: item.accuracyMeters == null ? null : number(item.accuracyMeters),
    timestamp: capturedAt,
  };
}

function memberFrom(value: unknown): TeamMember {
  const item = object(value);
  return {
    profile: profileFrom(item.profile),
    joinedAt: timestamp(item.joinedAt) ?? 0,
    readyAt: timestamp(item.readyAt),
    leftAt: timestamp(item.leftAt),
    isHost: item.isHost === true,
    location: locationFrom(item.location),
    arrivedAt: timestamp(item.arrivedAt),
    lastLocationAt: timestamp(item.lastLocationAt),
    locationIssue: item.locationIssue == null ? null : text(item.locationIssue),
  };
}

function taskFrom(value: unknown): TeamTask {
  const item = object(value);
  return {
    id: text(item.id),
    kind: text(item.kind, 'observation') as TeamTask['kind'],
    title: text(item.title),
    prompt: text(item.prompt),
    required: item.required !== false,
    status: item.status === 'completed' ? 'completed' : 'pending',
    stepTarget: item.stepTarget == null ? undefined : number(item.stepTarget),
    activeMinuteTarget: item.activeMinuteTarget == null ? undefined : number(item.activeMinuteTarget),
    confirmedByMe: item.confirmedByMe === true,
  };
}

function roomFrom(value: unknown): TeamRoom | null {
  if (!value) return null;
  const item = object(value);
  const destination = item.destination ? object(item.destination) : null;
  return {
    id: text(item.id),
    phase: text(item.phase, 'waiting') as TeamRoom['phase'],
    mode: text(item.mode, 'gather') as TeamJourneyMode,
    durationMinutes: number(item.durationMinutes, 30) as TeamRoom['durationMinutes'],
    difficulty: text(item.difficulty, 'relaxed') as TeamDifficulty,
    destinationName: text(item.destinationName, '共同目的地'),
    destination: destination ? { latitude: number(destination.latitude), longitude: number(destination.longitude) } : null,
    createdAt: timestamp(item.createdAt) ?? Date.now(),
    startedAt: timestamp(item.startedAt),
    expectedEndAt: timestamp(item.expectedEndAt),
    maxEndAt: timestamp(item.maxEndAt),
    completedAt: timestamp(item.completedAt),
    members: array(item.members).map(memberFrom),
    tasks: array(item.tasks).map(taskFrom),
    solo: item.solo === true,
    kickVotes: array(item.kickVotes).map((value) => {
      const vote = object(value);
      return { id: text(vote.id), targetId: text(vote.targetId), expiresAt: timestamp(vote.expiresAt) ?? 0, approvals: number(vote.approvals), needed: number(vote.needed), votedByMe: vote.votedByMe === true };
    }),
  };
}

function snapshotFrom(value: unknown): SocialSnapshot {
  const item = object(value);
  return {
    profile: profileFrom(item.profile),
    friends: array(item.friends).map((friend): SocialFriend => {
      const row = object(friend);
      return {
        profile: profileFrom(row.profile),
        category: text(row.category, 'friend') as FriendCategory,
        favorite: row.favorite === true,
      };
    }),
    requests: array(item.requests).map((request): SocialFriendRequest => {
      const row = object(request);
      return {
        id: text(row.id),
        sender: profileFrom(row.sender),
        createdAt: timestamp(row.createdAt) ?? 0,
        expiresAt: timestamp(row.expiresAt) ?? 0,
      };
    }),
    roomInvites: array(item.roomInvites).map((invite): SocialRoomInvite => {
      const row = object(invite);
      return {
        id: text(row.id),
        roomId: text(row.roomId),
        host: profileFrom(row.host),
        mode: text(row.mode, 'gather') as TeamJourneyMode,
        durationMinutes: number(row.durationMinutes, 30) as TeamRoom['durationMinutes'],
        difficulty: text(row.difficulty, 'relaxed') as TeamDifficulty,
        destinationName: text(row.destinationName, '共同目的地'),
        expiresAt: timestamp(row.expiresAt) ?? 0,
      };
    }),
    activeRoom: roomFrom(item.activeRoom),
    shares: array(item.shares).map((value) => {
      const share = object(value);
      return { id: text(share.id), friend: profileFrom(share.friend), incoming: share.incoming === true, status: share.status === 'active' ? 'active' : 'pending', hours: number(share.hours, 1) as 1 | 4 | 8, expiresAt: timestamp(share.expiresAt) ?? 0, myPrecision: share.myPrecision === 'precise' ? 'precise' : 'approximate', location: locationFrom(share.location) };
    }),
  };
}

async function rpc<T = unknown>(name: string, parameters: Record<string, unknown> = {}) {
  if (!supabase) throw new Error('Supabase 尚未設定。');
  const { data, error } = await supabase.rpc(name, parameters);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function ensureSocialSession() {
  if (!supabase) throw new Error('Supabase 尚未設定。');
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const signedIn = await supabase.auth.signInAnonymously();
  if (signedIn.error || !signedIn.data.session) {
    throw new Error(signedIn.error?.message ?? '無法建立匿名帳號。');
  }
  return signedIn.data.session;
}

export async function loadSocialSnapshot() {
  return snapshotFrom(await rpc('get_social_snapshot'));
}

export async function updateSocialNickname(nickname: string) {
  await rpc('update_social_nickname', { p_nickname: nickname });
}

export async function setSocialRecoveryHash(secretHash: string) {
  await rpc('set_social_recovery_hash', { p_secret_hash: secretHash });
}

export async function recoverSocialProfile(secretHash: string) {
  return Boolean(await rpc('recover_social_profile', { p_secret_hash: secretHash }));
}

export async function rotateSocialFriendCode() {
  return String(await rpc('rotate_social_friend_code'));
}

export async function setSocialAvailability(hours: 0 | 1 | 4 | 8) {
  await rpc('set_social_availability', { p_hours: hours });
}

export async function sendSocialFriendRequest(friendCode: string) {
  await rpc('send_social_friend_request', { p_friend_code: friendCode });
}

export async function respondSocialFriendRequest(requestId: string, action: 'accept' | 'decline' | 'block') {
  await rpc('respond_social_friend_request', { p_request_id: requestId, p_action: action });
}

export async function updateSocialFriendLabel(friendProfileId: string, category: FriendCategory, favorite: boolean) {
  await rpc('update_social_friend_label', {
    p_friend_profile_id: friendProfileId,
    p_category: category,
    p_favorite: favorite,
  });
}

export interface CreateRoomInput {
  mode: TeamJourneyMode;
  durationMinutes: TeamRoom['durationMinutes'];
  difficulty: TeamDifficulty;
  destinationName: string;
  destination: { latitude: number; longitude: number } | null;
  tasks: TeamTask[];
  invitedProfileIds: string[];
}

export async function createSocialRoom(input: CreateRoomInput) {
  await rpc('create_social_room', {
    p_mode: input.mode,
    p_duration_minutes: input.durationMinutes,
    p_difficulty: input.difficulty,
    p_destination_name: input.destinationName,
    p_destination_latitude: input.destination?.latitude ?? null,
    p_destination_longitude: input.destination?.longitude ?? null,
    p_tasks: input.tasks,
    p_invited_profile_ids: input.invitedProfileIds,
  });
}

export async function setSocialRoomReady(roomId: string, ready: boolean) {
  await rpc('set_social_room_ready', { p_room_id: roomId, p_ready: ready });
}

export async function respondSocialRoomInvite(inviteId: string, accept: boolean) {
  await rpc('respond_social_room_invite', { p_invite_id: inviteId, p_accept: accept });
}

export async function startSocialRoom(roomId: string) {
  await rpc('start_social_room', { p_room_id: roomId });
}

export async function publishSocialLocation(roomId: string, location: TrackedLocation) {
  await rpc('publish_social_location', {
    p_room_id: roomId,
    p_latitude: location.latitude,
    p_longitude: location.longitude,
    p_accuracy_meters: location.accuracyMeters,
    p_captured_at: new Date(location.timestamp).toISOString(),
  });
}

export async function completeSocialTask(roomId: string, taskId: string, steps: number, activeSeconds: number) {
  await rpc('confirm_social_task', { p_room_id: roomId, p_task_id: taskId, p_steps: Math.floor(steps), p_active_seconds: Math.floor(activeSeconds) });
}

export async function socialAction(name: string, parameters: Record<string, unknown> = {}) { return rpc(name, parameters); }

export async function createSocialQr() {
  const value = object(await rpc('create_social_friend_qr'));
  return { value: `explorepath://invite/${text(value.token)}`, expiresAt: timestamp(value.expiresAt) ?? 0 };
}

export async function finishSocialRoom(roomId: string) {
  await rpc('finish_social_room', { p_room_id: roomId });
}

export async function leaveSocialRoom(roomId: string) {
  await rpc('leave_social_room', { p_room_id: roomId });
}

export function subscribeSocialChanges(onChange: () => void) {
  if (!supabase) return () => undefined;
  const client = supabase;
  const channel = client
    .channel('explorepath-social-v08')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'social_friend_requests' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'social_friendships' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'social_rooms' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'social_room_invites' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'social_room_tasks' }, onChange)
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
