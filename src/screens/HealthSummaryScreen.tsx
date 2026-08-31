import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Page, PrimaryButton, typography } from '../components/UI';
import {
  formatHealthDistance,
  healthMilestonesForJourney,
  intensityMeta,
  journeyHealthMetrics,
  recordHealthMetrics,
} from '../domain/health';
import { JourneyEffort } from '../domain/types';
import { useExplorePath } from '../state/ExplorePathContext';
import { colors } from '../theme';
import { PetImage } from '../components/PetImage';
import { stageTitle } from '../domain/rules';

const effortMeta: Record<JourneyEffort, string> = {
  easy: '很輕鬆',
  steady: '剛剛好',
  challenging: '有點吃力',
  hard: '很累',
};

export function HealthSummaryScreen() {
  const { activeJourney, healthProfile, records, review, reward, petCollection, finishReward } = useExplorePath();
  if (!activeJourney) return null;
  const record = records.find((item) => item.id === activeJourney.id);
  const elapsedMinutes = Math.max(1, Math.round(((activeJourney.endedAt ?? Date.now()) - activeJourney.startedAt) / 60000));
  const metrics = record
    ? recordHealthMetrics(record, healthProfile)
    : journeyHealthMetrics({
      steps: activeJourney.steps,
      elapsedMinutes,
      strideLengthCm: healthProfile.strideLengthCm,
      stepStatus: activeJourney.stepStatus,
    });
  const milestones = record
    ? healthMilestonesForJourney(record, records.filter((item) => item.id !== record.id), healthProfile)
    : [];
  const hasSteps = !['unavailable', 'excluded'].includes(activeJourney.stepStatus ?? 'complete');

  return (
    <Page>
      <Text style={[styles.mark, styles.center]}>♥</Text>
      <Text style={[typography.title, styles.center]}>這趟活動已記錄</Text>
      <Text style={[typography.body, styles.center, styles.subtitle]}>你沒有特別安排運動，身體仍累積了一段活動。</Text>
      {reward && reward.petId ? <Card tone="paper" style={{ gap: 10, marginTop: 16, alignItems: 'center' }}>
        <PetImage seriesId={petCollection.pets.find((p) => p.id === reward.petId)?.seriesId} stage={reward.nextStage} size={160} />
        <Text style={typography.heading}>{reward.petEvent === 'foundEgg' ? '✦ 第一眼的相遇' : reward.previousStage !== reward.nextStage ? `✦ 進化為${stageTitle[reward.nextStage]}` : '又多了一段共同回憶'}</Text>
        <Text style={typography.body}>{reward.petEvent === 'foundEgg' ? '遇見新蛋，從0經驗開始。' : `同行夥伴 +${reward.appliedPetXP} XP`}</Text>
        {reward.newEggFound ? <Text style={typography.body}>新蛋已放進收藏，同行夥伴沒有自動更換。</Text> : null}
        {reward.careItemAwarded ? <Text style={typography.small}>獲得一個照顧道具。</Text> : null}
      </Card> : null}

      <Card tone="green" style={styles.heroCard}>
        <Text style={styles.heroLabel}>旅程步數</Text>
        <Text style={styles.heroValue}>{hasSteps ? metrics.steps.toLocaleString() : '未取得'}</Text>
        <Text style={styles.heroNote}>{hasSteps ? intensityMeta[metrics.intensity].title : '這趟仍保留旅程時間與感受'}</Text>
      </Card>

      <View style={styles.grid}>
        <Card style={styles.metricCard}>
          <Text style={styles.metricValue}>{metrics.elapsedMinutes}</Text>
          <Text style={styles.metricLabel}>旅程分鐘</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricValue}>{metrics.estimatedActiveMinutes}</Text>
          <Text style={styles.metricLabel}>估算活動分鐘</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricValue}>{formatHealthDistance(metrics.estimatedDistanceMeters)}</Text>
          <Text style={styles.metricLabel}>估算距離</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricValue}>{metrics.averageCadence}</Text>
          <Text style={styles.metricLabel}>平均步／分鐘</Text>
        </Card>
      </View>

      <Card tone="paper" style={styles.feelingCard}>
        <Text style={styles.feelingTitle}>主觀感受：{review.effort ? effortMeta[review.effort] : '尚未記錄'}</Text>
        <Text style={typography.small}>{intensityMeta[metrics.intensity].detail} 活動時間、距離與強度為依步數推估，並非醫療數據。</Text>
      </Card>

      {milestones.length > 0 ? (
        <View style={styles.milestoneWrap}>
          <Text style={typography.heading}>這趟解鎖的健康里程碑</Text>
          {milestones.map((milestone) => (
            <Card key={milestone.kind} style={styles.milestoneCard}>
              <Text style={styles.milestoneIcon}>✦</Text>
              <View style={styles.milestoneCopy}>
                <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                <Text style={typography.small}>{milestone.detail}</Text>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <PrimaryButton label="回到探索首頁" onPress={finishReward} />
    </Page>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  mark: { color: colors.sunset, fontSize: 34, marginBottom: 13, marginTop: 25 },
  subtitle: { marginHorizontal: 16, marginTop: 8 },
  heroCard: { alignItems: 'center', marginTop: 25 },
  heroLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 13, fontWeight: '800' },
  heroValue: { color: colors.white, fontSize: 44, fontWeight: '900', letterSpacing: -1, marginTop: 5 },
  heroNote: { color: 'rgba(255,255,255,0.78)', fontSize: 13, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  metricCard: { minHeight: 100, padding: 16, width: '48.5%' },
  metricValue: { color: colors.forest, fontSize: 22, fontWeight: '900' },
  metricLabel: { color: colors.mutedInk, fontSize: 12, marginTop: 6 },
  feelingCard: { marginBottom: 22, marginTop: 12 },
  feelingTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', marginBottom: 6 },
  milestoneWrap: { marginBottom: 10 },
  milestoneCard: { alignItems: 'center', flexDirection: 'row', marginTop: 10 },
  milestoneIcon: { color: colors.sunset, fontSize: 24 },
  milestoneCopy: { flex: 1, paddingLeft: 13 },
  milestoneTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', marginBottom: 4 },
});
