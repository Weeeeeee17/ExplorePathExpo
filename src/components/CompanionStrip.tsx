import React from 'react';
import { Text, View } from 'react-native';
import { useExplorePath } from '../state/ExplorePathContext';
import { PetImage } from './PetImage';
import { typography } from './UI';
import { stageTitle } from '../domain/rules';

export function CompanionStrip() {
  const { activePet: current } = useExplorePath();
  const activePet = current && ['available', 'countdown'].includes(current.lifecycle) ? current : null;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 }}>
    <PetImage seriesId={activePet?.seriesId} stage={activePet?.stage} size={48} />
    <Text style={[typography.small, { flex: 1 }]}>{activePet ? `${activePet.nickname} · ${stageTitle[activePet.stage]} · 和你一起發現日常` : '探索者徽章 · 你的第一位夥伴正在等待相遇'}</Text>
  </View>;
}
