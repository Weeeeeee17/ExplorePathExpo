import { PetProfile } from './types';
import { SocialPetDisplay } from './social';
import { isPetSeriesId, seriesFor, stages, OwnedStage, storiesForSeries, petStoryStatusLabels, petStoryWorldNote } from './petCatalog';
import { stageTitle } from './rules';
export function publicPetDisplay(pet: PetProfile | null): SocialPetDisplay {
  if (!pet || !['available', 'countdown'].includes(pet.lifecycle)) return { name: '探索者徽章', visualKey: 'badge', stage: 'emptyRoom', storyChapter: '', symbol: '⌁' };
  return { name: pet.nickname, visualKey: pet.seriesId, stage: pet.stage, storyChapter: pet.stage === 'egg' ? 'prologue' : 'juvenile', symbol: '⌁' };
}
export function publicPetStory(display: SocialPetDisplay): string {
  if (!isPetSeriesId(display.visualKey) || !stages.includes(display.stage as OwnedStage)) return '探索者徽章 · 尚無可顯示的夥伴外觀。';
  const family = seriesFor(display.visualKey)!;
  const stories = storiesForSeries(family, display.stage !== 'egg');
  return `${family.name} · ${stageTitle[display.stage as OwnedStage]}\n${petStoryWorldNote}\n\n${stories.map((story) => `${story.title}｜${petStoryStatusLabels[story.status]}\n${story.quote ? `${story.quote}\n\n` : ''}${story.text}`).join('\n\n')}`;
}
