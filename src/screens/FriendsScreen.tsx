import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureRef } from 'react-native-view-shot';
import { Card, ChoiceChip, Kicker, Metric, Page, PrimaryButton, SecondaryButton, typography } from '../components/UI';
import { SafetyTicker } from '../components/SafetyTicker';
import { TeamPetScene } from '../components/TeamPetScene';
import { TeamMap } from '../components/TeamMap';
import { canStartRoom, friendCategoryMeta, FriendCategory, friendTokenFromQr, isAvailabilityActive, physicalTaskTarget, requiredTaskCount, requiredTasksComplete, TeamDifficulty, TeamJourneyMode, TeamRoom, teamDifficultyMeta, teamLocationState, teamModeMeta } from '../domain/social';
import { Destination } from '../domain/types';
import { captureMemoryPhoto, pickMemoryPhoto } from '../services/memoryMedia';
import { shareMemoryImage } from '../services/backup';
import { useSocial } from '../state/SocialContext';
import { colors } from '../theme';

function Field({ value, onChangeText, placeholder, secure = false }: { value: string; onChangeText: (value: string) => void; placeholder: string; secure?: boolean }) {
  return <TextInput accessibilityLabel={placeholder} style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mutedInk} secureTextEntry={secure} autoCorrect={false} />;
}
function Confirm({ title, body, action }: { title: string; body: string; action: () => void }) {
  return <Pressable accessibilityRole="button" onPress={() => Alert.alert(title, body, [{ text: '取消', style: 'cancel' }, { text: '確認', style: 'destructive', onPress: action }])}><Text style={styles.danger}>{title}</Text></Pressable>;
}

export function FriendsScreen() {
  const social = useSocial();
  const { snapshot, mode, busy, message } = social;
  const [section, setSection] = useState<'friends' | 'create' | 'account'>('friends');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState(snapshot.profile.nickname);
  const [recovery, setRecovery] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [qr, setQr] = useState<{ value: string; expiresAt: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { setNickname(snapshot.profile.nickname); }, [snapshot.profile.nickname]);
  useEffect(() => { if (mode !== 'cloud') setShowSecret(false); }, [mode]);
  const scan = async () => { const result = permission?.granted ? permission : await requestPermission(); if (result.granted) setScanning(true); else Alert.alert('相機未授權', '也可以輸入好友碼。'); };
  const room = snapshot.activeRoom;
  return <Page>
    <Kicker>EXPLORE TOGETHER · v0.8</Kicker>
    <Text style={[typography.hero, styles.title]}>一起走，就有故事。</Text>
    <Text style={[typography.body, styles.space]}>邀請生活裡的人，找回一起探索的時間。</Text>
    <Card tone={mode === 'cloud' ? 'paper' : 'white'} style={styles.space}>
      <Text style={styles.label}>{mode === 'cloud' ? '● 已連線你的 Supabase 專案' : mode === 'preview' ? '本機預覽 · 好友與步數均為示範' : '尚未啟用多人連線'}</Text>
      <Text style={typography.small}>{mode === 'cloud' ? '僅 App 前景同步。沒有推播、聊天室或背景追蹤。' : '預覽不會送出真實邀請，也不會把示範步數寫入健康紀錄。'}</Text>
      {mode !== 'cloud' && <View style={styles.gap}><PrimaryButton label={social.configured ? '連線我的 Supabase' : '查看連線設定說明'} disabled={busy} onPress={() => void social.connectCloud()} /></View>}
      {mode === 'setup' && <SecondaryButton label="先看本機預覽" onPress={social.usePreview} />}
    </Card>
    {message && <Pressable onPress={social.clearMessage} style={styles.notice} accessibilityRole="button"><Text style={styles.label}>{message}</Text><Text style={typography.small}>點一下收起</Text></Pressable>}
    {room ? <TeamRoomView room={room} now={now} /> : <>
      <View style={styles.row}>{(['friends', 'create', 'account'] as const).map((item) => <ChoiceChip key={item} label={{ friends: '我的好友', create: '建立隊伍', account: '帳號與邀請' }[item]} selected={section === item} onPress={() => setSection(item)} />)}</View>
      {section === 'account' && <Card style={styles.stack}>
        <Text style={typography.heading}>讓好友認出你</Text>
        <Field value={nickname} onChangeText={setNickname} placeholder="你的暱稱（24 字內）" />
        <PrimaryButton label="儲存暱稱" disabled={busy || !nickname.trim()} onPress={() => void social.setNickname(nickname)} />
        <Text style={typography.small}>公開好友碼 · 不是登入密語</Text><Text selectable style={styles.code}>{snapshot.profile.friendCode}</Text>
        <View style={styles.row}><SecondaryButton label="產生 10 分鐘 QR" onPress={() => void social.createQr().then(setQr)} /><SecondaryButton label="掃描好友 QR" onPress={() => void scan()} /></View>
        <Confirm title="重新產生好友碼" body="舊好友碼與舊 QR 會立刻失效，現有好友不受影響。" action={() => { setQr(null); void social.rotateFriendCode(); }} />
        <Field value={code} onChangeText={setCode} placeholder="輸入現實好友的好友碼" />
        <PrimaryButton label="送出好友邀請" disabled={busy || code.trim().length < 8} onPress={() => void social.sendFriendRequest(code)} />
        <Text style={typography.small}>每日最多 10 次；邀請 7 天失效。拒絕後需等 24 小時。</Text>
        <Text style={typography.heading}>私人復原密語</Text>
        <Text style={typography.small}>請離線妥善保存。知道密語的人可以接管社交帳號；本機照片與健康紀錄不會跟著轉移。</Text>
        {mode === 'cloud' && <SecondaryButton label={showSecret ? '隱藏密語' : '顯示我的私人密語'} onPress={() => setShowSecret(!showSecret)} />}
        {showSecret && <Text selectable style={styles.secret}>{social.recoveryPhrase ?? '尚未建立密語'}</Text>}
        <Field value={recovery} onChangeText={setRecovery} placeholder="在新裝置輸入復原密語" secure />
        <Confirm title="復原到這個裝置" body="這會撤銷原裝置對此社交帳號的存取權。請確認密語屬於你本人。" action={() => void social.recoverAccount(recovery)} />
        {mode === 'preview' && <SecondaryButton label="重設本機示範資料" onPress={social.resetPreview} />}
      </Card>}
      {section === 'create' && <CreateRoomForm />}
      {section === 'friends' && <>
        <Card style={styles.stack}><Text style={typography.heading}>現在想一起走嗎？</Text><Text style={typography.small}>只表達組隊意願，不公開上線或最後登入時間。</Text><View style={styles.row}>{([0, 1, 4, 8] as const).map((hours) => <ChoiceChip key={hours} label={hours ? `${hours} 小時` : '關閉'} selected={hours === 0 && !isAvailabilityActive(snapshot.profile, now)} onPress={() => void social.setAvailability(hours)} />)}</View></Card>
        {snapshot.requests.map((request) => <Card key={request.id} style={styles.stack}><Text style={typography.heading}>{request.sender.nickname} 想加你為好友</Text><Text style={typography.small}>只接受你在現實中認識的人。</Text><View style={styles.row}><SecondaryButton label="接受" onPress={() => void social.respondFriendRequest(request.id, 'accept')} /><SecondaryButton label="拒絕" onPress={() => void social.respondFriendRequest(request.id, 'decline')} /><SecondaryButton label="封鎖" onPress={() => void social.respondFriendRequest(request.id, 'block')} /></View></Card>)}
        {snapshot.roomInvites.map((invite) => <Card key={invite.id} style={styles.stack}><Text style={typography.heading}>{invite.host.nickname} 邀你探索</Text><Text style={typography.body}>{invite.destinationName} · {invite.durationMinutes} 分鐘</Text><Text style={typography.small}>邀請剩餘 {Math.max(0, Math.ceil((invite.expiresAt - now) / 60_000))} 分鐘</Text><PrimaryButton label="加入房間" disabled={busy || invite.expiresAt <= now} onPress={() => void social.respondRoomInvite(invite.id, true)} /><SecondaryButton label="婉拒" onPress={() => void social.respondRoomInvite(invite.id, false)} /></Card>)}
        <Text style={[typography.heading, styles.gap]}>我的好友 · {snapshot.friends.length}/50</Text>
        {!snapshot.friends.length && <Text style={typography.body}>還沒有好友。在「帳號與邀請」交換好友碼，即可開始。</Text>}
        {snapshot.friends.map((friend) => <Card key={friend.profile.id} style={styles.stack}>
          <View style={styles.between}><Text style={typography.heading}>{friend.profile.nickname}</Text><Pressable accessibilityRole="button" accessibilityLabel="切換常用好友" onPress={() => void social.setFriendLabel(friend.profile.id, friend.category, !friend.favorite)}><Text style={styles.star}>{friend.favorite ? '★' : '☆'}</Text></Pressable></View>
          <Text style={typography.small}>{isAvailabilityActive(friend.profile, now) ? '● 現在願意組隊' : '未公開組隊意願'} · {friend.profile.pet.name}</Text>
          <View style={styles.row}>{(Object.keys(friendCategoryMeta) as FriendCategory[]).map((category) => <ChoiceChip key={category} label={friendCategoryMeta[category].label} selected={friend.category === category} onPress={() => void social.setFriendLabel(friend.profile.id, category, friend.favorite)} />)}</View>
          <Text style={typography.small}>非旅程約略位置互享（須對方同意）</Text><View style={styles.row}>{([1, 4, 8] as const).map((hours) => <SecondaryButton key={hours} label={`${hours} 小時`} onPress={() => void social.action('request_social_share', { p_friend_id: friend.profile.id, p_hours: hours }, '已邀請互相分享約略位置，等待對方同意。')} />)}</View>
          <View style={styles.row}><Confirm title="移除好友" body="解除好友與雙方位置分享。已加入的隊伍不會因此由你單方解散。" action={() => void social.action('remove_social_friend', { p_friend_id: friend.profile.id }, '已移除好友。')} /><Confirm title="封鎖" body="立即解除好友及雙方定位分享；若同隊，會發起 2 分鐘移除投票。" action={() => void social.action('block_social_profile', { p_target_id: friend.profile.id }, '已封鎖，雙方停止位置分享。')} /></View>
        </Card>)}
        <LocationShares now={now} />
        <SecondaryButton label="重新整理邀請與房間" onPress={() => void social.refresh()} />
      </>}
    </>}
    <Modal visible={Boolean(qr)} transparent animationType="fade" onRequestClose={() => setQr(null)}><View style={styles.backdrop}><View style={styles.modal}><Text style={typography.heading}>讓現實好友掃描</Text>{qr && qr.expiresAt > now ? <QRCode value={qr.value} size={210} /> : <Text>QR 已過期，請重新產生。</Text>}<Text style={typography.small}>最多 5 次邀請 · 剩餘 {Math.max(0, Math.ceil(((qr?.expiresAt ?? 0) - now) / 60_000))} 分鐘</Text><SecondaryButton label="關閉" onPress={() => setQr(null)} /></View></View></Modal>
    <Modal visible={scanning} onRequestClose={() => setScanning(false)}><View style={styles.scanner}>{scanning && <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => { setScanning(false); const token = friendTokenFromQr(data); if (token) void social.action('send_social_qr_request', { p_token: token }, '已送出好友邀請。'); else Alert.alert('不是有效的 ExplorePath 邀請 QR'); }} />}<View style={styles.scannerFooter}><SecondaryButton label="取消掃描" onPress={() => setScanning(false)} /></View></View></Modal>
  </Page>;
}

function LocationShares({ now }: { now: number }) {
  const social = useSocial();
  return <>{social.snapshot.shares?.filter((share) => share.expiresAt > now).map((share) => <Card key={share.id} style={styles.stack}>
    <Text style={typography.heading}>{share.friend.nickname} · {share.status === 'active' ? '位置互享中' : '等待同意'}</Text>
    <Text style={typography.small}>到期：{new Date(share.expiresAt).toLocaleTimeString()}。雙方都開啟 App 時才同步。</Text>
    {share.status === 'pending' && share.incoming && <PrimaryButton label={`同意互享約略位置 ${share.hours} 小時`} disabled={social.busy} onPress={() => void social.action('respond_social_share', { p_share_id: share.id, p_accept: true }, '已同意互享，隨時可以停止。')} />}
    {share.status === 'active' && <><Text style={typography.small}>我的授權：{share.myPrecision === 'precise' ? '精確' : '約略（約 1 公里網格）'}</Text>
      <Confirm title={share.myPrecision === 'precise' ? '改回約略位置' : '暫時授權精確位置'} body="只影響這次對這位好友的分享；到期即失效。" action={() => void social.action('set_social_share_precision', { p_share_id: share.id, p_precise: share.myPrecision !== 'precise' })} />
      {share.location && now - share.location.timestamp <= 300_000 ? <SecondaryButton label={`查看好友位置（${Math.floor((now - share.location.timestamp) / 1000)} 秒前）`} onPress={() => void Linking.openURL(`https://www.openstreetmap.org/?mlat=${share.location!.latitude}&mlon=${share.location!.longitude}#map=15/${share.location!.latitude}/${share.location!.longitude}`)} /> : <Text style={typography.small}>尚無位置或位置已過期；不代表對方目前所在。</Text>}</>}
    <SecondaryButton label="停止／拒絕分享" onPress={() => void social.action('respond_social_share', { p_share_id: share.id, p_accept: false }, '雙方位置互享已停止。')} />
  </Card>)}</>;
}

function CreateRoomForm() {
  const social = useSocial();
  const [mode, setMode] = useState<TeamJourneyMode>('gather');
  const [duration, setDuration] = useState<TeamRoom['durationMinutes']>(30);
  const [difficulty, setDifficulty] = useState<TeamDifficulty>('relaxed');
  const [invited, setInvited] = useState<string[]>([]);
  const [destination, setDestination] = useState<Destination | null>(null);
  return <Card style={styles.stack}>
    <Text style={typography.heading}>今天怎麼一起探索？</Text>
    <View style={styles.row}>{(['gather', 'sharedStart'] as const).map((value) => <ChoiceChip key={value} label={teamModeMeta[value].label} selected={mode === value} onPress={() => setMode(value)} />)}</View><Text style={typography.small}>{teamModeMeta[mode].detail}</Text>
    <View style={styles.row}>{([30, 60, 90, 120] as const).map((value) => <ChoiceChip key={value} label={`${value} 分`} selected={duration === value} onPress={() => setDuration(value)} />)}</View>
    <Text style={typography.small}>{requiredTaskCount(duration)} 個必要任務 + 2 個趣味任務。時間不含回程，請自行預留。</Text>
    <View style={styles.row}>{(['relaxed', 'standard', 'challenge'] as const).map((value) => <ChoiceChip key={value} label={teamDifficultyMeta[value].label} selected={difficulty === value} onPress={() => setDifficulty(value)} />)}</View><Text style={typography.small}>{teamDifficultyMeta[difficulty].detail}；不提高運動門檻。</Text>
    <Text style={styles.label}>邀請好友（含自己最多 6 人）</Text><View style={styles.row}>{social.snapshot.friends.map((friend) => <ChoiceChip key={friend.profile.id} label={friend.profile.nickname} selected={invited.includes(friend.profile.id)} onPress={() => setInvited((ids) => ids.includes(friend.profile.id) ? ids.filter((id) => id !== friend.profile.id) : ids.length < 5 ? [...ids, friend.profile.id] : ids)} />)}</View>
    <PrimaryButton label="尋找附近的共同目的地" disabled={social.busy} onPress={() => void social.searchTeamDestinations(duration)} />
    {social.destinationOptions.map((item) => <ChoiceChip key={item.id} label={item.internalName} selected={destination?.id === item.id} onPress={() => setDestination(item)} />)}
    {social.mode === 'preview' && !destination && <Text style={typography.small}>本機預覽可略過定位，用不含座標的示範目的地走流程。</Text>}
    <PrimaryButton label="建立房間並邀請" disabled={social.busy || !invited.length || (social.mode !== 'preview' && !destination)} onPress={() => void social.createRoom({ mode, durationMinutes: duration, difficulty, destinationName: destination?.internalName ?? '示範探索地點', destination: destination ? { latitude: destination.arrivalLatitude ?? destination.latitude, longitude: destination.arrivalLongitude ?? destination.longitude } : null, invitedProfileIds: invited })} />
  </Card>;
}

function TeamRoomView({ room, now }: { room: TeamRoom; now: number }) {
  const social = useSocial();
  const self = room.members.find((member) => member.profile.id === social.snapshot.profile.id);
  const countdown = room.startedAt ? Math.max(0, Math.ceil((room.startedAt - now) / 1000)) : 0;
  const [photo, setPhoto] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);
  useEffect(() => { let active = true; setPhoto(null); void AsyncStorage.getItem(`explorepath.team-photo.${room.id}`).then((uri) => { if (active) setPhoto(uri); }); return () => { active = false; }; }, [room.id]);
  const takePhoto = async (taskId?: string) => {
    const result = taskId ? await captureMemoryPhoto(`team-${room.id}-${taskId}`) : await pickMemoryPhoto(`team-${room.id}`);
    if (result.status === 'saved') { setPhoto(result.uri); await AsyncStorage.setItem(`explorepath.team-photo.${room.id}`, result.uri); if (taskId) await social.completeTask(taskId); }
    else if (result.status !== 'cancelled') Alert.alert('無法取得照片', '請檢查相機或照片權限；沒有照片不會自動確認任務。');
  };
  const shareCard = async () => {
    setSharing(true);
    try { const uri = await captureRef(cardRef, { format: 'png', quality: 1 }); await shareMemoryImage(uri); }
    catch { Alert.alert('無法分享', '請在 Expo Go 的手機上重試。'); } finally { setSharing(false); }
  };
  return <View style={styles.stack}>
    <Text style={typography.heading}>{room.solo ? '個人續行' : teamModeMeta[room.mode].label} · {room.destinationName}</Text>
    <Text style={typography.small}>{room.durationMinutes} 分鐘 · {teamDifficultyMeta[room.difficulty].label} · {room.members.length}/6 人</Text>
    {room.phase === 'waiting' && <><TeamPetScene members={room.members} /><Text style={typography.small}>等待房間剩餘 {Math.max(0, Math.ceil((room.createdAt + 1_800_000 - now) / 60_000))} 分鐘。準備後，定位會分享給同隊好友；先確認任務內容與權限。</Text><PrimaryButton label={self?.readyAt ? '取消準備' : '檢查權限並準備'} disabled={social.busy} onPress={() => void social.toggleReady()} />{self?.isHost && <PrimaryButton label="全員準備，10 秒後出發" disabled={social.busy || !canStartRoom(room)} onPress={() => void social.startRoom()} />}</>}
    {room.phase === 'active' && <><SafetyTicker />{countdown > 0 ? <Card><Text style={styles.countdown}>{countdown}</Text><Text style={typography.body}>大家準備好，一起出發。</Text></Card> : <><TeamMap room={room} now={now} /><Text style={typography.small}>前景每 30 秒嘗試同步；鎖屏或切到背景會暫停。</Text></>}
      <TeamPetScene members={room.members} compact />
      {room.expectedEndAt != null && now >= room.expectedEndAt && <Text style={styles.notice}>預計時間已到，可以繼續或提前結束；請記得留回程時間。最長 4 小時。</Text>}
      {room.solo && <Text style={styles.notice}>只剩你一人，已改為個人旅程。保留步數與目的地，不完成組隊任務、不產生組隊打卡。</Text>}
      {room.members.map((member) => {
        const timestamp = member.location?.timestamp ?? member.lastLocationAt;
        const state = timestamp ? teamLocationState(timestamp, now) : 'offline';
        return <View key={member.profile.id} style={styles.statusRow}><Text style={styles.label}>{member.profile.nickname} · {member.arrivedAt ? '已抵達' : ({ fresh: '位置正常', delayed: '更新延遲', stale: '位置已過期', offline: '離線／尚無定位' })[state]}</Text><Text style={typography.small}>{timestamp ? `${Math.max(0, Math.floor((now - timestamp) / 1000))} 秒前` : '等待更新'}{member.locationIssue ? ' · 定位異常，請重新取得位置' : ''}</Text>{member.profile.id !== social.snapshot.profile.id && <Confirm title="封鎖並發起移除投票" body="你們的定位會立即互相隱藏。移出隊伍需其他有效隊員過半同意。" action={() => void social.action('block_social_profile', { p_target_id: member.profile.id })} />}</View>;
      })}
      {room.kickVotes?.map((vote) => <Card key={vote.id} style={styles.stack}><Text style={styles.label}>移除 {room.members.find((member) => member.profile.id === vote.targetId)?.profile.nickname} 的投票</Text><Text style={typography.small}>{vote.approvals}/{vote.needed} 票 · 剩 {Math.max(0, Math.ceil((vote.expiresAt - now) / 1000))} 秒</Text>{vote.targetId !== social.snapshot.profile.id && !vote.votedByMe && <View style={styles.row}><SecondaryButton label="同意" onPress={() => void social.action('vote_social_kick', { p_vote_id: vote.id, p_approve: true })} /><SecondaryButton label="不同意" onPress={() => void social.action('vote_social_kick', { p_vote_id: vote.id, p_approve: false })} /></View>}</Card>)}
      {social.mode === 'preview' && <SecondaryButton label="預覽：模擬 +300 步／5 分鐘活動" onPress={social.addPreviewSteps} />}
    </>}
    {['waiting', 'active'].includes(room.phase) && !room.solo && room.tasks.map((task) => {
      const physical = task.kind === 'steps' || task.kind === 'activeMinutes';
      const enough = task.kind === 'steps' ? social.currentSteps >= physicalTaskTarget(room.tasks, task.id) : task.kind === 'activeMinutes' ? social.activeSeconds >= physicalTaskTarget(room.tasks, task.id) * 60 : true;
      return <Card key={task.id} style={styles.stack}><Text style={styles.label}>{task.required ? '必要' : '趣味選做'} · {task.title} {task.status === 'completed' ? '✓' : ''}</Text><Text style={typography.body}>{task.prompt}</Text>{room.phase === 'active' && <><Text style={typography.small}>請先安全停下再操作。{physical ? '裝置累積達標後自動確認。' : '完成後由每位仍在隊伍的成員確認。'}</Text><PrimaryButton label={task.status === 'completed' ? '全隊已完成' : task.confirmedByMe ? '你已完成，等待隊友' : physical ? enough ? '已達標，確認同步' : '持續探索，自動累積中' : task.kind === 'photo' ? '拍攝本機照片並確認' : '我們已觀察並確認'} disabled={social.busy || countdown > 0 || !enough || task.status === 'completed' || task.confirmedByMe} onPress={() => task.kind === 'photo' ? void takePhoto(task.id) : void social.completeTask(task.id)} /></>}</Card>;
    })}
    {room.phase === 'active' && <PrimaryButton label={room.solo ? '我已抵達，結束個人旅程' : '確認全隊抵達，完成旅程'} disabled={social.busy || countdown > 0 || (!room.solo && !requiredTasksComplete(room))} onPress={() => void social.finishRoom()} />}
    {['completed', 'closed'].includes(room.phase) && <>
      <View ref={cardRef} collapsable={false} style={styles.checkin}>
        <Kicker>{social.mode === 'preview' ? 'LOCAL DEMO · 示範打卡' : 'EXPLOREPATH · 一起留下足跡'}</Kicker><Text style={typography.title}>{room.phase === 'completed' ? '今天，我們走到了。' : '每一步都算數。'}</Text><Text style={typography.heading}>{room.destinationName}</Text><Text style={typography.small}>{new Date(room.completedAt ?? now).toLocaleString()}</Text>
        <TeamPetScene members={room.members} celebrate={room.phase === 'completed'} /><View style={styles.row}><Metric label={social.mode === 'preview' ? '示範步數' : '我的步數'} value={social.currentSteps.toLocaleString()} /><Metric label="估算活動分鐘" value={Math.floor(social.activeSeconds / 60).toString()} /></View>
        <Text style={typography.small}>{room.solo ? '個人續行 · 團隊任務未完成' : `${room.tasks.filter((task) => task.status === 'completed').length} 個任務完成`}</Text>
        {photo && <Image source={{ uri: photo }} style={styles.photo} />}
      </View>
      {room.phase === 'completed' && !room.solo && <><SecondaryButton label="加入一張本機照片" onPress={() => void takePhoto()} /><PrimaryButton label="分享／另存打卡圖片" disabled={sharing} onPress={() => void shareCard()} /></>}
      <Text style={typography.small}>照片只留在手機。旅程即時座標停止分享；有有效步數的未完成旅程仍保留。</Text>
    </>}
    <Confirm title={['completed', 'closed'].includes(room.phase) ? '回到好友清單' : '結束我的參與並停止分享'} body="已記錄的真實步數會保留。中途退出不會阻擋其他成員；只剩一人時自動改為個人旅程。" action={() => void social.leaveRoom()} />
  </View>;
}

const styles = StyleSheet.create({
  title: { marginTop: 12 }, space: { marginBottom: 20 }, gap: { marginTop: 12 }, stack: { gap: 14, marginVertical: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.forest, fontSize: 15, lineHeight: 23, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: '#FFFDF7', padding: 14, color: colors.ink, fontSize: 16, minHeight: 52 },
  code: { color: colors.forest, fontSize: 27, fontWeight: '800', letterSpacing: 3 },
  notice: { padding: 15, borderRadius: 16, backgroundColor: '#F4E4B7', color: colors.ink, marginBottom: 14 },
  danger: { color: '#9B493C', fontSize: 13, fontWeight: '700', paddingVertical: 10 }, star: { fontSize: 30, color: colors.sunset },
  secret: { color: '#9B493C', fontSize: 16, padding: 12, backgroundColor: '#FFF0E8' },
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { width: '100%', alignItems: 'center', gap: 24, borderRadius: 24, padding: 24, backgroundColor: colors.paper },
  scanner: { flex: 1, backgroundColor: '#000' }, scannerFooter: { padding: 28, backgroundColor: colors.paper },
  countdown: { fontSize: 80, textAlign: 'center', color: colors.forest, fontWeight: '800' },
  statusRow: { borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 8 },
  checkin: { padding: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 24, gap: 18 },
  photo: { width: '100%', height: 220, borderRadius: 18 },
});
