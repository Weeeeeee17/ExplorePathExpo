import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const requiredFiles = [
  'App.tsx',
  'index.js',
  'app.json',
  'package.json',
  'src/state/ExplorePathContext.tsx',
  'src/screens/ExploreScreen.tsx',
  'src/screens/ActiveJourneyScreen.tsx',
  'src/screens/ReviewScreen.tsx',
  'src/screens/RewardScreen.tsx',
  'src/screens/PetScreen.tsx',
  'src/screens/RecordsScreen.tsx',
  'src/domain/rules.ts',
  'src/domain/geo.ts',
  'src/data/destinations.ts',
  'src/services/overpass.ts',
  'src/services/storage.ts',
  'src/services/tracking.ts',
];

for (const file of requiredFiles) {
  assert.ok(existsSync(join(projectRoot, file)), `缺少必要檔案：${file}`);
}

const packageJSON = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const appJSON = JSON.parse(readFileSync(join(projectRoot, 'app.json'), 'utf8'));
assert.equal(packageJSON.dependencies.expo, '~54.0.0');
assert.equal(packageJSON.dependencies['react-native'], '0.81.5');
assert.equal(appJSON.expo.name, 'ExplorePath');
assert.equal(appJSON.expo.orientation, 'portrait');
assert.equal(packageJSON.dependencies['expo-location'], '~19.0.8');
assert.equal(packageJSON.dependencies['expo-sensors'], '~15.0.8');
assert.ok(packageJSON.dependencies['@react-native-async-storage/async-storage']);

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

const rulesSource = readFileSync(join(projectRoot, 'src/domain/rules.ts'), 'utf8');
assert.match(rulesSource, /arrivalXP = 100/);
assert.match(rulesSource, /Math\.min\([^;]*50\)/s);
assert.match(rulesSource, /petEvent: 'foundEgg'/);
assert.match(rulesSource, /appliedPetXP: 0/);

const contextSource = readFileSync(join(projectRoot, 'src/state/ExplorePathContext.tsx'), 'utf8');
assert.match(contextSource, /distanceMeters: 55/);
assert.match(contextSource, /dwellSeconds: 45/);
assert.match(contextSource, /steps: activeJourney\.steps/);
assert.match(contextSource, /setReplacementMessage\('已換成新的神秘地點/);
assert.match(contextSource, /requestForegroundLocationPermission/);
assert.match(contextSource, /searchNearbyDestinations/);
assert.match(contextSource, /location\.accuracyMeters > 100/);
assert.match(contextSource, /advanceDwellState/);

const geoSource = readFileSync(join(projectRoot, 'src/domain/geo.ts'), 'utf8');
assert.match(geoSource, /now - outsideSince > 10_000/);
assert.match(contextSource, /mode === 'real'/);

const storageSource = readFileSync(join(projectRoot, 'src/services/storage.ts'), 'utf8');
assert.doesNotMatch(storageSource, /locationHistory|routePoints|fullRoute/);

const overpassSource = readFileSync(join(projectRoot, 'src/services/overpass.ts'), 'utf8');
assert.match(overpassSource, /openstreetmap/i);
assert.doesNotMatch(overpassSource, /apiKey|creditCard|billing/i);

console.log('ExplorePath project validation passed.');
