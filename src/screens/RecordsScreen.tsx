import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Kicker, Page, typography } from '../components/UI';
import { moodMeta, themeMeta } from '../domain/rules';
import { useExplorePath } from '../state/ExplorePathContext';
import { colors, radius } from '../theme';

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function RecordsScreen() {
  const { mode, records } = useExplorePath();
  const completed = records.filter((record) => record.completed);
  const totalSteps = records.reduce((sum, record) => sum + record.steps, 0);
  const totalXP = records.reduce((sum, record) => sum + record.earnedXP, 0);

  return (
    <Page>
      <Kicker>{mode === 'real' ? '真實探索足跡 · 本機保存' : 'Demo 足跡 · 暫存'}</Kicker>
      <Text style={[typography.title, styles.title]}>那些無意間走完的路。</Text>

      <Card tone="green" style={styles.overviewCard}>
        <View style={styles.overviewItem}>
          <Text style={styles.overviewValue}>{completed.length}</Text>
          <Text style={styles.overviewLabel}>完成探索</Text>
        </View>
        <View style={styles.lightRule} />
        <View style={styles.overviewItem}>
          <Text style={styles.overviewValue}>{totalSteps.toLocaleString()}</Text>
          <Text style={styles.overviewLabel}>累積步數</Text>
        </View>
        <View style={styles.lightRule} />
        <View style={styles.overviewItem}>
          <Text style={styles.overviewValue}>{totalXP}</Text>
          <Text style={styles.overviewLabel}>獲得 XP</Text>
        </View>
      </Card>

      {records.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⌁</Text>
          <Text style={typography.heading}>還沒有足跡</Text>
          <Text style={[typography.body, styles.emptyCopy]}>
            {mode === 'real'
              ? '完成一次真實探索後，地點、心情、步數與獎勵會保存在這支 iPhone。'
              : '完成一次 Demo 探索後，暫存的地點、心情、步數與獎勵會出現在這裡。'}
          </Text>
        </View>
      ) : (
        <View style={styles.recordList}>
          {records.map((record) => (
            <Card key={record.id} style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <View style={styles.recordIconWrap}>
                  <Text style={styles.recordIcon}>{record.completed ? themeMeta[record.theme].icon : '…'}</Text>
                </View>
                <View style={styles.recordMain}>
                  <View style={styles.recordTitleRow}>
                    <Text style={styles.recordTitle}>{record.destinationName}</Text>
                    {!record.completed ? (
                      <View style={styles.incompletePill}>
                        <Text style={styles.incompleteText}>未完成</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={typography.small}>{formatDate(record.endedAt)}</Text>
                </View>
              </View>
              <View style={styles.recordRule} />
              <View style={styles.recordMetrics}>
                <Text style={styles.recordMetric}>{record.steps.toLocaleString()} 步</Text>
                <Text style={styles.recordMetric}>{record.elapsedMinutes} 分鐘</Text>
                <Text style={styles.recordMetric}>+{record.earnedXP} XP</Text>
              </View>
              {record.mood ? (
                <Text style={[typography.small, styles.moodLine]}>
                  {moodMeta[record.mood].emoji} {moodMeta[record.mood].title}
                  {record.hasPhoto ? '　▣ 有照片' : ''}
                </Text>
              ) : null}
              {record.note ? <Text style={styles.note}>「{record.note}」</Text> : null}
            </Card>
          ))}
        </View>
      )}

      <Card tone="paper" style={styles.yearCard}>
        <Text style={styles.yearIcon}>四季</Text>
        <View style={styles.yearCopy}>
          <Text style={styles.yearTitle}>年度任務 · 未來版本</Text>
          <Text style={typography.small}>在春夏秋冬走過同一個地方，留下四季景色與寵物救援獎勵。</Text>
        </View>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 9 },
  overviewCard: { flexDirection: 'row', marginTop: 23 },
  overviewItem: { alignItems: 'center', flex: 1 },
  overviewValue: { color: colors.white, fontSize: 21, fontWeight: '800' },
  overviewLabel: { color: 'rgba(255,255,255,0.62)', fontSize: 11, marginTop: 3 },
  lightRule: { backgroundColor: 'rgba(255,255,255,0.18)', height: 39, width: 1 },
  emptyState: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 58 },
  emptyIcon: { color: colors.moss, fontSize: 58, marginBottom: 12 },
  emptyCopy: { marginTop: 7, textAlign: 'center' },
  recordList: { gap: 12, marginTop: 15 },
  recordCard: { padding: 17 },
  recordHeader: { alignItems: 'center', flexDirection: 'row' },
  recordIconWrap: { alignItems: 'center', backgroundColor: colors.softMoss, borderRadius: 17, height: 52, justifyContent: 'center', width: 52 },
  recordIcon: { fontSize: 25 },
  recordMain: { flex: 1, paddingLeft: 12 },
  recordTitleRow: { alignItems: 'center', flexDirection: 'row' },
  recordTitle: { color: colors.ink, flexShrink: 1, fontSize: 16, fontWeight: '800' },
  incompletePill: { backgroundColor: '#F3DBD3', borderRadius: radius.pill, marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4 },
  incompleteText: { color: '#984B3D', fontSize: 10, fontWeight: '800' },
  recordRule: { backgroundColor: colors.line, height: 1, marginVertical: 13 },
  recordMetrics: { flexDirection: 'row', gap: 18 },
  recordMetric: { color: colors.forest, fontSize: 12, fontWeight: '800' },
  moodLine: { marginTop: 11 },
  note: { color: colors.ink, fontSize: 13, fontStyle: 'italic', lineHeight: 20, marginTop: 8 },
  yearCard: { alignItems: 'center', flexDirection: 'row', marginTop: 18 },
  yearIcon: { color: colors.forest, fontSize: 20, fontWeight: '800', marginRight: 15 },
  yearCopy: { flex: 1 },
  yearTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 4 },
});
