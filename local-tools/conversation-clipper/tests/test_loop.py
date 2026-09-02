"""run_loop() 반복 실행 테스트.

이 도구는 NAS Container Manager에 배포되어 --loop-seconds 인자로 스스로 주기 실행되는
게 목적이라(compose.yaml 참고), 루프가 한 번의 실패로 통째로 죽지 않는지, 그리고
매 실행 사이에 정확히 sleep_seconds만큼만 쉬는지가 핵심 계약이다.
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import main  # noqa: E402


class _StopLoop(Exception):
    """run_loop()은 무한 루프이므로, N번째 sleep 호출에서 이 예외로 테스트를 빠져나온다."""


def _cfg(tmp_path):
    return main.Config(
        source_dir="unused",
        output_dir=str(tmp_path),
        backend_api_base="http://backend",
        api_key="key",
        clip_url_prefix="https://clips.scanvoca.com",
    )


class TestRunLoop:
    def test_runs_repeatedly_and_sleeps_between_runs(self, tmp_path, monkeypatch):
        calls = {"run": 0, "sleep_args": []}

        def fake_run_once(cfg, mode):
            calls["run"] += 1

        def fake_sleep(seconds):
            calls["sleep_args"].append(seconds)
            if len(calls["sleep_args"]) >= 3:
                raise _StopLoop()

        monkeypatch.setattr(main, "run_once", fake_run_once)
        monkeypatch.setattr(main.time, "sleep", fake_sleep)

        try:
            main.run_loop(_cfg(tmp_path), "discover", 604800)
        except _StopLoop:
            pass

        assert calls["run"] == 3
        assert calls["sleep_args"] == [604800, 604800, 604800]

    def test_a_failed_run_is_caught_and_the_loop_continues(self, tmp_path, monkeypatch):
        """실행 하나가 예외를 던져도 루프 전체가 죽지 않고 다음 실행으로 넘어가야 한다
        (컨테이너가 restart: unless-stopped로 즉시 재시작하며 실패 기록을 남기지 못하는
        대신, 다음 스케줄까지 정상적으로 대기한다)."""
        calls = {"run": 0}

        def flaky_run_once(cfg, mode):
            calls["run"] += 1
            if calls["run"] == 1:
                raise RuntimeError("network blip")

        sleep_calls = []

        def fake_sleep(seconds):
            sleep_calls.append(seconds)
            if len(sleep_calls) >= 2:
                raise _StopLoop()

        monkeypatch.setattr(main, "run_once", flaky_run_once)
        monkeypatch.setattr(main.time, "sleep", fake_sleep)

        try:
            main.run_loop(_cfg(tmp_path), "discover", 100)
        except _StopLoop:
            pass

        assert calls["run"] == 2  # 첫 실행 실패 후에도 두 번째 실행까지 도달
        assert sleep_calls == [100, 100]  # 실패 여부와 무관하게 매번 동일하게 대기

    def test_run_once_invokes_discover_for_discover_mode(self, tmp_path, monkeypatch):
        called = {}
        monkeypatch.setattr(main, "discover", lambda cfg: called.setdefault("discover", cfg))
        monkeypatch.setattr(main, "process", lambda cfg: called.setdefault("process", cfg))

        cfg = _cfg(tmp_path)
        main.run_once(cfg, "discover")

        assert called.get("discover") is cfg
        assert "process" not in called

    def test_run_once_invokes_process_for_match_mode(self, tmp_path, monkeypatch):
        called = {}
        monkeypatch.setattr(main, "discover", lambda cfg: called.setdefault("discover", cfg))
        monkeypatch.setattr(main, "process", lambda cfg: called.setdefault("process", cfg))

        cfg = _cfg(tmp_path)
        main.run_once(cfg, "match")

        assert called.get("process") is cfg
        assert "discover" not in called

    def test_main_runs_once_when_loop_seconds_is_zero(self, tmp_path, monkeypatch):
        monkeypatch.setattr(
            main, "_load_config_from_args", lambda: (_cfg(tmp_path), "discover", 0)
        )
        calls = {"run_once": 0, "run_loop": 0}
        monkeypatch.setattr(main, "run_once", lambda cfg, mode: calls.__setitem__("run_once", calls["run_once"] + 1))
        monkeypatch.setattr(main, "run_loop", lambda cfg, mode, s: calls.__setitem__("run_loop", calls["run_loop"] + 1))

        main.main()

        assert calls == {"run_once": 1, "run_loop": 0}

    def test_main_loops_when_loop_seconds_is_positive(self, tmp_path, monkeypatch):
        monkeypatch.setattr(
            main, "_load_config_from_args", lambda: (_cfg(tmp_path), "discover", 604800)
        )
        calls = {"run_once": 0, "run_loop": 0}
        monkeypatch.setattr(main, "run_once", lambda cfg, mode: calls.__setitem__("run_once", calls["run_once"] + 1))
        monkeypatch.setattr(main, "run_loop", lambda cfg, mode, s: calls.__setitem__("run_loop", calls["run_loop"] + 1))

        main.main()

        assert calls == {"run_once": 0, "run_loop": 1}
