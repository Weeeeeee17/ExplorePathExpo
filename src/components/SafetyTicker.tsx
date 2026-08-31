import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../theme';

const messages = [
  '行走時請注意路況',
  '過馬路請確認來車',
  '請勿只注視手機',
  '請自行預留足夠的回程時間',
  '夜間請留意照明與周遭環境',
];

export function SafetyTicker() {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    const show = () => {
      opacity.setValue(0);
      translateX.setValue(24);
      Animated.parallel([
        Animated.timing(opacity, { duration: 900, toValue: 1, useNativeDriver: true }),
        Animated.timing(translateX, { duration: 900, toValue: 0, useNativeDriver: true }),
      ]).start();
    };
    show();
    const interval = setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
      show();
    }, 12_000);
    return () => clearInterval(interval);
  }, [opacity, translateX]);

  return (
    <View accessibilityLiveRegion="polite" style={styles.wrap}>
      <Text style={styles.icon}>!</Text>
      <Animated.View style={{ flex: 1, opacity, transform: [{ translateX }] }}>
        <Text numberOfLines={1} style={styles.text}>{messages[index]}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: '#F4E4B7',
    borderColor: '#E6CF8A',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 18,
    overflow: 'hidden',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  icon: {
    backgroundColor: colors.ink,
    borderRadius: 9,
    color: colors.white,
    fontSize: 11,
    fontWeight: '900',
    height: 18,
    lineHeight: 18,
    marginRight: 9,
    textAlign: 'center',
    width: 18,
  },
  text: { color: colors.ink, fontSize: 12, fontWeight: '800' },
});
