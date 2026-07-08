#!/usr/bin/env python3
"""
batch_generate_commentary.py — 批次生成法說會點評（本地 Mac 直跑）

直接呼叫 Claude API + 直接寫 MongoDB，完全不透過 Vercel。
支援 --dry-run、--limit N、--symbol NVDA、斷點續跑。

用法：
  python3 scripts/batch_generate_commentary.py                    # 全部跑
  python3 scripts/batch_generate_commentary.py --symbol NVDA      # 只跑 NVDA
  python3 scripts/batch_generate_commentary.py --limit 5          # 只跑前 5 支
  python3 scripts/batch_generate_commentary.py --dry-run           # 預覽，不寫 DB
  python3 scripts/batch_generate_commentary.py --force             # 強制重跑（包含已 published）
  python3 scripts/batch_generate_commentary.py --skip-published    # 跳過已 published（預設行為）
"""

import os
import sys
import json
import re
import time
import argparse
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ── 依賴檢查 ──────────────────────────────────────────────────────────────────
try:
    import anthropic
except ImportError:
    print("❌ 需要安裝 anthropic: pip3 install anthropic")
    sys.exit(1)

try:
    from pymongo import MongoClient
except ImportError:
    print("❌ 需要安裝 pymongo: pip3 install pymongo")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("❌ 需要安裝 requests: pip3 install requests")
    sys.exit(1)

# ── 設定 ──────────────────────────────────────────────────────────────────────

CLAUDE_MODEL = "claude-sonnet-4-5"
FMP_BASE_URL = "https://financialmodelingprep.com/stable"

# 載入 .env.local
def load_env(env_path: str) -> dict:
    """讀取 .env.local 的 KEY=VALUE"""
    env = {}
    p = Path(env_path).expanduser()
    if not p.exists():
        return env
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


# ── FMP API ───────────────────────────────────────────────────────────────────

class FMPClient:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def fetch_earnings_transcript(self, symbol: str) -> Optional[dict]:
        """取得最近一季法說會逐字稿（最多往回查 6 季）"""
        now = datetime.now()
        year = now.year
        month = now.month
        start_q = (month - 1) // 3 + 1

        for attempt in range(6):
            q = start_q - attempt
            y = year
            while q <= 0:
                q += 4
                y -= 1
            try:
                resp = requests.get(
                    f"{FMP_BASE_URL}/earning-call-transcript",
                    params={"symbol": symbol, "year": y, "quarter": q, "apikey": self.api_key},
                    timeout=15,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, list) and len(data) > 0:
                        return data[0]
            except Exception as e:
                logging.warning(f"[FMP] transcript {symbol} {y}Q{q}: {e}")
        return None

    def fetch_stock_news(self, symbol: str, limit: int = 30) -> list:
        """取得近期新聞"""
        try:
            resp = requests.get(
                f"{FMP_BASE_URL}/news/stock",
                params={"symbols": symbol, "limit": limit, "apikey": self.api_key},
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data if isinstance(data, list) else []
        except Exception as e:
            logging.warning(f"[FMP] news {symbol}: {e}")
        return []

    def get_current_price(self, symbol: str) -> Optional[float]:
        """取得目前股價"""
        try:
            resp = requests.get(
                f"{FMP_BASE_URL}/quote",
                params={"symbol": symbol, "apikey": self.api_key},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and len(data) > 0:
                    return data[0].get("price")
        except:
            pass
        return None


# ── Claude AI 生成 ────────────────────────────────────────────────────────────

def build_system_prompt() -> str:
    return """你是財經分析師。你的工作是把法說會內容和最近新聞對比，寫出中性的比對分析。

規則：
- 繁體中文
- 語氣如財經新聞，不加入個人意見
- 只陳述事實，不做預測
- 引用具體數字和新聞標題作為依據
- 不要使用任何 Markdown 格式，不要在段落標題前加 # 或 ## 符號

必須嚴格遵守輸出格式：
標題：（一句話總結這次法說會 vs 最新動態的比對結果）
---
【法說會方向】
（最新一季管理層在法說會說了什麼，包括財務結果、指引、重要計畫，引用具體數字和原話，150-200字）

【最近官方動態】
（根據最近 30 天新聞，找出與法說會相關的具體發展或變化，必須引用新聞標題和日期，150-200字）

【影子JG總結】
✅ 對得上：法說會方向有哪些新事件在印證
⚠️ 尚待觀察：法說會說了但尚未被新事件確認的項目
🔴 警訊：有哪些新事件違背或矛盾法說會的陳述（若無則寫「暫無明顯警訊」）"""


def build_user_prompt(symbol: str, transcript: Optional[dict], news: list,
                      mention_date: str, mention_close: float, latest_close: float) -> str:
    if mention_close > 0:
        diff_pct = ((latest_close - mention_close) / mention_close) * 100
        direction = "上漲" if diff_pct >= 0 else "下跌"
        price_str = f"（{direction} {abs(diff_pct):.1f}%）"
    else:
        price_str = ""

    stock_info = f"""【股票】{symbol}
【參考日期】{mention_date}
【參考股價】${mention_close}
【目前股價】${latest_close}{price_str}"""

    if transcript:
        content = transcript.get("content", "")
        t_year = transcript.get("year", "")
        t_quarter = transcript.get("quarter", "")
        t_date = transcript.get("date", "")
        transcript_section = f"""【最新法說會】{t_year} 年 Q{t_quarter}（{t_date}）
完整逐字稿：
---
{content}
---"""
    else:
        transcript_section = "【法說會資料】本期暫無法說會逐字稿，請根據新聞進行分析。"

    if news:
        news_items = "\n".join(
            f"{i+1}. [{n.get('publishedDate', '')[:10]}] {n.get('title', '')}（來源：{n.get('site', '')}）"
            for i, n in enumerate(news[:15])
        )
        news_section = f"【近期重要新聞】（最新 {min(len(news), 15)} 則）\n{news_items}"
    else:
        news_section = "【近期新聞】暫無新聞資料。"

    return f"""{stock_info}

{transcript_section}

{news_section}

請對 {symbol} 產出以下三段式比對分析：

【法說會方向】
最新一季管理層在法說會陳述的經營方向：包括財務結果、資本支出計畫、產品路線、下季指引。
必須引用具體數字和管理層原話。
同時提取以下四個面向：
- 明確時間承諾：管理層有沒有說「by Q3 we will...」「年底前完成...」這類有時間節點的承諾（若有請逐一列出）
- 需求展望：管理層怎麼描述市場需求（用原話引用）
- 風險提示：管理層自己提到的不確定性或風險
- 競爭/定位陳述：提到競爭對手或市場地位的說法

【最近官方動態】
根據以上法說會方向，查找最近 30 天新聞中有哪些「官方動態」與法說會內容相關。
必須引用具體新聞標題和發佈日期作為依據。

【影子JG總結】
對比兩部分，以中性客觀的角度列出：
✅ 對得上：法說會方向有哪些新事件在印證
⚠️ 尚待觀察：法說會說了但尚未被新事件確認的項目
🔴 警訊：有哪些新事件違背或矛盾法說會的陳述（若無則寫「暫無明顯警訊」）
不要下購買建議。"""


def parse_response(text: str) -> tuple[str, str]:
    """解析 Claude 回應 → (title, body)"""
    title_match = re.search(r"標題[：:]\s*(.+)", text)
    title = title_match.group(1).strip() if title_match else f"{datetime.now().year} Q 點評"

    sep_idx = text.find("---")
    body = text[sep_idx + 3:].strip() if sep_idx >= 0 else text.strip()
    body = re.sub(r'^#{1,3}\s*', '', body, flags=re.MULTILINE)
    return title, body


def parse_json_safe(text: str, fallback=None):
    """安全解析 JSON（處理 markdown code fence）"""
    if fallback is None:
        fallback = []
    cleaned = re.sub(r"```(?:json)?\n?", "", text).replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except:
        match = re.search(r"\[[\s\S]*\]", text)
        if match:
            try:
                return json.loads(match.group(0))
            except:
                pass
    return fallback


def build_news_text(news: list) -> str:
    if not news:
        return "（無新聞資料）"
    return "\n".join(
        f"{i+1}. [{n.get('publishedDate', '')[:10]}] {n.get('title', '')}（{n.get('site', '')}）"
        for i, n in enumerate(news[:30])
    )


def generate_key_points(client, transcript: Optional[dict], news: list) -> list:
    """兩段式 KeyPoint 生成"""
    if not transcript:
        return []

    transcript_text = transcript.get("content", "")[:8000]
    news_text = build_news_text(news)

    # Step 1: 從逐字稿提取要點
    step1_prompt = f"""你是財務分析師。從以下法說會逐字稿提取管理層的可驗證要點。

要提取的分類（全部）：
- revenue: 具體營收目標或結果
- margin: 毛利率/淨利率目標
- capex: 資本支出計畫（金額+用途）
- product: 產品發佈時程（有時間點的）
- headcount: 人力擴張/縮減計畫
- guidance: 下季/全年財務指引
- market_expansion: 市場進入/拓展計畫

輸出純 JSON array（不要 markdown code block），每筆：
{{
  "category": "...",
  "summary": "一句話中文摘要",
  "originalText": "原文引用（英文，50字內）",
  "targetQuarter": "2026-Q3" 或 null
}}

只提取有具體數字或時程的要點。模糊表態不算。
最多 8 個要點。

法說會逐字稿：
---
{transcript_text}
---"""

    try:
        step1_resp = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": step1_prompt}],
        )
        step1_text = step1_resp.content[0].text if step1_resp.content else "[]"
        step1_results = parse_json_safe(step1_text, [])
    except Exception as e:
        logging.error(f"[KeyPoints Step 1] {e}")
        return []

    if not step1_results:
        return []

    # Step 2: 新聞比對
    step2_prompt = f"""你是財務分析師。以下是一家公司法說會的要點，以及最近 30 天的新聞。

請對每個要點判斷「目前狀態」：
- pending: 時間未到，新聞無法確認
- fulfilled: 新聞顯示已達成
- partially: 部分達成
- broken: 新聞顯示未達成或下調
- unclear: 新聞資訊不足

每個要點輸出純 JSON array（不要 markdown code block），每筆：
{{
  "category": "...",（與輸入相同）
  "status": "pending|fulfilled|partially|broken|unclear",
  "statusNote": "中文說明，引用具體新聞標題或數字",
  "newsEvidence": "用哪條新聞判斷（標題，如無則填「—」）"
}}

法說會要點：
{json.dumps(step1_results, ensure_ascii=False, indent=2)}

最近 30 天新聞：
{news_text}"""

    try:
        step2_resp = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": step2_prompt}],
        )
        step2_text = step2_resp.content[0].text if step2_resp.content else "[]"
        step2_results = parse_json_safe(step2_text, [])
    except Exception as e:
        logging.error(f"[KeyPoints Step 2] {e}")
        step2_results = []

    # 合併 Step 1 + Step 2
    key_points = []
    for i, item in enumerate(step1_results):
        match = step2_results[i] if i < len(step2_results) else {}
        key_points.append({
            "category": item.get("category", "guidance"),
            "summary": item.get("summary", ""),
            "originalText": item.get("originalText", ""),
            "targetQuarter": item.get("targetQuarter"),
            "status": match.get("status", "unclear"),
            "statusNote": match.get("statusNote", "新聞資訊不足"),
            "newsEvidence": match.get("newsEvidence", "—"),
        })

    return key_points


def generate_commentary(claude_client, fmp: FMPClient, symbol: str,
                        mention_date: str, mention_close: float) -> dict:
    """完整生成一支股票的點評（3 次 Claude 呼叫）"""
    # 1. 取得最新股價
    latest_close = fmp.get_current_price(symbol) or 0.0

    # 2. 取得法說會逐字稿
    transcript = fmp.fetch_earnings_transcript(symbol)

    # 3. 取得新聞
    news = fmp.fetch_stock_news(symbol, 30)

    # 4. 呼叫 Claude 生成 title + body（第 1 次）
    system_prompt = build_system_prompt()
    user_prompt = build_user_prompt(symbol, transcript, news, mention_date, mention_close, latest_close)

    response = claude_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=3000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    text = response.content[0].text if response.content else ""
    title, body = parse_response(text)

    # 5. 呼叫 Claude 生成 key points（第 2+3 次）
    key_points = generate_key_points(claude_client, transcript, news)

    return {
        "title": title,
        "body": body,
        "model": CLAUDE_MODEL,
        "keyPoints": key_points,
        "transcript": transcript,
        "newsCount": len(news),
        "latestClose": latest_close,
    }


# ── MongoDB ───────────────────────────────────────────────────────────────────

def upsert_commentary(db, symbol: str, result: dict, publish: bool = True):
    """寫入 jg_commentary collection"""
    now = datetime.now(timezone.utc)
    update = {
        "$set": {
            "symbol": symbol.upper(),
            "draftTitle": result["title"],
            "draftBody": result["body"],
            "draftGeneratedAt": now,
            "draftModel": result["model"],
            "keyPoints": result.get("keyPoints", []),
            "status": "published" if publish else "draft",
            "sourcesSummary": {
                "earningsTranscriptCount": 1 if result.get("transcript") else 0,
                "newsCount": result.get("newsCount", 0),
                "filingsCount": 0,
                "latestEarningsDate": result["transcript"].get("date") if result.get("transcript") else None,
            },
            "updatedAt": now,
        },
        "$setOnInsert": {
            "createdAt": now,
        },
    }

    if publish:
        update["$set"]["publishedTitle"] = result["title"]
        update["$set"]["publishedBody"] = result["body"]
        update["$set"]["publishedAt"] = now

    db["jg_commentary"].update_one(
        {"symbol": symbol.upper()},
        update,
        upsert=True,
    )


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="批次生成法說會點評")
    parser.add_argument("--symbol", type=str, help="只跑指定股票（e.g. NVDA）")
    parser.add_argument("--limit", type=int, help="只跑前 N 支")
    parser.add_argument("--dry-run", action="store_true", help="預覽模式，不寫 DB")
    parser.add_argument("--force", action="store_true", help="強制重跑（包含已 published）")
    parser.add_argument("--draft-only", action="store_true", help="只存草稿，不自動 publish")
    parser.add_argument("--delay", type=float, default=2.0, help="每支股票間的等待秒數（避免 rate limit）")
    args = parser.parse_args()

    # 設定 logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )

    # 載入 env
    env_path = os.path.expanduser("~/repos/jgtruestock-web/.env.local")
    env = load_env(env_path)

    mongodb_uri = env.get("MONGODB_URI")
    anthropic_key = env.get("ANTHROPIC_API_KEY")
    fmp_key = env.get("FMP_API_KEY")

    if not mongodb_uri:
        print("❌ MONGODB_URI 未設定"); sys.exit(1)
    if not anthropic_key:
        print("❌ ANTHROPIC_API_KEY 未設定"); sys.exit(1)
    if not fmp_key:
        print("❌ FMP_API_KEY 未設定"); sys.exit(1)

    # 初始化
    mongo = MongoClient(mongodb_uri)
    db_13f = mongo["13f-tracker"]
    db_jgt = mongo["jgtruestock"]
    claude_client = anthropic.Anthropic(api_key=anthropic_key)
    fmp = FMPClient(fmp_key)

    # 取得所有追蹤股票
    if args.symbol:
        symbols_to_run = [args.symbol.upper()]
        # 取得 mention info
        picks_map = {}
        for coll_name in ["jg_picks_cache", "jg_picks_manual"]:
            doc = db_13f[coll_name].find_one({"symbol": args.symbol.upper()})
            if doc:
                picks_map[doc["symbol"]] = doc
                break
    else:
        # 取得全部追蹤股票
        picks_map = {}
        for coll_name in ["jg_picks_manual", "jg_picks_cache"]:
            for doc in db_13f[coll_name].find({}, {"symbol": 1, "mentionDate": 1, "mentionClose": 1}):
                picks_map[doc["symbol"]] = doc
        symbols_to_run = sorted(picks_map.keys())

    if args.limit:
        symbols_to_run = symbols_to_run[:args.limit]

    # 檢查已有的 commentary 狀態
    existing = {}
    for doc in db_jgt["jg_commentary"].find({}, {"symbol": 1, "status": 1}):
        existing[doc["symbol"]] = doc.get("status")

    # 篩選需要跑的
    to_run = []
    skipped = []
    for sym in symbols_to_run:
        status = existing.get(sym)
        if status == "published" and not args.force:
            skipped.append((sym, "已 published"))
        else:
            to_run.append(sym)

    # 顯示計畫
    print(f"\n{'='*60}")
    print(f"📋 批次生成法說會點評")
    print(f"{'='*60}")
    print(f"  追蹤股票: {len(symbols_to_run)} 支")
    print(f"  需要跑的: {len(to_run)} 支")
    print(f"  已跳過的: {len(skipped)} 支")
    if skipped:
        for sym, reason in skipped[:5]:
            print(f"    ⏭️  {sym} ({reason})")
        if len(skipped) > 5:
            print(f"    ... 還有 {len(skipped) - 5} 支")
    print(f"  模式: {'🔍 預覽（DRY RUN）' if args.dry_run else '🚀 正式執行'}")
    print(f"  發布: {'📝 只存草稿' if args.draft_only else '✅ 自動發布'}")
    print(f"{'='*60}\n")

    if not to_run:
        print("✅ 沒有需要跑的股票。")
        return

    if args.dry_run:
        print("🔍 DRY RUN 模式 — 以下股票將會被生成：")
        for i, sym in enumerate(to_run, 1):
            pick = picks_map.get(sym, {})
            print(f"  {i}. {sym} (mention: {pick.get('mentionDate', 'N/A')})")
        print(f"\n取消 --dry-run 即可正式執行。")
        return

    # 開始跑
    succeeded = []
    failed = []
    start_time = time.time()

    for i, sym in enumerate(to_run, 1):
        pick = picks_map.get(sym, {})
        mention_date = pick.get("mentionDate", "未知")
        mention_close = pick.get("mentionClose", 0)

        print(f"\n[{i}/{len(to_run)}] 🔄 {sym} ...")
        t0 = time.time()

        try:
            result = generate_commentary(claude_client, fmp, sym, mention_date, mention_close)
            elapsed = time.time() - t0

            # 寫 DB
            publish = not args.draft_only
            upsert_commentary(db_jgt, sym, result, publish=publish)

            status_emoji = "✅" if publish else "📝"
            print(f"  {status_emoji} {sym} — {result['title'][:40]}... ({elapsed:.1f}s)")
            print(f"     KeyPoints: {len(result.get('keyPoints', []))} | News: {result.get('newsCount', 0)} | Price: ${result.get('latestClose', 0):.2f}")
            succeeded.append(sym)

        except Exception as e:
            elapsed = time.time() - t0
            print(f"  ❌ {sym} — 失敗 ({elapsed:.1f}s): {e}")
            failed.append((sym, str(e)))
            logging.exception(f"Failed: {sym}")

        # Rate limit 間隔
        if i < len(to_run):
            time.sleep(args.delay)

    # 結果彙整
    total_time = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"📊 批次結果")
    print(f"{'='*60}")
    print(f"  ✅ 成功: {len(succeeded)} 支")
    print(f"  ❌ 失敗: {len(failed)} 支")
    print(f"  ⏭️  跳過: {len(skipped)} 支")
    print(f"  ⏱️  總耗時: {total_time:.0f} 秒 ({total_time/60:.1f} 分)")
    print(f"  📊 平均: {total_time/max(len(succeeded),1):.1f} 秒/支")

    if failed:
        print(f"\n❌ 失敗清單（可重跑 --symbol 指定）：")
        for sym, err in failed:
            print(f"  {sym}: {err[:80]}")

        # 寫失敗 log
        fail_log = os.path.expanduser("~/repos/jgtruestock-web/scripts/batch_failures.json")
        with open(fail_log, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "failed": [{"symbol": s, "error": e} for s, e in failed],
            }, f, ensure_ascii=False, indent=2)
        print(f"\n📝 失敗 log 已寫入: {fail_log}")

    print(f"{'='*60}")


if __name__ == "__main__":
    main()
