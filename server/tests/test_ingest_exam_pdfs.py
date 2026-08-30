"""
수능/모의고사 PDF 인제스트 파서 테스트 (ingest_exam_pdfs.py)

여기서 테스트하는 함수들은 IO 없는 순수 함수라 실제 PDF 없이 텍스트만으로 검증 가능하다.
"""
from ingest_exam_pdfs import parse_exam_text, validate_parsed_item


class TestParseExamTextNormalCase:
    def test_instruction_line_becomes_question_rest_becomes_passage(self):
        """지시문(한글)이 있는 일반적인 블록은 lines[0]=문제, 나머지=지문으로 정상 분리된다."""
        block = (
            "18. 다음 글의 목적으로 가장 적절한 것은?\n"
            "This is a sample passage that is long enough to pass the length and "
            "English-content checks required by validate_parsed_item for a normal item.\n"
            "①A ②B ③C ④D ⑤E"
        )
        results = parse_exam_text(block)
        assert len(results) == 1
        # split_problems가 선행 "18. " 마커 자체를 정규식 매치로 소비하므로 번호는 남지 않는다.
        assert results[0]["question_text"] == "다음 글의 목적으로 가장 적절한 것은?"
        assert results[0]["passage_text"].startswith("This is a sample passage")
        assert results[0]["choices"] == ["A", "B", "C", "D", "E"]


class TestParseExamTextBlankInferenceRegression:
    """2025 수능 33번 실사고 재현 — 지시문 없이 지문이 바로 시작되는 빈칸 추론 블록."""

    def _build_block(self) -> str:
        # 33번 앞에 별도 한글 지시문 없이 지문이 곧바로 시작되는 실제 사고 상황을 재현.
        return (
            "33. We are famously living in the era of the attention economy,\n"
            "where the largest and most profitable businesses in the world\n"
            "are those that consume my attention, and if you can't see who is\n"
            "paying for something that appears to be free, then it matters a lot.\n"
            "①all of your attention has already been spent\n"
            "②the real product being sold is you\n"
            "③your privacy is being violated\n"
            "④the public may be sponsoring you\n"
            "⑤you owe the benefits to your friend AI"
        )

    def test_hangul_less_question_text_is_rejected_by_validate(self):
        """한글이 없는 question_text는 지문이 잘못 잘려 들어간 것으로 보고 스킵 사유를 반환한다."""
        item = {
            "question_text": "We are famously living in the era of the attention economy,",
            "passage_text": "where the largest and most profitable businesses in the world " * 3,
            "choices": ["A", "B", "C", "D", "E"],
        }
        reason = validate_parsed_item(item)
        assert reason is not None
        assert "Hangul" in reason

    def test_parse_exam_text_skips_the_malformed_block_entirely(self):
        """실제 회귀 재현: 지시문 없는 블록은 parse_exam_text 결과에서 통째로 빠져야 한다
        (잘못된 지문/문제 분리로 라이브 블로그 글이 깨진 사고 — attention-economy 33번)."""
        results = parse_exam_text(self._build_block())
        assert results == []

    def test_normal_hangul_instruction_still_parses_for_same_shape(self):
        """회귀 검사가 정상적인 빈칸 추론 블록(한글 지시문 있음)까지 막지는 않는지 확인."""
        block = (
            "33. 다음 빈칸에 들어갈 말로 가장 적절한 것을 고르시오.\n"
            "We are famously living in the era of the attention economy, where the "
            "largest and most profitable businesses in the world are those that "
            "consume my attention, and if you can't see who is paying for something "
            "that appears to be free, then it matters a lot to everyone involved here.\n"
            "①all of your attention has already been spent\n"
            "②the real product being sold is you\n"
            "③your privacy is being violated\n"
            "④the public may be sponsoring you\n"
            "⑤you owe the benefits to your friend AI"
        )
        results = parse_exam_text(block)
        assert len(results) == 1
        assert results[0]["question_text"] == "다음 빈칸에 들어갈 말로 가장 적절한 것을 고르시오."
        assert results[0]["passage_text"].startswith("We are famously living")
