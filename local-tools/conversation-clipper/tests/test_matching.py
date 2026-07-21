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


class TestEscapeSubtitlesFilterPath:
    """Real bug found running against an actual NAS mapped drive: an absolute Windows
    path broke ffmpeg's subtitles filter because the drive-letter colon was parsed as
    a filter option separator. Reproduced live - worked with a relative forward-slash
    path, failed with "Z:\\source\\...".
    """

    def test_escapes_windows_drive_colon(self):
        from clipper.matching import escape_subtitles_filter_path

        out = escape_subtitles_filter_path(r"Z:\source\Emily in Paris S05E01\movie.srt")
        assert out == "Z\\:/source/Emily in Paris S05E01/movie.srt"
        assert ":" not in out.replace("\\:", "")  # the only colon left is the escaped one

    def test_unix_style_path_unchanged(self):
        from clipper.matching import escape_subtitles_filter_path

        assert escape_subtitles_filter_path("/nas/Friends/movie.srt") == "/nas/Friends/movie.srt"


class TestFfmpegCommand:
    def test_format_seconds(self):
        assert format_seconds(4.7) == "4.700"
        assert format_seconds(-1.0) == "0.000"

    def test_windows_absolute_path_escaped_in_filter(self):
        cmd = build_ffmpeg_command(
            r"Z:\source\Emily\movie.mkv", r"Z:\source\Emily\movie.srt",
            0.0, 5.0, r"Z:\output\out.mp4",
        )
        vf = cmd[cmd.index("-vf") + 1]
        assert vf == "subtitles='Z\\:/source/Emily/movie.srt'"

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


class TestPickTextSubtitleStream:
    """Pure: choose the best extractable (text-based, language-matched) subtitle stream."""

    def test_picks_subrip_stream(self):
        from main import pick_text_subtitle_stream

        streams = [
            {"index": 2, "codec_name": "subrip", "tags": {"language": "eng"}},
            {"index": 3, "codec_name": "ass", "tags": {"language": "eng"}},
        ]
        assert pick_text_subtitle_stream(streams) == 2

    def test_skips_image_based_pgs(self):
        from main import pick_text_subtitle_stream

        streams = [{"index": 2, "codec_name": "hdmv_pgs_subtitle", "tags": {"language": "eng"}}]
        assert pick_text_subtitle_stream(streams) is None

    def test_no_streams(self):
        from main import pick_text_subtitle_stream

        assert pick_text_subtitle_stream([]) is None

    def test_real_world_45_language_file_picks_english_not_first_stream(self):
        # Reproduces an actual file: English happened to be first here, but the
        # function must not rely on that - assert it's chosen *because* of language.
        from main import pick_text_subtitle_stream

        streams = [
            {"index": 2, "codec_name": "subrip", "tags": {"language": "eng", "title": "English"}},
            {"index": 3, "codec_name": "subrip", "tags": {"language": "eng", "title": "English (forced)"}},
            {"index": 4, "codec_name": "subrip", "tags": {"language": "eng", "title": "English (SDH)"}},
            {"index": 5, "codec_name": "subrip", "tags": {"language": "ara", "title": "Arabic"}},
            {"index": 24, "codec_name": "subrip", "tags": {"language": "kor", "title": "Korean"}},
        ]
        assert pick_text_subtitle_stream(streams) == 2

    def test_korean_first_still_picks_english(self):
        # Order must not matter - only language.
        from main import pick_text_subtitle_stream

        streams = [
            {"index": 2, "codec_name": "subrip", "tags": {"language": "kor"}},
            {"index": 3, "codec_name": "subrip", "tags": {"language": "eng"}},
        ]
        assert pick_text_subtitle_stream(streams) == 3

    def test_skips_forced_when_full_track_available(self):
        from main import pick_text_subtitle_stream

        streams = [
            {"index": 3, "codec_name": "subrip", "tags": {"language": "eng", "title": "English (forced)"},
             "disposition": {"forced": 1}},
            {"index": 2, "codec_name": "subrip", "tags": {"language": "eng", "title": "English"}},
        ]
        assert pick_text_subtitle_stream(streams) == 2

    def test_falls_back_to_forced_when_only_option(self):
        from main import pick_text_subtitle_stream

        streams = [
            {"index": 3, "codec_name": "subrip", "tags": {"language": "eng", "title": "English (forced)"},
             "disposition": {"forced": 1}},
        ]
        assert pick_text_subtitle_stream(streams) == 3

    def test_falls_back_to_other_language_when_preferred_absent(self):
        from main import pick_text_subtitle_stream

        streams = [{"index": 24, "codec_name": "subrip", "tags": {"language": "kor"}}]
        assert pick_text_subtitle_stream(streams) == 24

    def test_custom_preferred_language(self):
        from main import pick_text_subtitle_stream

        streams = [
            {"index": 2, "codec_name": "subrip", "tags": {"language": "eng"}},
            {"index": 24, "codec_name": "subrip", "tags": {"language": "kor"}},
        ]
        assert pick_text_subtitle_stream(streams, preferred_language="kor") == 24


class TestFindSourceMedia:
    """find_source_media accepts non-mp4 containers (ffmpeg reads bytes, not extensions)."""

    def test_finds_mkv_source(self, tmp_path):
        from main import find_source_media

        folder = tmp_path / "Friends"
        folder.mkdir()
        (folder / "movie.mkv").write_bytes(b"fake")
        (folder / "movie.srt").write_text("1\n00:00:01,000 --> 00:00:02,000\nHi\n")

        media = find_source_media(str(tmp_path))
        assert len(media) == 1
        assert media[0]["title"] == "Friends"
        assert media[0]["video"].endswith("movie.mkv")

    def test_auto_extracts_embedded_text_subtitle(self, tmp_path, monkeypatch):
        import main

        folder = tmp_path / "Friends"
        folder.mkdir()
        (folder / "movie.mkv").write_bytes(b"fake")
        # No movie.srt on disk - main.py must extract one from the embedded track.

        monkeypatch.setattr(
            main, "probe_subtitle_streams",
            lambda video: [{"index": 2, "codec_name": "subrip"}],
        )

        def fake_extract(video, stream_index, out_path):
            assert stream_index == 2
            with open(out_path, "w") as f:
                f.write("1\n00:00:01,000 --> 00:00:02,000\nHi\n")
            return True

        monkeypatch.setattr(main, "extract_embedded_subtitle", fake_extract)

        media = main.find_source_media(str(tmp_path))
        assert len(media) == 1
        assert os.path.isfile(folder / "movie.srt")

    def test_skips_when_no_extractable_subtitle(self, tmp_path, monkeypatch):
        import main

        folder = tmp_path / "HardsubOnly"
        folder.mkdir()
        (folder / "movie.mkv").write_bytes(b"fake")
        # No movie.srt, and probe finds only an image-based (PGS) track.

        monkeypatch.setattr(
            main, "probe_subtitle_streams",
            lambda video: [{"index": 2, "codec_name": "hdmv_pgs_subtitle"}],
        )

        assert main.find_source_media(str(tmp_path)) == []

    def test_prefers_mp4_when_both_present(self, tmp_path):
        from main import find_source_media

        folder = tmp_path / "Friends"
        folder.mkdir()
        (folder / "movie.mp4").write_bytes(b"fake")
        (folder / "movie.mkv").write_bytes(b"fake")
        (folder / "movie.srt").write_text("1\n00:00:01,000 --> 00:00:02,000\nHi\n")

        media = find_source_media(str(tmp_path))
        assert media[0]["video"].endswith("movie.mp4")

    def test_skips_folder_without_subtitles(self, tmp_path):
        from main import find_source_media

        folder = tmp_path / "NoSubs"
        folder.mkdir()
        (folder / "movie.mkv").write_bytes(b"fake")

        assert find_source_media(str(tmp_path)) == []

    def test_skips_folder_with_unsupported_video_ext(self, tmp_path):
        from main import find_source_media

        folder = tmp_path / "Weird"
        folder.mkdir()
        (folder / "movie.flv").write_bytes(b"fake")
        (folder / "movie.srt").write_text("1\n00:00:01,000 --> 00:00:02,000\nHi\n")

        assert find_source_media(str(tmp_path)) == []
