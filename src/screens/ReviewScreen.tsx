import React from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Page, PrimaryButton, typography } from '../components/UI';
import { moodMeta, themeMeta } from '../domain/rules';
import { JourneyEffort, JourneyMood } from '../domain/types';
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

const efforts: Array<{ id: JourneyEffort; label: string; detail: string }> = [
  { id: 'easy', label: '很輕鬆', detail: '幾乎不累' },
  { id: 'steady', label: '剛剛好', detail: '可以繼續' },
  { id: 'challenging', label: '有點吃力', detail: '需要休息' },
  { id: 'hard', label: '很累', detail: '今天先到這裡' },
];

export function ReviewScreen() {
  const {
    candidate,
    activeJourney,
    review,
    memoryMessage,
    setMood,
    setEffort,
    setNote,
    captureReviewPhoto,
    removeReviewPhoto,
    submitReview,
  } =
    useExplorePath();
  if (!candidate || !activeJourney) return null;

  return (
    <Page>
      <Text style={[typography.title, styles.center, styles.arrived]}>留下一段回憶</Text>
      <Text style={[typography.body, styles.center]}>抵達已完成，現在記錄這趟的感受</Text>

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

      <Text style={[typography.heading, styles.effortHeading]}>身體感覺如何？</Text>
      <Text style={[typography.small, styles.required]}>必填 · 這是你的主觀感受，不是醫療判定</Text>
      <View style={styles.effortGrid}>
        {efforts.map((effort) => {
          const selected = review.effort === effort.id;
          return (
            <Pressable
              key={effort.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setEffort(effort.id)}
              style={({ pressed }) => [
                styles.effort,
                selected && styles.selectedEffort,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.effortLabel, selected && styles.selectedMoodLabel]}>{effort.label}</Text>
              <Text style={[styles.effortDetail, selected && styles.selectedEffortDetail]}>{effort.detail}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: review.hasPhoto }}
        onPress={() => {
          if (review.photoUri) void removeReviewPhoto();
          else void captureReviewPhoto();
        }}
        style={({ pressed }) => [
          styles.photoCard,
          review.hasPhoto && styles.photoSelected,
          pressed && styles.pressed,
        ]}
      >
        {review.photoUri ? (
          <Image source={{ uri: review.photoUri }} style={styles.photoPreview} />
        ) : (
          <View style={styles.photoIconWrap}>
            <Text style={styles.photoIcon}>▣</Text>
          </View>
        )}
        <View style={styles.photoCopy}>
          <Text style={styles.photoTitle}>
            {review.photoUri ? '已加入一張代表照片' : '替這趟探索留張照片'}
          </Text>
          <Text style={typography.small}>
            選填 · 照片只保存在這支手機，也能完成後再補
          </Text>
        </View>
        <Text style={styles.photoAction}>{review.photoUri ? '移除' : '拍照'}</Text>
      </Pressable>

      {memoryMessage ? <Text style={[typography.small, styles.message]}>{memoryMessage}</Text> : null}

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
        disabled={!review.mood || !review.effort}
        label={review.mood && review.effort ? '完成並查看健康摘要' : '先完成心情與身體感受'}
        onPress={submitReview}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  arrived: { marginTop: 10 },
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
  effortHeading: { marginTop: 25 },
  effortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  effort: { backgroundColor: colors.softWhite, borderColor: colors.line, borderRadius: radius.medium, borderWidth: 1, padding: 13, width: '48.5%' },
  selectedEffort: { backgroundColor: colors.forest, borderColor: colors.forest },
  effortLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  effortDetail: { color: colors.mutedInk, fontSize: 11, marginTop: 3 },
  selectedEffortDetail: { color: 'rgba(255,255,255,0.72)' },
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
  photoPreview: { borderRadius: 16, height: 54, width: 54 },
  photoCopy: { flex: 1, paddingHorizontal: 12 },
  photoTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  photoAction: { color: colors.forest, fontSize: 13, fontWeight: '800' },
  message: { marginTop: 8 },
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
