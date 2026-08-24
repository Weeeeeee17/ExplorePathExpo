import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Kicker, Page, ProgressBar, typography } from '../components/UI';
import {
  growingXP,
  hatchXP,
  matureXP,
  petStage,
  speciesMeta,
  stageTitle,
} from '../domain/rules';
import { useExplorePath } from '../state/ExplorePathContext';
import { colors, radius } from '../theme';

export function PetScreen() {
  const { mode, pet, records } = useExplorePath();
  const stage = petStage(pet);
  const emoji = pet.species ? speciesMeta[pet.species].emoji : pet.hasEgg ? '🥚' : '·';
  const name = pet.species ? speciesMeta[pet.species].title : stageTitle[stage];
  const nextThreshold = !pet.hasEgg
    ? 1
    : !pet.species
      ? hatchXP
      : stage === 'juvenile'
        ? growingXP
        : matureXP;
  const progress = stage === 'mature' ? 1 : Math.min(pet.experience / nextThreshold, 1);
  const completed = records.filter((record) => record.completed).length;

  return (
    <Page>
      <Kicker>{mode === 'real' ? '真實探索夥伴 · 本機保存' : 'Demo 夥伴 · 暫存'}</Kicker>
      <Text style={[typography.title, styles.title]}>走過的路，會在這裡長大。</Text>

      <View style={styles.habitat}>
        <View style={styles.sun} />
        <View style={[styles.hill, styles.backHill]} />
        <View style={[styles.hill, styles.frontHill]} />
        <View style={styles.petShadow} />
        <Text style={styles.petEmoji}>{emoji}</Text>
        {!pet.hasEgg ? <Text style={styles.emptyHint}>完成第一次探索，就可能在路上遇見什麼。</Text> : null}
      </View>

      <Card style={styles.identityCard}>
        <View style={styles.identityRow}>
          <View>
            <Text style={typography.small}>目前夥伴</Text>
            <Text style={styles.petName}>{name}</Text>
          </View>
          <View style={styles.stagePill}>
            <Text style={styles.stagePillText}>{stageTitle[stage]}</Text>
          </View>
        </View>
        <ProgressBar value={progress} />
        <View style={styles.progressLabels}>
          <Text style={typography.small}>{pet.experience} XP</Text>
          <Text style={typography.small}>
            {stage === 'mature' ? '成熟完成' : `下一階段 ${nextThreshold} XP`}
          </Text>
        </View>
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{completed}</Text>
          <Text style={typography.small}>完成探索</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{pet.experience}</Text>
          <Text style={typography.small}>寵物經驗</Text>
        </Card>
      </View>

      <Card tone="paper">
        <Text style={styles.noteTitle}>這個版本怎麼運作？</Text>
        <Text style={typography.body}>
          第一次完成探索會找到蛋，但不套用當次 XP。之後每趟抵達獎勵與步數加成，都會推進孵化與三階段成長。
        </Text>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 9 },
  habitat: {
    alignItems: 'center',
    backgroundColor: '#E6E7CE',
    borderRadius: radius.large,
    height: 280,
    justifyContent: 'center',
    marginTop: 24,
    overflow: 'hidden',
  },
  sun: { backgroundColor: '#F2C66D', borderRadius: 35, height: 70, position: 'absolute', right: 34, top: 30, width: 70 },
  hill: { borderRadius: 200, position: 'absolute' },
  backHill: { backgroundColor: '#AFC29B', bottom: -95, height: 230, left: -70, width: 360 },
  frontHill: { backgroundColor: '#7F9F70', bottom: -135, height: 245, right: -95, width: 390 },
  petShadow: { backgroundColor: 'rgba(41,87,64,0.18)', borderRadius: 40, bottom: 48, height: 25, position: 'absolute', width: 110 },
  petEmoji: { fontSize: 94, marginTop: 24 },
  emptyHint: { bottom: 26, color: colors.forest, fontSize: 13, fontWeight: '700', paddingHorizontal: 40, position: 'absolute', textAlign: 'center' },
  identityCard: { marginTop: 14 },
  identityRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 17 },
  petName: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: 2 },
  stagePill: { backgroundColor: colors.softMoss, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  stagePillText: { color: colors.forest, fontSize: 12, fontWeight: '800' },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 14, marginTop: 14 },
  statCard: { flex: 1 },
  statValue: { color: colors.forest, fontSize: 27, fontWeight: '800', marginBottom: 2 },
  noteTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', marginBottom: 7 },
});
