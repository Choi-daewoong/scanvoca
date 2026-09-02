"""conversation-clipper — local NAS video clipping tool (NOT deployed to Cloud Run).

Two modes:

  --mode match (topic-first, legacy): a topic is written first (in the admin UI), and
    this tool searches NAS subtitles for dialogue overlapping that topic's wording.
      1. GET  {BACKEND_API_BASE}/admin/blog/conversation-clips/pending-topics  (X-Api-Key)
      2. For each pending topic: scan NAS source ({title}/movie.{mp4,mkv,mov,avi,webm} +
         movie.srt), find the best-matching dialogue window by keyword overlap.
      3. ffmpeg-cut that window with burned-in subtitles into the NAS output dir.
      4. POST {BACKEND_API_BASE}/admin/blog/conversation-clips  with the result (X-Api-Key).
    Structurally unreliable: a topic written without seeing the actual subtitle library
    often has zero overlap with anything on the NAS and just sits stuck (real case: two
    topics never matched any of the available shows/movies).

  --mode discover (dialogue-first, default): scan every available English-subtitled
    video's dialogue and let the model decide what's worth teaching, instead of hoping a
    pre-written topic happens to match.
      1. Scan NAS source, keep only videos whose subtitles pass is_english_subtitles.
      2. Slice each video's subtitles into non-overlapping windows (build_dialogue_windows).
      3. POST each window's text to {BACKEND_API_BASE}/admin/blog/conversation-clips/discover-topic
         (X-Api-Key) — the model returns a topic {title, angle} grounded in that dialogue,
         or null if the window isn't good teaching material (skipped, no forced match).
      4. ffmpeg-cut a matched window, then POST {BACKEND_API_BASE}/admin/blog/conversation-clips/discovered
         (X-Api-Key) to create the topic and its clip together in one call.
    Every created topic is guaranteed to have a matching clip, by construction.

All the decision logic (matching, windowing, timestamps, ffmpeg argv) lives in
clipper/matching.py as pure functions. This file only wires that logic to the NAS
filesystem, ffmpeg, and the backend — each of those is a thin wrapper monkeypatchable in
tests.

Config (CLI flags override .env / environment):
  NAS_SOURCE_DIR, NAS_OUTPUT_DIR, BACKEND_API_BASE, NAS_TOOL_API_KEY, CLIP_URL_PREFIX
  DISCOVER_WINDOW_SIZE, DISCOVER_MAX_WINDOWS_PER_VIDEO, DISCOVER_MAX_NEW_TOPICS
  DISCOVER_COOLDOWN_WINDOWS, CLIPPER_LOOP_SECONDS

Looping (CLIPPER_LOOP_SECONDS / --loop-seconds): 0 (default) runs once and exits — the
original behavior. > 0 runs forever instead: run, sleep that many seconds, run again.
This replaces the old approach of wrapping the container's entrypoint in a shell
`while true; do python main.py; sleep 604800; done` from outside (previously configured
only in an untracked NAS-side compose.yaml — see compose.yaml in this directory, now
checked into git, for the deployed shape). Looping in Python instead of shell means a
crashed run is caught and logged with a timestamp per iteration, rather than silently
being retried by `restart: unless-stopped` with no record of what happened or when.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import time
import traceback
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from clipper.matching import (
    build_dialogue_windows,
    build_ffmpeg_command,
    collect_dialogue,
    compute_clip_bounds,
    find_best_subtitle_index,
    is_english_subtitles,
    window_bounds,
    window_dialogue_text,
    window_key,
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
    discover_window_size: int = 6
    discover_max_windows_per_video: int = 40
    discover_max_new_topics: int = 5
    discover_state_file: Optional[str] = None
    discover_cooldown_windows: int = 3


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


def fetch_topic_discovery(cfg: Config, dialogue_en: str, video_title: str) -> Optional[Dict]:
    """POST a dialogue window to the backend; returns a {title, angle} suggestion or None
    when the model judged the window isn't good teaching material (X-Api-Key auth)."""
    import requests  # lazy

    resp = requests.post(
        f"{cfg.backend_api_base}/admin/blog/conversation-clips/discover-topic",
        headers={"X-Api-Key": cfg.api_key},
        json={"dialogue_en": dialogue_en, "video_title": video_title},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json().get("suggestion")


def post_discovered_clip(cfg: Config, payload: Dict) -> Optional[Dict]:
    """POST an AI-discovered topic + its already-cut clip; backend creates both in one
    call (X-Api-Key auth). Returns None on 409 (the backend already has this exact
    clip_url registered) instead of raising.

    409 is expected, not exceptional: the backend's dedup guard (added alongside this
    tool's own window_key state) rejects a clip_url it already has, which happens whenever
    local state doesn't yet know about a window - e.g. the very first run after state
    persistence was added, when the server already has days of history the fresh local
    state file knows nothing about. Before this, an unhandled 409 crashed the whole
    discover() run (and with it, the rest of that run's windows) instead of just skipping
    the one window that was already covered.
    """
    import requests  # lazy

    resp = requests.post(
        f"{cfg.backend_api_base}/admin/blog/conversation-clips/discovered",
        headers={"X-Api-Key": cfg.api_key},
        json=payload,
        timeout=30,
    )
    if resp.status_code == 409:
        return None
    resp.raise_for_status()
    return resp.json()


# ffmpeg reads the container/codec from the file's own bytes, not its extension, so any
# of these work as a source video - only the on-disk filename needs to match one of them.
_VIDEO_EXTENSIONS = (".mp4", ".mkv", ".mov", ".avi", ".webm")

# Text-based subtitle codecs ffmpeg can losslessly convert to .srt. Image-based tracks
# (PGS "hdmv_pgs_subtitle", VobSub "dvd_subtitle") carry no text - there's nothing to
# extract, same as subtitles burned into the video image itself.
_TEXT_SUBTITLE_CODECS = {"subrip", "ass", "ssa", "mov_text", "webvtt"}


def probe_subtitle_streams(video_path: str) -> List[Dict]:
    """List a video's embedded subtitle streams via ffprobe (thin IO wrapper)."""
    import json

    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams",
                "-select_streams", "s", video_path,
            ],
            capture_output=True, text=True,
        )
    except FileNotFoundError:
        return []
    if result.returncode != 0:
        return []
    try:
        return json.loads(result.stdout).get("streams", [])
    except json.JSONDecodeError:
        return []


def pick_text_subtitle_stream(streams: List[Dict], preferred_language: str = "eng") -> Optional[int]:
    """Pure: pick the best extractable subtitle stream, preferring `preferred_language`.

    This pipeline is for learning English, so language matters, not just "any text
    track" - a real file was observed with 45 subtitle tracks (one per language) where
    picking the first one would have been a coin flip. Among tracks matching the
    preferred language, "forced" tracks (only on-screen foreign-text translations, not
    full dialogue - e.g. a sign in another language) are skipped when a full non-forced
    track is also available. Falls back to any language's first text-based track only if
    none match the preferred language at all.
    """
    candidates = [s for s in streams if s.get("codec_name") in _TEXT_SUBTITLE_CODECS]
    if not candidates:
        return None

    def is_forced(s: Dict) -> bool:
        if s.get("disposition", {}).get("forced") == 1:
            return True
        return "forced" in str(s.get("tags", {}).get("title", "")).lower()

    lang_matches = [s for s in candidates if s.get("tags", {}).get("language") == preferred_language]
    non_forced = [s for s in lang_matches if not is_forced(s)]
    pool = non_forced or lang_matches or candidates

    index = pool[0].get("index")
    return index if isinstance(index, int) else None


def extract_embedded_subtitle(video_path: str, stream_index: int, out_srt_path: str) -> bool:
    """Extract one subtitle stream to a standalone .srt via ffmpeg (thin IO wrapper)."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", video_path, "-map", f"0:{stream_index}", out_srt_path],
            capture_output=True, text=True,
        )
    except FileNotFoundError:
        return False
    return result.returncode == 0 and os.path.isfile(out_srt_path)


def load_discover_state(path: str) -> set:
    """Load the set of already-scanned window keys (see window_key), or empty if no file yet.

    Corrupt/unreadable state is treated as empty rather than raised - losing the memory of
    what's already been scanned just means some windows get redundantly re-judged by the
    model, which is wasteful but harmless. It must never crash the whole run.
    """
    import json

    if not os.path.isfile(path):
        return set()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return set(data) if isinstance(data, list) else set()
    except (OSError, json.JSONDecodeError):
        return set()


def save_discover_state(path: str, visited: set) -> None:
    """Persist the visited-window key set as a JSON array (thin IO wrapper)."""
    import json

    with open(path, "w", encoding="utf-8") as f:
        json.dump(sorted(visited), f, ensure_ascii=False, indent=2)


def find_source_media(source_dir: str) -> List[Dict]:
    """Scan NAS source for {title}/movie.{mp4,mkv,...} + movie.srt folders (thin os wrapper).

    When movie.srt is missing but the video has an embedded text-based subtitle track
    (common for mkv rips), auto-extract it to movie.srt via ffmpeg instead of skipping
    the folder. Videos with only image-based (PGS/VobSub) or burned-in subtitles have no
    text to extract and are skipped - those need a manually supplied movie.srt.
    """
    media: List[Dict] = []
    if not os.path.isdir(source_dir):
        return media
    for name in sorted(os.listdir(source_dir)):
        folder = os.path.join(source_dir, name)
        if not os.path.isdir(folder):
            continue
        video = None
        for ext in _VIDEO_EXTENSIONS:
            candidate = os.path.join(folder, f"movie{ext}")
            if os.path.isfile(candidate):
                video = candidate
                break
        if video is None:
            continue

        srt = os.path.join(folder, "movie.srt")
        if not os.path.isfile(srt):
            stream_index = pick_text_subtitle_stream(probe_subtitle_streams(video))
            if stream_index is None:
                print(f"  skip {name}: no movie.srt and no text-based embedded subtitle track")
                continue
            if not extract_embedded_subtitle(video, stream_index, srt):
                print(f"  skip {name}: found an embedded subtitle track but extraction failed")
                continue
            print(f"  {name}: extracted embedded subtitle track -> movie.srt")

        media.append({"title": name, "video": video, "srt": srt})
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
            media["video"], media["srt"], start, end,
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
            if not is_english_subtitles(subtitles):
                print(f"  skip {media['title']}: subtitle text isn't English (language mismatch)")
                continue
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


# A discovered clip has no topic id yet at cut time (the topic is created together with
# the clip in one call to /discovered, after the file already exists) — name the output
# from the source video + window position instead, which is unique per (video, window).
_SLUG_RE = re.compile(r"[^A-Za-z0-9]+")


def _slugify(text: str) -> str:
    return _SLUG_RE.sub("-", text).strip("-").lower() or "clip"


# Skip windows too short to plausibly contain a real expression, without spending an AI
# call on them — cheap local filter before the network round-trip.
MIN_DISCOVER_WINDOW_CHARS = 40


def _try_next_window_in_video(
    cfg: Config, vs: Dict, visited: set, state_path: str
) -> Optional[Dict]:
    """Advance one video's window cursor, trying windows in order, until it either lands
    a new topic+clip or runs out of windows for this run. Returns None in the latter case.

    Skips already-visited windows, too-short windows, and windows the model judged as not
    good material or the backend already has (409) — all without stopping, since none of
    those should block reaching a *different* video's turn in the round-robin below. Only
    a genuine success (or running out of windows) ends this call.
    """
    media = vs["media"]
    subtitles = vs["subtitles"]
    windows = vs["windows"]

    while vs["next_index"] < len(windows):
        lo, hi = windows[vs["next_index"]]
        vs["next_index"] += 1

        key = window_key(media["title"], lo, hi)
        if key in visited:
            continue

        text = window_dialogue_text(subtitles, lo, hi)
        if len(text) < MIN_DISCOVER_WINDOW_CHARS:
            visited.add(key)
            save_discover_state(state_path, visited)
            continue

        suggestion = fetch_topic_discovery(cfg, text, media["title"])
        visited.add(key)
        save_discover_state(state_path, visited)
        if suggestion is None:
            continue

        start, end = window_bounds(subtitles, lo, hi, pad=cfg.pad)
        output_filename = f"discover-{_slugify(media['title'])}-{lo}-{hi}.mp4"
        ffmpeg_cmd = build_ffmpeg_command(
            media["video"], media["srt"], start, end,
            os.path.join(cfg.output_dir, output_filename),
        )
        code = run_ffmpeg(ffmpeg_cmd)
        if code != 0:
            print(f"  {media['title']} [{lo}:{hi}]: ffmpeg failed (exit {code}), skipping.")
            continue

        clip_url = f"{cfg.clip_url_prefix.rstrip('/')}/{output_filename}"
        payload = {
            "title": suggestion["title"],
            "angle": suggestion["angle"],
            "video_title": media["title"],
            "dialogue_en": text,
            "dialogue_ko": None,
            "start_seconds": start,
            "end_seconds": end,
            "clip_url": clip_url,
        }
        result = post_discovered_clip(cfg, payload)
        if result is None:
            print(f'  {media["title"]} [{lo}:{hi}]: backend already has this clip (409), skipping.')
            continue

        # Cooldown: skip the next few windows in this same video so a later pass (or a
        # future run) doesn't immediately grab the next few seconds of the same
        # conversation — without this, one chatty scene can fill several posts back to
        # back, which reads as repetitive/overlapping to anyone browsing the blog.
        vs["next_index"] += cfg.discover_cooldown_windows
        print(f'  discovered "{suggestion["title"]}" from {media["title"]} [{lo}:{hi}] -> {clip_url}')
        return result

    return None


def discover(cfg: Config) -> List[Dict]:
    """Scan every English-subtitled video's dialogue and let the model pick good
    expressions, creating a topic + its clip together for each one found (the reverse of
    process(): dialogue first, topic second — see module docstring).

    Round-robins across videos instead of exhausting one before moving to the next: each
    pass tries at most one new topic per video, cycling through every video until the
    quota (discover_max_new_topics) is filled or every video has run out of windows.
    Without this, a video with enough "good material" to fill the quota on its own (a
    real case: a show whose early episode alone kept supplying 5+ usable expressions)
    keeps refilling every run from the same neighborhood of windows, and every other
    video — earlier episodes, other shows entirely — is never reached.

    Persists which (video, window) pairs it has already judged (see window_key) to
    discover_state_file, and skips them on every later run — this is what lets a video
    exhausted mid-run pick up where it left off next time instead of restarting at
    window 0.
    """
    state_path = cfg.discover_state_file or os.path.join(cfg.output_dir, "discover_state.json")
    visited = load_discover_state(state_path)

    video_states: List[Dict] = []
    for media in find_source_media(cfg.source_dir):
        subtitles = load_subtitles(media["srt"])
        if not is_english_subtitles(subtitles):
            print(f"  skip {media['title']}: subtitle text isn't English (language mismatch)")
            continue
        windows = build_dialogue_windows(subtitles, window_size=cfg.discover_window_size)
        windows = windows[: cfg.discover_max_windows_per_video]
        video_states.append(
            {"media": media, "subtitles": subtitles, "windows": windows, "next_index": 0}
        )

    created: List[Dict] = []
    progress = True
    while len(created) < cfg.discover_max_new_topics and progress:
        progress = False
        for vs in video_states:
            if len(created) >= cfg.discover_max_new_topics:
                break
            result = _try_next_window_in_video(cfg, vs, visited, state_path)
            if result is not None:
                created.append(result)
                progress = True

    print(f"Done. {len(created)} new topic+clip pair(s) created.")
    return created


def _load_config_from_args() -> Tuple[Config, str]:
    try:
        from dotenv import load_dotenv  # lazy: keeps this module importable without it

        load_dotenv()  # loads .env from CWD before os.getenv() defaults below read it
    except ImportError:
        pass

    parser = argparse.ArgumentParser(description="conversation-clipper (local NAS tool)")
    parser.add_argument(
        "--mode", choices=["discover", "match"], default=os.getenv("CLIPPER_MODE", "discover"),
        help="discover (default): scan dialogue first, let the model pick topics. "
             "match (legacy): match pre-written topics against dialogue.",
    )
    parser.add_argument("--source-dir", default=os.getenv("NAS_SOURCE_DIR"))
    parser.add_argument("--output-dir", default=os.getenv("NAS_OUTPUT_DIR"))
    parser.add_argument("--backend-api-base", default=os.getenv("BACKEND_API_BASE"))
    parser.add_argument("--api-key", default=os.getenv("NAS_TOOL_API_KEY"))
    parser.add_argument("--clip-url-prefix", default=os.getenv("CLIP_URL_PREFIX"))
    parser.add_argument("--context", type=int, default=int(os.getenv("CLIP_CONTEXT", "1")))
    parser.add_argument("--pad", type=float, default=float(os.getenv("CLIP_PAD", "0.3")))
    parser.add_argument(
        "--discover-window-size", type=int,
        default=int(os.getenv("DISCOVER_WINDOW_SIZE", "6")),
    )
    parser.add_argument(
        "--discover-max-windows-per-video", type=int,
        default=int(os.getenv("DISCOVER_MAX_WINDOWS_PER_VIDEO", "40")),
    )
    parser.add_argument(
        "--discover-max-new-topics", type=int,
        default=int(os.getenv("DISCOVER_MAX_NEW_TOPICS", "5")),
    )
    parser.add_argument(
        "--discover-state-file", default=os.getenv("DISCOVER_STATE_FILE"),
        help="Where to persist already-scanned (video, window) pairs across runs. "
             "Defaults to <output-dir>/discover_state.json.",
    )
    parser.add_argument(
        "--discover-cooldown-windows", type=int,
        default=int(os.getenv("DISCOVER_COOLDOWN_WINDOWS", "3")),
        help="After a topic is found in a video, skip this many further windows in that "
             "same video before it's eligible again — keeps one chatty scene from "
             "filling several posts back to back.",
    )
    parser.add_argument(
        "--loop-seconds", type=int,
        default=int(os.getenv("CLIPPER_LOOP_SECONDS", "0")),
        help="0 (default): run once and exit. > 0: run, sleep this many seconds, run "
             "again, forever — lets the container re-scan for new clips on its own "
             "schedule instead of needing an external cron/scheduler to invoke it.",
    )
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
        discover_window_size=args.discover_window_size,
        discover_max_windows_per_video=args.discover_max_windows_per_video,
        discover_max_new_topics=args.discover_max_new_topics,
        discover_state_file=args.discover_state_file,
        discover_cooldown_windows=args.discover_cooldown_windows,
    ), args.mode, args.loop_seconds


def run_once(cfg: Config, mode: str) -> None:
    """Run one discover/process pass, logging a timestamp before and after."""
    started = datetime.now(timezone.utc).isoformat(timespec="seconds")
    print(f"[{started}] starting {mode} run")
    if mode == "discover":
        discover(cfg)
    else:
        process(cfg)
    finished = datetime.now(timezone.utc).isoformat(timespec="seconds")
    print(f"[{finished}] {mode} run finished")


def run_loop(cfg: Config, mode: str, loop_seconds: int) -> None:
    """Run run_once forever, sleeping loop_seconds between runs.

    A single run's exception is caught and logged (with a timestamp, so a look at the
    container's logs shows exactly when and why nothing happened) rather than crashing
    the whole container — `restart: unless-stopped` would otherwise silently re-run
    immediately with no record of the failure, and a persistent problem (e.g. an
    expired API key) would then spin in a tight crash loop instead of waiting for the
    next scheduled interval like a healthy run does.
    """
    while True:
        try:
            run_once(cfg, mode)
        except Exception:
            failed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
            print(f"[{failed_at}] {mode} run failed:")
            traceback.print_exc()
        print(f"sleeping {loop_seconds}s until next run")
        time.sleep(loop_seconds)


def main() -> None:
    cfg, mode, loop_seconds = _load_config_from_args()
    if loop_seconds > 0:
        run_loop(cfg, mode, loop_seconds)
    else:
        run_once(cfg, mode)


if __name__ == "__main__":
    main()
