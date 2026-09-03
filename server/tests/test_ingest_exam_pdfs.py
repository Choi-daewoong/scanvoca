"""
수능/모의고사 PDF 인제스트 테스트 (ingest_exam_pdfs.py)

두 갈래를 다룬다:
1. --answers-only(정답 백필) 경로가 계속 쓰는 pdfplumber 기반 순수 함수들 —
   컬럼 재구성, 밑줄 감지, 정답표 폼 분리/파싱 (실제 PDF 없이 좌표·문자열로 검증).
2. AI 기반 메인 인제스트 경로 — 추출 결과 검증기(validate_extracted_item), 배치 계획
   (_plan_batches), 그리고 GeminiService를 스텁으로 갈아끼운 ingest() 오케스트레이션.

구 regex 지문 파서(split_problems/parse_choices/parse_exam_text/...) 전용 테스트는 그
함수들과 함께 삭제됐다.
"""
import pytest

from app.models.exam_passage import ExamPassage


class TestColumnAwareReconstruction:
    """ingest_exam_pdfs.py 2단 레이아웃 재조합 순수 함수 (실제 PDF 없이 좌표로)."""

    @staticmethod
    def _word(text, x0, x1, top):
        return {"text": text, "x0": x0, "x1": x1, "top": top, "bottom": top + 10}

    def test_find_gutter_x_detects_clear_gap(self):
        from ingest_exam_pdfs import find_gutter_x
        # Both columns' centers must fall in the middle 30~70% band (240~560 of an
        # 800-wide page) for find_gutter_x to consider them — mirrors a real 2-column
        # layout where neither column hugs the page edge.
        words = [
            self._word("left", 260, 300, 10),
            self._word("col", 260, 300, 20),
            self._word("right", 500, 540, 10),
            self._word("col", 500, 540, 20),
        ]
        gutter = find_gutter_x(words, page_width=800)
        assert gutter is not None
        assert 300 < gutter < 500

    def test_find_gutter_x_none_for_single_column(self):
        from ingest_exam_pdfs import find_gutter_x
        # Words spread evenly across the middle band with no real gap.
        words = [self._word(f"w{i}", 300 + i * 12, 300 + i * 12 + 10, 10) for i in range(10)]
        assert find_gutter_x(words, page_width=800) is None

    def test_reconstruct_page_text_orders_left_column_before_right(self):
        from ingest_exam_pdfs import reconstruct_page_text
        # Column centers within the 30~70% band (see test_find_gutter_x_detects_clear_gap).
        words = [
            self._word("RightTop", 500, 540, 10),
            self._word("LeftTop", 260, 300, 10),
            self._word("LeftBottom", 260, 300, 50),
            self._word("RightBottom", 500, 540, 50),
        ]
        out = reconstruct_page_text(words, page_width=800)
        # Entire left column (top-to-bottom) must precede the entire right column.
        assert out.index("LeftBottom") < out.index("RightTop")
        assert out.index("LeftTop") < out.index("LeftBottom")
        assert out.index("RightTop") < out.index("RightBottom")

    def test_reconstruct_page_text_single_column_reading_order(self):
        from ingest_exam_pdfs import reconstruct_page_text
        words = [
            self._word("Second", 305, 340, 20),
            self._word("First", 300, 340, 10),
        ]
        out = reconstruct_page_text(words, page_width=800)
        assert out.index("First") < out.index("Second")

    def test_strip_page_furniture_removes_footer_lines(self):
        from ingest_exam_pdfs import strip_page_furniture
        text = (
            "20. 다음 글에서 필자가 주장하는 바로 가장 적절한 것은?\n"
            "Values alone do not create and build culture.\n"
            "⑤ 조직의 문화 형성에는 명시적 지침이 필요하다.\n"
            "8\n"
            "이 문제지에 관한 저작권은 한국교육과정평가원에 있습니다.\n"
            "홀수형\n"
            "21. 다음 빈칸에 들어갈 말로 가장 적절한 것은?\n"
        )
        out = strip_page_furniture(text)
        assert "저작권" not in out
        assert "홀수형" not in out
        assert "\n8\n" not in out
        assert "Values alone" in out
        assert "21. 다음 빈칸" in out

    def test_strip_page_furniture_keeps_real_content(self):
        from ingest_exam_pdfs import strip_page_furniture
        text = "18. Some question\nA passage that happens to end in the number 8 like this.\n"
        out = strip_page_furniture(text)
        assert "A passage that happens to end in the number 8 like this." in out


class TestUnderlineDetection:
    """수능 '밑줄 친 부분 중' 유형 — pdfplumber lines/rects로 밑줄 스트로크를 감지해
    passage_text에 <u>...</u>로 살리는 순수 함수 (실제 PDF 없이 좌표로 검증)."""

    @staticmethod
    def _word(text, x0, x1, top, bottom=None):
        return {"text": text, "x0": x0, "x1": x1, "top": top, "bottom": bottom or top + 10}

    @staticmethod
    def _shape(x0, x1, top, bottom):
        return {"x0": x0, "x1": x1, "top": top, "bottom": bottom}

    def test_is_underline_shape_accepts_thin_wide_stroke(self):
        from ingest_exam_pdfs import is_underline_shape
        assert is_underline_shape(x0=100, x1=140, top=20, bottom=20.5) is True

    def test_is_underline_shape_rejects_tall_box(self):
        from ingest_exam_pdfs import is_underline_shape
        # A filled choice-letter box or table cell is thin in neither dimension.
        assert is_underline_shape(x0=100, x1=140, top=10, bottom=30) is False

    def test_is_underline_shape_rejects_full_page_divider(self):
        from ingest_exam_pdfs import is_underline_shape
        assert is_underline_shape(x0=0, x1=595, top=50, bottom=50.3) is False

    def test_word_is_underlined_true_when_stroke_just_below_baseline(self):
        from ingest_exam_pdfs import word_is_underlined
        word = self._word("report", x0=100, x1=140, top=10, bottom=20)
        shapes = [self._shape(x0=99, x1=141, top=21, bottom=21.5)]
        assert word_is_underlined(word, shapes) is True

    def test_word_is_underlined_false_when_stroke_above_baseline(self):
        from ingest_exam_pdfs import word_is_underlined
        # A stroke ABOVE the baseline is a strikethrough or unrelated line, not an underline.
        word = self._word("report", x0=100, x1=140, top=10, bottom=20)
        shapes = [self._shape(x0=99, x1=141, top=9, bottom=9.5)]
        assert word_is_underlined(word, shapes) is False

    def test_word_is_underlined_false_when_too_far_below(self):
        from ingest_exam_pdfs import word_is_underlined
        word = self._word("report", x0=100, x1=140, top=10, bottom=20)
        shapes = [self._shape(x0=99, x1=141, top=40, bottom=40.5)]
        assert word_is_underlined(word, shapes) is False

    def test_word_is_underlined_false_when_no_horizontal_overlap(self):
        from ingest_exam_pdfs import word_is_underlined
        word = self._word("report", x0=100, x1=140, top=10, bottom=20)
        shapes = [self._shape(x0=300, x1=340, top=21, bottom=21.5)]
        assert word_is_underlined(word, shapes) is False

    def test_words_to_text_wraps_single_underlined_word(self):
        from ingest_exam_pdfs import _words_to_text
        words = [
            self._word("The", x0=50, x1=80, top=10, bottom=20),
            self._word("report", x0=85, x1=130, top=10, bottom=20),
            self._word("was", x0=135, x1=165, top=10, bottom=20),
        ]
        shapes = [self._shape(x0=84, x1=131, top=21, bottom=21.5)]
        out = _words_to_text(words, shapes)
        assert out == "The <u>report</u> was"

    def test_words_to_text_merges_contiguous_underlined_run(self):
        from ingest_exam_pdfs import _words_to_text
        words = [
            self._word("was", x0=50, x1=80, top=10, bottom=20),
            self._word("submitted", x0=85, x1=150, top=10, bottom=20),
            self._word("late", x0=155, x1=185, top=10, bottom=20),
        ]
        # One continuous stroke spans "submitted late".
        shapes = [self._shape(x0=84, x1=186, top=21, bottom=21.5)]
        out = _words_to_text(words, shapes)
        assert out == "was <u>submitted late</u>"

    def test_words_to_text_no_underline_shapes_unchanged(self):
        from ingest_exam_pdfs import _words_to_text
        words = [self._word("plain", x0=50, x1=90, top=10, bottom=20)]
        assert _words_to_text(words) == "plain"

    def test_reconstruct_page_text_splits_underline_shapes_by_column(self):
        from ingest_exam_pdfs import reconstruct_page_text
        words = [
            self._word("LeftWord", x0=260, x1=300, top=10, bottom=20),
            self._word("RightWord", x0=500, x1=540, top=10, bottom=20),
        ]
        # Underline only under the right-column word.
        shapes = [self._shape(x0=499, x1=541, top=21, bottom=21.5)]
        out = reconstruct_page_text(words, page_width=800, underline_shapes=shapes)
        assert "<u>RightWord</u>" in out
        assert "<u>LeftWord</u>" not in out

    def test_extract_form_section_splits_odd_then_even(self):
        from ingest_exam_pdfs import extract_form_section
        text = (
            "2022학년도 대학수학능력시험\n영어 영역 정답표\n( 홀수 )형\n"
            "1 ⑤ 2 13 ③ 3\n"
            "2022학년도 대학수학능력시험\n영어 영역 정답표\n( 짝수 )형\n"
            "1 ⑤ 2 13 ③ 3\n2 ④ 2"
        )
        odd = extract_form_section(text, "홀수형")
        even = extract_form_section(text, "짝수형")
        assert "홀수" in odd and "짝수" not in odd
        assert "짝수" in even
        assert "2 ④ 2" in even and "2 ④ 2" not in odd

    def test_extract_form_section_no_markers_returns_whole_text(self):
        from ingest_exam_pdfs import extract_form_section
        text = "1 ⑤ 2 13 ③ 3"
        assert extract_form_section(text, "홀수형") == text

    def test_parse_answers_after_form_split_does_not_leak_other_form(self):
        from ingest_exam_pdfs import extract_form_section, parse_answers_text
        # Same problem number, different answer letter per form — the real-world bug
        # this whole split exists to prevent (choices are reordered between forms).
        text = "( 홀수 )형\n2 ② 2\n( 짝수 )형\n2 ④ 2"
        odd_answers = parse_answers_text(extract_form_section(text, "홀수형"))
        even_answers = parse_answers_text(extract_form_section(text, "짝수형"))
        assert odd_answers[2] == "2"
        assert even_answers[2] == "4"

    def test_collect_underline_shapes_filters_lines_and_rects(self):
        from ingest_exam_pdfs import collect_underline_shapes
        lines_objs = [
            {"x0": 100, "x1": 140, "top": 20, "bottom": 20.3},  # plausible underline
            {"x0": 0, "x1": 595, "top": 50, "bottom": 50.2},  # page divider, too wide
        ]
        rects_objs = [
            {"x0": 200, "x1": 230, "top": 30, "bottom": 30.4},  # plausible underline
            {"x0": 200, "x1": 230, "top": 30, "bottom": 50},  # filled box, too tall
        ]
        shapes = collect_underline_shapes(lines_objs, rects_objs)
        assert len(shapes) == 2
        assert {round(s["x0"]) for s in shapes} == {100, 200}


class TestAnswerSheetParsing:
    """정답표 파싱 — --answers-only(backfill_answers) 경로가 계속 쓰는 순수 함수."""

    def test_parse_answers_text(self):
        from ingest_exam_pdfs import parse_answers_text
        answers = parse_answers_text("18 ③\n19. 1\n20) ⑤")
        assert answers[18] == "3"
        assert answers[19] == "1"
        assert answers[20] == "5"

    def test_parse_answers_text_flattened_multi_column_row(self):
        """실운영 버그: 실제 KICE 정답표는 "번호 정답 배점"이 한 줄에 4묶음씩 붙어 나온다
        (예: "1 ⑤ 2 13 ③ 3 25 ④ 2 37 ⑤ 3"). 배점(단일 숫자) 바로 뒤에 다음 문항번호가
        붙으면, 배점+문항번호 앞자리를 자기 자신의 (번호, 정답) 쌍으로 오인해 그 뒤 모든
        항목이 밀리는 실제 사고가 있었다(2022 수능 지문 전체 감사에서 발견). 4묶음 모두
        정확히 파싱되는지 확인."""
        from ingest_exam_pdfs import parse_answers_text
        answers = parse_answers_text("1 ⑤ 2 13 ③ 3 25 ④ 2 37 ⑤ 3")
        assert answers == {1: "5", 13: "3", 25: "4", 37: "5"}


# =============================================================================
# AI 추출 결과 검증 (validate_extracted_item)
# =============================================================================

# 영어 지문 최소 분량(라틴 문자 40자) 검사를 넉넉히 넘기는 표준 지문 본문.
_ENGLISH_PASSAGE = (
    "Attention is the scarcest resource of the modern economy, and the businesses that "
    "profit most are the ones that capture it most efficiently."
)


def _img(x0, top, x1, bottom):
    return {"x0": x0, "top": top, "x1": x1, "bottom": bottom}


class TestComputeChartCropBbox:
    """pdfplumber page.images 좌표만으로 도표 이미지 클러스터를 골라내는 순수 함수.
    좌표는 2026 수능 영어영역 문제지 PDF 4페이지(25번 도표가 왼쪽 칼럼에, 27번 안내문이
    오른쪽 칼럼에 있음)에서 실측한 값을 기반으로 한다."""

    PAGE_WIDTH = 842.0
    PAGE_HEIGHT = 1191.0

    def test_picks_the_larger_cluster_over_a_small_unrelated_image_on_the_same_side(self):
        """같은 쪽(왼쪽)에 있어도 세로로 멀리 떨어진 작은 이미지(예: 페이지 상단 로고)는
        도표 클러스터에 안 섞이고, 더 큰 클러스터가 선택돼야 한다."""
        from ingest_exam_pdfs import compute_chart_crop_bbox
        small_unrelated = _img(150.0, 20.0, 250.0, 45.0)  # 도표와 멀리 떨어진 상단 로고
        chart_top = _img(105.9, 189.96, 398.7, 339.0)
        chart_bottom = _img(105.9, 339.0, 398.7, 388.56)  # chart_top에 바로 이어붙음

        bbox = compute_chart_crop_bbox(
            [small_unrelated, chart_top, chart_bottom], self.PAGE_WIDTH, self.PAGE_HEIGHT, "left"
        )
        assert bbox is not None
        x0, top, x1, bottom = bbox
        assert top > 150  # 로고(top=20)가 아니라 도표(top=189.96) 쪽이 선택됨
        assert bottom > 380  # 도표 두 조각을 다 포함

    def test_ignores_images_on_the_other_side_of_the_page(self):
        from ingest_exam_pdfs import compute_chart_crop_bbox
        left_chart = _img(105.9, 189.96, 398.7, 339.0)
        right_notice = _img(447.84, 199.38, 753.96, 393.54)

        x0, top, x1, bottom = compute_chart_crop_bbox(
            [left_chart, right_notice], self.PAGE_WIDTH, self.PAGE_HEIGHT, "left"
        )
        assert x1 < 420

    def test_right_side_selects_only_right_images(self):
        from ingest_exam_pdfs import compute_chart_crop_bbox
        left_chart = _img(105.9, 189.96, 398.7, 339.0)
        right_notice = _img(447.84, 199.38, 753.96, 393.54)

        x0, top, x1, bottom = compute_chart_crop_bbox(
            [left_chart, right_notice], self.PAGE_WIDTH, self.PAGE_HEIGHT, "right"
        )
        assert x0 > 420

    def test_full_width_considers_every_image_regardless_of_side(self):
        from ingest_exam_pdfs import compute_chart_crop_bbox
        left_img = _img(50.0, 100.0, 150.0, 200.0)
        right_img = _img(700.0, 100.0, 800.0, 200.0)
        x0, top, x1, bottom = compute_chart_crop_bbox(
            [left_img, right_img], self.PAGE_WIDTH, self.PAGE_HEIGHT, "full_width"
        )
        assert x0 < 60 and x1 > 790  # 양쪽 다 포함해서 하나로 합쳐짐

    def test_returns_none_when_that_side_has_no_images(self):
        from ingest_exam_pdfs import compute_chart_crop_bbox
        right_only = [_img(447.84, 199.38, 753.96, 393.54)]
        assert compute_chart_crop_bbox(right_only, self.PAGE_WIDTH, self.PAGE_HEIGHT, "left") is None
        assert compute_chart_crop_bbox([], self.PAGE_WIDTH, self.PAGE_HEIGHT, "full_width") is None

    def test_crop_box_padding_is_clamped_to_page_bounds(self):
        """padding 때문에 페이지 경계 밖으로 나가면 pdfplumber page.crop()이 예외를 던지므로
        반드시 0..page_width / 0..page_height 안으로 잘려야 한다."""
        from ingest_exam_pdfs import compute_chart_crop_bbox
        corner_image = _img(0.0, 0.0, 50.0, 50.0)
        x0, top, x1, bottom = compute_chart_crop_bbox(
            [corner_image], self.PAGE_WIDTH, self.PAGE_HEIGHT, "left"
        )
        assert x0 == 0.0 and top == 0.0


def _standard_item(**overrides):
    """검증을 통과하는 standard 유형 기준 아이템 — 테스트마다 필드 하나씩만 망가뜨린다."""
    item = {
        "problem_number": 33,
        "problem_type": "standard",
        "passage_group": [],
        "passage_text": _ENGLISH_PASSAGE,
        "question_text": "다음 빈칸에 들어갈 말로 가장 적절한 것은?",
        "choices": ["첫째", "둘째", "셋째", "넷째", "다섯째"],
        "answer": "2",
        "explanation": "빈칸 앞뒤의 인과 관계로 보아 ②가 정답이며, 나머지는 근거가 없다.",
        "tags": ["빈칸추론", "경제"],
    }
    item.update(overrides)
    return item


class TestValidateExtractedItem:
    def test_accepts_standard_item(self):
        from ingest_exam_pdfs import validate_extracted_item
        assert validate_extracted_item(_standard_item()) is None

    def test_rejects_hangul_less_question_text(self):
        """2025 수능 33번 실사고 재현 — 지문 첫 문장이 question_text로 잘못 들어간 모양.
        구 파서에서 이 형태가 라이브 블로그 글을 깨뜨렸으므로, AI 출력에도 같은 안전망을
        건다(모델이 지시문 대신 영어 문장을 넣어버리는 경우)."""
        from ingest_exam_pdfs import validate_extracted_item
        reason = validate_extracted_item(_standard_item(
            question_text="We are famously living in the era of the attention economy,",
        ))
        assert reason is not None
        assert "Hangul" in reason

    def test_rejects_unrecognized_problem_type(self):
        from ingest_exam_pdfs import validate_extracted_item
        reason = validate_extracted_item(_standard_item(problem_type="summary"))
        assert reason is not None
        assert "problem_type" in reason

    def test_rejects_wrong_choice_count(self):
        from ingest_exam_pdfs import validate_extracted_item
        reason = validate_extracted_item(_standard_item(choices=["a", "b", "c"]))
        assert reason is not None
        assert "choice count" in reason

    def test_rejects_answer_outside_one_to_five(self):
        from ingest_exam_pdfs import validate_extracted_item
        assert validate_extracted_item(_standard_item(answer="6")) is not None
        assert validate_extracted_item(_standard_item(answer="②")) is not None

    def test_accepts_missing_answer(self):
        # 정답표 PDF 없이 인제스트하는 경우도 있으므로 answer=None 자체는 정상이다.
        from ingest_exam_pdfs import validate_extracted_item
        assert validate_extracted_item(_standard_item(answer=None)) is None

    def test_rejects_missing_explanation(self):
        from ingest_exam_pdfs import validate_extracted_item
        assert validate_extracted_item(_standard_item(explanation="")) is not None
        assert validate_extracted_item(_standard_item(explanation="No Hangul here.")) is not None

    def test_rejects_swallowed_passage_as_choice(self):
        from ingest_exam_pdfs import validate_extracted_item
        reason = validate_extracted_item(_standard_item(
            choices=["short", "short", "short", "short", "x" * 300],
        ))
        assert reason is not None

    def test_rejects_listening_fragment_passage(self):
        from ingest_exam_pdfs import validate_extracted_item
        reason = validate_extracted_item(_standard_item(
            passage_text="적절한 것을 고르시오. [3점] 남자의 응답으로 가장 알맞은 것은? Man:",
        ))
        assert reason is not None
        assert "English" in reason

    def test_accepts_underline_choice_item(self):
        from ingest_exam_pdfs import validate_extracted_item
        item = _standard_item(
            problem_type="underline_choice",
            question_text="다음 글의 밑줄 친 부분 중, 어법상 틀린 것은?",
            passage_text=(
                "A cell is born as a twin when its mother cell <u>divides</u>, producing two "
                "daughter cells that <u>grows</u> until it becomes as large as the mother "
                "cell <u>was</u>. The cell then <u>matures</u> and differentiates into a "
                "specialized cell <u>involving</u> parts."
            ),
            choices=["divides", "grows", "was", "matures", "involving"],
        )
        assert validate_extracted_item(item) is None

    # --- 구 regex 파서가 아예 표현조차 못 하던 두 유형 ---

    def test_accepts_paragraph_order_item(self):
        """글의 순서 배열형 — 구 파서는 이 유형을 통째로 스킵했다(스키마상 표현 불가)."""
        from ingest_exam_pdfs import validate_extracted_item
        item = _standard_item(
            problem_number=36,
            problem_type="paragraph_order",
            question_text="주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?",
            passage_text=(
                "Everyone knows a company needs a strategy.\n"
                "(A) But the first step is to define the market.\n"
                "(B) That definition then guides every later choice.\n"
                "(C) Only afterwards can resources be allocated well."
            ),
            choices=[
                "(A) - (C) - (B)",
                "(B) - (A) - (C)",
                "(B) - (C) - (A)",
                "(C) - (A) - (B)",
                "(C) - (B) - (A)",
            ],
            answer="2",
        )
        assert validate_extracted_item(item) is None

    def test_rejects_paragraph_order_missing_labels(self):
        from ingest_exam_pdfs import validate_extracted_item
        item = _standard_item(
            problem_type="paragraph_order",
            question_text="주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?",
            passage_text="Everyone knows a company needs a strategy.\n(A) First define it.",
            choices=[
                "(A) - (C) - (B)", "(B) - (A) - (C)", "(B) - (C) - (A)",
                "(C) - (A) - (B)", "(C) - (B) - (A)",
            ],
        )
        reason = validate_extracted_item(item)
        assert reason is not None
        assert "(A)(B)(C)" in reason

    def test_rejects_paragraph_order_with_non_permutation_choices(self):
        from ingest_exam_pdfs import validate_extracted_item
        item = _standard_item(
            problem_type="paragraph_order",
            question_text="주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?",
            passage_text="Intro.\n(A) first.\n(B) second.\n(C) third.",
            choices=["첫째", "둘째", "셋째", "넷째", "다섯째"],
        )
        assert validate_extracted_item(item) is not None

    def test_accepts_embedded_marker_item(self):
        """무관한 문장 찾기 / 문장 삽입 — ①~⑤가 지문 안에 박힌 채로 보존돼야 한다."""
        from ingest_exam_pdfs import validate_extracted_item
        item = _standard_item(
            problem_number=35,
            problem_type="embedded_marker",
            question_text="다음 글에서 전체 흐름과 관계 없는 문장은?",
            passage_text=(
                "Since their introduction, information systems have changed business. "
                "① Networks now cover every unit of a firm. "
                "② Managers rely on dashboards rather than reports. "
                "③ The city council recently repaved the main street. "
                "④ Decisions therefore travel faster than before. "
                "⑤ Feedback loops shorten with each new tool."
            ),
            choices=[
                "Networks now cover every unit of a firm.",
                "Managers rely on dashboards rather than reports.",
                "The city council recently repaved the main street.",
                "Decisions therefore travel faster than before.",
                "Feedback loops shorten with each new tool.",
            ],
            answer="3",
        )
        assert validate_extracted_item(item) is None

    def test_rejects_embedded_marker_without_embedded_markers(self):
        """마커를 지문에서 떼어내 목록으로 빼버린 출력은 유형의 의미가 사라지므로 거부."""
        from ingest_exam_pdfs import validate_extracted_item
        item = _standard_item(
            problem_type="embedded_marker",
            question_text="다음 글에서 전체 흐름과 관계 없는 문장은?",
            passage_text=_ENGLISH_PASSAGE,
            choices=["a", "b", "c", "d", "e"],
        )
        reason = validate_extracted_item(item)
        assert reason is not None
        assert "embedded" in reason

    # --- 도표(chart) 유형 — 2026 수능 25번 실사고(도표 없이 지어낸 수치로 발행) 재발 방지 ---

    def _chart_item(self, **overrides):
        item = _standard_item(
            problem_type="chart",
            question_text="다음 도표의 내용과 일치하지 않는 것은?",
            passage_text=(
                "The graph above shows the percentages of U.S. teenagers who spent time "
                "with friends by communication type.\n"
                "[도표 데이터] Text Messaging: Every Day 55%, Less Often 13% / "
                "Talking on the Phone: Every Day 19%, Less Often 41%"
            ),
            chart_page=4,
            chart_side="left",
        )
        item.update(overrides)
        return item

    def test_accepts_chart_item_with_page_and_side(self):
        from ingest_exam_pdfs import validate_extracted_item
        assert validate_extracted_item(self._chart_item()) is None

    def test_rejects_chart_item_missing_chart_page(self):
        """chart_page가 없으면 어느 쪽을 잘라야 할지 알 수 없어 이미지를 못 만든다 —
        이미지 없이 조용히 들어가면 사고가 재발하므로 아예 거부한다."""
        from ingest_exam_pdfs import validate_extracted_item
        reason = validate_extracted_item(self._chart_item(chart_page=None))
        assert reason is not None
        assert "chart_page" in reason

    def test_rejects_chart_item_with_invalid_chart_page(self):
        from ingest_exam_pdfs import validate_extracted_item
        assert validate_extracted_item(self._chart_item(chart_page=0)) is not None
        assert validate_extracted_item(self._chart_item(chart_page="4")) is not None

    def test_rejects_chart_item_missing_chart_side(self):
        from ingest_exam_pdfs import validate_extracted_item
        reason = validate_extracted_item(self._chart_item(chart_side=None))
        assert reason is not None
        assert "chart_side" in reason

    def test_rejects_chart_item_with_invalid_chart_side(self):
        from ingest_exam_pdfs import validate_extracted_item
        assert validate_extracted_item(self._chart_item(chart_side="center")) is not None


# =============================================================================
# 배치 계획 (_plan_batches)
# =============================================================================

class TestPlanBatches:
    def test_respects_batch_size(self):
        from ingest_exam_pdfs import _plan_batches
        manifest = [{"problem_number": n, "passage_group": []} for n in range(18, 31)]
        batches = _plan_batches(manifest, batch_size=6)
        assert all(len(b) <= 6 for b in batches)
        assert [n for b in batches for n in b] == list(range(18, 31))

    def test_never_splits_a_passage_group(self):
        """장문독해 세트(41-42)는 배치 크기가 아무리 작아도 같은 배치에 들어가야 한다 —
        한 지문을 반쪽만 본 모델이 나머지 문항을 엉뚱하게 채우는 걸 막는다."""
        from ingest_exam_pdfs import _plan_batches
        manifest = [
            {"problem_number": 40, "passage_group": []},
            {"problem_number": 41, "passage_group": [41, 42]},
            {"problem_number": 42, "passage_group": [41, 42]},
        ]
        batches = _plan_batches(manifest, batch_size=2)
        owner = [b for b in batches if 41 in b]
        assert len(owner) == 1
        assert 42 in owner[0]
        assert [n for b in batches for n in b] == [40, 41, 42]

    def test_group_members_are_not_emitted_twice(self):
        from ingest_exam_pdfs import _plan_batches
        manifest = [
            {"problem_number": 41, "passage_group": [41, 42]},
            {"problem_number": 42, "passage_group": [41, 42]},
        ]
        assert _plan_batches(manifest, batch_size=6) == [[41, 42]]

    def test_empty_manifest_gives_no_batches(self):
        from ingest_exam_pdfs import _plan_batches
        assert _plan_batches([], batch_size=6) == []


# =============================================================================
# ingest() 오케스트레이션 (GeminiService 스텁 + 테스트 DB)
# =============================================================================

class _FakeManifestEntry:
    """scan_exam_pdf_manifest의 반환 원소(ExamManifestEntry) 흉내 — ingest()는
    .model_dump()만 호출한다."""

    def __init__(self, data):
        self._data = data

    def model_dump(self):
        return dict(self._data)


def _manifest(*entries):
    return [_FakeManifestEntry(e) for e in entries]


@pytest.fixture
def stub_gemini(monkeypatch):
    """GeminiService의 두 추출 메서드를 스텁으로 갈아끼우고, 배치별 반환값을 지정한다.

    반환값 map: {(문항번호 튜플): [item dict, ...] 또는 None(배치 전체 실패)}
    """
    from app.services import gemini_service as gs

    state = {"manifest": [], "batches": {}, "calls": []}

    async def fake_scan(self, exam_pdf_bytes):
        return state["manifest"]

    async def fake_extract(self, exam_pdf_bytes, answers_pdf_bytes, problem_numbers, form="홀수형"):
        key = tuple(problem_numbers)
        state["calls"].append(key)
        result = state["batches"].get(key, [])
        if result is None:
            return None
        return [_FakeManifestEntry(item) for item in result]

    monkeypatch.setattr(gs.GeminiService, "scan_exam_pdf_manifest", fake_scan)
    monkeypatch.setattr(gs.GeminiService, "extract_exam_problems_from_pdfs", fake_extract)
    return state


@pytest.fixture
def ingest_env(db_session, monkeypatch, stub_gemini):
    """ingest()의 함수 내부 `from app.core.database import SessionLocal`을 테스트용
    in-memory 엔진으로 돌리고(=db_session과 같은 커넥션), PDF 파일 읽기도 스텁한다."""
    import pathlib
    from tests.conftest import TestingSessionLocal
    from app.core import database as db_module

    monkeypatch.setattr(db_module, "SessionLocal", TestingSessionLocal)
    monkeypatch.setattr(pathlib.Path, "read_bytes", lambda self: b"%PDF-fake")
    return stub_gemini


def _run_ingest(**overrides):
    import ingest_exam_pdfs
    kwargs = {
        "pdf_path": "fake.pdf",
        "year": 2025,
        "exam_type": "수능",
        "source_label": "2025학년도 수능 영어",
        "month": None,
    }
    kwargs.update(overrides)
    ingest_exam_pdfs.ingest(**kwargs)


class TestIngestOrchestration:
    def test_inserts_valid_items_with_problem_type(self, db_session, ingest_env):
        ingest_env["manifest"] = _manifest(
            {"problem_number": 33, "problem_type": "standard", "passage_group": []},
            {"problem_number": 36, "problem_type": "paragraph_order", "passage_group": []},
        )
        ingest_env["batches"][(33, 36)] = [
            _standard_item(problem_number=33),
            _standard_item(
                problem_number=36,
                problem_type="paragraph_order",
                question_text="주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?",
                passage_text="Intro sentence.\n(A) first.\n(B) second.\n(C) third.",
                choices=[
                    "(A) - (C) - (B)", "(B) - (A) - (C)", "(B) - (C) - (A)",
                    "(C) - (A) - (B)", "(C) - (B) - (A)",
                ],
            ),
        ]
        _run_ingest()

        rows = db_session.query(ExamPassage).order_by(ExamPassage.problem_number).all()
        assert [r.problem_number for r in rows] == [33, 36]
        assert rows[0].problem_type == "standard"
        assert rows[1].problem_type == "paragraph_order"
        assert rows[0].explanation
        assert rows[0].tags == ["빈칸추론", "경제"]
        assert all(r.status == "unused" and r.passage_group_key is None for r in rows)

    def test_invalid_item_is_skipped_without_blocking_others(self, db_session, ingest_env):
        ingest_env["manifest"] = _manifest(
            {"problem_number": 33, "problem_type": "standard", "passage_group": []},
            {"problem_number": 34, "problem_type": "standard", "passage_group": []},
        )
        ingest_env["batches"][(33, 34)] = [
            _standard_item(problem_number=33, choices=["a", "b"]),  # 5개가 아님 → 스킵
            _standard_item(problem_number=34),
        ]
        _run_ingest()

        rows = db_session.query(ExamPassage).all()
        assert [r.problem_number for r in rows] == [34]

    def test_existing_problem_number_is_skipped(self, db_session, ingest_env):
        db_session.add(ExamPassage(
            year=2025, exam_type="수능", month=None, problem_number=33,
            source_label="2025학년도 수능 영어", passage_text="old", question_text="old",
            status="unused",
        ))
        db_session.commit()

        ingest_env["manifest"] = _manifest(
            {"problem_number": 33, "problem_type": "standard", "passage_group": []},
        )
        ingest_env["batches"][(33,)] = [_standard_item(problem_number=33)]
        _run_ingest()

        rows = db_session.query(ExamPassage).all()
        assert len(rows) == 1
        assert rows[0].passage_text == "old"  # 덮어쓰지 않는다

    def test_passage_group_gets_shared_group_key(self, db_session, ingest_env):
        ingest_env["manifest"] = _manifest(
            {"problem_number": 41, "problem_type": "standard", "passage_group": [41, 42]},
            {"problem_number": 42, "problem_type": "standard", "passage_group": [41, 42]},
        )
        shared_passage = _ENGLISH_PASSAGE + " " + _ENGLISH_PASSAGE
        ingest_env["batches"][(41, 42)] = [
            _standard_item(problem_number=41, passage_group=[41, 42], passage_text=shared_passage),
            _standard_item(problem_number=42, passage_group=[41, 42], passage_text=shared_passage),
        ]
        _run_ingest()

        rows = db_session.query(ExamPassage).order_by(ExamPassage.problem_number).all()
        assert len(rows) == 2
        assert rows[0].passage_group_key == rows[1].passage_group_key == "2025-수능-0-41-42"
        # 지문은 관계형으로 공유하지 않고 각 row에 그대로 복제된다.
        assert rows[0].passage_text == rows[1].passage_text == shared_passage

    def test_one_failed_batch_does_not_block_the_others(self, db_session, ingest_env):
        ingest_env["manifest"] = _manifest(*[
            {"problem_number": n, "problem_type": "standard", "passage_group": []}
            for n in range(18, 31)
        ])
        first, second, third = (
            tuple(range(18, 24)), tuple(range(24, 30)), (30,),
        )
        ingest_env["batches"][first] = None  # 배치 전체 실패
        ingest_env["batches"][second] = [_standard_item(problem_number=n) for n in second]
        ingest_env["batches"][third] = [_standard_item(problem_number=30)]
        _run_ingest()

        nums = sorted(r.problem_number for r in db_session.query(ExamPassage).all())
        assert nums == list(range(24, 31))

    def test_failed_manifest_scan_inserts_nothing(self, db_session, ingest_env):
        ingest_env["manifest"] = None
        _run_ingest()

        assert db_session.query(ExamPassage).count() == 0
        assert ingest_env["calls"] == []  # 추출 호출 자체를 시도하지 않는다

    def test_no_tagging_stores_no_tags(self, db_session, ingest_env):
        ingest_env["manifest"] = _manifest(
            {"problem_number": 33, "problem_type": "standard", "passage_group": []},
        )
        ingest_env["batches"][(33,)] = [_standard_item(problem_number=33)]
        _run_ingest(do_tagging=False)

        row = db_session.query(ExamPassage).one()
        assert row.tags is None
        assert row.explanation  # 해설은 태깅 플래그와 무관하게 항상 저장된다

    # --- 도표(chart) 유형: 실제 이미지가 크롭되어 row에 붙는지 ---

    _CHART_PASSAGE = (
        "The graph above shows the percentages of U.S. teenagers who spent time with "
        "friends by communication type.\n"
        "[도표 데이터] Text Messaging: Every Day 55%, Less Often 13% / "
        "Talking on the Phone: Every Day 19%, Less Often 41%"
    )

    def test_chart_item_gets_cropped_image_attached(self, db_session, ingest_env, monkeypatch):
        import ingest_exam_pdfs
        captured = {}

        def fake_crop(pdf_path, page_number, side):
            captured["args"] = (pdf_path, page_number, side)
            return b"cropped-png-bytes"

        monkeypatch.setattr(ingest_exam_pdfs, "crop_chart_image", fake_crop)

        ingest_env["manifest"] = _manifest(
            {"problem_number": 25, "problem_type": "chart", "passage_group": []},
        )
        ingest_env["batches"][(25,)] = [
            _standard_item(
                problem_number=25, problem_type="chart",
                question_text="다음 도표의 내용과 일치하지 않는 것은?",
                passage_text=self._CHART_PASSAGE,
                chart_page=4, chart_side="left",
            ),
        ]
        _run_ingest()

        row = db_session.query(ExamPassage).filter(ExamPassage.problem_number == 25).one()
        assert row.chart_image == b"cropped-png-bytes"
        assert captured["args"] == ("fake.pdf", 4, "left")

    def test_chart_item_with_failed_crop_is_still_inserted_without_an_image(
        self, db_session, ingest_env, monkeypatch
    ):
        """크롭이 실패해도(예: chart_page/chart_side가 실제 PDF와 안 맞음) 문항 자체는
        들여보낸다 — passage_text의 텍스트 전사만으로도 발행은 가능하므로, 이미지 하나 못
        구했다고 문항 전체를 버리는 건 과함(단, validate_extracted_item에서 chart_page/
        chart_side 자체가 없는 건 이미 거부됨 — 이건 '있지만 크롭이 실패한' 경우)."""
        import ingest_exam_pdfs
        monkeypatch.setattr(ingest_exam_pdfs, "crop_chart_image", lambda *a, **k: None)

        ingest_env["manifest"] = _manifest(
            {"problem_number": 25, "problem_type": "chart", "passage_group": []},
        )
        ingest_env["batches"][(25,)] = [
            _standard_item(
                problem_number=25, problem_type="chart",
                question_text="다음 도표의 내용과 일치하지 않는 것은?",
                passage_text=self._CHART_PASSAGE,
                chart_page=4, chart_side="left",
            ),
        ]
        _run_ingest()

        row = db_session.query(ExamPassage).filter(ExamPassage.problem_number == 25).one()
        assert row.problem_type == "chart"
        assert row.chart_image is None

    def test_non_chart_item_never_calls_crop_chart_image(self, db_session, ingest_env, monkeypatch):
        import ingest_exam_pdfs
        calls = []
        monkeypatch.setattr(
            ingest_exam_pdfs, "crop_chart_image",
            lambda *a, **k: calls.append(a) or b"should-not-be-used",
        )

        ingest_env["manifest"] = _manifest(
            {"problem_number": 33, "problem_type": "standard", "passage_group": []},
        )
        ingest_env["batches"][(33,)] = [_standard_item(problem_number=33)]
        _run_ingest()

        assert calls == []
        row = db_session.query(ExamPassage).one()
        assert row.chart_image is None
