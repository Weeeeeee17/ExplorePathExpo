import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ChoiceChip, Kicker, Page, ProgressBar, typography } from '../components/UI';
import {
  currentActivityStreak,
  dailyHealthSummaries,
  formatHealthDistance,
  isCountedStepRecord,
  recordHealthMetrics,
} from '../domain/health';
import { useExplorePath } from '../state/ExplorePathContext';
import { colors, radius } from '../theme';

const goalOptions = [4000, 6000, 8000, 10000];

function compactDay(key: string) {
  const date = new Date(`${key}T12:00:00`);
  return new Intl.DateTimeFormat('zh-TW', { weekday: 'short' }).format(date).replace('週', '');
}

export function HealthScreen() {
  const { records, healthProfile, updateHealthProfile } = useExplorePath();
  const counted = useMemo(() => records.filter(isCountedStepRecord), [records]);
  const days = useMemo(
    () => dailyHealthSummaries(records, healthProfile, Date.now(), 7),
    [records, healthProfile],
  );
  const today = days.at(-1) ?? { steps: 0, journeyCount: 0, elapsedMinutes: 0, activeMinutes: 0, estimatedDistanceMeters: 0 };
  const weekSteps = days.reduce((sum, day) => sum + day.steps, 0);
  const weekActiveMinutes = days.reduce((sum, day) => sum + day.activeMinutes, 0);
  const weekDistance = days.reduce((sum, day) => sum + day.estimatedDistanceMeters, 0);
  const streak = currentActivityStreak(records);
  const personalBest = counted.reduce((best, record) => Math.max(best, record.steps), 0);
  const maxDaySteps = Math.max(1, ...days.map((day) => day.steps));
  const goalProgress = today.steps / healthProfile.dailyStepGoal;

  return (
    <Page>
      <Kicker>v0.7.1 · 健康紀錄</Kicker>
      <Text style={[typography.title, styles.title]}>每一趟探索，都算進今天。</Text>
      <Text style={typography.body}>只使用你允許的旅程步數，資料保存在這支手機。</Text>

      <Card tone="green" style={styles.todayCard}>
        <Text style={styles.lightLabel}>今日旅程步數</Text>
        <Text style={styles.todaySteps}>{today.steps.toLocaleString()}</Text>
        <Text style={styles.lightCopy}>目標 {healthProfile.dailyStepGoal.toLocaleString()} 步 · {today.journeyCount} 趟活動旅程</Text>
        <View style={styles.progressWrap}><ProgressBar value={goalProgress} /></View>
      </Card>

      <View style={styles.metricGrid}>
        <Card style={styles.metricCard}>
          <Text style={styles.metricValue}>{weekSteps.toLocaleString()}</Text>
          <Text style={styles.metricLabel}>近 7 天步數</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricValue}>{weekActiveMinutes}</Text>
          <Text style={styles.metricLabel}>估算活動分鐘</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricValue}>{formatHealthDistance(weekDistance)}</Text>
          <Text style={styles.metricLabel}>估算步行距離</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text style={styles.metricValue}>{streak}</Text>
          <Text style={styles.metricLabel}>連續活動天數</Text>
        </Card>
      </View>

      <Text style={[typography.heading, styles.sectionTitle]}>最近 7 天</Text>
      <Card style={styles.chartCard}>
        <View style={styles.chart}>
          {days.map((day) => {
            const height = day.steps === 0 ? 4 : Math.max(10, Math.round((day.steps / maxDaySteps) * 92));
            return (
              <View key={day.dateKey} style={styles.barColumn}>
                <Text style={styles.barValue}>{day.steps > 0 ? day.steps.toLocaleString() : '—'}</Text>
                <View style={[styles.bar, { height }]} />
                <Text style={styles.barLabel}>{compactDay(day.dateKey)}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      <Card tone="paper" style={styles.bestCard}>
        <Text style={styles.bestTitle}>目前單趟最佳：{personalBest.toLocaleString()} 步</Text>
        <Text style={typography.small}>未抵達但有有效步數的旅程，也會納入健康統計。</Text>
      </Card>

      <Text style={[typography.heading, styles.sectionTitle]}>個人估算設定</Text>
      <Card style={styles.settingsCard}>
        <Text style={styles.settingLabel}>步幅</Text>
        <View style={styles.stepperRow}>
          <Pressable
            accessibilityLabel="減少步幅"
            onPress={() => updateHealthProfile({ strideLengthCm: healthProfile.strideLengthCm - 5 })}
            style={styles.stepperButton}
          ><Text style={styles.stepperText}>−</Text></Pressable>
          <View style={styles.stepperValueWrap}>
            <Text style={styles.stepperValue}>{healthProfile.strideLengthCm} cm</Text>
            <Text style={typography.small}>只影響估算距離</Text>
          </View>
          <Pressable
            accessibilityLabel="增加步幅"
            onPress={() => updateHealthProfile({ strideLengthCm: healthProfile.strideLengthCm + 5 })}
            style={styles.stepperButton}
          ><Text style={styles.stepperText}>＋</Text></Pressable>
        </View>

        <Text style={[styles.settingLabel, styles.goalLabel]}>每日旅程步數目標</Text>
        <View style={styles.goalGrid}>
          {goalOptions.map((goal) => (
            <View key={goal} style={styles.goalCell}>
              <ChoiceChip
                label={goal.toLocaleString()}
                selected={healthProfile.dailyStepGoal === goal}
                onPress={() => updateHealthProfile({ dailyStepGoal: goal })}
              />
            </View>
          ))}
        </View>
      </Card>

      <Card tone="paper" style={styles.futureCard}>
        <Text style={styles.futureTitle}>為未來的新寵物保留成長資料</Text>
        <Text style={typography.small}>旅程數、步數目標、個人最佳與連續活動天數會形成通用里程碑。之後的新寵物只讀取這些里程碑，不會綁回舊寵物系統。</Text>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 8, marginTop: 22 },
  todayCard: { marginTop: 22 },
  lightLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 13, fontWeight: '800' },
  todaySteps: { color: colors.white, fontSize: 46, fontWeight: '900', letterSpacing: -1, marginTop: 5 },
  lightCopy: { color: 'rgba(255,255,255,0.76)', fontSize: 13, marginTop: 4 },
  progressWrap: { marginTop: 18 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  metricCard: { minHeight: 104, padding: 16, width: '48.5%' },
  metricValue: { color: colors.forest, fontSize: 23, fontWeight: '900' },
  metricLabel: { color: colors.mutedInk, fontSize: 12, marginTop: 6 },
  sectionTitle: { marginBottom: 12, marginTop: 28 },
  chartCard: { paddingBottom: 14, paddingHorizontal: 12, paddingTop: 18 },
  chart: { alignItems: 'flex-end', flexDirection: 'row', height: 145, justifyContent: 'space-between' },
  barColumn: { alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  barValue: { color: colors.mutedInk, fontSize: 9, marginBottom: 5 },
  bar: { backgroundColor: colors.moss, borderRadius: radius.pill, maxWidth: 24, width: '54%' },
  barLabel: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 7 },
  bestCard: { marginTop: 12 },
  bestTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', marginBottom: 4 },
  settingsCard: { marginBottom: 12 },
  settingLabel: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  stepperRow: { alignItems: 'center', flexDirection: 'row', marginTop: 12 },
  stepperButton: { alignItems: 'center', backgroundColor: colors.softMoss, borderRadius: radius.pill, height: 44, justifyContent: 'center', width: 44 },
  stepperText: { color: colors.forest, fontSize: 24, fontWeight: '800' },
  stepperValueWrap: { alignItems: 'center', flex: 1 },
  stepperValue: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  goalLabel: { marginTop: 24 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 },
  goalCell: { width: '48.5%' },
  futureCard: { marginTop: 4 },
  futureTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', marginBottom: 6 },
});
