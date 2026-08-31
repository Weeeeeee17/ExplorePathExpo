import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Card, ChoiceChip, Page, PrimaryButton, ProgressBar, SecondaryButton, typography } from '../components/UI';
import { PetImage } from '../components/PetImage';
import { petCatalog, seriesFor, stageXP, stages, unlockedStories, petStoryStatusLabels, petStoryWorldNote } from '../domain/petCatalog';
import { departureCountdownMilliseconds, memoryDeadlineMilliseconds, personalityMeta, remainingCooldown } from '../domain/petRules';
import { stageTitle } from '../domain/rules';
import { useExplorePath } from '../state/ExplorePathContext';
import { useSocial } from '../state/SocialContext';

const lifecycleNames = { available: '在身邊', countdown: '離家倒數', departed: '等待尋回', rescuing: '道具尋回中', memory: '永久回憶' };
function hours(milliseconds: number) { return `${Math.max(0, Math.ceil(milliseconds / 3_600_000))} 小時`; }

export function PetsScreen() {
  const app = useExplorePath(), social = useSocial(), { width } = useWindowDimensions();
  const [selectedId, select] = useState<string | null>(null), [nickname, setNickname] = useState('');
  const [seriesFilter, setSeriesFilter] = useState('all'), [stageFilter, setStageFilter] = useState('all'), [lifeFilter, setLifeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const collection = app.petCollection;
  const selected = collection.pets.find((p) => p.id === selectedId) ?? app.activePet ?? collection.pets[0];
  const family = seriesFor(selected?.seriesId), now = app.showcaseNow;
  const isActive = !!selected && selected.id === app.activePet?.id;
  const nextStage = selected ? stages[stages.indexOf(selected.stage) + 1] : undefined;
  const filtered = collection.pets.filter((p) => (seriesFilter === 'all' || p.seriesId === seriesFilter) && (stageFilter === 'all' || p.stage === stageFilter) && (lifeFilter === 'all' || p.lifecycle === lifeFilter));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 4) - 1));
  const teamBusy = social.snapshot.activeRoom && ['waiting', 'active'].includes(social.snapshot.activeRoom.phase);
  const idle = app.phase === 'preparation' && !teamBusy;
  return <Page contentStyle={{ gap: 16 }}>
    <Text style={typography.small}>EXPLOREPATH / COMPANIONS</Text>
    <Text style={typography.hero}>每一步，都有故事。</Text>
    <Text style={typography.body}>不必走得比別人遠，讓好奇心帶你出門就好。</Text>
    {app.rescueMessage ? <Card tone="paper"><Text accessibilityLiveRegion="polite" style={typography.body}>{app.rescueMessage}</Text></Card> : null}
    {!selected ? <Card style={{ gap: 14 }}>
      <Text style={typography.heading}>第一位夥伴，等你出發</Text>
      <PetImage size={120} />
      <Text style={typography.body}>完成下一趟一般探索並成功抵達，隨機遇見 12 系列之一的寵物蛋。首次相遇從 0 經驗開始，之後的成功旅程才增加經驗。</Text>
      <PrimaryButton label="去探索" onPress={() => app.setTab('explore')} />
    </Card> : <Card style={{ gap: 14 }}>
      <View style={{ alignItems: 'center' }}><PetImage key={`${selected.id}-${selected.stage}`} seriesId={selected.seriesId} stage={selected.stage} size={Math.min(300, width - 88)} /></View>
      <Text style={typography.title}>{selected.nickname}</Text>
      <Text style={typography.small}>{family?.name} · {stageTitle[selected.stage]} · {lifecycleNames[selected.lifecycle]}{isActive ? ' · 同行中' : ' · 收藏中'}</Text>
      <Text style={typography.small}>{personalityMeta[selected.personality].title}（只影響文字，不影響能力）</Text>
      <Text style={typography.heading}>{selected.experience.toLocaleString()} XP</Text>
      {nextStage ? <><ProgressBar value={selected.experience / stageXP[nextStage]} /><Text style={typography.small}>{selected.experience >= stageXP[nextStage] ? '經驗已達標，等待下一形態開放。經驗持續累積，更新素材後會自動進化。' : `下一階段門檻 ${stageXP[nextStage]} XP；實際進化也需要已開放的形態素材。`}</Text></> : null}
      <Text style={typography.body}>相遇於 {new Date(selected.createdAt).toLocaleDateString()} · 共同抵達 {selected.sharedJourneyCount} 趟 · 有效步數 {selected.sharedSteps.toLocaleString()}</Text>
      <TextInput accessibilityLabel="夥伴暱稱" placeholder="輸入新暱稱（最多16字）" value={nickname} onChangeText={setNickname} style={{ borderWidth: 1, borderColor: '#C9CBBF', borderRadius: 12, padding: 12, fontSize: 16 }} />
      <SecondaryButton label="儲存暱稱" onPress={() => { app.renamePet(selected.id, nickname); setNickname(''); }} />
      {!isActive && selected.lifecycle === 'available' ? <PrimaryButton label="選為同行夥伴" disabled={!!teamBusy} onPress={() => Alert.alert('更換同行夥伴？', '切換後須完成一趟一般探索，才能再切換。出發前可撤回一次。', [{ text: '取消', style: 'cancel' }, { text: '確認切換', onPress: () => app.switchActivePet(selected.id) }])} /> : null}
      {isActive && collection.switchLock?.undoAvailable && !teamBusy ? <SecondaryButton label="撤回這次切換（僅一次）" onPress={app.undoPetSwitch} /> : null}
      {selected.stage === 'egg' ? <Text style={typography.small}>蛋不消耗心情與清潔，不需要每日照顧。</Text> : <>
        <Text style={typography.body}>心情 {Math.ceil(selected.mood)} / 100　清潔 {Math.ceil(selected.cleanliness)} / 100</Text>
        {!isActive ? <Text style={typography.small}>收藏中的夥伴暫停消耗，不補扣離線時間。</Text> : <>
          <PrimaryButton label={remainingCooldown(selected.lastCompanionAt, now) ? `陪伴冷卻 ${hours(remainingCooldown(selected.lastCompanionAt, now))}` : '陪伴牠 · 心情 +12'} disabled={!!remainingCooldown(selected.lastCompanionAt, now) || !['available', 'countdown'].includes(selected.lifecycle)} onPress={app.companionActivePet} />
          <PrimaryButton label={remainingCooldown(selected.lastCleanedAt, now) ? `清潔冷卻 ${hours(remainingCooldown(selected.lastCleanedAt, now))}` : '幫牠清潔 · 清潔 +35'} disabled={!!remainingCooldown(selected.lastCleanedAt, now) || !['available', 'countdown'].includes(selected.lifecycle)} onPress={app.cleanActivePet} />
        </>}
      </>}
      {selected.lifecycle === 'countdown' ? <Text style={typography.body}>離家倒數：{hours((selected.countdownStartedAt ?? now) + departureCountdownMilliseconds - now)}。陪伴或完成一般探索可解除，清潔不能解除。</Text> : null}
      {isActive && selected.lifecycle === 'departed' ? <>
        <Text style={typography.body}>尋回期限還有 {hours((selected.departedAt ?? now) + memoryDeadlineMilliseconds - now)}。請依體力與現場安全選擇路線。</Text>
        <PrimaryButton label={`使用照顧道具（剩 ${collection.careItems}）· 等待24小時`} disabled={!collection.careItems} onPress={() => Alert.alert('使用一個照顧道具？', '確認後消耗一個道具，24 小時後回來。', [{ text: '取消', style: 'cancel' }, { text: '使用', onPress: app.rescueWithCareItem }])} />
        <PrimaryButton label="尋回探索 · 優先共同回憶" disabled={!idle} onPress={() => void app.searchRescueMemory()} />
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>{([10, 20, 30] as const).map((minutes) => <ChoiceChip key={minutes} label={`增加${minutes}分鐘`} selected={false} onPress={() => { if (idle) void app.searchRescueMemory(minutes); }} />)}</View>
        <SecondaryButton label="我同意改找附近新地點" onPress={() => { if (idle) Alert.alert('改找附近新地點？', '只在你確認後搜尋，不會自動增加時間。', [{ text: '取消' }, { text: '確認', onPress: () => void app.searchNearbyRescue() }]); }} />
      </> : null}
      {selected.lifecycle === 'rescuing' ? <Text style={typography.body}>道具尋回中，還有 {hours((selected.rescueReadyAt ?? now) - now)}。經驗和回憶都會保留。</Text> : null}
      {['departed', 'memory'].includes(selected.lifecycle) ? <>
        <Text style={typography.small}>永久回憶不會刪除。四季之約的重逢信物可讓夥伴回來。</Text>
        <PrimaryButton label="使用重逢信物" disabled={app.mode !== 'real' || app.seasonalPromise.reunionTokens < 1} onPress={() => Alert.alert('與夥伴重逢？', '將消耗一枚四季之約重逢信物。', [{ text: '取消' }, { text: '確認', onPress: () => app.reviveWithSeasonalToken(selected.id) }])} />
      </> : null}
      <Text style={typography.heading}>夥伴的故事</Text>
      <Text style={typography.small}>{petStoryWorldNote}</Text>
      <Text style={typography.body}>角色目標草稿：{family?.goal}</Text>
      {selected.stage !== 'egg' && family?.juvenileName ? <Text style={typography.small}>幼年名稱草稿：{family.juvenileName}</Text> : null}
      {unlockedStories(selected).map((story) => <View key={story.title} style={{ gap: 5 }}>
        <Text style={typography.heading}>{story.title}</Text>
        <Text style={typography.small}>{petStoryStatusLabels[story.status]}</Text>
        {story.quote ? <Text style={[typography.body, { fontStyle: 'italic' }]}>{story.quote}</Text> : null}
        <Text style={typography.body}>{story.text}</Text>
      </View>)}
      <Text style={typography.small}>後續章節隨實際進化解鎖。尚未開放的形態不提前揭露。</Text>
      <Text style={typography.heading}>共同回憶</Text>
      {app.records.filter((record) => record.petId === selected.id && !record.memoryHidden).slice(0, 5).map((record) => <Text key={record.id} style={typography.body}>{new Date(record.endedAt).toLocaleDateString()} · {record.destinationName}{record.kind === 'rescue' ? ' · 再次相遇' : ''}</Text>)}
      <SecondaryButton label="前往足跡看完整紀錄" onPress={() => app.setTab('records')} />
    </Card>}
    <Card style={{ gap: 12 }}>
      <Text style={typography.heading}>夥伴收藏 · {new Set(collection.pets.map((p) => p.seriesId)).size}/12 系列</Text>
      <Text style={typography.small}>出發時同行夥伴達 3,000 XP，之後每 10 趟成功一般探索取得新蛋：{collection.matureJourneysTowardEgg}/10。與低經驗夥伴同行只暫停、不重設。</Text>
      <Text style={typography.small}>照顧道具 {collection.careItems}/3 · 一般探索進度 {collection.normalJourneysTowardCareItem}/5。滿額時不囤積額外道具。</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        <ChoiceChip label="全部系列" selected={seriesFilter === 'all'} onPress={() => { setSeriesFilter('all'); setPage(0); }} />
        {petCatalog.map((s) => <ChoiceChip key={s.id} label={s.name} selected={seriesFilter === s.id} onPress={() => { setSeriesFilter(s.id); setPage(0); }} />)}
      </ScrollView>
      <ScrollView horizontal contentContainerStyle={{ gap: 6 }}><ChoiceChip label="全部階段" selected={stageFilter === 'all'} onPress={() => setStageFilter('all')} />{stages.map((stage) => <ChoiceChip key={stage} label={stageTitle[stage]} selected={stageFilter === stage} onPress={() => setStageFilter(stage)} />)}</ScrollView>
      <ScrollView horizontal contentContainerStyle={{ gap: 6 }}><ChoiceChip label="全部狀態" selected={lifeFilter === 'all'} onPress={() => setLifeFilter('all')} />{Object.entries(lifecycleNames).map(([id, name]) => <ChoiceChip key={id} label={name} selected={lifeFilter === id} onPress={() => setLifeFilter(id)} />)}</ScrollView>
      {filtered.slice(currentPage * 4, currentPage * 4 + 4).map((p) => <SecondaryButton key={p.id} label={`${p.nickname} · ${stageTitle[p.stage]} · ${lifecycleNames[p.lifecycle]}`} onPress={() => { select(p.id); setNickname(''); }} />)}
      {!filtered.length ? <Text style={typography.small}>這個分類還沒有夥伴。</Text> : null}
      {filtered.length > 4 ? <View style={{ gap: 8 }}><SecondaryButton label="上一頁" onPress={() => setPage(Math.max(0, currentPage - 1))} /><Text style={typography.small}>{currentPage + 1}/{Math.ceil(filtered.length / 4)}</Text><SecondaryButton label="下一頁" onPress={() => setPage(Math.min(Math.ceil(filtered.length / 4) - 1, currentPage + 1))} /></View> : null}
    </Card>
    <Card style={{ gap: 12 }}>
      <Text style={typography.heading}>保存與提醒</Text>
      <Text style={typography.small}>旅程、健康與完整寵物收藏保存在本機。好友復原詞不是資料備份。</Text>
      <Text style={typography.small}>舊版原始封存：{collection.legacyArchives.length} 份；不轉換物種、不移轉經驗，包含在完整 JSON 備份中。</Text>
      <SecondaryButton label="匯出完整備份（不含照片）" onPress={() => void app.exportBackup()} />
      <SecondaryButton label="到足跡頁預覽並還原備份" onPress={() => app.setTab('records')} />
      <SecondaryButton label={collection.notificationsEnabled ? '關閉本機夥伴提醒' : '自願開啟本機夥伴提醒'} onPress={() => void app.togglePetNotifications()} />
    </Card>
    <Card tone="paper" style={{ gap: 12 }}>
      <Text style={typography.heading}>{app.mode === 'demo' ? '展示沙盒 · 不影響真實資料' : '想先看看養成效果？'}</Text>
      {app.mode === 'real' ? <PrimaryButton label="進入隔離展示沙盒" disabled={!idle} onPress={() => { social.usePreview(); void app.enterShowcaseMode(); }} /> : <>
        <Text style={typography.small}>以下為模擬狀態，不能換成真實步數或經驗。</Text>
        <SecondaryButton label="模擬蛋期" onPress={() => { select(null); app.openShowcaseScenario('petEgg'); }} />
        <SecondaryButton label="模擬幼年" onPress={() => { select(null); app.openShowcaseScenario('petJuvenile'); }} />
        <SecondaryButton label="模擬3000XP以上，等待後續形態" onPress={() => { select(null); app.openShowcaseScenario('petMature'); }} />
        <SecondaryButton label="模擬離家倒數" onPress={() => { select(null); app.openShowcaseScenario('petCountdown'); }} />
        <SecondaryButton label="模擬等待尋回" onPress={() => { select(null); app.openShowcaseScenario('petDeparted'); }} />
        <SecondaryButton label="展示時間前進24小時" onPress={() => app.fastForwardShowcaseTime(86_400_000)} />
        <PrimaryButton label="返回真實資料" onPress={() => { select(null); void app.exitShowcaseMode(); }} />
      </>}
    </Card>
  </Page>;
}
