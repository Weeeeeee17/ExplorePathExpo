import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  Metric,
  Page,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  typography,
} from '../components/UI';
import { ORIGIN } from '../data/destinations';
import {
  broadDirectionFromBearing,
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

export function ActiveJourneyScreen() {
  const {
    mode,
    candidate,
    activeJourney,
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
    discardJourney,
  } = useExplorePath();
  const [showExit, setShowExit] = useState(false);

  if (!candidate || !activeJourney) return null;
  const liveOrigin = currentLocation ?? origin ?? ORIGIN;
  const bearing = initialBearing(liveOrigin, candidate);
  const rotation = mode === 'demo' ? 28 + activeJourney.walkStage * 11 : relativeCompassRotation(bearing, heading);
  const direction = broadDirectionFromBearing(bearing);
  const closeEnough =
    mode === 'demo'
      ? activeJourney.walkStage >= 3
      : activeJourney.distanceMeters <= arrivalRadius;
  const liveLabel =
    mode === 'demo'
      ? '探索中 · Demo'
      : trackingStatus === 'paused'
        ? '背景暫停'
        : trackingStatus === 'waitingForAccuracy'
          ? '等待精準定位'
          : trackingStatus === 'error'
            ? '感測器異常'
            : '探索中 · GPS';

  return (
    <Page>
      <View style={styles.topRow}>
        <Pressable onPress={() => setShowExit(true)} style={styles.roundButton}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <View style={styles.liveBadge}>
          <View style={[styles.liveDot, trackingStatus === 'paused' && styles.pausedDot]} />
          <Text style={styles.liveText}>{liveLabel}</Text>
        </View>
        <View style={styles.roundPlaceholder} />
      </View>

      <Text style={[typography.title, styles.center]}>跟著方向走</Text>
      <Text style={[typography.body, styles.center, styles.subtitle]}>
        {revealed ? candidate.internalName : '地點名稱會在抵達後揭曉'}
      </Text>

      <View style={styles.compassWrap}>
        <Compass rotation={rotation} />
      </View>
      <Text style={styles.direction}>{direction}</Text>
      <Text style={styles.distance}>{distanceText(activeJourney.distanceMeters)}</Text>
      <Text style={[typography.small, styles.center]}>
        {mode === 'demo'
          ? closeEnough
            ? '已進入抵達範圍，準備停留確認'
            : '直線距離會隨模擬步行逐步縮短'
          : closeEnough
            ? `已進入約 ${arrivalRadius} 公尺抵達範圍，請自然停留`
            : `動態抵達範圍約 ${arrivalRadius} 公尺 · 依 GPS 精準度調整`}
      </Text>

      {trackingMessage ? (
        <Card tone="paper" style={styles.trackingCard}>
          <Text style={styles.trackingText}>{trackingMessage}</Text>
        </Card>
      ) : null}

      <Card style={styles.statusCard}>
        <View style={styles.metricRow}>
          <Metric
            label={activeJourney.stepBonusAvailable === false ? '步數（未授權）' : '已走步數'}
            value={activeJourney.steps.toLocaleString()}
          />
          <View style={styles.verticalRule} />
          <Metric label="停留確認" value={`${activeJourney.dwellSeconds} / 45 秒`} />
        </View>
        <View style={styles.progressGap} />
        <ProgressBar value={activeJourney.dwellSeconds / 45} />
        {mode === 'real' ? (
          <Text style={[typography.small, styles.sensorLine]}>
            指南針：{heading === null ? '等待中' : '已連線'} · 步數：
            {motionStatus === 'available' ? '可用' : '不提供加成'}
          </Text>
        ) : null}
      </Card>

      {replacementMessage ? (
        <Card tone="paper" style={styles.messageCard}>
          <Text style={styles.messageText}>{replacementMessage}</Text>
          <Pressable onPress={clearReplacementMessage}>
            <Text style={styles.messageClose}>知道了</Text>
          </Pressable>
        </Card>
      ) : null}

      <Card tone="green" style={styles.safetyCard}>
        <Text style={styles.safetyTitle}>方向針不是導航路線</Text>
        <Text style={styles.safetyCopy}>
          請沿公共道路行走，不要穿越圍欄、私人土地、管制區或你覺得不安全的路段。
        </Text>
        <Pressable onPress={() => void revealAndOpenMap()} style={styles.mapButton}>
          <Text style={styles.mapButtonText}>安全揭曉並開啟 Apple 地圖</Text>
        </Pressable>
        <Text style={styles.noPenalty}>不扣 XP，也不影響換地點次數</Text>
      </Card>

      {mode === 'demo' ? (
        <>
          <PrimaryButton
            label={closeEnough ? '模擬抵達並停留 45 秒' : '模擬往前走一段'}
            onPress={closeEnough ? simulateArrival : simulateWalk}
          />
          <View style={styles.buttonGap} />
        </>
      ) : null}
      <SecondaryButton label="換一個神秘地點（保留步數）" onPress={() => void replaceActiveDestination()} />
      <Text style={[typography.small, styles.demoNote]}>
        {mode === 'real'
          ? '保持 ExplorePath 在前景。切到背景或鎖定螢幕時，GPS 與停留秒數會暫停。'
          : 'Demo 用按鈕模擬 GPS、方向、步數與抵達。'}
      </Text>
      {candidate.source === 'openstreetmap' ? (
        <Text style={[typography.small, styles.attribution]}>地點資料 © OpenStreetMap contributors（ODbL）</Text>
      ) : null}

      <Modal transparent animationType="fade" visible={showExit} onRequestClose={() => setShowExit(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.heading}>要結束這次探索嗎？</Text>
            <Text style={[typography.body, styles.modalCopy]}>
              你可以保留已走步數與未完成紀錄，或直接捨棄這次探索。
            </Text>
            <PrimaryButton label="保留為未完成紀錄" onPress={saveIncompleteJourney} />
            <View style={styles.buttonGap} />
            <SecondaryButton label="捨棄這次探索" destructive onPress={discardJourney} />
            <Pressable onPress={() => setShowExit(false)} style={styles.cancelModal}>
              <Text style={styles.cancelModalText}>繼續探索</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  roundButton: { alignItems: 'center', backgroundColor: colors.softWhite, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  roundPlaceholder: { height: 44, width: 44 },
  closeText: { color: colors.ink, fontSize: 29, fontWeight: '400', marginTop: -3 },
  liveBadge: { alignItems: 'center', backgroundColor: colors.softMoss, borderRadius: radius.pill, flexDirection: 'row', gap: 7, paddingHorizontal: 13, paddingVertical: 8 },
  liveDot: { backgroundColor: colors.sunset, borderRadius: 5, height: 9, width: 9 },
  pausedDot: { backgroundColor: colors.mutedInk },
  liveText: { color: colors.forest, fontSize: 12, fontWeight: '800' },
  center: { textAlign: 'center' },
  subtitle: { marginTop: 5 },
  compassWrap: { alignItems: 'center', marginBottom: 22, marginTop: 30 },
  compassOuter: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.55)', borderColor: 'rgba(41,87,64,0.18)', borderRadius: 126, borderWidth: 2, height: 252, justifyContent: 'center', shadowColor: colors.forest, shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.09, shadowRadius: 20, width: 252 },
  cardinal: { color: colors.mutedInk, fontSize: 12, fontWeight: '800', position: 'absolute' },
  north: { top: 14 },
  east: { right: 18 },
  south: { bottom: 14 },
  west: { left: 18 },
  needle: { alignItems: 'center', height: 158, justifyContent: 'center', position: 'absolute', width: 32 },
  needleTop: { borderBottomColor: colors.sunset, borderBottomWidth: 78, borderLeftColor: 'transparent', borderLeftWidth: 10, borderRightColor: 'transparent', borderRightWidth: 10, height: 0, width: 0 },
  needleBottom: { borderLeftColor: 'transparent', borderLeftWidth: 8, borderRightColor: 'transparent', borderRightWidth: 8, borderTopColor: colors.forest, borderTopWidth: 62, height: 0, opacity: 0.75, width: 0 },
  compassCenter: { backgroundColor: colors.paper, borderColor: colors.forest, borderRadius: 10, borderWidth: 4, height: 20, width: 20 },
  direction: { color: colors.forest, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  distance: { color: colors.ink, fontSize: 40, fontWeight: '800', letterSpacing: -1, marginVertical: 2, textAlign: 'center' },
  trackingCard: { marginTop: 15 },
  trackingText: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  statusCard: { marginBottom: 16, marginTop: 16 },
  metricRow: { alignItems: 'center', flexDirection: 'row' },
  verticalRule: { backgroundColor: colors.line, height: 38, width: 1 },
  progressGap: { height: 16 },
  sensorLine: { marginTop: 10, textAlign: 'center' },
  messageCard: { flexDirection: 'row', marginBottom: 14 },
  messageText: { color: colors.ink, flex: 1, fontSize: 13, lineHeight: 19, paddingRight: 12 },
  messageClose: { color: colors.forest, fontSize: 13, fontWeight: '800' },
  safetyCard: { marginBottom: 16 },
  safetyTitle: { color: colors.white, fontSize: 16, fontWeight: '800' },
  safetyCopy: { color: 'rgba(255,255,255,0.74)', fontSize: 13, lineHeight: 19, marginTop: 6 },
  mapButton: { alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.pill, marginTop: 15, padding: 13 },
  mapButtonText: { color: colors.forest, fontSize: 14, fontWeight: '800' },
  noPenalty: { color: 'rgba(255,255,255,0.62)', fontSize: 11, marginTop: 7, textAlign: 'center' },
  buttonGap: { height: 10 },
  demoNote: { marginHorizontal: 14, marginTop: 13, textAlign: 'center' },
  attribution: { marginTop: 7, textAlign: 'center' },
  modalBackdrop: { alignItems: 'center', backgroundColor: colors.overlay, flex: 1, justifyContent: 'center', padding: 22 },
  modalCard: { backgroundColor: colors.paper, borderRadius: radius.large, padding: 24, width: '100%' },
  modalCopy: { marginBottom: 22, marginTop: 9 },
  cancelModal: { alignItems: 'center', paddingTop: 18 },
  cancelModalText: { color: colors.mutedInk, fontSize: 14, fontWeight: '700' },
});
