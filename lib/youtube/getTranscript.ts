import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

const VENV_PYTHON = '/Users/jgtruestock/cron-scripts/venv/bin/python3';
// 10 MB buffer — large enough for multi-hour transcripts
const EXEC_MAX_BUFFER = 10 * 1024 * 1024;

export interface TranscriptResult {
  text: string;
  source: 'youtube-api' | 'whisper';
}

export async function getTranscript(videoId: string): Promise<TranscriptResult | null> {
  // ── 1. Try youtube-transcript-api with --format json ──────────────────────
  try {
    const cmd = `${VENV_PYTHON} -m youtube_transcript_api ${videoId} --languages zh-Hant zh en --format json`;
    const { stdout } = await execAsync(cmd, {
      timeout: 30000,
      maxBuffer: EXEC_MAX_BUFFER,
    });

    const text = parseJsonTranscript(stdout);
    if (text && text.length > 50) {
      return { text, source: 'youtube-api' };
    }
  } catch {
    // No transcript available or blocked — fall through to Whisper
  }

  // ── 2. Fallback: yt-dlp + Whisper ─────────────────────────────────────────
  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-'));
    const audioPath = path.join(tmpDir, 'audio.%(ext)s');

    // Download audio
    await execAsync(
      `yt-dlp -x --audio-format mp3 --audio-quality 5 -o "${audioPath}" "https://www.youtube.com/watch?v=${videoId}"`,
      { timeout: 120000, maxBuffer: EXEC_MAX_BUFFER }
    );

    // Find the downloaded file
    const files = fs.readdirSync(tmpDir);
    const audioFile = files.find((f) => f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.webm'));
    if (!audioFile) throw new Error('No audio file downloaded');

    const fullAudioPath = path.join(tmpDir, audioFile);

    // Run Whisper
    await execAsync(
      `whisper "${fullAudioPath}" --model small --language en --output_format txt --output_dir "${tmpDir}"`,
      { timeout: 300000, maxBuffer: EXEC_MAX_BUFFER }
    );

    // Find txt output
    const txtFiles = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.txt'));
    if (txtFiles.length === 0) throw new Error('No Whisper output file');

    const text = fs.readFileSync(path.join(tmpDir, txtFiles[0]), 'utf-8').trim();

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });

    if (text && text.length > 50) {
      return { text, source: 'whisper' };
    }
  } catch (err) {
    console.error(`Whisper fallback failed for ${videoId}:`, err);
  }

  return null;
}

/**
 * Parse --format json output from youtube_transcript_api CLI.
 * Output shape: [{"text": "...", "start": 0.0, "duration": 1.5}, ...]
 * or nested: [[{"text":"..."},...]] when multiple transcripts returned.
 */
function parseJsonTranscript(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed);

    // Could be array of segments or array of arrays
    let segments: Array<{ text: string }> = [];

    if (Array.isArray(parsed)) {
      if (parsed.length > 0 && Array.isArray(parsed[0])) {
        // [[{text:...},...], ...]
        segments = parsed[0] as Array<{ text: string }>;
      } else {
        // [{text:...}, ...]
        segments = parsed as Array<{ text: string }>;
      }
    }

    const parts = segments
      .map((s) => (s.text || '').replace(/\\n/g, ' ').trim())
      .filter(Boolean);

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}
