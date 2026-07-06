#!/usr/bin/env python3
"""
commentary_worker.py — 本地 Worker daemon，輪詢 MongoDB job queue 並執行 AI 生成

用法：
  python3 scripts/commentary_worker.py              # 前景執行
  python3 scripts/commentary_worker.py --once       # 只跑一輪就結束
  python3 scripts/commentary_worker.py --interval 5 # 每 5 秒查一次（預設 10）
"""
import os, sys, time, socket, argparse, logging
from datetime import datetime, timezone
from pathlib import Path

# 重用 batch 腳本的核心函式
sys.path.insert(0, str(Path(__file__).parent))
from batch_generate_commentary import (
    load_env, FMPClient, generate_commentary, upsert_commentary
)

import anthropic
from pymongo import MongoClient


def run_worker(mongo_uri, anthropic_key, fmp_key, interval=10, once=False):
    mongo = MongoClient(mongo_uri)
    db_13f = mongo["13f-tracker"]
    db_jgt = mongo["jgtruestock"]
    claude_client = anthropic.Anthropic(api_key=anthropic_key)
    fmp = FMPClient(fmp_key)
    hostname = socket.gethostname()

    logging.info(f"🔄 Worker 啟動（host={hostname}, interval={interval}s）")

    while True:
        # 原子搶 job：findOneAndUpdate status pending → processing
        job = db_jgt["jg_generation_jobs"].find_one_and_update(
            {"status": "pending"},
            {"$set": {
                "status": "processing",
                "startedAt": datetime.now(timezone.utc),
                "workerHost": hostname,
            }},
            sort=[("requestedAt", 1)],  # FIFO
            return_document=True,
        )

        if job:
            symbol = job["symbol"]
            job_id = job["jobId"]
            logging.info(f"📦 處理 job {job_id}: {symbol}")

            try:
                # 取 mention info
                pick = (
                    db_13f["jg_picks_cache"].find_one({"symbol": symbol})
                    or db_13f["jg_picks_manual"].find_one({"symbol": symbol})
                    or {}
                )
                mention_date = pick.get("mentionDate", "未知")
                mention_close = pick.get("mentionClose", 0)

                result = generate_commentary(claude_client, fmp, symbol, mention_date, mention_close)

                # 寫入 jg_commentary
                upsert_commentary(db_jgt, symbol, result, publish=False)

                # 更新 job 狀態
                db_jgt["jg_generation_jobs"].update_one(
                    {"jobId": job_id},
                    {"$set": {
                        "status": "completed",
                        "completedAt": datetime.now(timezone.utc),
                        "result": {
                            "title": result["title"],
                            "body": result["body"],
                            "model": result["model"],
                            "keyPoints": result.get("keyPoints", []),
                        },
                    }},
                )
                logging.info(f"✅ {symbol} 完成: {result['title'][:40]}...")

            except Exception as e:
                logging.exception(f"❌ {symbol} 失敗")
                db_jgt["jg_generation_jobs"].update_one(
                    {"jobId": job_id},
                    {"$set": {
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc),
                        "error": str(e)[:500],
                    }},
                )
        else:
            if once:
                logging.info("沒有 pending jobs，退出")
                break

        time.sleep(interval)


def main():
    parser = argparse.ArgumentParser(description="Commentary Worker Daemon")
    parser.add_argument("--once", action="store_true", help="只跑一輪")
    parser.add_argument("--interval", type=int, default=10, help="輪詢間隔秒數")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S"
    )

    env = load_env(os.path.expanduser("~/repos/jgtruestock-web/.env.local"))
    run_worker(
        env["MONGODB_URI"],
        env["ANTHROPIC_API_KEY"],
        env["FMP_API_KEY"],
        interval=args.interval,
        once=args.once,
    )


if __name__ == "__main__":
    main()
