import React from 'react';
import { ActivityIndicator, Modal, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ActiveJourneyScreen } from './src/screens/ActiveJourneyScreen';
import { ArrivalCelebrationScreen } from './src/screens/ArrivalCelebrationScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { HealthScreen } from './src/screens/HealthScreen';
import { PetsScreen } from './src/screens/PetsScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { SocialProvider, useSocial } from './src/state/SocialContext';
import { HealthSummaryScreen } from './src/screens/HealthSummaryScreen';
import { RecordsScreen } from './src/screens/RecordsScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { ExplorePathProvider, useExplorePath } from './src/state/ExplorePathContext';
import { AppTab } from './src/domain/types';
import { colors, radius } from './src/theme';
import { PrimaryButton, SecondaryButton, typography } from './src/components/UI';

const tabs: { id: AppTab; label: string; icon: string }[] = [
  { id: 'explore', label: '探索', icon: '⌁' },
  { id: 'pets', label: '夥伴', icon: '✦' },
  { id: 'friends', label: '好友', icon: '♧' },
  { id: 'records', label: '足跡', icon: '≋' },
  { id: 'health', label: '健康', icon: '♥' },
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

function ModeFrame({ children }: { children: React.ReactNode }) {
  const { mode } = useExplorePath();
  return <View style={styles.frame}>{mode === 'demo' ? <Text style={{ textAlign: 'center', backgroundColor: '#EFE8D2', padding: 8, color: '#365844', paddingTop: 42 }}>展示沙盒 · 不計入真實步數與養成進度</Text> : null}{children}</View>;
}

function MotionPrompts() {
  const {
    motionExplanationVisible,
    motionSettingsReminderVisible,
    journeyEndMessage,
    confirmMotionExplanation,
    cancelMotionExplanation,
    dismissMotionSettingsReminder,
    dismissJourneyEndMessage,
    openMotionSettings,
  } = useExplorePath();
  return (
    <>
      <Modal transparent animationType="fade" visible={motionExplanationVisible}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.heading}>只記錄這一趟的步數</Text>
            <Text style={[typography.body, styles.modalCopy]}>ExplorePath 會從你正式開始旅程到抵達或結束為止，讀取 iPhone 的動作與健身步數。畫面途中不顯示數字，抵達時才揭曉；不會記錄全天步數。</Text>
            <PrimaryButton label="了解並繼續" onPress={() => void confirmMotionExplanation()} />
            <View style={styles.modalGap} />
            <SecondaryButton label="先不要開始" onPress={cancelMotionExplanation} />
          </View>
        </View>
      </Modal>
      <Modal transparent animationType="fade" visible={motionSettingsReminderVisible}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.heading}>想讓下次旅程留下步數嗎？</Text>
            <Text style={[typography.body, styles.modalCopy]}>最近三趟旅程都沒有取得步數。你可以到 iPhone 設定檢查「動作與健身」權限；不開啟也能繼續探索，我們不會再自動提醒。</Text>
            <PrimaryButton label="前往設定" onPress={() => void openMotionSettings()} />
            <Pressable onPress={dismissMotionSettingsReminder} style={styles.modalLater}><Text style={styles.modalLaterText}>暫時不要</Text></Pressable>
          </View>
        </View>
      </Modal>
      <Modal transparent animationType="fade" visible={Boolean(journeyEndMessage)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={typography.heading}>這趟足跡已結束</Text>
            <Text style={[typography.body, styles.modalCopy]}>{journeyEndMessage}</Text>
            <PrimaryButton label="知道了" onPress={dismissJourneyEndMessage} />
          </View>
        </View>
      </Modal>
    </>
  );
}

function AppContent() {
  const { hydrated, phase, tab } = useExplorePath();
  const { snapshot } = useSocial();
  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.forest} size="large" />
        <Text style={styles.loadingText}>正在載入你的探索紀錄⋯</Text>
      </View>
    );
  }
  if (phase === 'active') return <ModeFrame><ActiveJourneyScreen /></ModeFrame>;
  if (phase === 'arrival') return <ModeFrame><ArrivalCelebrationScreen /></ModeFrame>;
  if (phase === 'review') return <ModeFrame><ReviewScreen /></ModeFrame>;
  if (phase === 'reward') return <ModeFrame><HealthSummaryScreen /></ModeFrame>;

  return (
    <ModeFrame>
      <View style={styles.root}>
        {tab === 'explore' ? snapshot.activeRoom && ['waiting', 'active'].includes(snapshot.activeRoom.phase) ? <FriendsScreen /> : <ExploreScreen /> : null}
        {tab === 'friends' ? <FriendsScreen /> : null}
        {tab === 'health' ? <HealthScreen /> : null}
        {tab === 'records' ? <RecordsScreen /> : null}
        {tab === 'pets' || tab === 'showcase' ? <PetsScreen /> : null}
        <TabBar />
      </View>
    </ModeFrame>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ExplorePathProvider>
        <SocialProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
        <AppContent />
        <MotionPrompts />
        </SocialProvider>
      </ExplorePathProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.paper, flex: 1 },
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
  modalBackdrop: { alignItems: 'center', backgroundColor: colors.overlay, flex: 1, justifyContent: 'center', padding: 22 },
  modalCard: { backgroundColor: colors.paper, borderRadius: radius.large, padding: 24, width: '100%' },
  modalCopy: { marginBottom: 22, marginTop: 9 }, modalGap: { height: 10 },
  modalLater: { alignItems: 'center', paddingTop: 18 }, modalLaterText: { color: colors.mutedInk, fontSize: 14, fontWeight: '700' },
});
