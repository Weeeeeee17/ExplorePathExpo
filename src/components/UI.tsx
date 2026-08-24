import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius } from '../theme';

export function Page({
  children,
  scroll = true,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.page, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.page, styles.fill, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  tone = 'white',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'white' | 'green' | 'paper';
}) {
  return (
    <View
      style={[
        styles.card,
        tone === 'green' && styles.greenCard,
        tone === 'paper' && styles.paperCard,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
    >
      <Text style={[styles.secondaryButtonText, destructive && styles.destructiveText]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChoiceChip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selectedChip,
        pressed && styles.pressed,
      ]}
    >
      {icon ? <Text style={styles.chipIcon}>{icon}</Text> : null}
      <Text style={[styles.chipText, selected && styles.selectedChipText]}>{label}</Text>
    </Pressable>
  );
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return <Text style={styles.kicker}>{children}</Text>;
}

export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(value, 1));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export const typography = StyleSheet.create({
  hero: {
    color: colors.ink,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.2,
    lineHeight: 42,
  },
  title: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  heading: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  body: {
    color: colors.mutedInk,
    fontSize: 16,
    lineHeight: 24,
  },
  small: {
    color: colors.mutedInk,
    fontSize: 13,
    lineHeight: 19,
  },
});

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.paper,
    flex: 1,
  },
  page: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 118,
    paddingTop: 18,
  },
  fill: { flex: 1 },
  card: {
    backgroundColor: colors.softWhite,
    borderColor: colors.line,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 20,
  },
  greenCard: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  paperCard: {
    backgroundColor: '#EFE8D2',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.forest,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.48)',
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: colors.forest,
    fontSize: 15,
    fontWeight: '700',
  },
  destructiveText: { color: '#A4483A' },
  disabled: { opacity: 0.36 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.softWhite,
    borderColor: colors.line,
    borderRadius: radius.medium,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 15,
  },
  selectedChip: {
    backgroundColor: colors.forest,
    borderColor: colors.forest,
  },
  chipIcon: { fontSize: 18 },
  chipText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  selectedChipText: { color: colors.white },
  kicker: {
    color: colors.moss,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  progressTrack: {
    backgroundColor: colors.softMoss,
    borderRadius: radius.pill,
    height: 10,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    backgroundColor: colors.sunset,
    borderRadius: radius.pill,
    height: '100%',
  },
  metric: {
    alignItems: 'center',
    flex: 1,
    minWidth: 74,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  metricLabel: {
    color: colors.mutedInk,
    fontSize: 12,
    marginTop: 3,
  },
});
