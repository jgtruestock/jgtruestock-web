# Security Hardening TODO
> 記錄於 2026-07-09，待測試完成後實作

## HIGH 優先

### 1. 設定 CRON_SECRET
- 在 Vercel 環境變數加入 `CRON_SECRET=<strong-random-string>`
- cron 端點目前無驗證，任何人都能呼叫（會炸 AI 費用）
- 所有 `/api/cron/*` 路由已有 auth 判斷邏輯，只缺 secret 本身

### 2. 加入 HTTP Security Headers
在 `next.config.ts` 加入 `headers()`:
```js
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ],
  }]
}
```
（CSP 較複雜，需要配合 Google OAuth / YouTube API 白名單，單獨討論）

## MEDIUM 優先

### 3. 移除 TypeScript ignoreBuildErrors
- `next.config.ts` 的 `typescript: { ignoreBuildErrors: true }` 要移除
- 先跑 `npx tsc --noEmit` 看有哪些現有錯誤，逐一修復後移除此設定

### 4. 關鍵 API 加 rate limit
- `/api/mentions`：目前只有登入驗證，無防爆量查詢
- `/api/stocks/:symbol/*`：同上
- 建議用 MongoDB 的 binding_logs 模式或 Upstash Redis

## LOW 優先

### 5. 錯誤訊息精簡
- 部分 API 回傳的錯誤含內部細節
- 生產環境應回傳通用錯誤訊息，細節只寫 server log

## 已完成 ✅
- Google OAuth（無密碼儲存）
- HTTPS 強制（Vercel）
- MongoDB object filter（無 NoSQL injection）
- verify-channel rate limit（5次/小時/email）
- Admin 雙重驗證（Discord ID + email）
- 1:1 頻道綁定防共用
