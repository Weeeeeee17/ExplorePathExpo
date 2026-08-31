import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { JourneyMicroTask } from '../domain/types';
import { colors, radius } from '../theme';
import { PrimaryButton, SecondaryButton, typography } from './UI';

const typeLabel = { photo: '拍照任務', observation: '觀察任務', imagination: '想像任務' } as const;

export function MicroTaskModal({
  visible,
  task,
  hint,
  onClose,
  onBegin,
  onReplace,
  onSkip,
  onComplete,
  onCapturePhoto,
  onSavePhoto,
}: {
  visible: boolean;
  task: JourneyMicroTask;
  hint: string;
  onClose: () => void;
  onBegin: () => void;
  onReplace: () => void;
  onSkip: () => void;
  onComplete: (response: string) => void;
  onCapturePhoto: () => Promise<void>;
  onSavePhoto: () => Promise<void>;
}) {
  const [answer, setAnswer] = useState('');
  useEffect(() => setAnswer(''), [task.id]);
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {task.status === 'available' ? (
            <>
              <Text style={styles.safetyIcon}>⚑</Text>
              <Text style={[typography.title, styles.center]}>先安全停下來</Text>
              <Text style={[typography.body, styles.center, styles.copy]}>
                請站到不妨礙通行、遠離車道的位置。確認安全後，小任務才會開始，沒有倒數壓力。
              </Text>
              <PrimaryButton label="我已安全停下" onPress={onBegin} />
              <Pressable onPress={onClose} style={styles.textButton}><Text style={styles.textButtonLabel}>稍後再做</Text></Pressable>
            </>
          ) : task.status === 'completed' ? (
            <>
              <Text style={styles.success}>✓</Text>
              <Text style={[typography.title, styles.center]}>小任務完成</Text>
              {task.photoUri ? <Image source={{ uri: task.photoUri }} style={styles.photo} /> : null}
              <View style={styles.hintCard}>
                <Text style={styles.hintKicker}>終點提示已增加</Text>
                <Text style={styles.hintText}>{hint}</Text>
                <Text style={styles.hintFoot}>地圖範圍已縮小到約 100 公尺；50 公尺內才會揭曉名稱。</Text>
              </View>
              {task.photoUri && !task.savedToPhotoLibrary ? (
                <SecondaryButton label="另存到 iPhone 照片（選填）" onPress={() => void onSavePhoto()} />
              ) : null}
              {task.savedToPhotoLibrary ? <Text style={styles.saved}>已另存到 iPhone「照片」</Text> : null}
              <Pressable onPress={onClose} style={styles.textButton}><Text style={styles.textButtonLabel}>回到探索</Text></Pressable>
            </>
          ) : task.status === 'skipped' ? (
            <>
              <Text style={[typography.title, styles.center]}>已略過小任務</Text>
              <Text style={[typography.body, styles.center, styles.copy]}>不會扣除獎勵，也不影響抵達判定；終點提示維持原本範圍。</Text>
              <PrimaryButton label="回到探索" onPress={onClose} />
            </>
          ) : (
            <>
              <Text style={styles.kicker}>{typeLabel[task.type]}</Text>
              <Text style={typography.title}>{task.title}</Text>
              <Text style={[typography.body, styles.prompt]}>{task.prompt}</Text>
              <Text style={styles.instruction}>{task.instruction}</Text>

              {task.type === 'photo' ? (
                <PrimaryButton label="開啟相機拍攝" onPress={() => void onCapturePhoto()} />
              ) : null}
              {task.type === 'observation' ? (
                <View style={styles.options}>
                  {(task.options ?? []).map((option) => (
                    <Pressable key={option} onPress={() => onComplete(option)} style={styles.option}>
                      <Text style={styles.optionText}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {task.type === 'imagination' ? (
                <>
                  <TextInput
                    maxLength={80}
                    onChangeText={setAnswer}
                    placeholder="輸入一個詞或一句短話"
                    placeholderTextColor="#929687"
                    style={styles.input}
                    value={answer}
                  />
                  <PrimaryButton disabled={!answer.trim()} label="完成小任務" onPress={() => onComplete(answer)} />
                </>
              ) : null}

              <View style={styles.actions}>
                {!task.replacementUsed ? <SecondaryButton label="免費換一題（僅一次）" onPress={onReplace} /> : null}
                <Pressable onPress={onSkip} style={styles.textButton}><Text style={styles.skip}>略過，不影響主獎勵</Text></Pressable>
                <Pressable onPress={onClose} style={styles.textButton}><Text style={styles.textButtonLabel}>先收起</Text></Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: colors.overlay, flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%', padding: 24, paddingBottom: 34 },
  handle: { alignSelf: 'center', backgroundColor: colors.line, borderRadius: 3, height: 5, marginBottom: 22, width: 48 },
  center: { textAlign: 'center' },
  safetyIcon: { fontSize: 38, marginBottom: 12, textAlign: 'center' },
  copy: { marginBottom: 24, marginTop: 10 },
  kicker: { color: colors.forest, fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 7 },
  prompt: { color: colors.ink, marginTop: 12 },
  instruction: { backgroundColor: '#F4E4B7', borderRadius: radius.medium, color: colors.ink, fontSize: 13, lineHeight: 19, marginBottom: 20, marginTop: 14, padding: 13 },
  options: { gap: 9 },
  option: { backgroundColor: colors.softWhite, borderColor: colors.line, borderRadius: radius.pill, borderWidth: 1, padding: 15 },
  optionText: { color: colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  input: { backgroundColor: colors.softWhite, borderColor: colors.line, borderRadius: radius.medium, borderWidth: 1, color: colors.ink, fontSize: 15, marginBottom: 14, padding: 15 },
  actions: { gap: 2, marginTop: 13 },
  textButton: { alignItems: 'center', padding: 14 },
  textButtonLabel: { color: colors.forest, fontSize: 14, fontWeight: '800' },
  skip: { color: colors.mutedInk, fontSize: 13, fontWeight: '700' },
  success: { color: colors.forest, fontSize: 46, fontWeight: '900', textAlign: 'center' },
  photo: { borderRadius: radius.card, height: 190, marginTop: 18, width: '100%' },
  hintCard: { backgroundColor: colors.softMoss, borderRadius: radius.card, marginBottom: 16, marginTop: 20, padding: 17 },
  hintKicker: { color: colors.forest, fontSize: 12, fontWeight: '900' },
  hintText: { color: colors.ink, fontSize: 17, fontWeight: '800', lineHeight: 24, marginTop: 5 },
  hintFoot: { color: colors.mutedInk, fontSize: 12, lineHeight: 18, marginTop: 8 },
  saved: { color: colors.forest, fontSize: 13, fontWeight: '800', marginTop: 12, textAlign: 'center' },
});
