"""Pure, IO-free helpers for the conversation clipper.

Everything here is deterministic and unit-testable without a NAS, ffmpeg, or the backend:
subtitle representation, keyword-overlap matching, clip-window/timestamp math, and ffmpeg
command-string assembly. All subprocess/network/file IO lives in main.py as thin wrappers.

A subtitle line is a plain dict: {"index": int, "start": float, "end": float, "text": str}
where start/end are seconds. Building these from a .srt file (pysrt) is main.py's job.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

# Keyword tokenizer: alnum + Hangul runs of length >= 2 (same idea as the backend matcher).
_TOKEN_RE = re.compile(r"[0-9A-Za-z가-힣]+")


def tokenize(text: str) -> set:
    """Lowercased keyword tokens (len >= 2) — the unit of the overlap matcher."""
    return {t.lower() for t in _TOKEN_RE.findall(text or "") if len(t) >= 2}


def score_subtitle_match(query: str, subtitle_text: str) -> int:
    """Number of keyword tokens shared between a query (topic title/angle) and a line."""
    q = tokenize(query)
    s = tokenize(subtitle_text)
    if not q or not s:
        return 0
    return len(q & s)


def find_best_subtitle_index(query: str, subtitles: List[Dict]) -> Optional[int]:
    """Index of the highest-overlap subtitle line, or None if nothing overlaps.

    Ties resolve to the earliest line (strict '>' keeps the first max).
    """
    best_index: Optional[int] = None
    best_score = 0
    for i, sub in enumerate(subtitles):
        s = score_subtitle_match(query, sub.get("text", ""))
        if s > best_score:
            best_score = s
            best_index = i
    return best_index


def _window_range(total: int, center_index: int, context: int) -> Tuple[int, int]:
    """Clamped [lo, hi] index range of `context` lines on each side of center."""
    lo = max(0, center_index - context)
    hi = min(total - 1, center_index + context)
    return lo, hi


def compute_clip_bounds(
    subtitles: List[Dict],
    center_index: int,
    context: int = 1,
    pad: float = 0.3,
    min_start: float = 0.0,
) -> Tuple[float, float]:
    """(start, end) seconds spanning the center line + `context` lines each side, padded.

    start is clamped to `min_start` (never negative). end is padded past the last line.
    """
    lo, hi = _window_range(len(subtitles), center_index, context)
    start = subtitles[lo]["start"] - pad
    if start < min_start:
        start = min_start
    end = subtitles[hi]["end"] + pad
    return round(start, 3), round(end, 3)


def collect_dialogue(subtitles: List[Dict], center_index: int, context: int = 1) -> str:
    """Joined text of the center line + `context` lines each side (blank lines dropped)."""
    lo, hi = _window_range(len(subtitles), center_index, context)
    lines = [subtitles[i].get("text", "").strip() for i in range(lo, hi + 1)]
    return "\n".join(ln for ln in lines if ln)


def format_seconds(seconds: float) -> str:
    """ffmpeg-friendly timestamp: plain seconds with millisecond precision."""
    return f"{max(0.0, float(seconds)):.3f}"


def build_ffmpeg_command(
    input_path: str,
    srt_path: str,
    start: float,
    end: float,
    output_path: str,
    burn_subtitles: bool = True,
) -> List[str]:
    """Assemble the ffmpeg argv for cutting [start, end] and burning in subtitles.

    Seeks AFTER -i (output seeking) so the burned-in subtitle timestamps stay in sync with
    the cut (input seeking would desync the subtitles filter). Returns an argv list ready
    for subprocess (never a shell string) so paths with spaces are safe.
    """
    duration = max(0.0, round(float(end) - float(start), 3))
    cmd: List[str] = [
        "ffmpeg",
        "-y",
        "-i",
        input_path,
        "-ss",
        format_seconds(start),
        "-t",
        format_seconds(duration),
    ]
    if burn_subtitles:
        # subtitles filter needs the path single-quoted inside the filter graph.
        cmd += ["-vf", f"subtitles='{srt_path}'"]
    cmd += ["-c:v", "libx264", "-c:a", "aac", output_path]
    return cmd
