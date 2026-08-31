import { petCatalog } from '../src/domain/petCatalog';
console.log('# 寵物故事｜蛋階段定稿與幼年期草稿\n\n版本：v0.9.1。12篇蛋階段引言與神秘背景採用使用者提供的原文。木系定名「枯木之種」，星系保留「觀星者的凝望」；後者採用本次藍寶石／抄寫員背景，不採用「抄寫員聖所蛋」作為名稱。沿用原圖及 wood／stargazer 系列ID，不改已有暱稱或養成存檔。\n\n以下故事為虛構世界觀，不表示App已具備心跳／濕度感測、步頻同步動畫、磁性導航、回憶星芒等功能；不改現有XP孵化門檻與回程提醒。\n\n幼年名稱、角色目標與8篇幼年章仍為待整批審閱草稿，不因蛋故事定稿而視為已核准。未提供幼年素材的4系列只展示蛋與定稿背景；成長／成熟期未開放。\n');
for (const pet of petCatalog) {
  console.log('## ' + pet.name + '\n\n### 蛋階段・使用者定稿\n\n> ' + pet.eggQuote + '\n\n神秘背景：' + pet.prologue + '\n\n### 後續設定・草稿待審\n\n幼年名稱草稿：' + (pet.juvenileName ?? '尚未設計，不代填') + '\n\n角色目標草稿：' + pet.goal + '\n');
  if (pet.juvenileChapter) console.log('#### 第一章・同行（幼年期草稿）\n\n' + pet.juvenileChapter + '\n');
}
