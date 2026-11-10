# 王國守衛者 — Kingdom Defender

以 React、TypeScript、Vite、Phaser 3、Tailwind CSS 與 Zustand 製作的奇幻森林塔防遊戲。遊戲場景與角色均以 Phaser 圖形原始繪製，不依賴未授權素材或後端服務。遊戲最佳波次會儲存在瀏覽器 LocalStorage。

## 本機安裝與啟動

需求：Node.js 20.19+ 或 22.12+，以及 npm。

```bash
npm install
npm run dev
```

使用終端機顯示的網址（通常是 `http://localhost:5173`）開啟遊戲。

## 遊戲操作

- 在營地上點擊並選擇防禦塔；再次點擊已建好的塔可升級或出售。
- 點擊地圖空地讓英雄移動；英雄會自動攻擊附近魔物。
- 使用畫面左下方的流星火雨與召喚援軍技能清敵、阻敵。
- 每波敵人消滅後，按右下方按鈕呼叫下一波，提早迎戰可提早取得波次獎勵。
- 可暫停戰鬥，或切換 1x／2x 速度。遊戲共有 20 波，最後一波有森林魔王。

## 建置與本機預覽

```bash
npm run build
npm run preview
```

`npm run build` 會先執行 TypeScript 專案建置／型別檢查，再產生 `dist/`。

## 上傳至 GitHub

先在 GitHub 建立空白 repository（不要先加入 README），在專案資料夾執行：

```bash
git init
git add .
git commit -m "Build Kingdom Defender tower defense game"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repository>.git
git push -u origin main
```

之後更新並推送：

```bash
git add .
git commit -m "Update Kingdom Defender"
git push
```

## 部署到 Vercel

1. 將此專案推送至 GitHub。
2. 登入 [Vercel](https://vercel.com/)，選擇 **Add New → Project**，匯入此 GitHub repository。
3. Framework Preset 選 **Vite**；Build Command 為 `npm run build`，Output Directory 為 `dist`，Install Command 為 `npm install`。
4. 按 **Deploy**。本專案的 `vercel.json` 已設定 SPA rewrite，避免重新整理遊戲網址時遇到 404。
5. 後續推送到 `main` 會由 Vercel 自動重新部署。無需設定環境變數或後端服務。

## 專案結構

```text
src/
  game/
    config.ts       Phaser 設定
    ForestScene.ts  地圖、敵人、塔樓、英雄與戰鬥模擬
    store.ts        Zustand 遊戲狀態、建塔與存檔
    types.ts        共用遊戲型別
  App.tsx           主選單、HUD、塔樓操作與技能介面
  styles.css        Tailwind 與自訂響應式樣式
```
