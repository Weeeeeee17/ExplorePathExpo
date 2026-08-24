import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  ChoiceChip,
  Kicker,
  Page,
  PrimaryButton,
  SecondaryButton,
  typography,
} from '../components/UI';
import { ORIGIN } from '../data/destinations';
import { destinationDirection } from '../domain/geo';
import { distanceText, durationOptions, themeMeta } from '../domain/rules';
import { ExplorationTheme, TrackingMode } from '../domain/types';
import { useExplorePath } from '../state/ExplorePathContext';
import { colors, radius } from '../theme';

const themes: ExplorationTheme[] = ['food', 'nature', 'architecture', 'surprise'];

function ModeBadge({ mode }: { mode: TrackingMode }) {
  return (
    <View style={[styles.modeBadge, mode === 'real' && styles.realBadge]}>
      <View style={[styles.modeDot, mode === 'real' && styles.realDot]} />
      <Text style={styles.modeText}>{mode === 'real' ? '真實感測模式' : '假資料體驗'}</Text>
    </View>
  );
}

function ModeSwitch() {
  const { mode, setMode } = useExplorePath();
  return (
    <View style={styles.modeSwitch}>
      {(['real', 'demo'] as TrackingMode[]).map((item) => {
        const selected = mode === item;
        return (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => setMode(item)}
            style={[styles.modeChoice, selected && styles.modeChoiceSelected]}
          >
            <Text style={[styles.modeChoiceText, selected && styles.modeChoiceTextSelected]}>
              {item === 'real' ? '真實探索' : 'Demo'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Preparation() {
  const { durationMinutes, mode, theme, chooseDuration, chooseTheme, search } = useExplorePath();
  return (
    <Page>
      <View style={styles.headerRow}>
        <Kicker>ExplorePath</Kicker>
        <ModeBadge mode={mode} />
      </View>
      <Text style={[typography.hero, styles.hero]}>不知道去哪裡，{`\n`}就從這裡開始。</Text>
      <Text style={[typography.body, styles.intro]}>
        選一段時間與想看的主題。我們只給方向與線索，讓步行自然發生。
      </Text>

      <ModeSwitch />
      <Text style={[typography.small, styles.modeHelp]}>
        {mode === 'real'
          ? '使用 iPhone GPS、指南針與可選步數；真實進度只存在這支 iPhone。'
          : '使用台北假地點與模擬按鈕；Demo 不會改動真實 XP、寵物或足跡。'}
      </Text>

      <Card style={styles.sectionCard}>
        <Text style={typography.heading}>今天想走多久？</Text>
        <View style={styles.durationRow}>
          {durationOptions.map((minutes) => (
            <ChoiceChip
              key={minutes}
              label={`${minutes} 分`}
              selected={durationMinutes === minutes}
              onPress={() => chooseDuration(minutes)}
            />
          ))}
        </View>
      </Card>

      <Text style={[typography.heading, styles.themeHeading]}>探索主題</Text>
      <View style={styles.themeGrid}>
        {themes.map((item) => (
          <View key={item} style={styles.themeCell}>
            <ChoiceChip
              icon={themeMeta[item].icon}
              label={themeMeta[item].title}
              selected={theme === item}
              onPress={() => chooseTheme(item)}
            />
          </View>
        ))}
      </View>

      <Card tone="paper" style={styles.locationCard}>
        <Text style={styles.locationIcon}>⌖</Text>
        <View style={styles.locationCopy}>
          <Text style={styles.locationTitle}>
            {mode === 'real' ? '起點：你按下搜尋時的 GPS 位置' : '起點：台北市信義區（模擬）'}
          </Text>
          <Text style={typography.small}>
            {mode === 'real'
              ? '不儲存完整移動路線，也不會上傳你的足跡。'
              : '不會存取定位、動態感測或健康資料。'}
          </Text>
        </View>
      </Card>

      <PrimaryButton label="替我找一個地方" onPress={() => void search()} />
      <Text style={[typography.small, styles.helper]}>
        {mode === 'real'
          ? '地點來自 OpenStreetMap 公開資料，不需要 API 金鑰或信用卡；網路服務可能暫時忙碌。'
          : 'Demo 完全使用 App 內建假資料，不會產生費用。'}
      </Text>
    </Page>
  );
}

function Searching() {
  const { mode } = useExplorePath();
  return (
    <Page scroll={false} contentStyle={styles.centerPage}>
      <View style={styles.searchOrb}>
        <ActivityIndicator color={colors.white} size="large" />
      </View>
      <Text style={[typography.title, styles.searchTitle]}>正在找一個剛剛好的地方</Text>
      <Text style={[typography.body, styles.centerText]}>
        {mode === 'real' ? '正在讀取目前位置與附近公開地點。' : '保留一點未知，路上才會有驚喜。'}
      </Text>
    </Page>
  );
}

function Candidate() {
  const {
    candidate,
    durationMinutes,
    mode,
    origin,
    theme,
    startJourney,
    replaceCandidate,
    resetPreparation,
  } = useExplorePath();
  if (!candidate) return null;
  const direction = destinationDirection(origin ?? ORIGIN, candidate);
  return (
    <Page>
      <View style={styles.headerRow}>
        <Kicker>找到一個選項</Kicker>
        <ModeBadge mode={mode} />
      </View>
      <Text style={[typography.title, styles.candidateTitle]}>先不告訴你名字。</Text>
      <Text style={typography.body}>跟著線索出發，抵達後才揭曉目的地。</Text>

      <Card tone="green" style={styles.clueCard}>
        <Text style={styles.clueIcon}>{themeMeta[candidate.theme].icon}</Text>
        <Text style={styles.clueLabel}>這裡可能是⋯</Text>
        <Text style={styles.clueText}>{candidate.environmentHint}</Text>
        <View style={styles.ruleLight} />
        <View style={styles.lightMetricRow}>
          <View>
            <Text style={styles.lightMetricLabel}>大方向</Text>
            <Text style={styles.lightMetricValue}>{direction}</Text>
          </View>
          <View>
            <Text style={styles.lightMetricLabel}>直線距離</Text>
            <Text style={styles.lightMetricValue}>{distanceText(candidate.distanceMeters)}</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={typography.small}>你的設定</Text>
          <Text style={styles.summaryValue}>
            {durationMinutes} 分鐘 · {themeMeta[theme].title}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={typography.small}>保守預估</Text>
          <Text style={styles.summaryValue}>約 {candidate.walkingMinutes} 分鐘步行</Text>
        </View>
      </Card>

      <Card tone="paper" style={styles.warningCard}>
        <Text style={styles.warningTitle}>實際時間可能更長</Text>
        <Text style={typography.small}>
          預估以直線距離 × 1.35 計算，不是導航路線。請只走公共道路，不要跨越圍欄、管制區或危險路段。
        </Text>
      </Card>

      <PrimaryButton label="開始探索" onPress={() => void startJourney()} />
      <View style={styles.buttonGap} />
      <SecondaryButton label="換一個（不限次數）" onPress={() => void replaceCandidate()} />
      <Pressable onPress={resetPreparation} style={styles.textButton}>
        <Text style={styles.textButtonLabel}>重新設定時間與主題</Text>
      </Pressable>
      {candidate.source === 'openstreetmap' ? (
        <Text style={[typography.small, styles.attribution]}>地點資料 © OpenStreetMap contributors（ODbL）</Text>
      ) : null}
    </Page>
  );
}

function NoResults() {
  const { mode, suggestions, addTimeAndSearch, resetPreparation, search } = useExplorePath();
  return (
    <Page>
      <ModeBadge mode={mode} />
      <Text style={[styles.emptyIcon, styles.emptyTop]}>◌</Text>
      <Text style={[typography.title, styles.centerText]}>目前條件找不到合適地點</Text>
      <Text style={[typography.body, styles.centerText, styles.noResultCopy]}>
        我們沒有偷偷改動你的時間或主題。以下結果數只根據剛才找到的附近地點計算。
      </Text>
      <View style={styles.suggestionList}>
        {suggestions.map((suggestion) => (
          <Pressable
            key={suggestion.addedMinutes}
            disabled={suggestion.resultCount === 0}
            onPress={() => void addTimeAndSearch(suggestion.addedMinutes)}
            style={({ pressed }) => [
              styles.suggestionCard,
              suggestion.resultCount === 0 && styles.disabledCard,
              pressed && styles.pressed,
            ]}
          >
            <View>
              <Text style={styles.suggestionTitle}>增加 {suggestion.addedMinutes} 分鐘</Text>
              <Text style={typography.small}>可找到 {suggestion.resultCount} 個符合結果</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
      {mode === 'real' && suggestions.every((item) => item.resultCount === 0) ? (
        <>
          <SecondaryButton label="重新連線搜尋" onPress={() => void search()} />
          <View style={styles.buttonGap} />
        </>
      ) : null}
      <SecondaryButton label="改主題或稍後再試" onPress={resetPreparation} />
    </Page>
  );
}

function BlockingIssue({ permission }: { permission: boolean }) {
  const { searchIssue, search, resetPreparation, setMode } = useExplorePath();
  return (
    <Page scroll={false} contentStyle={styles.centerPage}>
      <Text style={styles.issueIcon}>{permission ? '⌖' : '↻'}</Text>
      <Text style={[typography.title, styles.centerText]}>{searchIssue?.title}</Text>
      <Text style={[typography.body, styles.centerText, styles.issueCopy]}>{searchIssue?.detail}</Text>
      <View style={styles.issueActions}>
        <PrimaryButton label={permission ? '再次要求定位權限' : '重試相同條件'} onPress={() => void search()} />
        <View style={styles.buttonGap} />
        {permission ? (
          <SecondaryButton label="改用隔離的 Demo 模式" onPress={() => { resetPreparation(); setMode('demo'); }} />
        ) : (
          <SecondaryButton label="稍後再試" onPress={resetPreparation} />
        )}
      </View>
      <Text style={[typography.small, styles.helper]}>不會自動改用假位置、付費服務或放寬你的條件。</Text>
    </Page>
  );
}

export function ExploreScreen() {
  const { phase } = useExplorePath();
  if (phase === 'searching') return <Searching />;
  if (phase === 'candidate') return <Candidate />;
  if (phase === 'noResults') return <NoResults />;
  if (phase === 'permissionRequired') return <BlockingIssue permission />;
  if (phase === 'serviceError') return <BlockingIssue permission={false} />;
  return <Preparation />;
}

const styles = StyleSheet.create({
  headerRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  modeBadge: { alignItems: 'center', alignSelf: 'flex-end', backgroundColor: colors.softMoss, borderRadius: radius.pill, flexDirection: 'row', gap: 6, paddingHorizontal: 11, paddingVertical: 7 },
  realBadge: { backgroundColor: '#DCEBDD' },
  modeDot: { backgroundColor: colors.moss, borderRadius: 4, height: 7, width: 7 },
  realDot: { backgroundColor: colors.forest },
  modeText: { color: colors.forest, fontSize: 11, fontWeight: '800' },
  hero: { marginTop: 24 },
  intro: { marginBottom: 21, marginTop: 12 },
  modeSwitch: { backgroundColor: '#E8E2CF', borderRadius: radius.pill, flexDirection: 'row', padding: 4 },
  modeChoice: { alignItems: 'center', borderRadius: radius.pill, flex: 1, paddingVertical: 10 },
  modeChoiceSelected: { backgroundColor: colors.forest },
  modeChoiceText: { color: colors.mutedInk, fontSize: 13, fontWeight: '800' },
  modeChoiceTextSelected: { color: colors.white },
  modeHelp: { marginBottom: 23, marginTop: 8, textAlign: 'center' },
  sectionCard: { marginBottom: 28 },
  durationRow: { flexDirection: 'row', gap: 9, marginTop: 15 },
  themeHeading: { marginBottom: 12 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeCell: { width: '48%' },
  locationCard: { alignItems: 'center', flexDirection: 'row', marginBottom: 18, marginTop: 26 },
  locationIcon: { color: colors.forest, fontSize: 27, marginRight: 13 },
  locationCopy: { flex: 1 },
  locationTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 3 },
  helper: { marginTop: 12, textAlign: 'center' },
  centerPage: { alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  searchOrb: { alignItems: 'center', backgroundColor: colors.forest, borderRadius: 54, height: 108, justifyContent: 'center', width: 108 },
  searchTitle: { marginTop: 30, textAlign: 'center' },
  centerText: { textAlign: 'center' },
  candidateTitle: { marginBottom: 8, marginTop: 28 },
  clueCard: { marginBottom: 16, marginTop: 24 },
  clueIcon: { fontSize: 42 },
  clueLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 22 },
  clueText: { color: colors.white, fontSize: 22, fontWeight: '800', lineHeight: 31, marginTop: 6 },
  ruleLight: { backgroundColor: 'rgba(255,255,255,0.18)', height: 1, marginVertical: 22 },
  lightMetricRow: { flexDirection: 'row', justifyContent: 'space-between' },
  lightMetricLabel: { color: 'rgba(255,255,255,0.58)', fontSize: 12 },
  lightMetricValue: { color: colors.white, fontSize: 17, fontWeight: '800', marginTop: 4 },
  summaryCard: { marginBottom: 12 },
  summaryRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 },
  summaryValue: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  warningCard: { marginBottom: 18 },
  warningTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 5 },
  buttonGap: { height: 10 },
  textButton: { alignItems: 'center', paddingVertical: 17 },
  textButtonLabel: { color: colors.mutedInk, fontSize: 14, fontWeight: '700' },
  attribution: { marginTop: 3, textAlign: 'center' },
  emptyIcon: { color: colors.moss, fontSize: 72, textAlign: 'center' },
  emptyTop: { marginTop: 60 },
  noResultCopy: { marginHorizontal: 16, marginTop: 12 },
  suggestionList: { gap: 10, marginBottom: 22, marginTop: 28 },
  suggestionCard: { alignItems: 'center', backgroundColor: colors.softWhite, borderColor: colors.line, borderRadius: radius.medium, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 18 },
  disabledCard: { opacity: 0.42 },
  suggestionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 3 },
  chevron: { color: colors.moss, fontSize: 32 },
  issueIcon: { color: colors.forest, fontSize: 68, marginBottom: 18 },
  issueCopy: { marginTop: 12 },
  issueActions: { marginTop: 28, width: '100%' },
  pressed: { opacity: 0.7 },
});
