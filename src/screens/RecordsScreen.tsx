import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Kicker, Page, PrimaryButton, SecondaryButton, typography } from '../components/UI';
import { formatHealthDistance, isCountedStepRecord, recordHealthMetrics } from '../domain/health';
import { isActivityJourney, journeyOutcome, memoriesByMonth, monthlySummary, stepDisplayText } from '../domain/memories';
import { moodMeta, themeMeta } from '../domain/rules';
import { JourneyEffort, JourneyRecord } from '../domain/types';
import { useExplorePath } from '../state/ExplorePathContext';
import { colors, radius } from '../theme';

const effortMeta: Record<JourneyEffort, string> = {
  easy: '很輕鬆',
  steady: '剛剛好',
  challenging: '有點吃力',
  hard: '很累',
};

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(timestamp));
}

function formatMonth(key: string) {
  const [year, month] = key.split('-');
  return `${year} 年 ${Number(month)} 月`;
}

function RecordCard({ record, onPress }: { record: JourneyRecord; onPress: () => void }) {
  const outcome = journeyOutcome(record);
  const steps = stepDisplayText(record);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.recordCard, pressed && styles.pressed]}>
      <View style={styles.recordIcon}><Text style={styles.recordIconText}>{themeMeta[record.theme].icon}</Text></View>
      <View style={styles.recordCopy}>
        <View style={styles.recordTitleRow}>
          <Text numberOfLines={1} style={styles.recordTitle}>{record.destinationName}</Text>
          <Text style={[styles.outcome, outcome === 'unreached' && styles.unreached]}> {outcome === 'arrived' ? '已抵達' : '未抵達'} </Text>
        </View>
        <Text style={styles.recordMeta}>{formatDate(record.endedAt)} · {record.elapsedMinutes} 分鐘</Text>
        <Text style={styles.recordSteps}>{steps ?? '步數未納入統計'}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function RecordsScreen() {
  const {
    records, healthProfile, backupPreview, memoryMessage, updateMemoryNote, hideMemory,
    markMemoryStepsInaccurate, exportBackup, chooseBackup, confirmBackupRestore,
    cancelBackupRestore, clearMemoryMessage,
  } = useExplorePath();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const monthGroups = useMemo(() => memoriesByMonth(records), [records]);
  const selected = records.find((record) => record.id === selectedId) ?? null;
  const activityRecords = records.filter(isActivityJourney);
  const countedRecords = activityRecords.filter(isCountedStepRecord);
  const totalSteps = countedRecords.reduce((sum, record) => sum + record.steps, 0);
  const totalActiveMinutes = countedRecords.reduce(
    (sum, record) => sum + recordHealthMetrics(record, healthProfile).estimatedActiveMinutes, 0,
  );
  const totalDistance = countedRecords.reduce(
    (sum, record) => sum + recordHealthMetrics(record, healthProfile).estimatedDistanceMeters, 0,
  );

  const openRecord = (record: JourneyRecord) => {
    setSelectedId(record.id);
    setDraftNote(record.note);
  };
  const closeRecord = () => setSelectedId(null);
  const askToHide = (record: JourneyRecord) => {
    Alert.alert('從足跡時間軸隱藏？', '健康統計仍會保留，但這張旅程卡片不再顯示。', [
      { text: '取消', style: 'cancel' },
      { text: '確認隱藏', style: 'destructive', onPress: () => { void hideMemory(record.id).then(closeRecord); } },
    ]);
  };
  const selectedMetrics = selected ? recordHealthMetrics(selected, healthProfile) : null;

  return (
    <Page>
      <Kicker>v0.7.1 · 本機健康足跡</Kicker>
      <Text style={[typography.title, styles.title]}>走過的每一段，都有留下來。</Text>

      {memoryMessage ? (
        <Pressable onPress={clearMemoryMessage} style={styles.messageBanner}>
          <Text style={styles.messageText}>{memoryMessage}</Text><Text style={styles.messageClose}>×</Text>
        </Pressable>
      ) : null}

      <Card tone="green" style={styles.overviewCard}>
        <View style={styles.overviewItem}><Text style={styles.overviewValue}>{activityRecords.length}</Text><Text style={styles.overviewLabel}>活動旅程</Text></View>
        <View style={styles.lightRule} />
        <View style={styles.overviewItem}><Text style={styles.overviewValue}>{totalSteps.toLocaleString()}</Text><Text style={styles.overviewLabel}>累積步數</Text></View>
        <View style={styles.lightRule} />
        <View style={styles.overviewItem}><Text style={styles.overviewValue}>{Math.round(totalActiveMinutes)}</Text><Text style={styles.overviewLabel}>活動分鐘</Text></View>
      </Card>

      <Card tone="paper" style={styles.distanceCard}>
        <Text style={styles.distanceTitle}>估算累積距離：{formatHealthDistance(totalDistance)}</Text>
        <Text style={typography.small}>依有效旅程步數與 {healthProfile.strideLengthCm} 公分步幅計算，可在健康頁調整。</Text>
      </Card>

      {monthGroups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⌁</Text><Text style={typography.heading}>還沒有健康足跡</Text>
          <Text style={[typography.body, styles.emptyCopy]}>抵達，或未抵達但走出有效步數後，就會建立一趟活動旅程。</Text>
        </View>
      ) : monthGroups.map((group) => {
        const summary = monthlySummary(records, group.key);
        return (
          <View key={group.key} style={styles.monthSection}>
            <Text style={styles.monthTitle}>{formatMonth(group.key)}</Text>
            <Text style={styles.monthMeta}>{summary.journeyCount} 趟 · {summary.totalSteps.toLocaleString()} 步 · {summary.totalMinutes} 分鐘</Text>
            <View style={styles.recordList}>
              {group.records.map((record) => <RecordCard key={record.id} record={record} onPress={() => openRecord(record)} />)}
            </View>
          </View>
        );
      })}

      <Text style={[typography.heading, styles.backupHeading]}>資料備份</Text>
      <Card style={styles.backupCard}>
        <Text style={styles.backupTitle}>健康足跡保存在本機</Text>
        <Text style={[typography.small, styles.backupCopy]}>備份包含旅程與健康統計，不包含照片；還原前會先顯示摘要。</Text>
        <PrimaryButton label="匯出備份" onPress={() => void exportBackup()} />
        <View style={styles.buttonGap} />
        <SecondaryButton label="選擇備份檔還原" onPress={() => void chooseBackup()} />
      </Card>

      <Modal transparent animationType="slide" visible={Boolean(selected && selectedMetrics)} onRequestClose={closeRecord}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selected && selectedMetrics ? (
                <>
                  <View style={styles.modalTopRow}><Kicker>{journeyOutcome(selected) === 'arrived' ? '已抵達旅程' : '未抵達活動旅程'}</Kicker><Pressable onPress={closeRecord}><Text style={styles.close}>×</Text></Pressable></View>
                  <Text style={[typography.title, styles.modalTitle]}>{selected.destinationName}</Text>
                  <Text style={typography.small}>{formatDate(selected.endedAt)} · {themeMeta[selected.theme].title}</Text>
                  <View style={styles.detailGrid}>
                    <View style={styles.detailItem}><Text style={styles.detailValue}>{selectedMetrics.steps.toLocaleString()}</Text><Text style={styles.detailLabel}>步數</Text></View>
                    <View style={styles.detailItem}><Text style={styles.detailValue}>{selectedMetrics.elapsedMinutes}</Text><Text style={styles.detailLabel}>旅程分鐘</Text></View>
                    <View style={styles.detailItem}><Text style={styles.detailValue}>{selectedMetrics.estimatedActiveMinutes}</Text><Text style={styles.detailLabel}>估算活動分鐘</Text></View>
                    <View style={styles.detailItem}><Text style={styles.detailValue}>{formatHealthDistance(selectedMetrics.estimatedDistanceMeters)}</Text><Text style={styles.detailLabel}>估算距離</Text></View>
                  </View>
                  <Card tone="paper" style={styles.feelingCard}>
                    <Text style={styles.feelingTitle}>心情：{selected.mood ? `${moodMeta[selected.mood].emoji} ${moodMeta[selected.mood].title}` : '未記錄'}</Text>
                    <Text style={styles.feelingTitle}>身體感受：{selected.effort ? effortMeta[selected.effort] : '未記錄'}</Text>
                  </Card>
                  <Text style={[typography.heading, styles.noteHeading]}>私人筆記</Text>
                  <TextInput multiline maxLength={160} onChangeText={setDraftNote} placeholder="替這趟旅程留一句話" placeholderTextColor="#929687" style={styles.noteInput} value={draftNote} />
                  <PrimaryButton label="儲存筆記" onPress={() => { updateMemoryNote(selected.id, draftNote); closeRecord(); }} />
                  <Pressable onPress={() => markMemoryStepsInaccurate(selected.id)} style={styles.textAction}><Text style={styles.textActionLabel}>這趟步數不準確，排除健康統計</Text></Pressable>
                  <Pressable onPress={() => askToHide(selected)} style={styles.textAction}><Text style={styles.destructiveAction}>從時間軸隱藏</Text></Pressable>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={Boolean(backupPreview)}>
        <View style={[styles.modalBackdrop, styles.centerModal]}>
          <View style={styles.backupModal}>
            <Text style={typography.heading}>確認還原備份</Text>
            <Text style={[typography.body, styles.backupPreviewCopy]}>版本 {backupPreview?.appVersion} · {backupPreview?.recordCount ?? 0} 趟旅程 · {backupPreview?.petCount ?? 0} 位新夥伴 · {backupPreview?.archiveCount ?? 0} 份舊版封存。還原會取代目前資料（包含寵物收藏），不含照片，不恢復進行中的雲端組隊；本機提醒需重新開啟。請先匯出現有備份。</Text>
            <PrimaryButton label="確認還原" onPress={confirmBackupRestore} />
            <View style={styles.buttonGap} /><SecondaryButton label="取消" onPress={cancelBackupRestore} />
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 20, marginTop: 22 },
  messageBanner: { alignItems: 'center', backgroundColor: colors.softMoss, borderRadius: radius.medium, flexDirection: 'row', marginBottom: 12, padding: 13 },
  messageText: { color: colors.forest, flex: 1, fontSize: 13, lineHeight: 19 },
  messageClose: { color: colors.forest, fontSize: 20, fontWeight: '800', paddingLeft: 10 },
  overviewCard: { alignItems: 'center', flexDirection: 'row' },
  overviewItem: { alignItems: 'center', flex: 1 },
  overviewValue: { color: colors.white, fontSize: 22, fontWeight: '900' },
  overviewLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 11, marginTop: 4 },
  lightRule: { backgroundColor: 'rgba(255,255,255,0.18)', height: 42, width: 1 },
  distanceCard: { marginTop: 12 }, distanceTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', marginBottom: 5 },
  emptyState: { alignItems: 'center', paddingHorizontal: 22, paddingVertical: 60 }, emptyIcon: { color: colors.moss, fontSize: 62, marginBottom: 15 }, emptyCopy: { marginTop: 8, textAlign: 'center' },
  monthSection: { marginTop: 28 }, monthTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' }, monthMeta: { color: colors.mutedInk, fontSize: 12, marginTop: 3 }, recordList: { gap: 9, marginTop: 12 },
  recordCard: { alignItems: 'center', backgroundColor: colors.softWhite, borderColor: colors.line, borderRadius: radius.medium, borderWidth: 1, flexDirection: 'row', padding: 13 },
  recordIcon: { alignItems: 'center', backgroundColor: colors.paper, borderRadius: 15, height: 48, justifyContent: 'center', width: 48 }, recordIconText: { fontSize: 24 },
  recordCopy: { flex: 1, paddingHorizontal: 11 }, recordTitleRow: { alignItems: 'center', flexDirection: 'row' }, recordTitle: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: '900' },
  outcome: { backgroundColor: colors.softMoss, borderRadius: radius.pill, color: colors.forest, fontSize: 9, overflow: 'hidden' }, unreached: { backgroundColor: '#EFE8D2', color: '#7B6634' },
  recordMeta: { color: colors.mutedInk, fontSize: 11, marginTop: 4 }, recordSteps: { color: colors.forest, fontSize: 12, fontWeight: '800', marginTop: 4 }, chevron: { color: colors.moss, fontSize: 27 },
  backupHeading: { marginTop: 32 }, backupCard: { marginTop: 12 }, backupTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' }, backupCopy: { marginBottom: 16, marginTop: 5 }, buttonGap: { height: 9 },
  modalBackdrop: { backgroundColor: colors.overlay, flex: 1, justifyContent: 'flex-end' }, centerModal: { alignItems: 'center', justifyContent: 'center' },
  modalSheet: { backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '91%', padding: 22 }, modalTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, close: { color: colors.ink, fontSize: 30, paddingHorizontal: 6 }, modalTitle: { marginBottom: 5, marginTop: 16 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 18 }, detailItem: { backgroundColor: colors.softWhite, borderRadius: radius.medium, padding: 14, width: '48.5%' }, detailValue: { color: colors.forest, fontSize: 19, fontWeight: '900' }, detailLabel: { color: colors.mutedInk, fontSize: 11, marginTop: 4 },
  feelingCard: { marginTop: 12 }, feelingTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginVertical: 3 }, noteHeading: { marginTop: 22 },
  noteInput: { backgroundColor: colors.softWhite, borderColor: colors.line, borderRadius: radius.medium, borderWidth: 1, color: colors.ink, fontSize: 14, lineHeight: 21, marginBottom: 12, marginTop: 9, minHeight: 94, padding: 14, textAlignVertical: 'top' },
  textAction: { alignItems: 'center', paddingVertical: 14 }, textActionLabel: { color: colors.forest, fontSize: 13, fontWeight: '800' }, destructiveAction: { color: '#A4483A', fontSize: 13, fontWeight: '800' },
  backupModal: { backgroundColor: colors.paper, borderRadius: radius.card, padding: 22, width: '88%' }, backupPreviewCopy: { marginBottom: 20, marginTop: 8 }, pressed: { opacity: 0.7 },
});
