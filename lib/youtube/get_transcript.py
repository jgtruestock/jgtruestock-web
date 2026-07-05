#!/usr/bin/env python3
"""
Helper script: fetch full YouTube transcript as JSON.
Usage: python3 get_transcript.py <videoId> [lang1 lang2 ...]
Output: JSON array of text strings, or {"error": "..."} on failure.
"""
import json
import sys

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No videoId provided"}))
        sys.exit(1)

    video_id = sys.argv[1]
    languages = sys.argv[2:] if len(sys.argv) > 2 else ['zh-Hant', 'zh', 'en']

    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        # Newer API: fetch() instead of get_transcript()
        ytt_api = YouTubeTranscriptApi()
        fetched = ytt_api.fetch(video_id, languages=languages)
        texts = [snippet.text for snippet in fetched]
        print(json.dumps(texts))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
