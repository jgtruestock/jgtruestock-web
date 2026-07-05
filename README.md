# JGTrueStock Web

JG 提股記錄平台 — Next.js 14+ (App Router) + MongoDB Atlas + Discord OAuth

## 本地開發

```bash
npm install
npm run dev
```

開啟 http://localhost:3000

## 環境變數（.env.local）

| 變數 | 說明 | 狀態 |
|---|---|---|
| `MONGODB_URI` | MongoDB Atlas 連線字串 | ✅ 已設定 |
| `FMP_API_KEY` | FMP API Key | ✅ 已設定 |
| `DISCORD_CLIENT_ID` | Discord OAuth App Client ID | ❌ 需要填入 |
| `DISCORD_CLIENT_SECRET` | Discord OAuth App Secret | ❌ 需要填入 |
| `NEXTAUTH_SECRET` | JWT 簽名密鑰（隨機字串即可） | ❌ 需要填入 |
| `NEXTAUTH_URL` | 部署後的網址（本地用 http://localhost:3000） | ❌ 需要更新 |
| `ADMIN_DISCORD_ID` | JG 的 Discord User ID（後台管理員） | ❌ 需要填入 |
| `CRON_SECRET` | Cron job 認證（選填，Vercel 會自動注入） | ⚠️ 選填 |

## 如何取得 Discord OAuth 憑證

1. 前往 https://discord.com/developers/applications
2. 新增 Application
3. 左側選 OAuth2
4. 複製 Client ID 和 Client Secret
5. 在 Redirects 加入：
   - 本地：`http://localhost:3000/api/auth/callback/discord`
   - Production：`https://jgtruestock.com/api/auth/callback/discord`

## 如何取得 JG 的 Discord ID

1. Discord 設定 → 進階 → 開啟開發者模式
2. 對自己的頭像右鍵 → 複製用戶 ID

## 部署到 Vercel

### 方法一：CLI

```bash
npm install -g vercel
cd ~/repos/jgtruestock-web
vercel
```

### 方法二：GitHub + Vercel 自動部署

1. 在 GitHub 建立新 repo（例如 `jgtruestock-web`）
2. Push 程式碼：
   ```bash
   cd ~/repos/jgtruestock-web
   git remote add origin https://github.com/YOUR_USERNAME/jgtruestock-web.git
   git push -u origin main
   ```
3. 前往 https://vercel.com/new，匯入 GitHub repo
4. 在 Vercel 設定環境變數（把 .env.local 裡的變數都填進去）
5. 部署

### Vercel 環境變數設定

在 Vercel Dashboard → Project Settings → Environment Variables 填入：
- `MONGODB_URI`
- `FMP_API_KEY`  
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `NEXTAUTH_SECRET`（用 `openssl rand -base64 32` 生成）
- `NEXTAUTH_URL`（填 `https://jgtruestock.com`）
- `ADMIN_DISCORD_ID`（JG 的 Discord User ID）

## DNS 設定（讓 jgtruestock.com 指向 Vercel）

在 Cloudflare DNS 面板：

1. 加入 CNAME 記錄：
   - Name: `@`（或 `jgtruestock.com`）
   - Target: `cname.vercel-dns.com`
   - Proxy: 先關掉（灰色雲朵）測試通過後再開

2. 或加入 A 記錄（如果 CNAME @ 不支援）：
   - Vercel 會提供 IP，在 Vercel Dashboard → Domains 查看

3. 在 Vercel Dashboard → Domains 加入 `jgtruestock.com`
4. 等待 DNS 生效（通常 5 分鐘內）

## Cron Job

`vercel.json` 已設定每天 22:00 UTC（台北時間 06:00）自動更新股價：

```
/api/cron/update-prices
```

Vercel 會自動觸發，無需額外設定。

## 頁面路由

| 路徑 | 說明 | 權限 |
|---|---|---|
| `/` | 重導向到 /stocks | - |
| `/login` | Discord 登入頁 | 未登入 |
| `/stocks` | JG 提股記錄（主頁面） | 需登入 |
| `/admin/mentions` | 後台：新增/刪除提股記錄 | 需登入（Admin） |

## API 端點

| 路徑 | 說明 |
|---|---|
| `GET /api/mentions` | 取得所有提股記錄 + 統計 |
| `POST /api/admin/mentions` | 新增提股記錄（admin） |
| `DELETE /api/admin/mentions/[id]` | 刪除記錄（admin） |
| `GET /api/admin/search?q=` | FMP 股票搜尋（admin） |
| `GET /api/cron/update-prices` | 更新所有股價（Vercel Cron） |
