import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const pkg = JSON.parse(read('package.json'));
const config = JSON.parse(read('app.json')).expo;

test('App Store release stays on SDK 54 with matching version and lockfile', () => {
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '0.9.1');
  assert.equal(config.version, pkg.version);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(pkg.dependencies.expo, '~54.0.0');
  assert.match(lock.packages['node_modules/expo'].version, /^54\./);
  assert.match(require('expo/package.json').version, /^54\./);
  assert.equal(config.sdkVersion, undefined, 'Do not mask a dependency mismatch with sdkVersion');
  assert.deepEqual(lock.packages[''].dependencies, pkg.dependencies);
});

test('Every Expo Go bundled direct dependency matches the SDK 54 native module matrix', () => {
  const bundled = require('expo/bundledNativeModules.json');
  const lock = JSON.parse(read('package-lock.json'));
  for (const [name, wanted] of Object.entries(pkg.dependencies)) {
    if (!bundled[name]) continue;
    assert.equal(wanted, bundled[name], `${name} must use the SDK 54 recommendation`);
    const installed = require(`${name}/package.json`);
    assert.equal(installed.version, lock.packages[`node_modules/${name}`].version, `${name} installed/lock mismatch`);
  }
});

test('Native service imports resolve, including SDK 54 media and filesystem entry points', () => {
  assert.match(read('src/services/taskMedia.ts'), /from 'expo-media-library';/);
  assert.doesNotMatch(read('src/services/taskMedia.ts'), /expo-media-library\/legacy/);
  assert.match(read('src/services/taskMedia.ts'), /requestPermissionsAsync\(true\)/);
  function check(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) check(path);
      else if (/\.[jt]sx?$/.test(entry.name)) {
        for (const match of readFileSync(path, 'utf8').matchAll(/from\s+['"](expo-[^'"]+|react-native-[^'"]+)['"]/g)) {
          assert.doesNotThrow(() => require.resolve(match[1]!), `Unresolvable native import in ${path}`);
        }
      }
    }
  }
  check(join(root, 'src'));
});

test('SDK 54 config plugins resolve without the SDK 57 sharing plugin', () => {
  const pluginNames = config.plugins.map((plugin: string | [string, unknown]) => Array.isArray(plugin) ? plugin[0] : plugin);
  assert.ok(!pluginNames.includes('expo-sharing'));
  for (const name of pluginNames) assert.doesNotThrow(() => require.resolve(`${name}/app.plugin.js`));
});

test('Launcher guards stale SDKs and lockfiles, starts Expo Go with a clean Metro cache', () => {
  const launcher = read('Start-ExplorePath.ps1');
  assert.match(launcher, /v0\.9\.1/);
  assert.match(launcher, /installedExpo\.version -notlike '54\.\*'/);
  assert.match(launcher, /Get-FileHash.+package-lock\.json/);
  assert.match(launcher, /npm\.cmd ci/);
  assert.match(launcher, /npm\.cmd start -- --go --clear/);
});

test('Expo Metro uses the patched PostCSS without changing SDK 54', () => {
  const expoRequire = createRequire(require.resolve('expo/package.json'));
  const metroRequire = createRequire(expoRequire.resolve('@expo/metro-config/package.json'));
  assert.equal(metroRequire('postcss/package.json').version, '8.5.26');
  assert.equal(metroRequire('postcss').parse('a { color: red }').toString(), 'a { color: red }');
});
