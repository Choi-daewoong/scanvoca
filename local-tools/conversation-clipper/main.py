"""conversation-clipper — local NAS video clipping tool (NOT deployed to Cloud Run).

Flow (per the phase-2 contract §2-3):
  1. GET  {BACKEND_API_BASE}/admin/blog/conversation-clips/pending-topics  (X-Api-Key)
  2. For each pending topic: scan NAS source ({title}/movie.mp4 + movie.srt), find the
     best-matching dialogue window by keyword overlap, compute a padded clip window.
  3. ffmpeg-cut that window with burned-in subtitles into the NAS output dir.
  4. POST {BACKEND_API_BASE}/admin/blog/conversation-clips  with the result (X-Api-Key).

All the decision logic (matching, timestamps, ffmpeg argv) lives in clipper/matching.py as
pure functions. This file only wires that logic to the NAS filesystem, ffmpeg, and the
backend — each of those is a thin wrapper monkeypatchable in tests.

Config (CLI flags override .env / environment):
  NAS_SOURCE_DIR, NAS_OUTPUT_DIR, BACKEND_API_BASE, NAS_TOOL_API_KEY, CLIP_URL_PREFIX
"""
from __future__ import annotations

import argparse
import os
import subprocess
from dataclasses import dataclass
from typing import Dict, List, Optional

from clipper.matching import (
    build_ffmpeg_command,
    collect_dialogue,
    compute_clip_bounds,
    find_best_subtitle_index,
)


@dataclass
class Config:
    source_dir: str
    output_dir: str
    backend_api_base: str
    api_key: str
    clip_url_prefix: str
    context: int = 1
    pad: float = 0.3


# ---------------- Thin IO wrappers (monkeypatched in tests) ----------------

def load_subtitles(srt_path: str) -> List[Dict]:
    """Parse a .srt into [{index, start, end, text}] via pysrt (lazy import)."""
    import pysrt  # lazy: keeps clipper.matching import-free for pure-function tests

    subs = pysrt.open(srt_path, encoding="utf-8")
    out: List[Dict] = []
    for item in subs:
        out.append(
            {
                "index": item.index,
                "start": item.start.ordinal / 1000.0,  # ms -> seconds
                "end": item.end.ordinal / 1000.0,
                "text": item.text.replace("\n", " ").strip(),
            }
        )
    return out


def run_ffmpeg(cmd: List[str]) -> int:
    """Run an ffmpeg argv list, returning its exit code (thin subprocess wrapper)."""
    result = subprocess.run(cmd, capture_output=True)
    return result.returncode


def fetch_pending_topics(cfg: Config) -> List[Dict]:
    """GET pending conversation topics from the backend (X-Api-Key auth)."""
    import requests  # lazy

    resp = requests.get(
        f"{cfg.backend_api_base}/admin/blog/conversation-clips/pending-topics",
        headers={"X-Api-Key": cfg.api_key},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def post_clip(cfg: Config, payload: Dict) -> Dict:
    """POST a finished clip back to the backend (X-Api-Key auth)."""
    import requests  # lazy

    resp = requests.post(
        f"{cfg.backend_api_base}/admin/blog/conversation-clips",
        headers={"X-Api-Key": cfg.api_key},
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def find_source_media(source_dir: str) -> List[Dict]:
    """Scan NAS source for {title}/movie.mp4 + movie.srt folders (thin os wrapper)."""
    media: List[Dict] = []
    if not os.path.isdir(source_dir):
        return media
    for name in sorted(os.listdir(source_dir)):
        folder = os.path.join(source_dir, name)
        if not os.path.isdir(folder):
            continue
        mp4 = os.path.join(folder, "movie.mp4")
        srt = os.path.join(folder, "movie.srt")
        if os.path.isfile(mp4) and os.path.isfile(srt):
            media.append({"title": name, "mp4": mp4, "srt": srt})
    return media


# ---------------- Orchestration (uses pure functions above) ----------------

def build_clip_payload(
    topic: Dict,
    media: Dict,
    subtitles: List[Dict],
    cfg: Config,
    output_filename: str,
) -> Optional[Dict]:
    """Match a topic against one media file's subtitles → clip payload, or None if no match.

    Pure except that it delegates ffmpeg cutting to run_ffmpeg via the caller. Here it only
    computes the window + payload; the caller runs ffmpeg. Returns None when the dialogue
    doesn't match the topic at all (caller should try the next media file).
    """
    query = f"{topic.get('title', '')} {topic.get('angle', '')}"
    center = find_best_subtitle_index(query, subtitles)
    if center is None:
        return None

    start, end = compute_clip_bounds(subtitles, center, context=cfg.context, pad=cfg.pad)
    dialogue_en = collect_dialogue(subtitles, center, context=cfg.context)
    clip_url = f"{cfg.clip_url_prefix.rstrip('/')}/{output_filename}"

    return {
        "topic_id": topic["id"],
        "video_title": media["title"],
        "dialogue_en": dialogue_en,
        "dialogue_ko": None,
        "start_seconds": start,
        "end_seconds": end,
        "clip_url": clip_url,
        "_ffmpeg": build_ffmpeg_command(
            media["mp4"], media["srt"], start, end,
            os.path.join(cfg.output_dir, output_filename),
        ),
    }


def process(cfg: Config) -> List[Dict]:
    """Run the full pipeline. Returns the list of successfully posted clip results."""
    pending = fetch_pending_topics(cfg)
    media_files = find_source_media(cfg.source_dir)
    posted: List[Dict] = []

    for topic in pending:
        chosen: Optional[Dict] = None
        for media in media_files:
            subtitles = load_subtitles(media["srt"])
            output_filename = f"topic-{topic['id']}.mp4"
            payload = build_clip_payload(topic, media, subtitles, cfg, output_filename)
            if payload is not None:
                chosen = payload
                break
        if chosen is None:
            print(f"  topic {topic['id']}: no matching dialogue found, skipping.")
            continue

        ffmpeg_cmd = chosen.pop("_ffmpeg")
        code = run_ffmpeg(ffmpeg_cmd)
        if code != 0:
            print(f"  topic {topic['id']}: ffmpeg failed (exit {code}), skipping.")
            continue

        result = post_clip(cfg, chosen)
        posted.append(result)
        print(f"  topic {topic['id']}: clip posted -> {chosen['clip_url']}")

    print(f"Done. {len(posted)} clip(s) posted.")
    return posted


def _load_config_from_args() -> Config:
    try:
        from dotenv import load_dotenv  # lazy: keeps this module importable without it

        load_dotenv()  # loads .env from CWD before os.getenv() defaults below read it
    except ImportError:
        pass

    parser = argparse.ArgumentParser(description="conversation-clipper (local NAS tool)")
    parser.add_argument("--source-dir", default=os.getenv("NAS_SOURCE_DIR"))
    parser.add_argument("--output-dir", default=os.getenv("NAS_OUTPUT_DIR"))
    parser.add_argument("--backend-api-base", default=os.getenv("BACKEND_API_BASE"))
    parser.add_argument("--api-key", default=os.getenv("NAS_TOOL_API_KEY"))
    parser.add_argument("--clip-url-prefix", default=os.getenv("CLIP_URL_PREFIX"))
    parser.add_argument("--context", type=int, default=int(os.getenv("CLIP_CONTEXT", "1")))
    parser.add_argument("--pad", type=float, default=float(os.getenv("CLIP_PAD", "0.3")))
    args = parser.parse_args()

    missing = [
        k for k in ("source_dir", "output_dir", "backend_api_base", "api_key", "clip_url_prefix")
        if not getattr(args, k)
    ]
    if missing:
        parser.error(f"missing required config: {', '.join(missing)} (set via flag or env)")

    return Config(
        source_dir=args.source_dir,
        output_dir=args.output_dir,
        backend_api_base=args.backend_api_base.rstrip("/"),
        api_key=args.api_key,
        clip_url_prefix=args.clip_url_prefix,
        context=args.context,
        pad=args.pad,
    )


def main() -> None:
    cfg = _load_config_from_args()
    process(cfg)


if __name__ == "__main__":
    main()
