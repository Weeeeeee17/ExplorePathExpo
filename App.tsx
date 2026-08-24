import React from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ActiveJourneyScreen } from './src/screens/ActiveJourneyScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { PetScreen } from './src/screens/PetScreen';
import { RecordsScreen } from './src/screens/RecordsScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { RewardScreen } from './src/screens/RewardScreen';
import { ExplorePathProvider, useExplorePath } from './src/state/ExplorePathContext';
import { AppTab } from './src/domain/types';
import { colors, radius } from './src/theme';

const tabs: { id: AppTab; label: string; icon: string }[] = [
  { id: 'explore', label: '探索', icon: '⌁' },
  { id: 'pet', label: '夥伴', icon: '◉' },
  { id: 'records', label: '足跡', icon: '≋' },
];

function TabBar() {
  const { tab, setTab } = useExplorePath();
  return (
    <View style={styles.tabBarWrap}>
      <View style={styles.tabBar}>
        {tabs.map((item) => {
          const selected = tab === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(item.id)}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <Text style={[styles.tabIcon, selected && styles.selectedTabText]}>{item.icon}</Text>
              <Text style={[styles.tabLabel, selected && styles.selectedTabText]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AppContent() {
  const { hydrated, phase, tab } = useExplorePath();
  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.forest} size="large" />
        <Text style={styles.loadingText}>正在載入你的探索紀錄⋯</Text>
      </View>
    );
  }
  if (phase === 'active') return <ActiveJourneyScreen />;
  if (phase === 'review') return <ReviewScreen />;
  if (phase === 'reward') return <RewardScreen />;

  return (
    <View style={styles.root}>
      {tab === 'explore' ? <ExploreScreen /> : null}
      {tab === 'pet' ? <PetScreen /> : null}
      {tab === 'records' ? <RecordsScreen /> : null}
      <TabBar />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ExplorePathProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
        <AppContent />
      </ExplorePathProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.paper, flex: 1 },
  loading: { alignItems: 'center', backgroundColor: colors.paper, flex: 1, justifyContent: 'center' },
  loadingText: { color: colors.mutedInk, fontSize: 14, marginTop: 14 },
  tabBarWrap: { bottom: 16, left: 18, position: 'absolute', right: 18 },
  tabBar: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: colors.line,
    borderRadius: radius.large,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 7,
    shadowColor: colors.forest,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.13,
    shadowRadius: 18,
  },
  tab: { alignItems: 'center', flex: 1, paddingVertical: 8 },
  tabIcon: { color: '#93978D', fontSize: 21, fontWeight: '800' },
  tabLabel: { color: '#93978D', fontSize: 11, fontWeight: '700', marginTop: 2 },
  selectedTabText: { color: colors.forest },
  pressed: { opacity: 0.65 },
});
