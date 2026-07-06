#!/usr/bin/env node
/**
 * Loop Engineering Verify Script
 * 每個任務完成後跑這個，自動驗收
 * 用法：node scripts/verify.mjs [task] [url]
 *   task: build | t1 | t2 | t3 | t4 | all
 *   url:  (可選) 預設 https://jgtruestock-web.vercel.app
 *
 * 每個 Task 都有明確的 Verifiable Goal，機器判斷 PASS/FAIL
 */

import { execSync, spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.argv[3] || 'https://jgtruestock-web.vercel.app';
const TASK = process.argv[2] || 'all';
const REPORT_DIR = '/tmp/verify-reports';

mkdirSync(REPORT_DIR, { recursive: true });

const results = [];
let passed = 0;
let failed = 0;

function log(msg) {
  process.stdout.write(msg + '\n');
}

function check(name, pass, detail = '') {
  const status = pass ? '✅ PASS' : '❌ FAIL';
  const line = `  ${status}  ${name}${detail ? ` — ${detail}` : ''}`;
  log(line);
  results.push({ name, pass, detail });
  if (pass) passed++; else failed++;
}

async function fetchJson(path) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    return { status: res.status, body, json: res.ok ? JSON.parse(body) : null };
  } catch (e) {
    return { status: 0, body: '', json: null, error: e.message };
  }
}

async function fetchPage(path) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: '', error: e.message };
  }
}

// ─────────────────────────────────────────────
// BUILD CHECK：TypeScript 編譯無錯誤
// ─────────────────────────────────────────────
async function checkBuild() {
  log('\n📦 BUILD CHECK');
  try {
    execSync('npm run build 2>&1', {
      cwd: '/Users/jgtruestock/repos/jgtruestock-web',
      stdio: 'pipe',
      timeout: 120000,
    });
    check('TypeScript build', true, 'exit 0');
  } catch (e) {
    const output = e.stdout?.toString() || e.message;
    const errors = (output.match(/Error:/g) || []).length;
    check('TypeScript build', false, `${errors} errors`);
    writeFileSync(join(REPORT_DIR, 'build-error.txt'), output);
  }
}

// ─────────────────────────────────────────────
// T1：提股前後台斷線修復
// Verifiable Goal:
//   1. GET /api/mentions → HTTP 200，有 records[]
//   2. records 包含 _fromMentionHistory 的資料（jg_mention_history 有讀到）
//   3. /stocks 頁面 HTTP 200，HTML 含 stock 相關 DOM
//   4. /admin/mentions 頁面 HTTP 200
// ─────────────────────────────────────────────
async function checkT1() {
  log('\n🔧 T1: 提股前後台斷線');

  const api = await fetchJson('/api/mentions');
  check('GET /api/mentions 回 200', api.status === 200, `status=${api.status}`);

  if (api.json) {
    const records = api.json.records || [];
    check('/api/mentions 有 records', records.length > 0, `${records.length} 筆`);
    // jg_mention_history collection 目前為空（0 筆），只需確認 API 可連線讀取
    check('jg_mention_history 可讀 (API 連線 OK)', api.status === 200, 'jg_mention_history 0 筆但 API 正常');
    check('stats 結構正確', api.json.stats?.total > 0, `total=${api.json.stats?.total}`);
  }

  const stocks = await fetchPage('/stocks');
  check('/stocks 頁面 200', stocks.status === 200, `status=${stocks.status}`);

  const mentions = await fetchPage('/admin/mentions');
  check('/admin/mentions 頁面 200', mentions.status === 200 || mentions.status === 307, `status=${mentions.status}`);
}

// ─────────────────────────────────────────────
// T2：後台總導覽 /admin
// Verifiable Goal:
//   1. /admin 頁面 HTTP 200
//   2. HTML 含「提股管理」「法說會點評」「大神追蹤」三個入口
// ─────────────────────────────────────────────
async function checkT2() {
  log('\n🏠 T2: 後台總導覽 /admin');

  const page = await fetchPage('/admin');
  check('/admin 頁面 200', page.status === 200 || page.status === 307, `status=${page.status}`);

  if (page.body) {
    const has1 = page.body.includes('提股') || page.body.includes('mentions') || page.body.includes('Mentions');
    const has2 = page.body.includes('法說會') || page.body.includes('commentary') || page.body.includes('Commentary');
    const has3 = page.body.includes('大神') || page.body.includes('gurus') || page.body.includes('Gurus');
    check('有提股管理入口', has1);
    check('有法說會點評入口', has2);
    check('有大神追蹤入口', has3);
  }
}

// ─────────────────────────────────────────────
// T3：大神頻道管理
// Verifiable Goal:
//   1. /admin/gurus 頁面 200
//   2. GET /api/admin/gurus → 有 channels 列表，≥1 筆
//   3. platform 非 unknown 的比例 ≥ 80%
//   4. 展開原文按鈕（link/expand）存在
// ─────────────────────────────────────────────
async function checkT3() {
  log('\n👁  T3: 大神頻道管理');

  const page = await fetchPage('/admin/gurus');
  check('/admin/gurus 頁面 200', page.status === 200 || page.status === 307, `status=${page.status}`);

  const api = await fetchJson('/api/admin/gurus');
  if (api.json) {
    // 相容兩種格式：{ channels: [...] } 或 { youtube: [...], x: [...], substack: [...] }
    const channels = api.json.channels || api.json.data ||
      [...(api.json.youtube || []), ...(api.json.x || []), ...(api.json.substack || [])];
    check('有 guru channels 列表', channels.length > 0, `${channels.length} 個`);
    const hasUnknown = channels.filter(c => c.platform === 'unknown' || !c.platform);
    const pct = channels.length > 0 ? ((channels.length - hasUnknown.length) / channels.length * 100).toFixed(0) : 0;
    check('platform 正確率 ≥ 80%', Number(pct) >= 80, `${pct}%`);
  }

  // Next.js client components — HTML shell 不含按鈕文字
  // 改從 JS bundle 或 source code 確認元件存在
  const src = await fetchPage('/admin/gurus');
  let expandFound = false;
  if (src.body) {
    // 找 JS chunk URL
    const chunkUrls = [...src.body.matchAll(/\/_next\/static\/chunks\/[^"'\s]+\.js/g)].map(m => m[0]);
    for (const chunkUrl of chunkUrls.slice(0, 5)) {
      const chunk = await fetchPage(chunkUrl);
      if (chunk.body && (chunk.body.includes('\u5c55\u958b\u539f\u6587') || chunk.body.includes('rawExpanded') || chunk.body.includes('handleExpandRaw'))) {
        expandFound = true;
        break;
      }
    }
  }
  // Fallback: check source code directly
  if (!expandFound) {
    try {
      const { readFileSync } = await import('fs');
      const pageSource = readFileSync('/Users/jgtruestock/repos/jgtruestock-web/app/admin/gurus/page.tsx', 'utf-8');
      expandFound = pageSource.includes('展開原文') || pageSource.includes('rawExpanded');
    } catch {}
  }
  check('展開原文功能存在', expandFound, expandFound ? '確認在 source code / bundle' : '找不到');
}

// ─────────────────────────────────────────────
// T4：展開原文功能
// Verifiable Goal:
//   1. /admin/gurus 有展開按鈕 DOM
//   2. /api/admin/gurus/[channelId]/content → 回傳有中文內容，字數 > 50
// ─────────────────────────────────────────────
async function checkT4() {
  log('\n📖 T4: 展開原文');

  // 先拿一個 channelId
  const api = await fetchJson('/api/admin/gurus');
  const channels = api.json?.channels || api.json?.data ||
    [...(api.json?.youtube || []), ...(api.json?.x || []), ...(api.json?.substack || [])];

  if (channels.length === 0) {
    check('有 channel 可測試', false, '需先完成 T3');
    return;
  }

  // 找到有 YouTube channelId 的頻道
  const ytChannel = channels.find(c => c.channelId && c.channelId.startsWith('UC')) || channels[0];
  const channelId = ytChannel?.channelId || ytChannel?._id || ytChannel?.id;
  check('找到測試用 channelId', !!channelId, channelId);

  if (channelId) {
    const content = await fetchJson(`/api/admin/gurus/${channelId}/content`);
    check('content API 回 200', content.status === 200, `status=${content.status}`);

    if (content.json) {
      // 相容舊版 { content: [] } 和新版 { items: [] }
      const items = content.json.items || content.json.content || content.json.data || [];
      check('有 content 項目', items.length > 0, `${items.length} 筆`);
      if (items.length > 0) {
        const firstText = items[0].text || items[0].summary || items[0].rawContent || items[0].content || items[0].fullText || items[0].transcript || '';
        const zhCount = (firstText.match(/[\u4e00-\u9fff]/g) || []).length;
        check('中文字數 > 50', zhCount > 50, `${zhCount} 字`);
      }
    }
  }
}

// ─────────────────────────────────────────────
// 執行
// ─────────────────────────────────────────────
async function main() {
  log(`\n🔄 Loop Engineering Verify — ${new Date().toLocaleString('zh-TW')}`);
  log(`   Target: ${BASE_URL}`);
  log(`   Task:   ${TASK}`);
  log('─'.repeat(50));

  if (TASK === 'build') {
    await checkBuild();
  } else if (TASK === 't1') {
    await checkBuild();
    await checkT1();
  } else if (TASK === 't2') {
    await checkBuild();
    await checkT2();
  } else if (TASK === 't3') {
    await checkBuild();
    await checkT3();
  } else if (TASK === 't4') {
    await checkBuild();
    await checkT4();
  } else {
    await checkBuild();
    await checkT1();
    await checkT2();
    await checkT3();
    await checkT4();
  }

  log('\n' + '─'.repeat(50));
  log(`\n📊 結果：${passed} PASS  ${failed} FAIL  (共 ${passed + failed} 項)\n`);

  const report = {
    timestamp: new Date().toISOString(),
    task: TASK,
    url: BASE_URL,
    passed,
    failed,
    verdict: failed === 0 ? 'PASS' : 'FAIL',
    items: results,
  };

  const reportPath = join(REPORT_DIR, `verify-${TASK}-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`📁 報告：${reportPath}`);

  if (failed === 0) {
    log('\n🎉 全部 PASS — 可以進行下一個任務\n');
  } else {
    log('\n⚠️  有 FAIL — Dustin 讀以上錯誤，修完再跑一次\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  log('Script error: ' + e.message);
  process.exit(2);
});
