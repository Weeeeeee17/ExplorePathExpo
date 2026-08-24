import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Page, PrimaryButton, ProgressBar, typography } from '../components/UI';
import {
  growingXP,
  hatchXP,
  matureXP,
  petStage,
  speciesMeta,
  stageTitle,
} from '../domain/rules';
import { RewardSummary } from '../domain/types';
import { useExplorePath } from '../state/ExplorePathContext';
import { colors } from '../theme';

function eventCopy(event: RewardSummary['petEvent']) {
  switch (event) {
    case 'foundEgg':
      return { icon: '🥚', title: '你找到了一顆寵物蛋！', detail: '第一次完成探索，經驗值先不放進蛋裡。下一趟開始會累積孵化進度。' };
    case 'hatched':
      return { icon: '✨', title: '寵物孵化了！', detail: '持續探索與步行，牠會從幼年慢慢長大。' };
    case 'evolved':
      return { icon: '🌱', title: '寵物成長了！', detail: '每一段無意間完成的步行，都成為牠的成長養分。' };
    case 'eggProgressed':
      return { icon: '🥚', title: '蛋裡傳來一點動靜', detail: '探索經驗已經加入孵化進度，再走幾趟就會相遇。' };
    default:
      return { icon: '💫', title: '探索經驗已送給寵物', detail: '抵達是主要獎勵，步數另外提供加成。' };
  }
}

export function RewardScreen() {
  const { reward, pet, activeJourney, finishReward } = useExplorePath();
  if (!reward) return null;
  const copy = eventCopy(reward.petEvent);
  const stage = petStage(pet);
  const nextThreshold = !pet.species ? hatchXP : stage === 'juvenile' ? growingXP : matureXP;
  const progress = stage === 'mature' ? 1 : Math.min(pet.experience / nextThreshold, 1);
  const petEmoji = pet.species ? speciesMeta[pet.species].emoji : '🥚';

  return (
    <Page>
      <Text style={[styles.sparkles, styles.center]}>✦　✧　✦</Text>
      <Text style={[typography.title, styles.center]}>探索完成</Text>
      <Text style={[typography.body, styles.center, styles.subtitle]}>你沒有特別去運動，卻已經走了一段路。</Text>

      <Card style={styles.xpCard}>
        <Text style={styles.xpTotal}>+{reward.xp.totalXP} XP</Text>
        <View style={styles.xpRule} />
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownValue}>+{reward.xp.arrivalXP}</Text>
            <Text style={typography.small}>抵達獎勵</Text>
          </View>
          <View style={styles.breakdownItem}>
            <Text style={styles.breakdownValue}>+{reward.xp.stepBonusXP}</Text>
            <Text style={typography.small}>步數加成</Text>
          </View>
        </View>
      </Card>

      {activeJourney?.stepBonusAvailable === false ? (
        <Text style={[typography.small, styles.noStepNote]}>
          這趟沒有步數權限，因此步數加成為 0；抵達 100 XP 已正常計入。
        </Text>
      ) : null}

      <Card tone="green" style={styles.petEventCard}>
        <Text style={styles.petEventIcon}>{reward.petEvent === 'hatched' ? petEmoji : copy.icon}</Text>
        <View style={styles.petEventCopy}>
          <Text style={styles.petEventTitle}>{copy.title}</Text>
          <Text style={styles.petEventDetail}>{copy.detail}</Text>
        </View>
      </Card>

      <Card style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={typography.small}>目前階段</Text>
            <Text style={styles.stageName}>{stageTitle[stage]}</Text>
          </View>
          <Text style={styles.petMini}>{petEmoji}</Text>
        </View>
        <ProgressBar value={progress} />
        <Text style={[typography.small, styles.progressLabel]}>
          {reward.appliedPetXP === 0
            ? '這次獲得寵物蛋，XP 尚未套用'
            : `本次加入 ${reward.appliedPetXP} XP · 累積 ${pet.experience} XP`}
        </Text>
      </Card>

      <PrimaryButton label="回到探索首頁" onPress={finishReward} />
    </Page>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  sparkles: { color: colors.sunset, fontSize: 26, marginBottom: 14, marginTop: 26 },
  subtitle: { marginHorizontal: 16, marginTop: 8 },
  xpCard: { alignItems: 'center', marginTop: 28 },
  xpTotal: { color: colors.forest, fontSize: 42, fontWeight: '800', letterSpacing: -1 },
  xpRule: { backgroundColor: colors.line, height: 1, marginVertical: 20, width: '100%' },
  breakdownRow: { flexDirection: 'row', width: '100%' },
  breakdownItem: { alignItems: 'center', flex: 1 },
  breakdownValue: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 3 },
  petEventCard: { alignItems: 'center', flexDirection: 'row', marginTop: 14 },
  petEventIcon: { fontSize: 49 },
  petEventCopy: { flex: 1, paddingLeft: 17 },
  petEventTitle: { color: colors.white, fontSize: 18, fontWeight: '800' },
  petEventDetail: { color: 'rgba(255,255,255,0.74)', fontSize: 13, lineHeight: 19, marginTop: 5 },
  progressCard: { marginBottom: 20, marginTop: 14 },
  progressHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  stageName: { color: colors.ink, fontSize: 20, fontWeight: '800', marginTop: 2 },
  petMini: { fontSize: 38 },
  progressLabel: { marginTop: 10 },
  noStepNote: { marginTop: 10, textAlign: 'center' },
});
