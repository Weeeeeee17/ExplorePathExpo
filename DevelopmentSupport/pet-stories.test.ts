import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { petCatalog, petSeriesIds, petStoryWorldNote, seriesFor, storiesForSeries, unlockedStories } from '../src/domain/petCatalog';
import { createEgg, emptyPetCollection, normalizePetCollection, settlePetCollection } from '../src/domain/petRules';
import { publicPetDisplay, publicPetStory } from '../src/domain/petDisplay';
import { PetVisualId } from '../src/domain/types';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const approved = JSON.parse(read('DevelopmentSupport/approved-egg-stories-v091.json')) as Array<{ id: PetVisualId; name: string; quote: string; prologue: string }>;
const now = Date.UTC(2026, 7, 31);
function collection(series: PetVisualId, experience = 0) {
  const state = emptyPetCollection();
  state.seriesBag = [series];
  createEgg(state, now, () => 0);
  state.pets[0]!.experience = experience;
  return settlePetCollection(state, now);
}

test('all 12 approved egg names, quotations and backgrounds match the supplied text verbatim', () => {
  assert.equal(approved.length, 12);
  assert.deepEqual([...petSeriesIds].sort(), approved.map((s) => s.id).sort());
  for (const expected of approved) {
    const actual = seriesFor(expected.id)!;
    assert.equal(actual.name, expected.name);
    assert.equal(actual.eggQuote, expected.quote);
    assert.equal(actual.prologue, expected.prologue);
    const story = storiesForSeries(actual, false);
    assert.equal(story.length, 1);
    assert.equal(story[0]!.status, 'approved');
    assert.equal(story[0]!.quote, expected.quote);
    assert.equal(story[0]!.text, expected.prologue);
  }
  assert.equal(seriesFor('wood')!.name, '枯木之種');
  assert.equal(seriesFor('stargazer')!.name, '觀星者的凝望');
  assert.ok(!petCatalog.some((s) => s.name === '抄寫員聖所蛋' || s.name === '積木木雕蛋'));
});

test('8 juvenile chapters remain drafts and unlock only after actual evolution, including missing-art waits', () => {
  assert.equal(petCatalog.filter((s) => s.juvenileChapter).length, 8);
  for (const series of petCatalog) {
    const egg = collection(series.id).pets[0]!;
    assert.deepEqual(unlockedStories(egg).map((s) => s.status), ['approved']);
    const evolved = collection(series.id, 3500).pets[0]!;
    const stories = unlockedStories(evolved);
    assert.deepEqual(stories.map((s) => s.status), series.juvenileChapter ? ['approved', 'draft'] : ['approved']);
    if (series.juvenileChapter) assert.equal(stories[1]!.text, series.juvenileChapter);
  }
});

test('friend stories use the same approved quotations and backgrounds with an explicit fiction notice', () => {
  for (const series of petCatalog) {
    const egg = collection(series.id).pets[0]!;
    const text = publicPetStory(publicPetDisplay(egg));
    assert.ok(text.includes(series.name));
    assert.ok(text.includes(series.eggQuote));
    assert.ok(text.includes(series.prologue));
    assert.ok(text.includes(petStoryWorldNote));
    assert.ok(text.includes('蛋階段故事 · 使用者定稿'));
    assert.ok(!text.includes('幼年期故事 · 草稿待審'));
    if (series.juvenileChapter) {
      assert.ok(!text.includes(series.juvenileChapter));
      const juvenileText = publicPetStory(publicPetDisplay(collection(series.id, 300).pets[0]!));
      assert.ok(juvenileText.includes('幼年期故事 · 草稿待審'));
      assert.ok(juvenileText.includes(series.juvenileChapter));
    }
  }
});

test('renaming the wood series never changes owned IDs, custom nicknames, XP, bag or award ledger', () => {
  const previous = collection('wood', 1700);
  previous.pets[0]!.nickname = '積木木雕蛋'; // A saved name is personal data, even when it used the old default.
  previous.pets[0]!.sharedJourneyCount = 7;
  previous.pets[0]!.sharedSteps = 3210;
  const before = JSON.stringify(previous);
  const restored = normalizePetCollection(JSON.parse(before), now);
  assert.deepEqual(restored, previous);
  const beforeStoryRead = JSON.stringify(restored);
  unlockedStories(restored.pets[0]!);
  publicPetStory(publicPetDisplay(restored.pets[0]!));
  assert.equal(JSON.stringify(restored), beforeStoryRead);
  assert.equal(restored.pets[0]!.seriesId, 'wood');
});

test('bottom tabs retain their screen IDs and follow explore, pets, friends, records, health order', () => {
  const app = read('App.tsx');
  const tabArray = app.slice(app.indexOf('const tabs:'), app.indexOf('function TabBar()'));
  const entries = [...tabArray.matchAll(/id: '([^']+)', label: '([^']+)'/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(entries, [['explore', '探索'], ['pets', '夥伴'], ['friends', '好友'], ['records', '足跡'], ['health', '健康']]);
  assert.match(app, /onPress=\{\(\) => setTab\(item.id\)\}/);
  const pets = read('src/screens/PetsScreen.tsx');
  assert.match(pets, /petStoryStatusLabels\[story.status\]/);
  assert.match(pets, /story.quote/);
  assert.match(pets, /petStoryWorldNote/);
  assert.match(pets, /角色目標草稿/);
});
