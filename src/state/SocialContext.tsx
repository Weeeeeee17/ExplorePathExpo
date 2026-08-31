import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  canStartRoom,
  createTeamTasks,
  FriendCategory,
  normalizeFriendCode,
  requiredTasksComplete,
  SocialConnectionMode,
  SocialProfile,
  SocialSnapshot,
  TeamDifficulty,
  TeamJourneyMode,
  TeamRoom,
  physicalTaskTarget,
} from '../domain/social';
import { Destination, TrackedLocation } from '../domain/types';
import { searchNearbyDestinations } from '../services/overpass';
import {
  completeSocialTask,
  createSocialRoom,
  ensureSocialSession,
  finishSocialRoom,
  leaveSocialRoom,
  loadSocialSnapshot,
  publishSocialLocation,
  recoverSocialProfile,
  respondSocialFriendRequest,
  respondSocialRoomInvite,
  rotateSocialFriendCode,
  sendSocialFriendRequest,
  setSocialAvailability,
  setSocialRecoveryHash,
  setSocialRoomReady,
  startSocialRoom,
  subscribeSocialChanges,
  updateSocialFriendLabel,
  updateSocialNickname,
  socialAction,
  createSocialQr,
} from '../services/socialRepository';
import {
  generateRecoveryPhrase,
  hashRecoveryPhrase,
  loadRecoveryPhrase,
  normalizeRecoveryPhrase,
  saveRecoveryPhrase,
} from '../services/socialIdentity';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import {
  getCurrentTrackedLocation,
  requestForegroundLocationPermission,
  requestMotionAccess,
  stepsBetween,
  watchSteps,
} from '../services/tracking';
import { useExplorePath } from './ExplorePathContext';
import { journeyHealthMetrics } from '../domain/health';
import { publicPetDisplay } from '../domain/petDisplay';

const previewStorageKey = 'explorepath.social.preview.v1';

const previewPet = publicPetDisplay(null);
const previewProfile: SocialProfile = {
  id: 'preview-self', nickname: '探索者', friendCode: 'PATH2026', availabilityUntil: null, pet: previewPet,
};

function createPreviewSnapshot(): SocialSnapshot {
  return {
    profile: previewProfile,
    friends: [
      { profile: { id: 'preview-sunny', nickname: '小晴', friendCode: 'SUNNY001', availabilityUntil: Date.now() + 3_600_000, pet: { ...previewPet, symbol: '✧' } }, category: 'friend', favorite: true },
      { profile: { id: 'preview-forest', nickname: '阿森', friendCode: 'FOREST01', availabilityUntil: null, pet: { ...previewPet, name: '探索者徽章', visualKey: 'badge', symbol: '⌁' } }, category: 'coworker', favorite: false },
    ],
    requests: [],
    roomInvites: [],
    activeRoom: null,
  };
}

const errorMessages: Record<string, string> = {
  invalid_friend_code: '找不到這個好友碼，或這是你自己的好友碼。',
  already_friends: '你們已經是好友。',
  friend_limit_reached: '好友已達 50 位上限，請先移除一位。',
  daily_invite_limit: '今天已送出 10 次好友邀請，明天再試。',
  invite_cooldown: '對方拒絕後 24 小時內不能再次邀請。',
  blocked: '目前無法向這位使用者送出邀請。',
  members_not_ready: '需要全員完成準備才能出發。',
  members_not_arrived: '仍有隊員尚未進入目的地 60 公尺內並停留 30 秒。',
  required_tasks_incomplete: '仍有必要任務尚未由全隊完成。',
  fresh_locations_required: '請先更新所有隊員的位置。',
  members_not_within_100m: '同地探索需要所有成員在彼此 100 公尺內。',
  room_member_limit: '隊伍最多 6 人。',
  room_already_started: '旅程已開始，無法中途加入。',
  invite_unavailable: '這份邀請已失效或已被處理。',
  qr_expired: 'QR 已過期、達到 5 次上限或已被重新產生，請向好友索取新的 QR。',
  already_in_room: '你已在另一個等待或進行中的房間，請先離開。',
  sharing_not_allowed: '這份分享尚未同意、已到期或好友關係已變更。',
  invalid_health_summary: '步數或活動時間暫時無法核對，已保留本機紀錄，請稍後再同步。',
  task_not_reached: '這個任務尚未累積到必要步數或活動時間。',
  vote_unavailable: '投票已結束，或你不是這次投票的有效成員。',
  request_unavailable: '這份好友邀請已失效或已被處理。',
  current_profile_not_empty: '目前帳號已有好友或旅程，請先匯出資料，再使用新的裝置工作階段復原。',
};

function messageFor(error: unknown) {
  const message = error instanceof Error ? error.message : '目前無法完成操作。';
  for (const [key, value] of Object.entries(errorMessages)) if (message.includes(key)) return value;
  if (message.includes('get_social_snapshot') || message.includes('schema cache')) return 'Supabase 尚未套用 v0.8 資料庫 migration，請依設定文件完成後重新連線。';
  return message;
}

interface CreateTeamRoomOptions {
  mode: TeamJourneyMode;
  durationMinutes: TeamRoom['durationMinutes'];
  difficulty: TeamDifficulty;
  destinationName: string;
  destination: TeamRoom['destination'];
  invitedProfileIds: string[];
}

interface SocialContextValue {
  mode: SocialConnectionMode;
  configured: boolean;
  hydrated: boolean;
  busy: boolean;
  message: string | null;
  snapshot: SocialSnapshot;
  recoveryPhrase: string | null;
  foreground: boolean;
  currentSteps: number;
  activeSeconds: number;
  currentLocation: TrackedLocation | null;
  destinationOptions: Destination[];
  connectCloud: () => Promise<void>;
  usePreview: () => void;
  resetPreview: () => void;
  refresh: () => Promise<void>;
  clearMessage: () => void;
  setNickname: (nickname: string) => Promise<void>;
  setAvailability: (hours: 0 | 1 | 4 | 8) => Promise<void>;
  rotateFriendCode: () => Promise<void>;
  sendFriendRequest: (code: string) => Promise<void>;
  respondFriendRequest: (id: string, action: 'accept' | 'decline' | 'block') => Promise<void>;
  setFriendLabel: (id: string, category: FriendCategory, favorite: boolean) => Promise<void>;
  recoverAccount: (phrase: string) => Promise<void>;
  searchTeamDestinations: (durationMinutes: number) => Promise<void>;
  createRoom: (options: CreateTeamRoomOptions) => Promise<void>;
  respondRoomInvite: (id: string, accept: boolean) => Promise<void>;
  toggleReady: () => Promise<void>;
  startRoom: () => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  finishRoom: () => Promise<void>;
  leaveRoom: () => Promise<void>;
  addPreviewSteps: () => void;
  createQr: () => Promise<{ value: string; expiresAt: number } | null>;
  action: (name: string, parameters: Record<string, unknown>, success?: string) => Promise<void>;
}

const SocialContext = createContext<SocialContextValue | null>(null);

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const { saveTeamRecord, startTeamPetJourney, reconcileTeamPetJourneys, activePet, hydrated: appHydrated, mode: appMode, healthProfile, phase: soloPhase } = useExplorePath();
  const [mode, setMode] = useState<SocialConnectionMode>(isSupabaseConfigured ? 'setup' : 'preview');
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SocialSnapshot>(createPreviewSnapshot);
  const [recoveryPhrase, setRecoveryPhrase] = useState<string | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [currentSteps, setCurrentSteps] = useState(0);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<TrackedLocation | null>(null);
  const [destinationOptions, setDestinationOptions] = useState<Destination[]>([]);
  const modeRef = useRef(mode);
  const snapshotRef = useRef(snapshot);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statsRef = useRef({ roomId: '', steps: 0, activeSeconds: 0 });
  const completedTaskRequests = useRef(new Set<string>());
  const pendingLeaves = useRef<string[]>([]);
  const previousRoom = useRef<TeamRoom | null>(null);
  const [statsLoadedRoomId, setStatsLoadedRoomId] = useState<string | null>(null);
  statsRef.current.steps = currentSteps;
  statsRef.current.activeSeconds = activeSeconds;
  modeRef.current = mode;
  snapshotRef.current = snapshot;

  const petDisplay = publicPetDisplay(activePet);
  const petDisplaySignature = JSON.stringify(petDisplay);
  useEffect(() => {
    if (!appHydrated) return;
    if (mode === 'preview') {
      setSnapshot((current) => ({ ...current, profile: { ...current.profile, pet: petDisplay },
        activeRoom: current.activeRoom ? { ...current.activeRoom, members: current.activeRoom.members.map((member) => member.profile.id === current.profile.id ? { ...member, profile: { ...member.profile, pet: petDisplay } } : member) } : null }));
    } else if (mode === 'cloud' && appMode === 'real' && JSON.stringify(snapshotRef.current.profile.pet) !== petDisplaySignature) {
      void socialAction('update_social_pet', { p_name: petDisplay.name, p_series: petDisplay.visualKey, p_stage: petDisplay.stage })
        .then(() => refresh()).catch(() => setMessage('夥伴仍保存在本機；好友外觀未同步。請先套用 v0.9 寵物展示 migration，再重新連線。'));
    }
  }, [appHydrated, appMode, mode, snapshot.profile.id, petDisplaySignature]);

  useEffect(() => {
    const room = snapshot.activeRoom;
    if (mode === 'cloud' && appMode === 'real' && appHydrated && room?.phase === 'active' && room.startedAt && room.members.some((m) => m.profile.id === snapshot.profile.id && m.leftAt == null)) {
      startTeamPetJourney(`team-${room.id}`, Math.min(Date.now(), room.startedAt));
    }
  }, [mode, appMode, appHydrated, snapshot.activeRoom?.id, snapshot.activeRoom?.phase, snapshot.activeRoom?.startedAt]);

  const refresh = useCallback(async () => {
    if (modeRef.current !== 'cloud') return;
    try {
      for (const roomId of [...pendingLeaves.current]) {
        try { await leaveSocialRoom(roomId); pendingLeaves.current = pendingLeaves.current.filter((id) => id !== roomId); }
        catch (error) { if (String(error).includes('not_room_member')) pendingLeaves.current = pendingLeaves.current.filter((id) => id !== roomId); }
      }
      await AsyncStorage.setItem('explorepath.social.pending-leaves', JSON.stringify(pendingLeaves.current));
      const next = await loadSocialSnapshot();
      if (next.activeRoom && pendingLeaves.current.includes(next.activeRoom.id)) next.activeRoom = null;
      setSnapshot(next);
    } catch (error) {
      setMessage(messageFor(error));
      if (String(error).includes('social_profile_missing')) { setMode('setup'); setSnapshot(createPreviewSnapshot()); setRecoveryPhrase(null); }
    }
  }, []);

  useEffect(() => {
    if (!appHydrated || mode !== 'cloud' || appMode !== 'real') return;
    const room = snapshot.activeRoom;
    const participating = room?.members.some((m) => m.profile.id === snapshot.profile.id && m.leftAt == null);
    reconcileTeamPetJourneys(room && participating ? `team-${room.id}` : null);
  }, [appHydrated, appMode, mode, snapshot.activeRoom, snapshot.profile.id]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(previewStorageKey);
        const leaves = await AsyncStorage.getItem('explorepath.social.pending-leaves');
        if (leaves) { const ids = JSON.parse(leaves); if (Array.isArray(ids)) pendingLeaves.current = ids.filter((id) => typeof id === 'string'); }
        if (alive && stored && !isSupabaseConfigured) {
          const parsed = JSON.parse(stored) as SocialSnapshot;
          if (parsed.profile?.id === 'preview-self' && Array.isArray(parsed.friends)) setSnapshot(parsed);
        }
      } catch { /* A damaged preview must not block the real app. */ }
      if (alive) setHydrated(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (hydrated && mode === 'preview') void AsyncStorage.setItem(previewStorageKey, JSON.stringify(snapshot));
  }, [hydrated, mode, snapshot]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      if (state === 'active') {
        supabase?.auth.startAutoRefresh();
        void refresh();
      } else {
        supabase?.auth.stopAutoRefresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  useEffect(() => {
    if (mode !== 'cloud' || !foreground) return;
    const unsubscribe = subscribeSocialChanges(() => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => void refresh(), 350);
    });
    const timer = setInterval(() => void refresh(), 30_000);
    return () => { unsubscribe(); clearInterval(timer); if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, [mode, foreground, refresh]);

  const connectCloud = async () => {
    if (appMode !== 'real') { setMessage('展示沙盒不會連接真實好友帳號，請先返回真實資料。'); return; }
    if (!isSupabaseConfigured) { setMessage('請先依 SUPABASE_SETUP.md 設定免費專案 URL 與 Publishable Key。'); return; }
    setBusy(true);
    setMessage(null);
    try {
      await ensureSocialSession();
      const cloudSnapshot = await loadSocialSnapshot();
      if (cloudSnapshot.activeRoom && pendingLeaves.current.includes(cloudSnapshot.activeRoom.id)) cloudSnapshot.activeRoom = null;
      let phrase = await loadRecoveryPhrase(cloudSnapshot.profile.id);
      if (!phrase) {
        phrase = await generateRecoveryPhrase();
        await setSocialRecoveryHash(await hashRecoveryPhrase(phrase));
        await saveRecoveryPhrase(phrase, cloudSnapshot.profile.id);
      }
      setRecoveryPhrase(phrase);
      setSnapshot(cloudSnapshot);
      setMode('cloud');
      setMessage('已連線至你的 Supabase 免費專案。請先保存私人復原密語。');
    } catch (error) { setMessage(messageFor(error)); }
    finally { setBusy(false); }
  };

  const perform = async (cloudAction: () => Promise<void>, previewAction: () => void, success?: string) => {
    if (appMode === 'demo' && modeRef.current === 'cloud') return;
    setBusy(true);
    setMessage(null);
    try {
      if (modeRef.current === 'cloud') { await cloudAction(); await refresh(); }
      else if (modeRef.current === 'preview') previewAction();
      else throw new Error('請先連線，或明確切換本機預覽。');
      if (success) setMessage(success);
    } catch (error) { setMessage(messageFor(error)); }
    finally { setBusy(false); }
  };

  const setNickname = async (nickname: string) => {
    const clean = nickname.trim().slice(0, 24);
    if (!clean) return;
    await perform(() => updateSocialNickname(clean), () => setSnapshot((value) => ({ ...value, profile: { ...value.profile, nickname: clean } })));
  };

  const setAvailability = async (hours: 0 | 1 | 4 | 8) => perform(
    () => setSocialAvailability(hours),
    () => setSnapshot((value) => ({ ...value, profile: { ...value.profile, availabilityUntil: hours ? Date.now() + hours * 3_600_000 : null } })),
    hours ? `已開啟可組隊狀態 ${hours} 小時，不會公開最後登入時間。` : '已關閉可組隊狀態。',
  );

  const rotateFriendCode = async () => perform(
    async () => { await rotateSocialFriendCode(); },
    () => setSnapshot((value) => ({ ...value, profile: { ...value.profile, friendCode: `P${Date.now().toString(36).toUpperCase()}`.slice(-10) } })),
    '好友碼已更新，舊碼不再有效。',
  );

  const sendFriendRequest = async (code: string) => perform(
    () => sendSocialFriendRequest(normalizeFriendCode(code)),
    () => undefined,
    modeRef.current === 'cloud' ? '好友邀請已送出，7 天後失效。' : '本機預覽：已模擬送出邀請。這不是跨手機連線。',
  );

  const respondFriendRequest = async (id: string, action: 'accept' | 'decline' | 'block') => perform(
    () => respondSocialFriendRequest(id, action),
    () => setSnapshot((value) => {
      const request = value.requests.find((item) => item.id === id);
      return { ...value, requests: value.requests.filter((item) => item.id !== id), friends: action === 'accept' && request ? [...value.friends, { profile: request.sender, category: 'friend', favorite: false }] : value.friends };
    }),
  );

  const setFriendLabel = async (id: string, category: FriendCategory, favorite: boolean) => perform(
    () => updateSocialFriendLabel(id, category, favorite),
    () => setSnapshot((value) => ({ ...value, friends: value.friends.map((friend) => friend.profile.id === id ? { ...friend, category, favorite } : friend) })),
  );

  const recoverAccount = async (phrase: string) => {
    if (normalizeRecoveryPhrase(phrase).length !== 32) { setMessage('復原密語應包含 32 個英數字元，連字號可以省略。'); return; }
    if (!isSupabaseConfigured) { setMessage('帳號復原需要先連線至你的 Supabase 專案；本機預覽不會假裝復原成功。'); return; }
    setBusy(true);
    try {
      await ensureSocialSession();
      if (!(await recoverSocialProfile(await hashRecoveryPhrase(phrase)))) throw new Error('找不到這組復原密語。');
      const restored = await loadSocialSnapshot();
      await saveRecoveryPhrase(phrase, restored.profile.id);
      setRecoveryPhrase(phrase);
      setMode('cloud');
      setSnapshot(restored);
      setMessage('帳號已復原。原裝置的社交資料存取權已轉移到這個登入工作階段。');
    } catch (error) { setMessage(messageFor(error)); }
    finally { setBusy(false); }
  };

  const searchTeamDestinations = async (durationMinutes: number) => {
    setBusy(true);
    try {
      if (!(await requestForegroundLocationPermission())) throw new Error('需要前景定位權限才能尋找共同目的地。');
      const location = await getCurrentTrackedLocation();
      setCurrentLocation(location);
      const results = await searchNearbyDestinations(location, durationMinutes);
      setDestinationOptions(results.slice(0, 8));
      setMessage(results.length ? '已找到附近地點，請選一個共同目的地。' : '附近暫時沒有符合條件的地點。');
    } catch (error) { setMessage(messageFor(error)); }
    finally { setBusy(false); }
  };

  const createRoom = async (options: CreateTeamRoomOptions) => {
    if (['active', 'arrival', 'review', 'reward'].includes(soloPhase)) { setMessage('請先結束個人旅程，再開始組隊。'); return; }
    const id = `preview-room-${Date.now()}`;
    const tasks = createTeamTasks(options.durationMinutes, options.difficulty, id);
    await perform(
      () => createSocialRoom({ ...options, tasks }),
      () => {
        const now = Date.now();
        const value = snapshotRef.current;
        const profiles = [value.profile, ...value.friends.filter((friend) => options.invitedProfileIds.includes(friend.profile.id)).map((friend) => friend.profile)].slice(0, 6);
        setSnapshot({ ...value, activeRoom: {
          id, phase: 'waiting', mode: options.mode, durationMinutes: options.durationMinutes, difficulty: options.difficulty,
          destinationName: options.destinationName.trim() || '共同探索地點', destination: options.destination,
          createdAt: now, startedAt: null, expectedEndAt: null, maxEndAt: null, completedAt: null,
          members: profiles.map((profile, index) => ({ profile, joinedAt: now + index, readyAt: index === 0 ? null : now, leftAt: null, isHost: index === 0, location: null, arrivedAt: null })),
          tasks,
        } });
      },
      modeRef.current === 'cloud' ? '組隊房間已建立，好友邀請將在 15 分鐘後失效。' : '本機預覽房間已建立；示範好友已模擬加入並準備。',
    );
  };

  const respondRoomInvite = async (id: string, accept: boolean) => perform(
    () => respondSocialRoomInvite(id, accept),
    () => undefined,
  );

  const toggleReady = async () => {
    const room = snapshotRef.current.activeRoom;
    if (!room) return;
    const self = room.members.find((member) => member.profile.id === snapshotRef.current.profile.id);
    const ready = !self?.readyAt;
    if (ready && modeRef.current === 'cloud') {
      setBusy(true);
      try {
        if (!(await requestForegroundLocationPermission())) throw new Error('請先允許前景定位。');
        const motion = await requestMotionAccess();
        if (motion !== 'available') throw new Error('組隊旅程需要可用的動作與健身步數權限。');
        const location = await getCurrentTrackedLocation();
        setCurrentLocation(location);
        await publishSocialLocation(room.id, location);
      } catch (error) { setMessage(messageFor(error)); setBusy(false); return; }
      setBusy(false);
    }
    await perform(
      () => setSocialRoomReady(room.id, ready),
      () => setSnapshot((value) => ({ ...value, activeRoom: value.activeRoom ? { ...value.activeRoom, members: value.activeRoom.members.map((member) => member.profile.id === value.profile.id ? { ...member, readyAt: ready ? Date.now() : null } : member) } : null })),
    );
  };

  const startRoom = async () => {
    const room = snapshotRef.current.activeRoom;
    if (!room || !canStartRoom(room)) { setMessage('需要 2～6 位成員全部準備完成。'); return; }
    await perform(
      () => startSocialRoom(room.id),
      () => {
        const startedAt = Date.now() + 10_000;
        setCurrentSteps(0);
        setSnapshot((value) => ({ ...value, activeRoom: value.activeRoom ? { ...value.activeRoom, phase: 'active', startedAt, expectedEndAt: startedAt + room.durationMinutes * 60_000, maxEndAt: startedAt + 4 * 3_600_000 } : null }));
      },
    );
  };

  const completeTask = async (taskId: string) => {
    const room = snapshotRef.current.activeRoom;
    if (!room) return;
    const task = room.tasks.find((item) => item.id === taskId);
    if (!task || room.phase !== 'active' || !room.startedAt || Date.now() < room.startedAt) return;
    const target = physicalTaskTarget(room.tasks, taskId);
    if (task.kind === 'steps' && currentSteps < target) return;
    if (task.kind === 'activeMinutes' && activeSeconds < target * 60) return;
    await perform(
      () => completeSocialTask(room.id, taskId, currentSteps, activeSeconds),
      () => setSnapshot((value) => ({ ...value, activeRoom: value.activeRoom ? { ...value.activeRoom, tasks: value.activeRoom.tasks.map((task) => task.id === taskId ? { ...task, status: 'completed' } : task) } : null })),
      modeRef.current === 'cloud' ? '已記錄你的完成確認，等待其他隊員。' : '本機預覽：已模擬全隊完成這個任務。',
    );
  };

  const finishRoom = async () => {
    const room = snapshotRef.current.activeRoom;
    if (!room || (!room.solo && !requiredTasksComplete(room))) { setMessage('請先完成所有必要任務。'); return; }
    await perform(
      async () => { await captureFinalSteps(room); await finishSocialRoom(room.id); },
      () => setSnapshot((value) => ({ ...value, activeRoom: value.activeRoom ? { ...value.activeRoom, phase: 'completed', completedAt: Date.now(), members: value.activeRoom.members.map((member) => ({ ...member, location: null, arrivedAt: Date.now() })) } : null })),
      modeRef.current === 'cloud' ? '全隊完成！即時位置已停止分享。' : '本機預覽完成。示範步數不會寫入真實健康紀錄。',
    );
  };

  const leaveRoom = async () => {
    const room = snapshotRef.current.activeRoom;
    if (!room) return;
    if (modeRef.current === 'cloud') {
      // Stop local tracking immediately, even when the server is unreachable.
      pendingLeaves.current = [...new Set([...pendingLeaves.current, room.id])];
      await AsyncStorage.setItem('explorepath.social.pending-leaves', JSON.stringify(pendingLeaves.current));
      setSnapshot((value) => ({ ...value, activeRoom: null }));
      await captureFinalSteps(room);
      saveHealthRecord(room, room.phase === 'completed');
      await refresh();
      setMessage(pendingLeaves.current.includes(room.id) ? '已在本機停止定位並保存步數。離隊要求待網路恢復後送出；好友端會依最後更新時間顯示過期。' : '已離隊並停止分享，有效步數已保存。');
    } else setSnapshot((value) => ({ ...value, activeRoom: null }));
  };

  function saveHealthRecord(room: TeamRoom, completed: boolean) {
    if (statsRef.current.roomId !== room.id) return;
    const self = room.members.find((member) => member.profile.id === snapshotRef.current.profile.id);
    completed = completed && !!self && self.leftAt == null;
    const steps = statsRef.current.steps;
    if (modeRef.current !== 'cloud' || !room.startedAt) return;
    const endedAt = Math.min(Date.now(), room.completedAt ?? room.maxEndAt ?? Date.now());
    const elapsedMinutes = Math.max(1, Math.round((endedAt - room.startedAt) / 60_000));
    const metrics = journeyHealthMetrics({ steps, elapsedMinutes, strideLengthCm: healthProfile.strideLengthCm, stepStatus: 'partial' });
    saveTeamRecord({ id: `team-${room.id}`, destinationName: room.destinationName, theme: 'surprise', endedAt, elapsedMinutes, steps,
      estimatedActiveMinutes: Math.min(elapsedMinutes, activeSeconds / 60), stoppedMinutes: Math.max(0, elapsedMinutes - activeSeconds / 60),
      estimatedDistanceMeters: metrics.estimatedDistanceMeters, averageCadence: metrics.averageCadence, healthIntensity: metrics.intensity,
      mood: null, effort: null, hasPhoto: false, note: room.solo ? '組隊轉個人旅程；團隊任務未完成。' : '好友組隊旅程；僅記錄本機個人步數。',
      earnedXP: 0, completed, outcome: completed ? 'arrived' : 'unreached', stepStatus: 'partial', kind: 'normal', destinationRevealed: true,
      destinationId: `team-place-${room.destination?.latitude}-${room.destination?.longitude}`,
      destinationLatitude: room.destination?.latitude, destinationLongitude: room.destination?.longitude });
  }

  async function captureFinalSteps(room: TeamRoom) {
    if (!room.startedAt || Date.now() <= room.startedAt) return;
    const end = Math.min(Date.now(), room.completedAt ?? room.maxEndAt ?? Date.now());
    const steps = await stepsBetween(room.startedAt, end);
    if (steps != null) { statsRef.current.steps = Math.max(statsRef.current.steps, steps); setCurrentSteps(statsRef.current.steps); }
    await socialAction('save_social_health_summary', { p_room_id: room.id, p_steps: statsRef.current.steps, p_active_seconds: Math.floor(statsRef.current.activeSeconds) }).catch(() => undefined);
  }

  useEffect(() => {
    const previous = previousRoom.current;
    if (mode === 'cloud' && previous?.phase === 'active' && (!snapshot.activeRoom || previous.id !== snapshot.activeRoom.id)) saveHealthRecord(previous, false);
    previousRoom.current = snapshot.activeRoom;
  }, [mode, snapshot.activeRoom]);

  useEffect(() => {
    const room = snapshot.activeRoom;
    if (mode !== 'cloud' || !room) return;
    let cancelled = false;
    if (statsRef.current.roomId !== room.id) {
      statsRef.current.roomId = room.id;
      statsRef.current.steps = 0; statsRef.current.activeSeconds = 0;
      setStatsLoadedRoomId(null);
      setCurrentSteps(0); setActiveSeconds(0);
      void AsyncStorage.getItem(`explorepath.team-stats.${room.id}`).then((stored) => {
        if (cancelled) return;
        try { const stats = stored ? JSON.parse(stored) : {}; setCurrentSteps(Math.max(0, Number(stats.steps) || 0)); setActiveSeconds(Math.max(0, Number(stats.activeSeconds) || 0)); } catch { /* Keep valid defaults. */ }
        setStatsLoadedRoomId(room.id);
      }).catch(() => { if (!cancelled) setStatsLoadedRoomId(room.id); });
    }
    return () => { cancelled = true; };
  }, [mode, snapshot.activeRoom?.id]);

  useEffect(() => {
    const room = snapshot.activeRoom;
    if (!appHydrated || mode !== 'cloud' || !room?.startedAt || statsLoadedRoomId !== room.id) return;
    void AsyncStorage.setItem(`explorepath.team-stats.${room.id}`, JSON.stringify({ steps: currentSteps, activeSeconds })).catch(() => undefined);
    if (room.phase === 'completed' || room.phase === 'closed') saveHealthRecord(room, room.phase === 'completed');
  }, [appHydrated, mode, snapshot.activeRoom?.id, snapshot.activeRoom?.phase, currentSteps, activeSeconds, statsLoadedRoomId]);

  useEffect(() => {
    const room = snapshot.activeRoom;
    if (!room || room.phase !== 'active' || !room.maxEndAt) return;
    const timer = setTimeout(() => {
      setSnapshot((value) => value.activeRoom?.id === room.id ? { ...value, activeRoom: { ...value.activeRoom, phase: 'closed' } } : value);
      setMessage('這趟已達 4 小時上限，已停止本機定位並保存已知步數；連線後同步結束狀態。');
    }, Math.max(0, room.maxEndAt - Date.now()));
    return () => clearTimeout(timer);
  }, [snapshot.activeRoom?.id, snapshot.activeRoom?.phase, snapshot.activeRoom?.maxEndAt]);

  useEffect(() => {
    const room = snapshot.activeRoom;
    if (!foreground || room?.phase !== 'active' || !room.startedAt || room.solo || Date.now() < room.startedAt) return;
    const task = room.tasks.find((item) => !item.confirmedByMe && item.status !== 'completed' && !completedTaskRequests.current.has(item.id)
      && ((item.kind === 'steps' && currentSteps >= physicalTaskTarget(room.tasks, item.id)) || (item.kind === 'activeMinutes' && activeSeconds >= physicalTaskTarget(room.tasks, item.id) * 60)));
    if (!task) return;
    completedTaskRequests.current.add(task.id);
    void completeTask(task.id).finally(() => { completedTaskRequests.current.delete(task.id); });
  }, [mode, foreground, snapshot.activeRoom, currentSteps, activeSeconds]);

  useEffect(() => {
    const room = snapshot.activeRoom;
    if (mode !== 'cloud' || !foreground || !room || statsLoadedRoomId !== room.id || !['waiting', 'active'].includes(room.phase)) return;
    if (room.phase === 'waiting' && !room.members.find((member) => member.profile.id === snapshot.profile.id)?.readyAt) return;
    let cancelled = false;
    let updating = false;
    let priorSteps = statsRef.current.steps;
    let priorTime = Date.now();
    const update = async () => {
      if (updating || (room.startedAt && Date.now() < room.startedAt)) return;
      updating = true;
      try {
        const location = await getCurrentTrackedLocation();
        const steps = room.startedAt ? await stepsBetween(room.startedAt, Math.min(Date.now(), room.maxEndAt ?? Date.now())) : null;
        if (cancelled || AppState.currentState !== 'active' || pendingLeaves.current.includes(room.id)) return;
        setCurrentLocation(location);
        const nextSteps = Math.max(statsRef.current.steps, steps ?? 0);
        if (room.startedAt && nextSteps > priorSteps) setActiveSeconds((seconds) => seconds + Math.min(30, Math.max(0, (Date.now() - priorTime) / 1000)));
        priorSteps = nextSteps; priorTime = Date.now();
        if (steps != null) setCurrentSteps(nextSteps);
        await publishSocialLocation(room.id, location);
        if (room.startedAt) await socialAction('save_social_health_summary', { p_room_id: room.id, p_steps: nextSteps, p_active_seconds: Math.floor(statsRef.current.activeSeconds) });
        await refresh();
      } catch (error) { if (!cancelled) setMessage(messageFor(error)); }
      finally { updating = false; }
    };
    void update();
    const timer = setInterval(() => void update(), 30_000);
    const baseSteps = statsRef.current.steps;
    let stepSubscription: ReturnType<typeof watchSteps> | null = null;
    const begin = setTimeout(() => { if (!cancelled && room.startedAt) stepSubscription = watchSteps((steps) => { if (!cancelled && Date.now() < (room.maxEndAt ?? Infinity)) setCurrentSteps((previous) => Math.max(previous, baseSteps + steps)); }); }, Math.max(0, (room.startedAt ?? Date.now()) - Date.now()));
    return () => { cancelled = true; clearInterval(timer); clearTimeout(begin); stepSubscription?.remove(); };
  }, [mode, foreground, statsLoadedRoomId, snapshot.activeRoom?.id, snapshot.activeRoom?.phase, snapshot.activeRoom?.startedAt, snapshot.activeRoom?.members.find((member) => member.profile.id === snapshot.profile.id)?.readyAt, refresh]);

  useEffect(() => {
    if (mode !== 'cloud' || !foreground || !snapshot.shares?.some((share) => share.status === 'active' && share.expiresAt > Date.now())) return;
    let cancelled = false;
    let updating = false;
    const update = async () => {
      if (updating) return; updating = true;
      try {
        const location = await getCurrentTrackedLocation();
        if (cancelled || AppState.currentState !== 'active') return;
        await socialAction('publish_social_share_location', { p_latitude: location.latitude, p_longitude: location.longitude, p_captured_at: new Date(location.timestamp).toISOString() });
      } catch (error) { if (!cancelled) setMessage(messageFor(error)); }
      finally { updating = false; }
    };
    void update(); const timer = setInterval(() => void update(), 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [mode, foreground, snapshot.shares?.filter((share) => share.status === 'active').map((share) => share.id).join(',')]);

  const action: SocialContextValue['action'] = async (name, parameters, success) => {
    if (['request_social_share', 'respond_social_share'].includes(name) && parameters.p_accept !== false) {
      if (!(await requestForegroundLocationPermission())) { setMessage('位置分享需要前景定位權限。'); return; }
    }
    await perform(async () => { await socialAction(name, parameters); }, () => { setMessage('這項操作需要 Supabase 連線，本機預覽不會改變真實好友或分享權限。'); }, mode === 'cloud' ? success : undefined);
  };

  const value: SocialContextValue = {
    mode, configured: isSupabaseConfigured, hydrated, busy, message, snapshot, recoveryPhrase,
    foreground, currentSteps, activeSeconds, currentLocation, destinationOptions,
    connectCloud,
    usePreview: () => { setMode('preview'); setSnapshot(createPreviewSnapshot()); setMessage('已切換本機預覽，所有好友與房間都是示範資料。'); },
    resetPreview: () => { setSnapshot(createPreviewSnapshot()); setCurrentSteps(0); setMessage('本機預覽已重設。'); },
    refresh, clearMessage: () => setMessage(null), setNickname, setAvailability, rotateFriendCode,
    sendFriendRequest, respondFriendRequest, setFriendLabel, recoverAccount, searchTeamDestinations,
    createRoom, respondRoomInvite, toggleReady, startRoom, completeTask, finishRoom, leaveRoom,
    addPreviewSteps: () => { if (mode === 'preview') { setCurrentSteps((steps) => steps + 300); setActiveSeconds((seconds) => seconds + 300); } },
    action,
    createQr: async () => { if (mode !== 'cloud') { setMessage('限時 QR 邀請需要真實 Supabase 連線。'); return null; } try { return await createSocialQr(); } catch (error) { setMessage(messageFor(error)); return null; } },
  };

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const context = useContext(SocialContext);
  if (!context) throw new Error('useSocial must be used inside SocialProvider');
  return context;
}
