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

import pytest  # noqa: E402
import requests  # noqa: E402

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


class TestDiscoverRoundRobinAndCooldown:
    """실사용 버그: 소재가 잘 나오는 영상 하나가 discover_max_new_topics를 혼자 다
    채워서 다른 에피소드/작품이 며칠씩 뒤로 밀리고, 같은 영상 안에서도 바로 이웃한
    구간들이 연달아 뽑혀 블로그에서 봤을 때 같은 장면을 5초 단위로 쪼갠 것처럼
    타이트하게 느껴진다는 사용자 피드백에 대한 수정."""

    def test_round_robins_across_videos_in_the_same_run(self, tmp_path, monkeypatch):
        """A Show 혼자서도 할당량(2)을 채울 구간이 있지만, 라운드로빈이면 A에서 1개
        뽑은 뒤 곧바로 B로 넘어가 1개씩 골고루 나와야 한다(A에서 2개 다 뽑으면 안 됨)."""
        media = [_media("A Show"), _media("B Show")]
        monkeypatch.setattr(main, "find_source_media", lambda source_dir: media)

        def fake_load_subtitles(srt):
            # A Show has 4 windows' worth of lines; B Show has just 1.
            return _subs(24) if "A Show" in srt else _subs(6)

        monkeypatch.setattr(main, "load_subtitles", fake_load_subtitles)
        monkeypatch.setattr(main, "is_english_subtitles", lambda subs: True)
        monkeypatch.setattr(
            main, "fetch_topic_discovery",
            lambda cfg, dialogue_en, video_title: {"title": f"{video_title} 표현", "angle": "앵글"},
        )
        monkeypatch.setattr(main, "run_ffmpeg", lambda cmd: 0)
        monkeypatch.setattr(
            main, "post_discovered_clip", lambda cfg, payload: {"id": 1, **payload}
        )

        cfg = _cfg(tmp_path, discover_max_new_topics=2)
        created = main.discover(cfg)

        assert [c["video_title"] for c in created] == ["A Show", "B Show"]

    def test_cooldown_skips_neighboring_windows_in_same_video(self, tmp_path, monkeypatch):
        """한 구간이 소재로 뽑히면, 같은 영상의 바로 다음 구간들(cooldown 개수만큼)은
        건너뛰고 그 다음 구간부터 다시 후보가 되어야 한다."""
        media = [_media("A Show")]
        monkeypatch.setattr(main, "find_source_media", lambda source_dir: media)
        monkeypatch.setattr(main, "load_subtitles", lambda srt: _subs(48))  # 8 windows
        monkeypatch.setattr(main, "is_english_subtitles", lambda subs: True)
        monkeypatch.setattr(
            main, "fetch_topic_discovery",
            lambda cfg, dialogue_en, video_title: {"title": "표현", "angle": "앵글"},
        )
        monkeypatch.setattr(main, "run_ffmpeg", lambda cmd: 0)
        monkeypatch.setattr(
            main, "post_discovered_clip", lambda cfg, payload: {"id": 1, **payload}
        )

        cfg = _cfg(tmp_path, discover_max_new_topics=2, discover_cooldown_windows=3)
        created = main.discover(cfg)

        assert len(created) == 2
        # window 0 (0-5), then cooldown skips windows 1-3 (6-11, 12-17, 18-23),
        # landing on window 4 (24-29) — not the immediately-next window 1 (6-11).
        assert created[0]["clip_url"].endswith("-0-5.mp4")
        assert created[1]["clip_url"].endswith("-24-29.mp4")


class TestPostDiscoveredClip409Handling:
    """실운영 버그: 백엔드가 clip_url 중복 방지 409를 새로 추가했는데, 클라이언트인
    post_discovered_clip이 이를 처리하지 않고 raise_for_status()로 그대로 예외를
    던져 discover() 전체가 크래시했다(그 실행에서 남은 모든 구간이 통째로 날아감).
    로컬 상태 파일이 아직 서버가 이미 아는 구간을 모르는 첫 실행에서 특히 발생하기
    쉬운 상황이라 반드시 gracefully 처리해야 한다."""

    def test_returns_none_on_409(self, tmp_path, monkeypatch):
        class FakeResp:
            status_code = 409

            def raise_for_status(self):
                raise AssertionError("409 must be handled before raise_for_status() is called")

        monkeypatch.setattr(requests, "post", lambda *a, **k: FakeResp())
        cfg = _cfg(tmp_path)
        assert main.post_discovered_clip(cfg, {"clip_url": "https://x/1.mp4"}) is None

    def test_raises_on_other_http_errors(self, tmp_path, monkeypatch):
        class FakeResp:
            status_code = 500

            def raise_for_status(self):
                raise requests.exceptions.HTTPError("server error")

        monkeypatch.setattr(requests, "post", lambda *a, **k: FakeResp())
        cfg = _cfg(tmp_path)
        with pytest.raises(requests.exceptions.HTTPError):
            main.post_discovered_clip(cfg, {"clip_url": "https://x/1.mp4"})

    def test_discover_skips_409_window_without_crashing(self, tmp_path, monkeypatch):
        """구간 하나가 409(이미 등록됨)를 받아도 discover() 전체가 죽지 않고, 다음
        구간으로 넘어가 계속 새 주제를 찾아야 한다."""
        media = [_media("Emily in Paris S05E01", num_lines=13)]
        monkeypatch.setattr(main, "find_source_media", lambda source_dir: media)
        monkeypatch.setattr(main, "load_subtitles", lambda srt: _subs(13))
        monkeypatch.setattr(main, "is_english_subtitles", lambda subs: True)
        monkeypatch.setattr(main, "run_ffmpeg", lambda cmd: 0)
        monkeypatch.setattr(
            main, "fetch_topic_discovery",
            lambda cfg, dialogue_en, video_title: {"title": "제목", "angle": "앵글"},
        )

        calls = {"n": 0}

        def fake_post(cfg, payload):
            calls["n"] += 1
            if calls["n"] == 1:
                return None  # 첫 구간: 서버가 이미 갖고 있음 (409)
            return {"id": 1, **payload}

        monkeypatch.setattr(main, "post_discovered_clip", fake_post)

        cfg = _cfg(tmp_path, discover_window_size=6, discover_max_new_topics=1)
        created = main.discover(cfg)

        assert calls["n"] == 2  # 첫 구간(409로 스킵) + 두 번째 구간(성공)까지 호출됨
        assert len(created) == 1  # 크래시 없이, 성공한 구간만 결과에 포함
