import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { TeamMember } from '../domain/social';
import { colors } from '../theme';
import { PetImage } from './PetImage';
import { publicPetStory } from '../domain/petDisplay';
import { seriesFor } from '../domain/petCatalog';
import { stageTitle } from '../domain/rules';

export function TeamPetScene({ members, compact = false, celebrate = false }: { members: TeamMember[]; compact?: boolean; celebrate?: boolean }) {
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!celebrate || reduce || cancelled) return;
      animation = Animated.sequence([0, 1, 2].map(() => Animated.sequence([
        Animated.timing(lift, { toValue: -8, duration: 240, useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: 240, useNativeDriver: true }),
      ])));
      animation.start();
    });
    return () => { cancelled = true; animation?.stop(); };
  }, [celebrate, lift]);
  return <View style={[styles.scene, compact && styles.compact]}>
    {!compact && <Text style={styles.sceneTitle}>{celebrate ? '✦ 每一步，都讓我們靠近 ✦' : '在這裡，等你一起出發'}</Text>}
    <View style={styles.members}>
      {members.filter((member) => member.leftAt == null).map((member) => <Pressable key={member.profile.id} accessibilityRole="button"
        accessibilityLabel={`查看 ${member.profile.nickname} 的寵物故事`}
        onPress={() => Alert.alert(member.profile.pet.name, publicPetStory(member.profile.pet))}
        style={[styles.member, compact && styles.smallMember]}>
        <Animated.View style={{ transform: [{ translateY: lift }], marginBottom: 8 }}><PetImage seriesId={member.profile.pet.visualKey} stage={member.profile.pet.stage} size={compact ? 48 : 88} /></Animated.View>
        <Text style={styles.name} numberOfLines={1}>{member.profile.nickname}{member.isHost ? ' · 主' : ''}</Text>
        {!compact && <><Text style={styles.detail}>{member.profile.pet.name}</Text><Text style={styles.detail}>{seriesFor(member.profile.pet.visualKey)?.name ?? '探索者徽章'} · {stageTitle[member.profile.pet.stage as keyof typeof stageTitle] ?? '外觀待更新'}</Text><Text style={styles.ready}>{member.readyAt ? '✓ 準備好了' : '等待準備'}</Text></>}
      </Pressable>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  scene: { backgroundColor: '#E6EAD9', borderRadius: 26, padding: 18, borderWidth: 1, borderColor: colors.line },
  compact: { padding: 10 }, sceneTitle: { textAlign: 'center', color: colors.forest, fontWeight: '700', marginBottom: 22 },
  members: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18 },
  member: { width: '42%', alignItems: 'center', gap: 4 }, smallMember: { width: 78 },
  egg: { backgroundColor: '#FFF9E9', width: 74, height: 88, borderRadius: 40, borderBottomWidth: 5, borderColor: '#D9D0AD', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  smallEgg: { width: 42, height: 48, marginBottom: 0 }, symbol: { color: colors.moss, fontSize: 28 },
  name: { fontSize: 13, fontWeight: '800', color: colors.forest }, detail: { color: colors.mutedInk, fontSize: 11 },
  ready: { fontSize: 11, color: colors.forest, marginTop: 4 },
});
