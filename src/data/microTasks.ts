import { ExplorationTheme, MicroTaskDefinition } from '../domain/types';

const foodTasks: MicroTaskDefinition[] = [
  { id: 'food-photo-01', theme: 'food', type: 'photo', title: '街角色彩', prompt: '拍下一個讓你聯想到食物的暖色細節。', instruction: '只拍攝公共空間中的物品，避免拍到陌生人的正臉。' },
  { id: 'food-photo-02', theme: 'food', type: 'photo', title: '有年代的招牌', prompt: '找一塊有時間痕跡的店家招牌並拍下它。', instruction: '站在安全、不阻礙通行的位置拍攝。' },
  { id: 'food-photo-03', theme: 'food', type: 'photo', title: '字體觀察', prompt: '拍下一個你覺得很有個性的菜單或招牌字體。', instruction: '只拍攝對外公開的招牌或菜單。' },
  { id: 'food-photo-04', theme: 'food', type: 'photo', title: '包裝圖案', prompt: '拍下一個吸引你的食物包裝或圖案。', instruction: '不需要購買任何東西，也不要進入私人區域。' },
  { id: 'food-observe-01', theme: 'food', type: 'observation', title: '街區氣味', prompt: '停下來感受一下，這裡最明顯的是哪一種氣味印象？', instruction: '沒有標準答案，選最接近當下感受的一項。', options: ['烘焙或甜味', '鹹香或辛香', '茶與咖啡', '暫時沒有明顯氣味'] },
  { id: 'food-observe-02', theme: 'food', type: 'observation', title: '用餐節奏', prompt: '你覺得附近的用餐氣氛比較接近哪一種？', instruction: '觀察公共空間即可，不要注視特定陌生人。', options: ['匆忙外帶', '慢慢停留', '市場般熱鬧', '安靜日常'] },
  { id: 'food-observe-03', theme: 'food', type: 'observation', title: '第一個細節', prompt: '附近最先吸引你注意的是什麼？', instruction: '選擇最接近的描述。', options: ['顏色', '聲音', '香氣', '招牌文字'] },
  { id: 'food-observe-04', theme: 'food', type: 'observation', title: '街角溫度', prompt: '如果用溫度形容這個街角，你會怎麼選？', instruction: '這是感受題，不是實際氣溫。', options: ['溫暖', '清爽', '熱烈', '平靜'] },
  { id: 'food-imagine-01', theme: 'food', type: 'imagination', title: '替香氣命名', prompt: '用一個短詞替此刻的街區香氣取名。', instruction: '輸入一個詞或一句很短的話即可。' },
  { id: 'food-imagine-02', theme: 'food', type: 'imagination', title: '今日菜名', prompt: '如果這段路是一道菜，你會替它取什麼名字？', instruction: '輸入一個有趣的名字即可。' },
  { id: 'food-imagine-03', theme: 'food', type: 'imagination', title: '一口城市', prompt: '用一句短話形容你想像中的「這一口城市」。', instruction: '不用真的購買或品嘗食物。' },
  { id: 'food-imagine-04', theme: 'food', type: 'imagination', title: '味道顏色', prompt: '此刻的味道如果有顏色，會是什麼？', instruction: '輸入顏色與一個簡短原因。' },
];

const natureTasks: MicroTaskDefinition[] = [
  { id: 'nature-photo-01', theme: 'nature', type: 'photo', title: '自然紋理', prompt: '拍下一個葉片、樹皮、石頭或水面形成的紋理。', instruction: '不要採摘、攀爬或離開公共步道。' },
  { id: 'nature-photo-02', theme: 'nature', type: 'photo', title: '今日天空', prompt: '拍下此刻天空最有層次的一小部分。', instruction: '請先停在不阻礙通行的位置。' },
  { id: 'nature-photo-03', theme: 'nature', type: 'photo', title: '光與影', prompt: '拍下自然光形成的一道影子。', instruction: '不需要靠近危險邊坡、水域或車道。' },
  { id: 'nature-photo-04', theme: 'nature', type: 'photo', title: '指定綠色', prompt: '拍下一個你今天第一次注意到的綠色。', instruction: '只觀察與拍攝，不碰觸不熟悉的植物。' },
  { id: 'nature-observe-01', theme: 'nature', type: 'observation', title: '環境聲音', prompt: '閉上嘴安靜聽幾秒，最先聽到什麼？', instruction: '保持在安全位置，選最接近的一項。', options: ['風或葉子', '鳥或昆蟲', '水聲', '城市背景聲'] },
  { id: 'nature-observe-02', theme: 'nature', type: 'observation', title: '風吹方向', prompt: '此刻的風帶給你什麼感覺？', instruction: '這是感受題，不用精確測量。', options: ['幾乎沒有風', '輕柔', '明顯', '變化很多'] },
  { id: 'nature-observe-03', theme: 'nature', type: 'observation', title: '自然距離', prompt: '離你最近的自然元素是哪一類？', instruction: '不用靠近或碰觸。', options: ['植物', '水', '土地或石頭', '天空與光'] },
  { id: 'nature-observe-04', theme: 'nature', type: 'observation', title: '季節線索', prompt: '哪個細節最像現在的季節？', instruction: '選擇最接近你的觀察。', options: ['葉片狀態', '光線', '風與溫度', '動物或昆蟲聲'] },
  { id: 'nature-imagine-01', theme: 'nature', type: 'imagination', title: '替風取名', prompt: '替現在經過身邊的風取一個名字。', instruction: '一個詞或一句短話即可。' },
  { id: 'nature-imagine-02', theme: 'nature', type: 'imagination', title: '景色標題', prompt: '如果眼前是一張明信片，它的標題會是什麼？', instruction: '輸入一句簡短標題。' },
  { id: 'nature-imagine-03', theme: 'nature', type: 'imagination', title: '自然顏色', prompt: '用一個顏色形容此刻的自然感受。', instruction: '可以不是眼前實際看見的顏色。' },
  { id: 'nature-imagine-04', theme: 'nature', type: 'imagination', title: '留給四季', prompt: '留一句話給下一個季節再來這裡的自己。', instruction: '輸入一句短話即可。' },
];

const architectureTasks: MicroTaskDefinition[] = [
  { id: 'architecture-photo-01', theme: 'architecture', type: 'photo', title: '時間招牌', prompt: '拍下一塊有年代感的路邊招牌。', instruction: '只拍攝公共空間，不進入私人土地。' },
  { id: 'architecture-photo-02', theme: 'architecture', type: 'photo', title: '門與窗', prompt: '拍下一扇形狀或比例讓你印象深刻的門窗。', instruction: '避免拍攝住家內部或可辨識的住戶。' },
  { id: 'architecture-photo-03', theme: 'architecture', type: 'photo', title: '建築材料', prompt: '拍下磚、石、木、金屬或混凝土的一個細節。', instruction: '保持在公共道路與安全距離。' },
  { id: 'architecture-photo-04', theme: 'architecture', type: 'photo', title: '幾何形狀', prompt: '拍下一個在建築上重複出現的幾何形狀。', instruction: '先停下再構圖，不要邊走邊拍。' },
  { id: 'architecture-observe-01', theme: 'architecture', type: 'observation', title: '主要材質', prompt: '附近最顯眼的建築材質是哪一種？', instruction: '選擇最接近的一項。', options: ['磚或石', '木材', '金屬與玻璃', '混凝土'] },
  { id: 'architecture-observe-02', theme: 'architecture', type: 'observation', title: '線條方向', prompt: '哪一種線條最主導眼前的建築？', instruction: '沒有標準答案，依第一印象選擇。', options: ['水平', '垂直', '曲線', '不規則'] },
  { id: 'architecture-observe-03', theme: 'architecture', type: 'observation', title: '時間感', prompt: '這個街區給你的時間感比較像哪一種？', instruction: '依你的感受選擇。', options: ['歷史痕跡', '現代俐落', '新舊混合', '日常無年代感'] },
  { id: 'architecture-observe-04', theme: 'architecture', type: 'observation', title: '抬頭細節', prompt: '抬頭後最先注意到哪個部分？', instruction: '請站穩後再觀察。', options: ['屋頂', '陽台', '招牌', '天空輪廓'] },
  { id: 'architecture-imagine-01', theme: 'architecture', type: 'imagination', title: '建築綽號', prompt: '替眼前最有特色的建築取一個綽號。', instruction: '輸入一個短名字即可。' },
  { id: 'architecture-imagine-02', theme: 'architecture', type: 'imagination', title: '牆的故事', prompt: '如果這面牆會說話，它最想說什麼？', instruction: '輸入一句短話即可。' },
  { id: 'architecture-imagine-03', theme: 'architecture', type: 'imagination', title: '城市拼圖', prompt: '用一個詞描述這個街角在城市拼圖中的角色。', instruction: '一個詞就能完成。' },
  { id: 'architecture-imagine-04', theme: 'architecture', type: 'imagination', title: '光影名稱', prompt: '替建築上的光影取一個名字。', instruction: '輸入一個短詞或短句。' },
];

const surpriseTasks: MicroTaskDefinition[] = [
  { id: 'surprise-photo-01', theme: 'surprise', type: 'photo', title: '今天的指定色', prompt: '拍下一個此刻最先吸引你的顏色。', instruction: '先在安全位置停下，避免拍到陌生人的正臉。' },
  { id: 'surprise-photo-02', theme: 'surprise', type: 'photo', title: '被忽略的角落', prompt: '拍下一個平常容易被忽略、但讓你停下來看的小細節。', instruction: '只拍公共空間，不進入私人或管制區域。' },
  { id: 'surprise-photo-03', theme: 'surprise', type: 'photo', title: '圓形搜查', prompt: '找一個出現在街景裡的圓形並拍下來。', instruction: '不需要穿越道路或靠近危險位置。' },
  { id: 'surprise-photo-04', theme: 'surprise', type: 'photo', title: '光的記號', prompt: '拍下一處有趣的反光、倒影或光影。', instruction: '請先停下再拍攝，不要邊走邊看手機。' },
  { id: 'surprise-observe-01', theme: 'surprise', type: 'observation', title: '第一印象', prompt: '如果只用一個感覺形容現在，你會選哪一個？', instruction: '沒有標準答案，選最接近當下感受的一項。', options: ['熟悉', '意外', '安靜', '有活力'] },
  { id: 'surprise-observe-02', theme: 'surprise', type: 'observation', title: '街景節奏', prompt: '這段路此刻的節奏比較接近哪一種？', instruction: '觀察環境即可，不要注視特定陌生人。', options: ['快速', '緩慢', '忽快忽慢', '幾乎靜止'] },
  { id: 'surprise-observe-03', theme: 'surprise', type: 'observation', title: '最遠的聲音', prompt: '安全停下聽幾秒，最遠處的聲音像從哪裡來？', instruction: '不用閉眼，也不要站在車道或路口中央。', options: ['人群', '交通', '自然', '辨認不出來'] },
  { id: 'surprise-observe-04', theme: 'surprise', type: 'observation', title: '視線高度', prompt: '最吸引你的細節位在哪個高度？', instruction: '站穩後再抬頭或環顧。', options: ['腳邊', '視線平行', '屋頂以上', '遠方'] },
  { id: 'surprise-imagine-01', theme: 'surprise', type: 'imagination', title: '街角片名', prompt: '如果這個街角是一部短片，片名會是什麼？', instruction: '輸入一個短名稱即可。' },
  { id: 'surprise-imagine-02', theme: 'surprise', type: 'imagination', title: '今日暗號', prompt: '替這趟探索設計一個只有你知道的暗號。', instruction: '一個詞或一句短話即可。' },
  { id: 'surprise-imagine-03', theme: 'surprise', type: 'imagination', title: '下一位旅人', prompt: '留一句話給下一位經過這裡的探索者。', instruction: '不用真的留下實體物品，只需輸入一句短話。' },
  { id: 'surprise-imagine-04', theme: 'surprise', type: 'imagination', title: '城市聲音', prompt: '如果這個地方有一段主題聲音，你會怎麼形容？', instruction: '用一個詞或一句短句完成。' },
];

export const microTasks: MicroTaskDefinition[] = [
  ...foodTasks,
  ...natureTasks,
  ...architectureTasks,
  ...surpriseTasks,
];

function hash(text: string) {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) >>> 0;
  }
  return value;
}

export function tasksForTheme(theme: ExplorationTheme) {
  return microTasks.filter((task) => task.theme === theme);
}

export function selectMicroTask(
  theme: ExplorationTheme,
  usedIds: string[],
  seed: string,
  excludedIds: string[] = [],
): MicroTaskDefinition {
  const pool = tasksForTheme(theme);
  const excluded = new Set(excludedIds);
  const unused = pool.filter((task) => !usedIds.includes(task.id) && !excluded.has(task.id));
  const fallback = pool.filter((task) => !excluded.has(task.id));
  const candidates = unused.length > 0 ? unused : fallback;
  return candidates[hash(seed) % candidates.length] ?? pool[0]!;
}
