# v0.9.1｜Supabase 免費多人測試設定

本次只提供程式與 SQL，未建立你的雲端專案、未取得你的 Key，也未執行任何遠端 migration。

v0.9.1只有寵物名稱／故事與分頁順序更新，不新增migration、資料欄位或權限。已完成v0.9.0設定者不必再執行SQL；個人與好友故事由各自App內建文案顯示，兩支手機請一起更新。

已完成v0.8／v0.8.1設定者，只需在同一免費專案執行新增的 `supabase/migrations/202608310003_pet_display_v09.sql`；不要重跑前兩份、不要重建資料庫。新資料夾的 `.env` 請依下文重新設定（或從自己的舊資料夾複製）；ZIP不包含實際Key。

第三份migration只新增本人可修改的寵物暱稱／系列／階段展示RPC及輸入驗證，不上傳收藏、XP、私人健康、照片或旅程筆記。未套用時個人寵物仍保存在本機，但好友外觀同步會失敗並提示。兩支手機需同版才能辨識所有系列；未知系列回退中性徽章。

## 1. 隔離的免費專案

在 [Supabase Dashboard](https://supabase.com/dashboard) 建立專供 ExplorePath 封閉測試的 **Free Plan** 專案。不要加入信用卡、升級 Pro 或啟用付費附加服務。若要求付款，停止並確認方案。

免費額度滿時接受暫停。先只邀請少數現實好友，隊伍上限 6 人不代表整個服務容量。參考官方 [方案與額度](https://supabase.com/docs/guides/platform/billing-on-supabase)。

## 2. 匿名登入

在 Authentication 啟用 Anonymous Sign-Ins。App 建立匿名帳號，使用獨立 128-bit 私人復原密語找回社交身分，不使用付費簡訊或 Email。

參考：[匿名登入文件](https://supabase.com/docs/guides/auth/auth-anonymous)。目前沒有 CAPTCHA 介面或反濫用網關，**不適合公開推廣**；匿名註冊可能被濫用耗用免費額度，先封閉測試，防護需另行整合。

## 3. 依序執行 SQL

在新專案的 SQL Editor，以專案擁有者身分，依序貼上執行：

1. supabase/migrations/202608310001_social_v08.sql
2. supabase/migrations/202608310002_social_safety.sql
3. supabase/migrations/202608310003_pet_display_v09.sql
4. supabase/enable_cleanup.sql

每份只執行一次。不要只跑第一份，第二份包含必要的定位隱私與權限收緊；不要在其他正式專案直接重跑。

第四份設定每分鐘清理4小時旅程、30分鐘房間、到期互享、5分鐘舊位置、QR／邀請／投票。必須確認Cron有成功執行。正常完成旅程由trigger同交易刪除即時位置；即使Cron遲到，snapshot仍拒絕過期讀取。

確認排程：

```sql
select jobname, schedule, active from cron.job where jobname='explorepath-social-cleanup';
```

## 4. 填寫公開連線參數

在檔案總管將 .env.example 複製成 .env，填入 Project URL 與 Publishable Key：

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://你的專案.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_你的公開金鑰
```

參數會放進 App bundle，**絕不可填 Secret／service_role Key 或資料庫密碼**。安全依靠 RLS、受限 RPC 與登入身分，不靠藏住公開 Key。

修改後重新執行 `npm start -- --clear`，兩支手機使用同一版 App 與同一個 Supabase 專案。

## 5. 兩支手機連線

1. 點「好友 → 連線我的 Supabase」。
2. 各自設定暱稱，私下保存自己的密語，切勿互傳。
3. 交換公開好友碼或 10 分鐘 QR，送出並接受邀請。
4. 同隊成員只有彼此直接成為好友才能互看定位；房主的好友不自動變成你的好友。
5. 建房、選目的地、邀請、檢查權限、全員準備。
6. 房主啟動倒數，保持前景，驗證位置、任務、完成、封鎖與停止分享。

## 資料邊界

- 雲端：匿名社交身分、好友、房間、任務確認、每人自己的步數／活動摘要、限時互享同意與最近位置。
- 本機：照片、完整健康足跡、私人回顧、復原密語（SecureStore）、未送出的離隊要求。
- 隊員看不到你的健康摘要、私人分類、復原 Hash 或投票者名單。
- 原始位置表不開放手機 SELECT；snapshot 依本人／好友／隊員與時效回傳合法資料。
- 不保存完整路線；約略座標量化後才寫入分享表。
- 原裝置與密語都遺失就無法復原；沒有付費簡訊或客服信箱復原。
- 復原撤銷原匿名身分社交資料存取，不轉移原手機照片與完整健康存檔。

## 常見問題

- RPC／schema cache 錯誤：確認兩份 migration 都成功，URL 是相同專案。
- Anonymous sign-ins disabled：啟用匿名登入；若要求 CAPTCHA，本版尚未整合，不能直接公開測試。
- 沒有新位置：確認前景、定位權限、好友關係、同房間與最後更新時間。
- 同地探索無法開始：所有位置近兩分鐘、精度 100 公尺內，兩兩距離也在 100 公尺內。
- 額度不足：暫停多人測試或等免費額度重置，不升級付款。

本機測試不涵蓋真實網路、Realtime、Cron、Auth 設定、濫用流量或供應商備份保存期。這些需在你的 Free 專案完成驗收，完成前不能聲稱適合公開營運。
