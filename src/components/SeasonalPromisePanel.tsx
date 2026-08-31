import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { seasonForDate, seasonMeta } from '../domain/seasonalPromise';
import { journeyStepStatus, knownJourneySteps } from '../domain/memories';
import { Season } from '../domain/types';
import { shareMemoryImage } from '../services/backup';
import { captureTaskPhoto } from '../services/taskMedia';
import { useExplorePath } from '../state/ExplorePathContext';
import { colors, radius } from '../theme';
import { Card, PrimaryButton, SecondaryButton, typography } from './UI';

const formatDay = (value: number | null) => value ? new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(value)) : '—';

export function SeasonalPromisePanel() {
  const { mode, showcaseNow, seasonalPromise, seasonalCandidates, petCollection, records, beginSeasonalSelection, toggleSeasonalCandidate, sealSeasonalCandidates, revealSeasonalBox, startSeasonalJourney, completeSeasonalVisit, abandonSeasonalVisit, claimSeasonalCompletion, reviveWithSeasonalToken } = useExplorePath();
  const [observation, setObservation] = useState('');
  const [safeRadius, setSafeRadius] = useState(false);
  const [busy, setBusy] = useState(false);
  const [privacy, setPrivacy] = useState<'full' | 'city' | 'hidden'>('city');
  const shareRef = useRef<View>(null);
  const now = mode === 'demo' ? showcaseNow : Date.now();
  const currentSeason = seasonForDate(now);
  const alreadyStamped = seasonalPromise.entries.some((entry) => entry.season === currentSeason);
  const departed = petCollection.pets.filter((pet) => ['departed', 'memory'].includes(pet.lifecycle));
  const seasonalJourneyRecords = seasonalPromise.entries
    .map((entry) => records.find((record) => record.id === entry.journeyId))
    .filter((record): record is NonNullable<typeof record> => Boolean(record));
  const seasonalKnownSteps = seasonalJourneyRecords
    .filter((record) => !['unavailable', 'excluded'].includes(journeyStepStatus(record)))
    .reduce((sum, record) => sum + knownJourneySteps(record), 0);
  const seasonalHasPartial = seasonalJourneyRecords.some((record) => journeyStepStatus(record) === 'partial');

  const addText = async () => {
    if (!observation.trim() || busy) return;
    setBusy(true); await completeSeasonalVisit('observation', observation, undefined, safeRadius); setBusy(false);
  };
  const addPhoto = async () => {
    const result = await captureTaskPhoto(`seasonal-${Date.now()}`);
    if (result.status !== 'saved') return;
    setBusy(true); await completeSeasonalVisit('photo', observation, result.uri, safeRadius); setBusy(false);
  };
  const shareCard = async () => {
    if (!shareRef.current) return;
    setBusy(true);
    try { await shareMemoryImage(await captureRef(shareRef, { format: 'png', quality: 1, result: 'tmpfile' })); } finally { setBusy(false); }
  };
  const sharePlace = privacy === 'hidden' ? '一個珍藏的地方' : privacy === 'city' ? seasonalPromise.target?.cityLabel ?? '所在城市' : seasonalPromise.target?.destinationName ?? '';

  return <Card tone="paper" style={styles.card}>
    <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.kicker}>15 個月長期旅程</Text><Text style={styles.title}>四季之約</Text></View><View style={styles.token}><Text style={styles.tokenText}>重逢印記 {seasonalPromise.reunionTokens}/1</Text></View></View>
    {seasonalPromise.lastRewardMessage ? <Text style={styles.message}>{seasonalPromise.lastRewardMessage}</Text> : null}

    {seasonalPromise.status === 'idle' ? <><Text style={styles.body}>挑選三段願意再訪的回憶，打亂成旅行包裹；抽中的地方會成為這一輪唯一目的地。</Text><PrimaryButton label="挑選三段回憶" onPress={beginSeasonalSelection} disabled={seasonalCandidates.length < 3} />{seasonalCandidates.length < 3 ? <Text style={styles.hint}>需要至少三筆有座標的完成紀錄。</Text> : null}</> : null}

    {seasonalPromise.status === 'selecting' ? <><Text style={styles.section}>選三個都願意再去的地方</Text><Text style={styles.hint}>已選 {seasonalPromise.selectedCandidates.length}/3</Text><View style={styles.list}>{seasonalCandidates.map((item) => {
      const selected = seasonalPromise.selectedCandidates.some((candidate) => candidate.id === item.id);
      return <Pressable key={item.id} onPress={() => toggleSeasonalCandidate(item)} style={[styles.candidate, selected && styles.selected]}><Text style={[styles.checkbox, selected && styles.checkboxOn]}>{selected ? '✓' : ''}</Text><View style={styles.candidateCopy}><Text style={styles.candidateName}>{item.destinationName}</Text><Text style={styles.candidateMeta}>{item.isShowcase ? '展示資料 · 不寫入正式獎勵' : '完成過的真實足跡'}</Text></View></Pressable>;
    })}</View><PrimaryButton label="封存三個旅行包裹" onPress={sealSeasonalCandidates} disabled={seasonalPromise.selectedCandidates.length !== 3} /></> : null}

    {seasonalPromise.status === 'sealed' ? <><Text style={styles.section}>三個包裹已經打亂</Text><Text style={styles.hint}>選定後不能更換地點，也不能重新抽取。</Text><View style={styles.parcels}>{[0, 1, 2].map((index) => <Pressable key={index} onPress={() => revealSeasonalBox(index)} style={styles.parcel}><Text style={styles.plant}>{['🌿', '🍁', '🌾'][index]}</Text><View style={styles.ropeH} /><View style={styles.ropeV} /><View style={styles.seal}><Text style={styles.sealText}>旅</Text></View><Text style={styles.parcelLabel}>包裹 {index + 1}</Text></Pressable>)}</View></> : null}

    {seasonalPromise.status === 'active' ? <><View style={styles.target}><Text style={styles.targetLabel}>{seasonalPromise.isShowcase ? '展示版目的地' : '本輪目的地'}</Text><Text style={styles.targetName}>{seasonalPromise.target?.destinationName}</Text><Text style={styles.hint}>期限至 {formatDay(seasonalPromise.expiresAt)}</Text></View><View style={styles.stamps}>{(Object.keys(seasonMeta) as Season[]).map((season) => {
      const stamped = seasonalPromise.entries.some((entry) => entry.season === season);
      return <View key={season} style={[styles.stamp, stamped && { backgroundColor: seasonMeta[season].color }]}><Text style={styles.stampIcon}>{seasonMeta[season].icon}</Text><Text style={styles.stampName}>{seasonMeta[season].title}</Text><Text style={styles.stampMeta}>{stamped ? '已記錄' : seasonMeta[season].months}</Text></View>;
    })}</View>{alreadyStamped ? <Card style={styles.done}><Text style={styles.doneTitle}>{seasonMeta[currentSeason].icon} 本季已經留下足跡</Text><Text style={styles.hint}>下一季再回來看看地方的變化。</Text></Card> : seasonalPromise.pendingVisit ? <><Text style={styles.section}>本季紀錄待完成</Text><Text style={styles.hint}>抵達旅程與一般獎勵已保存。再次加入文字或照片時會重新確認目前仍在目的地附近，不會重複給獎。</Text><TextInput multiline maxLength={280} value={observation} onChangeText={setObservation} placeholder="記下施工、招牌、植物、光線或當下感受……" placeholderTextColor="#898D82" style={styles.input} /><Pressable onPress={() => setSafeRadius((value) => !value)} style={[styles.safety, safeRadius && styles.safetyOn]}><Text style={styles.safetyTitle}>{safeRadius ? '✓ ' : ''}施工／封鎖，使用最近合法安全位置</Text><Text style={styles.safetyText}>最多放寬至 150 公尺；不得跨越圍籬或進入禁止區。</Text></Pressable><PrimaryButton label={busy ? '正在重新確認位置…' : '用文字完成本季'} onPress={() => void addText()} disabled={!observation.trim() || busy} /><View style={styles.gap} /><SecondaryButton label="拍下本季景色" onPress={() => void addPhoto()} /><Pressable onPress={abandonSeasonalVisit} style={styles.abandon}><Text style={styles.abandonText}>放棄本季待完成內容</Text></Pressable></> : <><Text style={styles.section}>{seasonMeta[currentSeason].title}季旅程</Text><Text style={styles.hint}>從你按下開始才記錄步數與時間，不設時間上限。抵達後會先保存一般旅程與獎勵，再完成本季內容。</Text><PrimaryButton label="開始本季旅程" onPress={() => void startSeasonalJourney()} /></>}</> : null}

    {seasonalPromise.status === 'completed' ? <><View ref={shareRef} collapsable={false} style={styles.shareCard}><Text style={styles.shareBrand}>ExplorePath · 四季之約</Text><Text style={styles.sharePlace}>{sharePlace}</Text><Text style={styles.shareSteps}>{seasonalHasPartial ? '至少 ' : ''}{seasonalKnownSteps.toLocaleString()} 步</Text><View style={styles.grid}>{seasonalPromise.entries.map((entry) => <View key={entry.id} style={[styles.tile, { backgroundColor: seasonMeta[entry.season].color }]}><Text style={styles.tileSeason}>{seasonMeta[entry.season].icon} {seasonMeta[entry.season].title}</Text><Text numberOfLines={4} style={styles.tileText}>{entry.kind === 'photo' ? '▣ 季節照片' : entry.observation}</Text></View>)}</View><Text style={styles.sharePrivacy}>不包含 GPS 座標、路線或私人筆記</Text></View><View style={styles.privacyRow}>{(['full', 'city', 'hidden'] as const).map((item) => <Pressable key={item} onPress={() => setPrivacy(item)} style={[styles.privacyChip, privacy === item && styles.privacyOn]}><Text style={[styles.privacyText, privacy === item && styles.privacyTextOn]}>{item === 'full' ? '完整地名' : item === 'city' ? '只顯示城市' : '隱藏地點'}</Text></Pressable>)}</View><SecondaryButton label={busy ? '正在產生圖卡…' : '分享到 IG Stories／其他 App'} onPress={() => void shareCard()} /><View style={styles.gap} /><PrimaryButton label="收下四季回憶與獎勵" onPress={claimSeasonalCompletion} /></> : null}

    {seasonalPromise.status === 'idle' && seasonalPromise.reunionTokens === 1 ? <View style={styles.revive}><Text style={styles.section}>四季重逢印記</Text>{departed.length === 0 ? <Text style={styles.hint}>印記永不過期，直到有夥伴需要回來。</Text> : departed.map((pet) => <Pressable key={pet.id} onPress={() => reviveWithSeasonalToken(pet.id)} style={styles.reviveRow}><Text style={styles.reviveName}>{pet.nickname}</Text><Text style={styles.reviveAction}>使用印記帶回</Text></Pressable>)}</View> : null}
    <Text style={styles.footer}>{mode === 'real' ? '任務與獎勵只保存在這支 iPhone。' : '展示模式與正式存檔完全分離。'}</Text>
  </Card>;
}

const styles = StyleSheet.create({
  card: { marginTop: 22 }, header: { alignItems: 'flex-start', flexDirection: 'row' }, headerCopy: { flex: 1 }, kicker: { color: colors.moss, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, title: { color: colors.ink, fontSize: 27, fontWeight: '900', marginTop: 3 }, token: { backgroundColor: colors.forest, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 7 }, tokenText: { color: colors.white, fontSize: 10, fontWeight: '900' }, message: { backgroundColor: 'rgba(255,255,255,.58)', borderRadius: radius.medium, color: colors.forest, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 12, padding: 12 }, body: { ...typography.body, marginBottom: 16, marginTop: 12 }, section: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 16 }, hint: { color: colors.mutedInk, fontSize: 11, lineHeight: 17, marginBottom: 12, marginTop: 5 }, list: { gap: 8, marginBottom: 14 }, candidate: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,.55)', borderColor: colors.line, borderRadius: radius.medium, borderWidth: 1, flexDirection: 'row', padding: 12 }, selected: { borderColor: colors.forest, borderWidth: 2 }, checkbox: { borderColor: colors.moss, borderRadius: 10, borderWidth: 1, color: colors.white, fontWeight: '900', height: 25, lineHeight: 23, textAlign: 'center', width: 25 }, checkboxOn: { backgroundColor: colors.forest }, candidateCopy: { flex: 1, marginLeft: 10 }, candidateName: { color: colors.ink, fontSize: 14, fontWeight: '900' }, candidateMeta: { color: colors.mutedInk, fontSize: 10, marginTop: 3 }, parcels: { flexDirection: 'row', gap: 8 }, parcel: { alignItems: 'center', backgroundColor: '#D8B47C', borderColor: '#A98552', borderRadius: 14, borderWidth: 1, flex: 1, height: 140, justifyContent: 'center', overflow: 'hidden' }, plant: { fontSize: 20, position: 'absolute', right: 7, top: 7 }, ropeH: { backgroundColor: '#997148', height: 5, left: 0, position: 'absolute', right: 0 }, ropeV: { backgroundColor: '#997148', bottom: 0, position: 'absolute', top: 0, width: 5 }, seal: { alignItems: 'center', backgroundColor: '#984738', borderRadius: 19, height: 38, justifyContent: 'center', width: 38 }, sealText: { color: '#F5D9C4', fontWeight: '900' }, parcelLabel: { bottom: 9, color: '#65462A', fontSize: 10, fontWeight: '900', position: 'absolute' }, target: { backgroundColor: 'rgba(255,255,255,.6)', borderRadius: radius.card, marginTop: 14, padding: 16 }, targetLabel: { color: colors.moss, fontSize: 10, fontWeight: '900' }, targetName: { color: colors.ink, fontSize: 21, fontWeight: '900', marginTop: 3 }, stamps: { flexDirection: 'row', gap: 5, marginTop: 10 }, stamp: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,.55)', borderRadius: 14, flex: 1, minHeight: 80, padding: 6 }, stampIcon: { fontSize: 19 }, stampName: { color: colors.ink, fontSize: 12, fontWeight: '900' }, stampMeta: { color: colors.mutedInk, fontSize: 8, marginTop: 3, textAlign: 'center' }, done: { marginTop: 12 }, doneTitle: { color: colors.forest, fontSize: 14, fontWeight: '900' }, input: { backgroundColor: 'rgba(255,255,255,.65)', borderColor: colors.line, borderRadius: radius.medium, borderWidth: 1, color: colors.ink, minHeight: 100, padding: 12, textAlignVertical: 'top' }, safety: { borderColor: colors.line, borderRadius: radius.medium, borderWidth: 1, marginBottom: 12, marginTop: 9, padding: 11 }, safetyOn: { backgroundColor: colors.softMoss, borderColor: colors.forest }, safetyTitle: { color: colors.forest, fontSize: 12, fontWeight: '900' }, safetyText: { color: colors.mutedInk, fontSize: 10, lineHeight: 15, marginTop: 3 }, gap: { height: 9 }, abandon: { alignItems: 'center', paddingTop: 13 }, abandonText: { color: colors.mutedInk, fontSize: 11, fontWeight: '800' }, shareCard: { backgroundColor: colors.forest, borderRadius: radius.card, marginTop: 15, padding: 16 }, shareBrand: { color: 'rgba(255,255,255,.7)', fontSize: 11, fontWeight: '900' }, sharePlace: { color: colors.white, fontSize: 22, fontWeight: '900', marginTop: 5 }, shareSteps: { color: '#F3D490', fontSize: 16, fontWeight: '900', marginTop: 4 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 }, tile: { borderRadius: 15, minHeight: 95, padding: 10, width: '48%' }, tileSeason: { color: colors.ink, fontSize: 13, fontWeight: '900' }, tileText: { color: '#41463E', fontSize: 10, lineHeight: 15, marginTop: 6 }, sharePrivacy: { color: 'rgba(255,255,255,.58)', fontSize: 9, marginTop: 10 }, privacyRow: { flexDirection: 'row', gap: 5, marginVertical: 10 }, privacyChip: { borderColor: colors.line, borderRadius: radius.pill, borderWidth: 1, flex: 1, padding: 7 }, privacyOn: { backgroundColor: colors.forest }, privacyText: { color: colors.forest, fontSize: 9, fontWeight: '800', textAlign: 'center' }, privacyTextOn: { color: colors.white }, revive: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 18 }, reviveRow: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,.58)', borderRadius: radius.medium, flexDirection: 'row', marginTop: 7, padding: 11 }, reviveName: { color: colors.ink, flex: 1, fontWeight: '900' }, reviveAction: { color: colors.forest, fontSize: 11, fontWeight: '900' }, footer: { color: colors.mutedInk, fontSize: 9, marginTop: 15, textAlign: 'center' },
});
