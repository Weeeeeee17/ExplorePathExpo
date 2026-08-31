import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApproximateMap } from '../components/ApproximateMap';
import { CompanionStrip } from '../components/CompanionStrip';
import { MicroTaskModal } from '../components/MicroTaskModal';
import { SafetyTicker } from '../components/SafetyTicker';
import { Card, Metric, Page, PrimaryButton, SecondaryButton, typography } from '../components/UI';
import { ORIGIN } from '../data/destinations';
import {
  broadDirectionFromBearing,
  destinationTarget,
  initialBearing,
  relativeCompassRotation,
} from '../domain/geo';
import { distanceText } from '../domain/rules';
import { useExplorePath } from '../state/ExplorePathContext';
import { colors, radius } from '../theme';

function Compass({ rotation }: { rotation: number }) {
  return (
    <View style={styles.compassOuter}>
      <Text style={[styles.cardinal, styles.north]}>N</Text>
      <Text style={[styles.cardinal, styles.east]}>E</Text>
      <Text style={[styles.cardinal, styles.south]}>S</Text>
      <Text style={[styles.cardinal, styles.west]}>W</Text>
      <View style={[styles.needle, { transform: [{ rotate: `${rotation}deg` }] }]}>
        <View style={styles.needleTop} />
        <View style={styles.needleBottom} />
      </View>
      <View style={styles.compassCenter} />
    </View>
  );
}

function ArrivalProgress({ value, inside }: { value: number; inside: boolean }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const status = !inside ? '尚未進入範圍' : percent < 45 ? '正在確認位置' : percent < 90 ? '再停留一下' : '即將完成';
  return (
    <View style={styles.arrivalWrap}>
      <View style={[styles.arrivalCircle, inside && styles.arrivalCircleActive]}>
        <Text style={styles.arrivalPercent}>{percent}%</Text>
        <Text style={styles.arrivalLabel}>抵達確認</Text>
      </View>
      <Text style={styles.arrivalStatus}>{status}</Text>
      <Text style={styles.arrivalHelp}>短暫 GPS 飄移只會暫停；明確離開範圍才會重新計算。</Text>
    </View>
  );
}

export function ActiveJourneyScreen() {
  const {
    mode,
    showcaseNow,
    candidate,
    activeJourney,
    durationMinutes,
    origin,
    currentLocation,
    heading,
    motionStatus,
    trackingStatus,
    trackingMessage,
    arrivalRadius,
    revealed,
    replacementMessage,
    clearReplacementMessage,
    revealAndOpenMap,
    simulateWalk,
    simulateArrival,
    replaceActiveDestination,
    saveIncompleteJourney,
    returnToStart,
    discardJourney,
    dismissDeviationSuggestion,
    beginMicroTask,
    replaceMicroTask,
    skipMicroTask,
    completeMicroTask,
    captureMicroTaskPhoto,
    saveMicroTaskPhoto,
    resumeRecoveredJourney,
    endRecoveredJourney,
  } = useExplorePath();
  const [showExit, setShowExit] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [overtimeDismissed, setOvertimeDismissed] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  if (!candidate || !activeJourney) return null;
  const target = destinationTarget(candidate);
  const liveOrigin = currentLocation ?? origin ?? ORIGIN;
  const bearing = initialBearing(liveOrigin, target);
  const rotation = mode === 'demo' ? 28 + activeJourney.walkStage * 11 : relativeCompassRotation(bearing, heading);
  const direction = broadDirectionFromBearing(bearing);
  const closeEnough = mode === 'demo' ? activeJourney.walkStage >= 3 : activeJourney.distanceMeters <= arrivalRadius;
  const dwellTarget = activeJourney.dwellTargetSeconds ?? 45;
  const dwellProgress = activeJourney.dwellSeconds / dwellTarget;
  const task = activeJourney.microTask;
  const effectiveNow = mode === 'demo' ? showcaseNow : now;
  const elapsedMinutes = (effectiveNow - activeJourney.startedAt) / 60_000;
  const warningLevel = activeJourney.kind === 'seasonal'
    ? 'none'
    : elapsedMinutes >= durationMinutes ? 'critical' : elapsedMinutes >= durationMinutes * 0.8 ? 'notice' : 'none';
  const isRescue = activeJourney.kind === 'rescue';
  const isSeasonal = activeJourney.kind === 'seasonal';
  const liveLabel = mode === 'demo'
    ? `${isRescue ? '尋回' : isSeasonal ? '四季' : '探索'}中 · 展示`
    : trackingStatus === 'paused'
      ? '背景暫停'
      : trackingStatus === 'waitingForAccuracy'
        ? '等待精準定位'
        : trackingStatus === 'error'
          ? '感測器異常'
          : `${isRescue ? '尋回' : isSeasonal ? '四季' : '探索'}中 · GPS`;

  return (
    <Page>
      <CompanionStrip />
      <View style={styles.topRow}>
        <Pressable accessibilityLabel="結束探索" onPress={() => setShowExit(true)} style={styles.roundButton}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <View style={styles.liveBadge}>
          <View style={[styles.liveDot, trackingStatus === 'paused' && styles.pausedDot]} />
          <Text style={styles.liveText}>{liveLabel}</Text>
        </View>
        <Pressable accessibilityLabel="切換地圖" onPress={() => setShowMap((value) => !value)} style={styles.roundButton}>
          <Text style={styles.mapIcon}>⌖</Text>
        </Pressable>
      </View>

      <SafetyTicker />
      <Text style={[typography.title, styles.center]}>{showMap ? '確認大致範圍' : isRescue ? '沿著線索去找牠' : isSeasonal ? '回到這一季的約定' : '跟著方向走'}</Text>
      <Text style={[typography.body, styles.center, styles.subtitle]}>
        {revealed ? candidate.internalName : isRescue ? '尋回探索 · 抵達前終點仍是秘密' : task?.hintUnlocked ? candidate.environmentHint : `${candidate.theme === 'food' ? '美食' : candidate.theme === 'nature' ? '自然' : '建築'}主題 · 終點仍是秘密`}
      </Text>

      {showMap ? (
        <View style={styles.mapWrap}>
          <ApproximateMap
            key={candidate.id}
            currentLocation={currentLocation ?? origin}
            destination={candidate}
            hintUnlocked={task?.hintUnlocked ?? false}
            revealed={revealed}
          />
          <Text style={[typography.small, styles.center]}>地圖只顯示大致範圍；請仍以安全公共道路為主。</Text>
        </View>
      ) : (
        <>
          <View style={styles.compassWrap}><Compass rotation={rotation} /></View>
          <Text style={styles.direction}>{direction}</Text>
          <Text style={styles.distance}>{distanceText(activeJourney.distanceMeters)}</Text>
          <Text style={[typography.small, styles.center]}>
            {closeEnough ? '已進入抵達範圍，請在安全位置自然停留' : `動態抵達範圍約 ${arrivalRadius} 公尺 · 依 GPS 精準度調整`}
          </Text>
        </>
      )}

      {trackingMessage ? <Card tone="paper" style={styles.trackingCard}><Text style={styles.trackingText}>{trackingMessage}</Text></Card> : null}

      <Card style={styles.statusCard}>
        <View style={styles.metricRow}>
          <Metric label="旅程步數" value={activeJourney.stepBonusAvailable === false ? '未取得' : '記錄中'} />
          <View style={styles.verticalRule} />
          <Metric label={isSeasonal ? '旅程時間' : '單程探索上限'} value={isSeasonal ? '不設限' : `${durationMinutes} 分鐘`} />
        </View>
        <ArrivalProgress inside={closeEnough} value={dwellProgress} />
        {mode === 'real' ? (
          <Text style={[typography.small, styles.sensorLine]}>指南針：{heading === null ? '等待中' : '已連線'} · 步數：{motionStatus === 'available' ? '旅程結束後揭曉' : '本趟未取得'}</Text>
        ) : null}
      </Card>

      {warningLevel !== 'none' && !overtimeDismissed ? (
        <Card tone={warningLevel === 'critical' ? 'paper' : 'white'} style={styles.timeCard}>
          <Text style={styles.timeTitle}>{warningLevel === 'critical' ? '已達單程探索上限' : '已使用 80% 單程探索時間'}</Text>
          <Text style={styles.timeCopy}>{warningLevel === 'critical' ? '計時不會自動結束。你可以自行決定繼續，或結束並保存未抵達旅程；也請自行預留回程時間。' : '這只是柔性提醒；你仍可繼續探索，並請自行預留足夠的回程時間。'}</Text>
          {warningLevel === 'critical' ? (
            <>
              <PrimaryButton label="結束並回到起點" onPress={() => void returnToStart()} />
              <Pressable onPress={() => setOvertimeDismissed(true)} style={styles.textAction}><Text style={styles.textActionLabel}>我知道了，繼續探索</Text></Pressable>
            </>
          ) : <Pressable onPress={() => setOvertimeDismissed(true)} style={styles.textAction}><Text style={styles.textActionLabel}>知道了</Text></Pressable>}
        </Card>
      ) : null}

      {task ? (
        <Card tone={task.status === 'completed' ? 'green' : 'white'} style={styles.taskCard}>
          <Text style={task.status === 'completed' ? styles.taskKickerLight : styles.taskKicker}>途中小任務 · 選填</Text>
          <Text style={task.status === 'completed' ? styles.taskTitleLight : styles.taskTitle}>
            {task.status === 'pending' ? '接近終點時出現' : task.status === 'completed' ? `已完成：${task.title}` : task.status === 'skipped' ? '這趟已略過小任務' : task.title}
          </Text>
          <Text style={task.status === 'completed' ? styles.taskCopyLight : styles.taskCopy}>
            {task.status === 'pending' ? '到距離終點約 200–300 公尺時，會開放一個安全的小挑戰。' : task.status === 'completed' ? `${candidate.environmentHint} · 地圖範圍已縮小。` : task.status === 'skipped' ? '不影響健康紀錄，抵達流程照常進行。' : '先安全停下後再開始；完成可獲得更多終點提示。'}
          </Text>
          {task.status !== 'pending' ? (
            <Pressable onPress={() => setShowTask(true)} style={task.status === 'completed' ? styles.taskButtonLight : styles.taskButton}>
              <Text style={task.status === 'completed' ? styles.taskButtonTextDark : styles.taskButtonText}>{task.status === 'completed' ? '查看提示' : task.status === 'skipped' ? '查看狀態' : '開啟小任務'}</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {replacementMessage ? (
        <Card tone="paper" style={styles.messageCard}>
          <Text style={styles.messageText}>{replacementMessage}</Text>
          <Pressable onPress={clearReplacementMessage}><Text style={styles.messageClose}>知道了</Text></Pressable>
        </Card>
      ) : null}

      <Card tone="green" style={styles.safetyCard}>
        <Text style={styles.safetyTitle}>方向針不是導航路線</Text>
        <Text style={styles.safetyCopy}>請沿公共道路行走，不要穿越圍欄、私人土地、管制區或你覺得不安全的路段。</Text>
        <Pressable onPress={() => setShowMap((value) => !value)} style={styles.mapButton}>
          <Text style={styles.mapButtonText}>{showMap ? '回到指南針' : '查看模糊範圍地圖'}</Text>
        </Pressable>
        {revealed ? <Pressable onPress={() => void revealAndOpenMap()} style={styles.exactButton}><Text style={styles.exactButtonText}>在 Apple 地圖開啟已揭曉終點</Text></Pressable> : null}
        <Text style={styles.noPenalty}>查看地圖不影響健康紀錄，也不影響換地點次數</Text>
      </Card>

      {mode === 'demo' ? (
        <>
          <PrimaryButton label={closeEnough ? '模擬完成停留確認' : '模擬往前走一段'} onPress={closeEnough ? simulateArrival : simulateWalk} />
          <View style={styles.buttonGap} />
        </>
      ) : null}
      {!isSeasonal ? <SecondaryButton label={isRescue ? '換一個尋回地點（保留步數）' : '換一個神秘地點（保留時間與步數）'} onPress={() => void replaceActiveDestination()} /> : null}
      <Text style={[typography.small, styles.demoNote]}>{mode === 'real' ? '進入背景時 GPS、方向與停留會暫停；回到前景後會自動補查旅程期間的 iPhone 步數。' : '展示模式用按鈕模擬 GPS、方向、步數與抵達，所有資料與真實進度隔離。'}</Text>
      {candidate.source === 'openstreetmap' ? <Text style={[typography.small, styles.attribution]}>地點資料 © OpenStreetMap contributors（ODbL）</Text> : null}

      {task ? (
        <MicroTaskModal
          hint={candidate.environmentHint}
          onBegin={beginMicroTask}
          onCapturePhoto={captureMicroTaskPhoto}
          onClose={() => setShowTask(false)}
          onComplete={completeMicroTask}
          onReplace={replaceMicroTask}
          onSavePhoto={saveMicroTaskPhoto}
          onSkip={skipMicroTask}
          task={task}
          visible={showTask}
        />
      ) : null}

      <Modal transparent animationType="fade" visible={activeJourney.deviationSuggested ?? false}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.heading}>方向可能越走越遠</Text>
            <Text style={[typography.body, styles.modalCopy]}>距離持續增加了一段時間。要打開 App 內的模糊地圖確認方向嗎？地圖不會揭曉確切終點。</Text>
            <PrimaryButton label="查看模糊地圖" onPress={() => { setShowMap(true); dismissDeviationSuggestion(); }} />
            <Pressable onPress={dismissDeviationSuggestion} style={styles.cancelModal}><Text style={styles.cancelModalText}>繼續使用指南針</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={showExit} onRequestClose={() => setShowExit(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.heading}>要結束這次探索嗎？</Text>
            <Text style={[typography.body, styles.modalCopy]}>提早結束時，只要有有效步數就會保存成「未抵達旅程」；Apple 地圖返程只是安全工具，不影響時間與步數紀錄。</Text>
            <PrimaryButton label="結束並保存，再開啟返程" onPress={() => void returnToStart()} />
            <View style={styles.buttonGap} />
            <SecondaryButton label="結束並保存未抵達旅程" onPress={() => void saveIncompleteJourney()} />
            <View style={styles.buttonGap} />
            <SecondaryButton label="若無有效步數則取消" destructive onPress={discardJourney} />
            <Pressable onPress={() => setShowExit(false)} style={styles.cancelModal}><Text style={styles.cancelModalText}>繼續探索</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={activeJourney.recoveryPending === true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.heading}>找到一趟尚未結束的旅程</Text>
            <Text style={[typography.body, styles.modalCopy]}>我們可以從旅程開始時間補查 iPhone 步數後繼續，或現在結束並保存最後能確認的未抵達足跡。</Text>
            <PrimaryButton label="恢復步數並繼續" onPress={() => void resumeRecoveredJourney()} />
            <View style={styles.buttonGap} />
            <SecondaryButton label="現在結束並保存" onPress={() => void endRecoveredJourney()} />
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  roundButton: { alignItems: 'center', backgroundColor: colors.softWhite, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  closeText: { color: colors.ink, fontSize: 29, fontWeight: '400', marginTop: -3 },
  mapIcon: { color: colors.forest, fontSize: 22, fontWeight: '800' },
  liveBadge: { alignItems: 'center', backgroundColor: colors.softMoss, borderRadius: radius.pill, flexDirection: 'row', gap: 7, paddingHorizontal: 13, paddingVertical: 8 },
  liveDot: { backgroundColor: colors.sunset, borderRadius: 5, height: 9, width: 9 },
  pausedDot: { backgroundColor: colors.mutedInk },
  liveText: { color: colors.forest, fontSize: 12, fontWeight: '800' },
  center: { textAlign: 'center' },
  subtitle: { marginTop: 5 },
  mapWrap: { marginTop: 22 },
  compassWrap: { alignItems: 'center', marginBottom: 22, marginTop: 30 },
  compassOuter: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.55)', borderColor: 'rgba(41,87,64,0.18)', borderRadius: 126, borderWidth: 2, height: 252, justifyContent: 'center', shadowColor: colors.forest, shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.09, shadowRadius: 20, width: 252 },
  cardinal: { color: colors.mutedInk, fontSize: 12, fontWeight: '800', position: 'absolute' },
  north: { top: 14 }, east: { right: 18 }, south: { bottom: 14 }, west: { left: 18 },
  needle: { alignItems: 'center', height: 158, justifyContent: 'center', position: 'absolute', width: 32 },
  needleTop: { borderBottomColor: colors.sunset, borderBottomWidth: 78, borderLeftColor: 'transparent', borderLeftWidth: 10, borderRightColor: 'transparent', borderRightWidth: 10, height: 0, width: 0 },
  needleBottom: { borderLeftColor: 'transparent', borderLeftWidth: 8, borderRightColor: 'transparent', borderRightWidth: 8, borderTopColor: colors.forest, borderTopWidth: 62, height: 0, opacity: 0.75, width: 0 },
  compassCenter: { backgroundColor: colors.paper, borderColor: colors.forest, borderRadius: 10, borderWidth: 4, height: 20, width: 20 },
  direction: { color: colors.forest, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  distance: { color: colors.ink, fontSize: 40, fontWeight: '800', letterSpacing: -1, marginVertical: 2, textAlign: 'center' },
  trackingCard: { marginTop: 15 }, trackingText: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  statusCard: { marginBottom: 16, marginTop: 16 }, metricRow: { alignItems: 'center', flexDirection: 'row' }, verticalRule: { backgroundColor: colors.line, height: 38, width: 1 },
  arrivalWrap: { alignItems: 'center', borderTopColor: colors.line, borderTopWidth: 1, marginTop: 18, paddingTop: 18 },
  arrivalCircle: { alignItems: 'center', borderColor: colors.line, borderRadius: 52, borderWidth: 8, height: 104, justifyContent: 'center', width: 104 },
  arrivalCircleActive: { borderColor: colors.sunset }, arrivalPercent: { color: colors.ink, fontSize: 22, fontWeight: '900' }, arrivalLabel: { color: colors.mutedInk, fontSize: 11, fontWeight: '700' },
  arrivalStatus: { color: colors.forest, fontSize: 14, fontWeight: '900', marginTop: 10 }, arrivalHelp: { color: colors.mutedInk, fontSize: 11, lineHeight: 17, marginTop: 4, textAlign: 'center' },
  sensorLine: { marginTop: 12, textAlign: 'center' },
  timeCard: { marginBottom: 16 }, timeTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' }, timeCopy: { color: colors.mutedInk, fontSize: 13, lineHeight: 19, marginBottom: 15, marginTop: 6 },
  textAction: { alignItems: 'center', paddingTop: 14 }, textActionLabel: { color: colors.forest, fontSize: 13, fontWeight: '800' },
  taskCard: { marginBottom: 16 }, taskKicker: { color: colors.forest, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }, taskKickerLight: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  taskTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 5 }, taskTitleLight: { color: colors.white, fontSize: 18, fontWeight: '900', marginTop: 5 },
  taskCopy: { color: colors.mutedInk, fontSize: 13, lineHeight: 19, marginTop: 6 }, taskCopyLight: { color: 'rgba(255,255,255,0.76)', fontSize: 13, lineHeight: 19, marginTop: 6 },
  taskButton: { alignItems: 'center', borderColor: colors.forest, borderRadius: radius.pill, borderWidth: 1, marginTop: 14, padding: 12 }, taskButtonLight: { alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.pill, marginTop: 14, padding: 12 },
  taskButtonText: { color: colors.forest, fontSize: 14, fontWeight: '900' }, taskButtonTextDark: { color: colors.forest, fontSize: 14, fontWeight: '900' },
  messageCard: { flexDirection: 'row', marginBottom: 14 }, messageText: { color: colors.ink, flex: 1, fontSize: 13, lineHeight: 19, paddingRight: 12 }, messageClose: { color: colors.forest, fontSize: 13, fontWeight: '800' },
  safetyCard: { marginBottom: 16 }, safetyTitle: { color: colors.white, fontSize: 16, fontWeight: '800' }, safetyCopy: { color: 'rgba(255,255,255,0.74)', fontSize: 13, lineHeight: 19, marginTop: 6 },
  mapButton: { alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.pill, marginTop: 15, padding: 13 }, mapButtonText: { color: colors.forest, fontSize: 14, fontWeight: '800' },
  exactButton: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.45)', borderRadius: radius.pill, borderWidth: 1, marginTop: 9, padding: 12 }, exactButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' }, noPenalty: { color: 'rgba(255,255,255,0.62)', fontSize: 11, marginTop: 7, textAlign: 'center' },
  buttonGap: { height: 10 }, demoNote: { marginHorizontal: 14, marginTop: 13, textAlign: 'center' }, attribution: { marginTop: 7, textAlign: 'center' },
  modalBackdrop: { alignItems: 'center', backgroundColor: colors.overlay, flex: 1, justifyContent: 'center', padding: 22 }, modalCard: { backgroundColor: colors.paper, borderRadius: radius.large, padding: 24, width: '100%' }, modalCopy: { marginBottom: 22, marginTop: 9 }, cancelModal: { alignItems: 'center', paddingTop: 18 }, cancelModalText: { color: colors.mutedInk, fontSize: 14, fontWeight: '700' },
});
