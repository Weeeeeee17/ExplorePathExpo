import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Page, PrimaryButton, typography } from '../components/UI';
import { moodMeta, themeMeta } from '../domain/rules';
import { JourneyMood } from '../domain/types';
import { useExplorePath } from '../state/ExplorePathContext';
import { colors, radius } from '../theme';

const moods: JourneyMood[] = [
  'surprised',
  'happy',
  'calm',
  'curious',
  'tired',
  'disappointed',
];

export function ReviewScreen() {
  const { mode, candidate, activeJourney, review, setMood, setNote, togglePhoto, submitReview } =
    useExplorePath();
  if (!candidate || !activeJourney) return null;

  return (
    <Page>
      <View style={styles.successMark}>
        <Text style={styles.check}>✓</Text>
      </View>
      <Text style={[typography.title, styles.center, styles.arrived]}>你到了！</Text>
      <Text style={[typography.body, styles.center]}>神秘地點正式揭曉</Text>

      <Card tone="green" style={styles.destinationCard}>
        <Text style={styles.themeIcon}>{themeMeta[candidate.theme].icon}</Text>
        <Text style={styles.revealLabel}>{themeMeta[candidate.theme].title}探索</Text>
        <Text style={styles.destinationName}>{candidate.internalName}</Text>
        <Text style={styles.destinationHint}>{candidate.environmentHint}</Text>
      </Card>

      <Text style={typography.heading}>這趟感覺如何？</Text>
      <Text style={[typography.small, styles.required]}>必填 · 選一個最接近的心情</Text>
      <View style={styles.moodGrid}>
        {moods.map((mood) => {
          const selected = review.mood === mood;
          return (
            <Pressable
              key={mood}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setMood(mood)}
              style={({ pressed }) => [
                styles.mood,
                selected && styles.selectedMood,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.moodEmoji}>{moodMeta[mood].emoji}</Text>
              <Text style={[styles.moodLabel, selected && styles.selectedMoodLabel]}>
                {moodMeta[mood].title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: review.hasPhoto }}
        onPress={togglePhoto}
        style={({ pressed }) => [
          styles.photoCard,
          review.hasPhoto && styles.photoSelected,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.photoIconWrap}>
          <Text style={styles.photoIcon}>▣</Text>
        </View>
        <View style={styles.photoCopy}>
          <Text style={styles.photoTitle}>
            {review.hasPhoto ? '已標記這趟有拍照' : '替這趟探索留張照片'}
          </Text>
          <Text style={typography.small}>
            {mode === 'real' ? '選填 · 第一感測版只保存有拍照標記' : '選填 · Demo 不會開啟相機'}
          </Text>
        </View>
        <Text style={styles.photoAction}>{review.hasPhoto ? '移除' : '加入'}</Text>
      </Pressable>

      <Text style={[typography.heading, styles.noteHeading]}>留一句話給未來的自己</Text>
      <TextInput
        accessibilityLabel="探索筆記"
        multiline
        maxLength={160}
        onChangeText={setNote}
        placeholder="例如：原來離日常這麼近，也有沒看過的風景。"
        placeholderTextColor="#929687"
        style={styles.input}
        textAlignVertical="top"
        value={review.note}
      />
      <Text style={[typography.small, styles.count]}>{review.note.length} / 160</Text>

      <PrimaryButton
        disabled={!review.mood}
        label={review.mood ? '完成並領取獎勵' : '先選擇一個心情'}
        onPress={submitReview}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  successMark: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.softMoss,
    borderRadius: 37,
    height: 74,
    justifyContent: 'center',
    marginTop: 10,
    width: 74,
  },
  check: { color: colors.forest, fontSize: 34, fontWeight: '800' },
  center: { textAlign: 'center' },
  arrived: { marginTop: 17 },
  destinationCard: { marginBottom: 27, marginTop: 22 },
  themeIcon: { fontSize: 34 },
  revealLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700', marginTop: 16 },
  destinationName: { color: colors.white, fontSize: 28, fontWeight: '800', marginTop: 5 },
  destinationHint: { color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 21, marginTop: 9 },
  required: { marginBottom: 13, marginTop: 3 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  mood: {
    alignItems: 'center',
    backgroundColor: colors.softWhite,
    borderColor: colors.line,
    borderRadius: radius.medium,
    borderWidth: 1,
    paddingVertical: 12,
    width: '31.5%',
  },
  selectedMood: { backgroundColor: colors.forest, borderColor: colors.forest },
  moodEmoji: { fontSize: 25 },
  moodLabel: { color: colors.ink, fontSize: 12, fontWeight: '700', marginTop: 4 },
  selectedMoodLabel: { color: colors.white },
  photoCard: {
    alignItems: 'center',
    backgroundColor: colors.softWhite,
    borderColor: colors.line,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 24,
    padding: 16,
  },
  photoSelected: { backgroundColor: colors.softMoss, borderColor: 'rgba(41,87,64,0.26)' },
  photoIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  photoIcon: { color: colors.forest, fontSize: 22 },
  photoCopy: { flex: 1, paddingHorizontal: 12 },
  photoTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  photoAction: { color: colors.forest, fontSize: 13, fontWeight: '800' },
  noteHeading: { marginTop: 25 },
  input: {
    backgroundColor: colors.softWhite,
    borderColor: colors.line,
    borderRadius: radius.medium,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    minHeight: 112,
    padding: 16,
  },
  count: { marginBottom: 20, marginTop: 5, textAlign: 'right' },
  pressed: { opacity: 0.7 },
});
