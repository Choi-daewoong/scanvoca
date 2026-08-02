"""discover() 상태 영속화 테스트 — 실운영 버그 재현.

버그: discover()가 실행마다 상태 기억 없이 항상 처음(알파벳 순 첫 영상)부터 다시
훑다 보니, 어떤 영상 하나가 discover_max_new_topics를 스스로 채울 만큼 "좋은 소재"를
계속 내놓으면(예: 에피소드가 많은 시리즈) 그 영상 뒤에 오는 다른 영상들은 하루 할당량이
그 앞 영상에서 매번 소진되어 영원히 도달하지 못한다. 실제로 몇 주간 conversation
파이프라인 글이 전부 한 영상(Emily in Paris)에서만 나왔다.

실행:
    cd local-tools/conversation-clipper && python -m pytest -q
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import main  # noqa: E402


def _cfg(tmp_path, **overrides):
    base = dict(
        source_dir="unused",
        output_dir=str(tmp_path),
        backend_api_base="http://backend",
        api_key="key",
        clip_url_prefix="https://clips.scanvoca.com",
        discover_window_size=6,
        discover_max_windows_per_video=40,
        discover_max_new_topics=1,
        discover_state_file=None,
    )
    base.update(overrides)
    return main.Config(**base)


def _media(title, num_lines=6):
    return {"title": title, "video": f"{title}.mp4", "srt": f"{title}.srt"}


def _subs(num_lines=6):
    return [
        {"index": i, "start": float(i * 3), "end": float(i * 3 + 2), "text": f"real dialogue line number {i}"}
        for i in range(num_lines)
    ]


class TestDiscoverStatePersistence:
    def test_load_discover_state_missing_file_is_empty(self, tmp_path):
        assert main.load_discover_state(str(tmp_path / "nope.json")) == set()

    def test_save_then_load_roundtrips(self, tmp_path):
        path = str(tmp_path / "state.json")
        main.save_discover_state(path, {"A::0-5", "B::0-5"})
        assert main.load_discover_state(path) == {"A::0-5", "B::0-5"}

    def test_corrupt_state_file_treated_as_empty(self, tmp_path):
        path = tmp_path / "state.json"
        path.write_text("not json{{{", encoding="utf-8")
        assert main.load_discover_state(str(path)) == set()

    def test_second_run_skips_already_judged_window(self, tmp_path, monkeypatch):
        """같은 영상 하나만 있는 상황에서, 두 번째 실행은 첫 번째 실행에서 이미 판단한
        구간에 대해 모델을 다시 호출하지 않아야 한다."""
        media = [_media("Emily in Paris S05E01")]
        monkeypatch.setattr(main, "find_source_media", lambda source_dir: media)
        monkeypatch.setattr(main, "load_subtitles", lambda srt: _subs())
        monkeypatch.setattr(main, "is_english_subtitles", lambda subs: True)

        calls = []

        def fake_discovery(cfg, dialogue_en, video_title):
            calls.append(video_title)
            return {"title": "제목", "angle": "앵글"}

        monkeypatch.setattr(main, "fetch_topic_discovery", fake_discovery)
        monkeypatch.setattr(main, "run_ffmpeg", lambda cmd: 0)
        monkeypatch.setattr(
            main, "post_discovered_clip", lambda cfg, payload: {"id": 1, **payload}
        )

        cfg = _cfg(tmp_path, discover_max_new_topics=1)

        main.discover(cfg)
        assert len(calls) == 1  # 1회차: 첫 구간을 판단해 할당량(1개) 소진

        main.discover(cfg)
        # 2회차: 유일한 구간이 이미 방문됨으로 기록돼 있어 모델을 다시 부르지 않는다
        assert len(calls) == 1

    def test_quota_exhausted_on_first_video_still_reaches_second_video_next_run(
        self, tmp_path, monkeypatch
    ):
        """핵심 회귀 테스트: 알파벳상 앞선 영상 하나가 그날의 할당량을 혼자 다 채워도,
        그 구간이 상태에 기록되므로 다음 실행에서는 뒤에 있는 영상까지 도달해야 한다."""
        media = [_media("A Show"), _media("Z Show")]
        monkeypatch.setattr(main, "find_source_media", lambda source_dir: media)
        monkeypatch.setattr(main, "load_subtitles", lambda srt: _subs())
        monkeypatch.setattr(main, "is_english_subtitles", lambda subs: True)

        def fake_discovery(cfg, dialogue_en, video_title):
            return {"title": f"{video_title} 표현", "angle": "앵글"}

        monkeypatch.setattr(main, "fetch_topic_discovery", fake_discovery)
        monkeypatch.setattr(main, "run_ffmpeg", lambda cmd: 0)
        monkeypatch.setattr(
            main, "post_discovered_clip", lambda cfg, payload: {"id": 1, **payload}
        )

        cfg = _cfg(tmp_path, discover_max_new_topics=1)

        first_run = main.discover(cfg)
        assert len(first_run) == 1
        assert first_run[0]["video_title"] == "A Show"  # 할당량이 첫 영상에서 소진됨

        second_run = main.discover(cfg)
        assert len(second_run) == 1
        assert second_run[0]["video_title"] == "Z Show"  # 두 번째 영상까지 도달
