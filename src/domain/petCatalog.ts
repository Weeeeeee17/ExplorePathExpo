import { PetProfile, PetStage, PetVisualId } from './types';

export type OwnedStage = Exclude<PetStage, 'emptyRoom'>;
export const stages: OwnedStage[] = ['egg', 'juvenile', 'growing', 'mature'];
export const stageXP: Record<OwnedStage, number> = { egg: 0, juvenile: 300, growing: 1200, mature: 3000 };
export interface PetSeries {
  id: PetVisualId;
  name: string;
  juvenileName?: string;
  goal: string;
  eggQuote: string;
  prologue: string;
  juvenileChapter?: string;
}
/** Egg names, quotations and backgrounds approved by the user; goals and juvenile text remain drafts. */
export const petCatalog: PetSeries[] = [
  { id: 'pebble', name: '月卵石群', juvenileName: '月紋石貓', goal: '找回散落在日常裡的月光。', eggQuote: '「滿月照亮歸途，新月隱匿群石；唯有靜止之物，方能看見真正的流動。」', prologue: '外殼刻有完整月相星盤的深邃隕石蛋，中心常在月圓之夜裂開一條縫隙，露出許多好奇擠在一起的石生多目靈，最深處還沉睡著一隻古老的石化幼貓。', juvenileChapter: '石群聚成了一隻貓，尾巴掛著一彎小月亮。牠不催你走快，只在你發現新角落時輕輕回頭：原來白天也能收集月光。' },
  { id: 'water', name: '水滴之晶', juvenileName: '潮紋水靈', goal: '收集每個地方不同的聲音。', eggQuote: '「落下的雨滴是天空的眼淚，懸浮的心是未曾止息的渴望。」', prologue: '蛋體由永不凝固的純淨水流與水晶花枝交織而成，中心懸浮著一顆長有微型天使羽翼的發光純露。據說它能感應空氣中的濕度與探索者心跳的頻率。', juvenileChapter: '水靈第一次伸出手，掌心映出你們走過的天空。牠發現每條路都有自己的節奏，決定把這些聲音留在身上的銀紋裡。' },
  { id: 'porcelain', name: '白瓷之卵', juvenileName: '瓷翼守望者', goal: '學會看見被忽略的溫柔。', eggQuote: '「它看著你時，你便不再盲目；但若凝視太久，純白亦會化為深淵。」', prologue: '無暇的白瓷蛋身宛如沉睡的聖像，中央永遠不眨動的瞳孔據說能看見「未被地圖標記的隱藏路徑」。環繞於蛋底的白蛇據說是它的守護靈，正緩慢吸收著探索者的體溫。', juvenileChapter: '瓷殼裂開，金翼張開，白蛇環繞身旁。守望者還不熟悉世界，但牠記得你第一次停下來的耐心，想把同樣的溫柔送給下一個角落。' },
  { id: 'marble', name: '金紋大理石蛋', juvenileName: '金脈幼獅', goal: '找到不靠逞強也能守護他人的方式。', eggQuote: '「大理石上的裂痕不是創傷，而是神明用黃金修補的命運。」', prologue: '產自古羅馬遺跡大理石脈的尊貴之卵，生長著純白的水晶簇。蛋身上的金絲據說是用歷代建築大師遺留下的黃金比例鑄成，每經過一座壯麗建築，金紋便會微微發熱。', juvenileChapter: '幼獅走得還不穩，卻總在你休息時安靜守在旁邊。牠逐漸明白，守護不是永遠站在前方，而是願意照著彼此的步調前進。' },
  { id: 'cloud', name: '思維之卵', goal: '替尚未說出口的想法找一個容身之處。', eggQuote: '「問號是思考的起點，當你以為它是虛無，它正孕育著無限可能。」', prologue: '這顆蛋沒有實體蛋殼，而是由一團不斷翻湧、呼吸般的純白雲霧構成，核心隱約透出一個發光的金色「？」。它以行者腦海中一閃而過的靈感與未解的疑惑為食。' },
  { id: 'thought', name: '思緒之書蛋', juvenileName: '拾頁書童', goal: '把平凡散步寫成一本共同的書。', eggQuote: '「未寫下的一頁最沉重，踏過萬卷者，終將聽見書頁翻動的腳步聲。」', prologue: '傳說它是城市舊書店、古老圖書館與無數漫步者駐足沉思時，遺落的思緒殘篇凝聚而成的活體典籍。蛋殼上的木質小腳會在無人注視時悄悄走動，尋找被遺忘的文字。', juvenileChapter: '書童搬進小紙箱，捧著空白筆記跟上你的腳步。牠不問今天去了多遠，只問：有沒有一個瞬間，是你願意再想起的？' },
  { id: 'voyager', name: '航海家地圖蛋', goal: '畫出不以距離衡量的冒險地圖。', eggQuote: '「大洋之下是沉睡的龍，陸地之上是啟航的舟；你的每一步，都在繪製世界的邊界。」', prologue: '陶土蛋身宛如一艘破浪前行的古典蓋倫帆船，上方刻有古老世界經緯圖與六分儀，下方船底甚至盤踞著一條金鱗海蛇。它渴望記錄未知的邊界與漫長的遠征。' },
  { id: 'brass', name: '黃銅齒輪蛋', juvenileName: '花時計蛛', goal: '找回屬於自己的生活節奏。', eggQuote: '「每一秒的滴答，都是齒輪在咬合命運；別停下，發條將隨你的腳步上緊。」', prologue: '融合維多利亞時代機械美學與翠綠植物雕紋的發條蛋。觀景窗內的齒輪轉速完全與探索者的「即時步頻」同步；只要行者不斷前進，蛋頂的紅寶石便會熠熠生輝。', juvenileChapter: '小機械蛛用不同的腳試探地面，紅寶石映出路邊的光。牠的時鐘不再催促，而是為每次自在的散步記下一段值得珍惜的時間。' },
  { id: 'frosted', name: '磨砂刻印蛋', juvenileName: '刻印幼龍', goal: '找到只屬於你們的道路。', eggQuote: '「唯有行者之足，能賦予『道路』真正的形體。」', prologue: '由柔霧般的磨砂冰晶鑄造，內部燃燒著恆溫的心靈微光。正面鐫刻著唯一的字樣「path（路徑）」，據說只有累積足夠步數的行者，才能看見蛋底長出雙足、隨行奔跑。', juvenileChapter: '幼龍的胸口亮起微光，身上的刻印隨著相遇逐漸清楚。牠還不能飛很遠，但牠喜歡和你一起走，因為每一步都讓未知少一點陌生。' },
  { id: 'wood', name: '枯木之種', juvenileName: '芽光木偶', goal: '讓新的可能在舊裂縫裡發芽。', eggQuote: '「枯木非死，只是在等待一場足夠漫長的雨，與一雙不畏荊棘的鞋。」', prologue: '由一整塊雷擊古神木雕琢而成的沉靜之卵，表面佈滿死寂的枯藤。然而只要探索者開始邁步，乾裂的縫隙中便會隱隱透出金色的生機微光與嫩綠芽苞。', juvenileChapter: '木偶從裂縫裡長出嫩芽，笨拙地跨過第一道小坎。牠把每一次嘗試都當成成長，不怕走得慢，只希望下次還能和你一起。' },
  { id: 'compass', name: '羅盤之卵', goal: '學會在不確定中選擇方向。', eggQuote: '「不問歸期，八方皆是坦途；但迷失方向時，金針將指向本心。」', prologue: '由堅硬玄武岩原石雕琢，中央嵌有八角星黃銅羅盤。這顆蛋始終具有微弱的磁性，其羅盤指針不指向磁北極，而是永遠指向「離探索者最近的下一個未解奇蹟」。' },
  { id: 'stargazer', name: '觀星者的凝望', goal: '把眼前的小小發現連成星座。', eggQuote: '「回憶不是過去的影子，而是被封存於藍寶石中的第二條生命。」', prologue: '深邃的淡天藍色琉璃蛋，中心嵌有一顆彷彿能吞噬星光的皇家藍寶石。古老的抄寫員曾用它記錄行者走過的所有足跡，每當你在 App 中儲存一則「回憶」，寶石內部便會多出一道星芒。' },
];
export const petSeriesIds = petCatalog.map((series) => series.id);
export function isPetSeriesId(value: unknown): value is PetVisualId {
  return typeof value === 'string' && petSeriesIds.includes(value as PetVisualId);
}
export function seriesFor(id: string | undefined): PetSeries | undefined { return petCatalog.find((series) => series.id === id); }
export function hasStageArt(id: PetVisualId, stage: OwnedStage): boolean {
  return stage === 'egg' || (stage === 'juvenile' && Boolean(seriesFor(id)?.juvenileName));
}
export interface PetStory { title: string; text: string; status: 'approved' | 'draft'; quote?: string }
export const petStoryStatusLabels = { approved: '蛋階段故事 · 使用者定稿', draft: '幼年期故事 · 草稿待審' } as const;
export const petStoryWorldNote = '以下為虛構世界觀。心跳、濕度、步頻同步、磁性指引與星芒等描述，不代表 App 已提供相關感測、導航或動畫效果。';
export function storiesForSeries(series: PetSeries, includeJuvenile: boolean): PetStory[] {
  const result: PetStory[] = [{ title: '序章・神秘背景', text: series.prologue, quote: series.eggQuote, status: 'approved' }];
  if (includeJuvenile && series.juvenileChapter) result.push({ title: '第一章・同行', text: series.juvenileChapter, status: 'draft' });
  return result;
}
export function unlockedStories(pet: PetProfile): PetStory[] {
  const series = seriesFor(pet.seriesId);
  if (!series) return [];
  return storiesForSeries(series, pet.stageHistory.some((entry) => entry.stage === 'juvenile'));
}
