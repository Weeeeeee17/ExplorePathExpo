import React from 'react';
import { CompanionStrip } from '../components/CompanionStrip';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Metric, Page, PrimaryButton, typography } from '../components/UI';
import { formatHealthDistance, journeyHealthMetrics } from '../domain/health';
import { themeMeta } from '../domain/rules';
import { useExplorePath } from '../state/ExplorePathContext';
import { colors, radius } from '../theme';

export function ArrivalCelebrationScreen() {
  const { candidate, activeJourney, healthProfile, continueAfterArrival, revealAndOpenMap } = useExplorePath();
  if (!candidate || !activeJourney) return null;
  const elapsedMinutes = Math.max(1, Math.round(((activeJourney.endedAt ?? Date.now()) - activeJourney.startedAt) / 60000));
  const metrics = journeyHealthMetrics({
    steps: activeJourney.steps,
    elapsedMinutes,
    strideLengthCm: healthProfile.strideLengthCm,
    stepStatus: activeJourney.stepStatus,
  });
  const stepMessage = activeJourney.stepStatus === 'unavailable'
    ? '本趟未取得步數，旅程時間仍會保留。'
    : activeJourney.stepStatus === 'partial'
      ? `你在這趟探索中，不知不覺走了至少 ${activeJourney.steps.toLocaleString()} 步。`
      : `你在這趟探索中，不知不覺走了 ${activeJourney.steps.toLocaleString()} 步。`;

  return (
    <Page>
      <CompanionStrip />
      <View style={styles.burst}>
        <Text style={styles.spark}>✦</Text>
        <View style={styles.successMark}><Text style={styles.check}>✓</Text></View>
        <Text style={[styles.spark, styles.sparkRight]}>✦</Text>
      </View>
      <Text style={[typography.title, styles.center, styles.arrived]}>探索抵達！</Text>
      <Text style={[typography.body, styles.center]}>停留確認完成，神秘終點正式揭曉</Text>

      <Card tone="green" style={styles.destinationCard}>
        <Text style={styles.themeIcon}>{themeMeta[candidate.theme].icon}</Text>
        <Text style={styles.revealLabel}>{themeMeta[candidate.theme].title}探索</Text>
        <Text style={styles.destinationName}>{candidate.internalName}</Text>
        <Text style={styles.destinationHint}>{candidate.environmentHint}</Text>
        <Pressable onPress={() => void revealAndOpenMap()} style={styles.mapButton}>
          <Text style={styles.mapButtonText}>在 Apple 地圖查看此地點</Text>
        </Pressable>
      </Card>

      <Card tone="paper" style={styles.stepRevealCard}>
        <Text style={styles.stepRevealTitle}>{stepMessage}</Text>
        {activeJourney.destinationReplaced ? <Text style={styles.stepRevealNote}>途中曾更換目的地，時間與步數都合併在同一趟。</Text> : null}
      </Card>

      <Text style={typography.heading}>這趟的初步活動紀錄</Text>
      <Card style={styles.healthCard}>
        <View style={styles.metricRow}>
          <Metric label="旅程時間" value={`${metrics.elapsedMinutes} 分鐘`} />
          <View style={styles.verticalRule} />
          <Metric label="估算距離" value={formatHealthDistance(metrics.estimatedDistanceMeters)} />
          <View style={styles.verticalRule} />
          <Metric label="平均步頻" value={`${metrics.averageCadence} 步／分`} />
        </View>
      </Card>
      <Text style={[typography.small, styles.note]}>下一步記錄心情與身體感受，完成後會產生完整健康摘要。估算數字不是醫療資料。</Text>
      <PrimaryButton label="記錄這趟的感受" onPress={continueAfterArrival} />
    </Page>
  );
}

const styles = StyleSheet.create({
  burst: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  successMark: { alignItems: 'center', backgroundColor: colors.softMoss, borderRadius: 42, height: 84, justifyContent: 'center', marginHorizontal: 22, width: 84 },
  check: { color: colors.forest, fontSize: 40, fontWeight: '900' },
  spark: { color: colors.sunset, fontSize: 28, transform: [{ rotate: '-15deg' }] },
  sparkRight: { transform: [{ rotate: '18deg' }] },
  center: { textAlign: 'center' }, arrived: { marginTop: 18 },
  destinationCard: { marginBottom: 25, marginTop: 22 }, themeIcon: { fontSize: 34 },
  revealLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', marginTop: 14 },
  destinationName: { color: colors.white, fontSize: 28, fontWeight: '900', marginTop: 5 },
  destinationHint: { color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 21, marginTop: 9 },
  stepRevealCard: { marginBottom: 18 }, stepRevealTitle: { color: colors.forest, fontSize: 18, fontWeight: '900', lineHeight: 26, textAlign: 'center' }, stepRevealNote: { color: colors.mutedInk, fontSize: 12, marginTop: 7, textAlign: 'center' },
  mapButton: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.45)', borderRadius: radius.pill, borderWidth: 1, marginTop: 16, padding: 12 }, mapButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  healthCard: { marginTop: 10 }, metricRow: { alignItems: 'center', flexDirection: 'row' }, verticalRule: { backgroundColor: colors.line, height: 38, width: 1 },
  note: { marginBottom: 20, marginTop: 12, textAlign: 'center' },
});
