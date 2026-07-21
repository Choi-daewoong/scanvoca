"""conversation-clipper 순수 함수 단위 테스트 (NAS/ffmpeg/백엔드 불필요).

실행:
    cd local-tools/conversation-clipper && python -m pytest -q
"""
import os
import sys

# allow "from clipper.matching import ..." when run from this directory
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from clipper.matching import (  # noqa: E402
    tokenize,
    score_subtitle_match,
    find_best_subtitle_index,
    compute_clip_bounds,
    collect_dialogue,
    format_seconds,
    build_ffmpeg_command,
)


SUBS = [
    {"index": 1, "start": 5.0, "end": 7.0, "text": "Hey, how are you doing today"},
    {"index": 2, "start": 7.5, "end": 9.0, "text": "I am looking forward to the weekend"},
    {"index": 3, "start": 9.5, "end": 11.0, "text": "Let's grab a coffee break"},
    {"index": 4, "start": 11.5, "end": 13.0, "text": "Sounds like a great plan"},
]


class TestTokenizeAndScore:
    def test_tokenize_filters_short_tokens(self):
        assert tokenize("a coffee break") == {"coffee", "break"}

    def test_score_counts_shared_tokens(self):
        assert score_subtitle_match("weekend plans", "looking forward to the weekend") == 1
        assert score_subtitle_match("coffee break time", "grab a coffee break") == 2

    def test_score_zero_on_no_overlap(self):
        assert score_subtitle_match("완전히 다른", "totally unrelated line") == 0

    def test_score_zero_on_empty(self):
        assert score_subtitle_match("", "text") == 0
        assert score_subtitle_match("text", "") == 0


class TestFindBest:
    def test_finds_highest_overlap_line(self):
        idx = find_best_subtitle_index("coffee break plan", SUBS)
        # line 3 has both "coffee" and "break" -> score 2, the max
        assert idx == 2

    def test_returns_none_when_no_overlap(self):
        assert find_best_subtitle_index("전혀없는키워드", SUBS) is None

    def test_tie_breaks_to_earliest(self):
        subs = [
            {"index": 1, "start": 0.0, "end": 1.0, "text": "coffee"},
            {"index": 2, "start": 1.0, "end": 2.0, "text": "coffee"},
        ]
        assert find_best_subtitle_index("coffee", subs) == 0


class TestClipBounds:
    def test_window_with_context_and_pad(self):
        start, end = compute_clip_bounds(SUBS, center_index=1, context=1, pad=0.3)
        # lo=0 start 5.0-0.3=4.7 ; hi=2 end 11.0+0.3=11.3
        assert start == 4.7
        assert end == 11.3

    def test_start_pad_applied_when_above_min(self):
        start, _ = compute_clip_bounds(SUBS, center_index=0, context=1, pad=1.0, min_start=0.0)
        assert start == 4.0  # line0 start 5.0 - pad 1.0 = 4.0 (> 0, not clamped)

    def test_start_clamp_near_zero(self):
        subs = [{"index": 1, "start": 0.2, "end": 1.0, "text": "hi"}]
        start, end = compute_clip_bounds(subs, 0, context=1, pad=0.5)
        assert start == 0.0  # 0.2-0.5 = -0.3 clamped to 0
        assert end == 1.5

    def test_context_clamps_at_edges(self):
        start, end = compute_clip_bounds(SUBS, center_index=3, context=5, pad=0.0)
        assert start == 5.0   # lo clamped to 0
        assert end == 13.0    # hi clamped to last


class TestCollectDialogue:
    def test_joins_window_lines(self):
        text = collect_dialogue(SUBS, center_index=1, context=1)
        assert "how are you doing today" in text
        assert "looking forward to the weekend" in text
        assert "coffee break" in text
        assert text.count("\n") == 2  # 3 lines

    def test_single_line_no_context(self):
        text = collect_dialogue(SUBS, center_index=2, context=0)
        assert text == "Let's grab a coffee break"


class TestFfmpegCommand:
    def test_format_seconds(self):
        assert format_seconds(4.7) == "4.700"
        assert format_seconds(-1.0) == "0.000"

    def test_command_structure(self):
        cmd = build_ffmpeg_command(
            "/nas/Friends/movie.mp4", "/nas/Friends/movie.srt",
            start=4.7, end=11.3, output_path="/out/topic-1.mp4",
        )
        assert cmd[0] == "ffmpeg"
        assert "-y" in cmd
        # input before output seeking (-ss after -i)
        i_idx = cmd.index("-i")
        ss_idx = cmd.index("-ss")
        assert i_idx < ss_idx
        assert cmd[cmd.index("-i") + 1] == "/nas/Friends/movie.mp4"
        assert cmd[cmd.index("-ss") + 1] == "4.700"
        # duration = 11.3 - 4.7 = 6.6
        assert cmd[cmd.index("-t") + 1] == "6.600"
        assert "-vf" in cmd
        assert cmd[cmd.index("-vf") + 1] == "subtitles='/nas/Friends/movie.srt'"
        assert cmd[-1] == "/out/topic-1.mp4"

    def test_command_without_subtitles(self):
        cmd = build_ffmpeg_command(
            "in.mp4", "s.srt", 0.0, 5.0, "out.mp4", burn_subtitles=False
        )
        assert "-vf" not in cmd
