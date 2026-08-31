import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

// Windows PowerShell 5 cannot deserialize the lockfile's empty package key.
// Parse ZIP entry content with Node instead, without extracting or rewriting it.
if (process.argv.includes('--lock-stdin')) {
  const lock = JSON.parse(readFileSync(0, 'utf8'));
  assert.equal(lock.version, '0.9.1');
  assert.equal(lock.packages[''].version, '0.9.1');
  assert.match(lock.packages['node_modules/expo'].version, /^54\./);
  assert.equal(lock.packages['node_modules/react-native'].version, '0.81.5');
  console.log('ZIP lockfile verified: v0.9.1 / SDK 54 / RN 0.81.5');
  process.exit(0);
}

const projectRoot = resolve(import.meta.dirname, '..');
const requiredFiles = [
  'App.tsx',
  'metro.config.js',
  'DevelopmentSupport/metro-worker.cjs',
  'DevelopmentSupport/metro-pet-image-reader.cjs',
  'index.js',
  'app.json',
  'package.json',
  'README_WINDOWS_IPHONE.md',
  'CHANGELOG.md',
  'src/state/ExplorePathContext.tsx',
  'src/screens/ExploreScreen.tsx',
  'src/screens/ActiveJourneyScreen.tsx',
  'src/screens/ArrivalCelebrationScreen.tsx',
  'src/screens/ReviewScreen.tsx',
  'src/screens/HealthSummaryScreen.tsx',
  'src/screens/HealthScreen.tsx',
  'src/screens/RecordsScreen.tsx',
  'src/domain/health.ts',
  'src/domain/rules.ts',
  'src/domain/geo.ts',
  'src/domain/memories.ts',
  'src/domain/backupFormat.ts',
  'src/domain/types.ts',
  'src/data/destinations.ts',
  'src/data/microTasks.ts',
  'src/components/ApproximateMap.tsx',
  'src/components/MicroTaskModal.tsx',
  'src/components/SafetyTicker.tsx',
  'src/services/overpass.ts',
  'src/services/storage.ts',
  'src/services/tracking.ts',
  'src/services/healthStorage.ts',
  'src/services/taskMedia.ts',
  'src/services/memoryMedia.ts',
  'src/services/backup.ts',
  'DevelopmentSupport/health.test.ts',
  'src/screens/FriendsScreen.tsx',
  'src/state/SocialContext.tsx',
  'src/services/socialRepository.ts',
  'src/services/supabaseClient.ts',
  'SUPABASE_SETUP.md',
  'FEATURES.md',
  'supabase/migrations/202608310001_social_v08.sql',
  'supabase/migrations/202608310002_social_safety.sql',
  'DevelopmentSupport/social-database.test.ts',
  'src/screens/PetsScreen.tsx',
  'src/components/PetImage.tsx',
  'src/domain/petCatalog.ts',
  'src/domain/petRules.ts',
  'src/domain/petDisplay.ts',
  'DevelopmentSupport/pets.test.ts',
  'DevelopmentSupport/pet-stories.test.ts',
  'DevelopmentSupport/approved-egg-stories-v091.json',
  'supabase/migrations/202608310003_pet_display_v09.sql',
];

for (const file of requiredFiles) {
  assert.ok(existsSync(join(projectRoot, file)), `缺少必要檔案：${file}`);
}

const packageJSON = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const appJSON = JSON.parse(readFileSync(join(projectRoot, 'app.json'), 'utf8'));
assert.equal(packageJSON.dependencies.expo, '~54.0.0');
assert.equal(packageJSON.dependencies['react-native'], '0.81.5');
assert.equal(packageJSON.dependencies['expo-sensors'], '~15.0.8');
assert.equal(packageJSON.dependencies['expo-location'], '~19.0.8');
assert.ok(packageJSON.dependencies['@react-native-async-storage/async-storage']);
assert.equal(packageJSON.version, '0.9.1');
assert.equal(appJSON.expo.version, '0.9.1');
assert.equal(appJSON.expo.name, 'ExplorePath');
assert.equal(appJSON.expo.orientation, 'portrait');

const sourceFiles = requiredFiles.filter((file) => ['.ts', '.tsx', '.js'].includes(extname(file)));
for (const relativeFile of sourceFiles) {
  const absoluteFile = join(projectRoot, relativeFile);
  const source = readFileSync(absoluteFile, 'utf8');
  const importPattern = /(?:from\s+|import\s+)["'](\.{1,2}\/[^"']+)["']/g;
  for (const match of source.matchAll(importPattern)) {
    const importPath = resolve(dirname(absoluteFile), match[1]);
    const resolves = ['', '.ts', '.tsx', '.js', '/index.ts', '/index.tsx', '/index.js'].some(
      (suffix) => existsSync(`${importPath}${suffix}`),
    );
    assert.ok(resolves, `${relativeFile} 的本機 import 無法解析：${match[1]}`);
  }
}

const appSource = readFileSync(join(projectRoot, 'App.tsx'), 'utf8');
assert.match(appSource, /HealthScreen/);
assert.match(appSource, /HealthSummaryScreen/);
assert.match(appSource, /label: '健康'/);
assert.doesNotMatch(appSource, /PetScreen|PetCollectionScreen|RewardScreen|ShowcaseScreen/);

const contextSource = readFileSync(join(projectRoot, 'src/state/ExplorePathContext.tsx'), 'utf8');
assert.match(contextSource, /appVersion = '0\.9\.1'/);
assert.match(contextSource, /journeyHealthMetrics/);
assert.match(contextSource, /healthMilestonesForJourney/);
assert.match(contextSource, /stepsBetween/);
assert.match(contextSource, /stepCaptureStartedAt/);
assert.match(contextSource, /updateHealthProfile/);
assert.match(contextSource, /applyNormalJourneyReward/);
assert.match(appSource, /PetsScreen/);
assert.match(appSource, /label: '夥伴'/);

const healthSource = readFileSync(join(projectRoot, 'src/domain/health.ts'), 'utf8');
assert.match(healthSource, /defaultHealthProfile/);
assert.match(healthSource, /dailyHealthSummaries/);
assert.match(healthSource, /currentActivityStreak/);
assert.match(healthSource, /healthMilestonesForJourney/);
assert.match(healthSource, /strideLengthCm/);

const reviewSource = readFileSync(join(projectRoot, 'src/screens/ReviewScreen.tsx'), 'utf8');
assert.match(reviewSource, /身體感覺如何/);
assert.match(reviewSource, /完成並查看健康摘要/);

const recordsSource = readFileSync(join(projectRoot, 'src/screens/RecordsScreen.tsx'), 'utf8');
assert.match(recordsSource, /本機健康足跡/);
assert.match(recordsSource, /估算累積距離/);
assert.match(recordsSource, /未抵達活動旅程/);
assert.match(recordsSource, /排除健康統計/);

const backupSource = readFileSync(join(projectRoot, 'src/domain/backupFormat.ts'), 'utf8');
assert.match(backupSource, /backupVersion = 4/);
assert.match(backupSource, /healthProfile/);
assert.match(backupSource, /petCollection:/);

const trackingSource = readFileSync(join(projectRoot, 'src/services/tracking.ts'), 'utf8');
assert.match(trackingSource, /Pedometer\.getStepCountAsync/);
assert.match(trackingSource, /Pedometer\.watchStepCount/);

const storageSource = readFileSync(join(projectRoot, 'src/services/storage.ts'), 'utf8');
assert.doesNotMatch(storageSource, /locationHistory|routePoints|fullRoute/);
assert.match(storageSource, /effort: review\.effort \?\? null/);

const tickerSource = readFileSync(join(projectRoot, 'src/components/SafetyTicker.tsx'), 'utf8');
assert.match(tickerSource, /請自行預留足夠的回程時間/);

const overpassSource = readFileSync(join(projectRoot, 'src/services/overpass.ts'), 'utf8');
assert.match(overpassSource, /openstreetmap/i);
assert.doesNotMatch(overpassSource, /apiKey|creditCard|billing/i);

assert.match(appSource, /SocialProvider/);
assert.match(appSource, /FriendsScreen/);
const socialSource = readFileSync(join(projectRoot, 'src/state/SocialContext.tsx'), 'utf8');
assert.match(socialSource, /pendingLeaves/);
assert.match(socialSource, /AppState.currentState !== 'active'/);
assert.match(socialSource, /saveTeamRecord/);
assert.doesNotMatch(socialSource, /startLocationUpdatesAsync/);
console.log('ExplorePath v0.9.1 SDK 54 pets + social + health project validation passed.');
