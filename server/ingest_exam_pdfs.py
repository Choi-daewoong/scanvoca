"""
수능/모의고사 영어 기출 PDF 인제스트 스크립트 (1회성 관리 스크립트 — API 아님).

seed_blog_topics.py와 같은 성격. 실행 여부는 오케스트레이터가 결정한다.

실행 예:
    cd server && venv/Scripts/python.exe ingest_exam_pdfs.py \
        --pdf "2025_suneung_english.pdf" \
        --answers "2025_suneung_answers.pdf" \
        --year 2025 --exam-type 수능 --source-label "2025학년도 수능 영어"

    # 모의고사(시행 월 지정):
    cd server && venv/Scripts/python.exe ingest_exam_pdfs.py \
        --pdf "2025_09_mock.pdf" --year 2025 --exam-type 모의고사 --month 9 \
        --source-label "2025년 9월 모의고사 영어"

특징:
- 메인 인제스트 경로는 **AI가 PDF 원본을 직접 읽는다**. pdfplumber로 텍스트를 뽑아 정규식으로
  자르던 옛 파서는 KICE PDF 유형마다 다르게 깨져(5주간 6번) 전면 폐기했고, 대신 문제지 PDF
  (+ 정답표 PDF) 바이트를 그대로 모델에 첨부해 구조화 출력(response_schema)으로 받는다:
    1) scan_exam_pdf_manifest — 문항 번호 + 유형 + 장문독해 그룹만 가볍게 스캔
    2) _plan_batches로 문항을 배치(장문독해 그룹은 안 쪼갬)로 나눔
    3) 배치마다 extract_exam_problems_from_pdfs — 지문/문제/선택지/정답/해설/태그 추출
  덕분에 구 파서가 구조적으로 표현조차 못 하던 글의순서·장문독해·무관문장 유형도 포함된다.
- validate_extracted_item으로 형태가 이상한 항목만 건너뛰고 사유를 출력한다(부분 실패를
  견디는 구조 — 배치 하나가 통째로 실패해도 나머지는 계속 진행).
- 멱등: 같은 (year, exam_type, month, problem_number) 조합이 이미 있으면 스킵.
- 태깅은 추출 호출에 합쳐져 있어 별도 AI 호출이 없다(--no-tagging은 tags 저장만 생략).
- pdfplumber 기반 헬퍼(컬럼 재구성/언더라인 감지/정답표 파싱)는 --answers-only(정답 백필)
  경로가 계속 쓰므로 그대로 남아 있다.

아래 순수 함수(extract 제외)는 pytest로 검증 가능하도록 IO와 분리되어 있다.
"""
from __future__ import annotations

import argparse
import asyncio
import re
from typing import Dict, List, Optional

CIRCLED = "①②③④⑤"
# Answer-sheet entry: "18 ③" / "18. 3" / "18) ④" etc.
#
# Real KICE answer sheets pack four "번호 정답 배점" triples per line (e.g.
# "1 ⑤ 2 13 ③ 3 25 ④ 2 37 ⑤ 3"), with 배점(score) always a single digit — but a
# plain (non-circled) 정답 digit is ALSO a single digit, so without care a
# 배점 immediately followed by the next entry's 문항번호 misreads as its own
# (번호, 정답) pair (observed live: "...② 2 13 ③..." parsed as (2, "1") from
# "2 13", desyncing every match after it — see 2022 수능 audit). The negative
# lookahead rejects a plain digit as 정답 when another digit immediately
# follows it (i.e. it's actually the first digit of a 2-digit 문항번호), which
# a genuine single-digit 정답 never has. Circled digits need no such guard —
# they're never confused with a 문항번호 or 배점.
_ANSWER_RE = re.compile(r"(\d{1,2})\s*[.)]?\s*([①②③④⑤]|[1-5](?!\d))")
_CIRCLED_TO_NUM = {c: str(i + 1) for i, c in enumerate(CIRCLED)}
_ALPHA_RE = re.compile(r"[A-Za-z]")


# ---------- Pure validation / batch planning (unit-testable, no IO) ----------

# 실제 수능 지시문("다음 빈칸에 들어갈 말로...", "다음 글의 목적으로...")은 항상 한글이다.
# 구 regex 파서는 "문항 블록 첫 줄 = 한글 지시문"을 전제로 지문/문제를 갈랐는데, 지시문 없이
# 지문이 곧바로 시작되는 블록에서 지문 첫 문장이 통째로 "문제"로 오인식됐다(실제 사고:
# 2025 수능 33번 "We are famously living in the era of the attention economy,"가
# question_text로 들어가고 지문은 "where the largest..."부터 시작하며 빈칸 표시까지 유실 —
# 라이브 블로그 글이 깨져서 발견됨). 파서는 바뀌었지만 "한글 없는 question_text는 지시문이
# 아니다"라는 판정 자체는 AI 출력에도 그대로 유효한 안전망이라 검증기에 남겨둔다.
_HANGUL_RE = re.compile(r"[가-힣]")

_VALID_PROBLEM_TYPES = {
    "standard", "chart", "underline_choice", "embedded_marker", "paragraph_order"
}
_VALID_CHART_SIDES = {"left", "right", "full_width"}
_PAREN_LABEL_RE = re.compile(r"\(([A-C])\)")
_ORDER_CHOICE_RE = re.compile(r"\(?[A-C]\)?(\s*[-–]\s*\(?[A-C]\)?){2}")
# embedded_marker 지문 안에 실제로 박혀 있어야 하는 마커들 — 정답표 파싱용 CIRCLED와 같은
# 문자 집합이지만, 쓰임이 전혀 다른 곳이라 이름을 따로 둔다.
_CIRCLED_CHARS = CIRCLED


def validate_extracted_item(item: Dict) -> Optional[str]:
    """Return a skip-reason string if an AI-extracted item looks implausible, else None.

    Pure — no IO. `item` is one ExtractedProblem.model_dump()'d dict (or a hand-built dict
    in tests). Mirrors the old validate_parsed_item's tolerant "skip what looks wrong,
    keep the rest" philosophy, extended with per-problem_type structural checks for the 3
    types the old regex parser could never represent at all.
    """
    problem_type = item.get("problem_type")
    if problem_type not in _VALID_PROBLEM_TYPES:
        return f"unrecognized problem_type: {problem_type!r}"

    question = item.get("question_text") or ""
    passage = item.get("passage_text") or ""
    choices = item.get("choices") or []
    answer = item.get("answer")
    explanation = item.get("explanation") or ""

    if not question or not _HANGUL_RE.search(question):
        # ASCII hyphen, not an em dash: this string is interpolated into ingest()'s final
        # summary print, and the Windows console this script is run from (cp949) cannot
        # encode U+2014 — an em dash here crashes the run's last line. Hangul is fine in
        # cp949; only the dash was the problem.
        return "question_text missing or has no Hangul (likely a mis-split passage - see 2025 수능 33번)"
    if len(question) > 200:
        return "question_text implausibly long (likely cross-contaminated block)"
    if len(passage) < 20:
        return "passage_text implausibly short"
    # 장문독해/일반 지문은 인쇄된 영어 본문이므로 라틴 문자가 넉넉히 있어야 한다. 듣기 문항
    # 조각(한글 지시문 꼬리 + "Man:" 같은 화자 표시)은 길이 검사는 통과해도 영어가 사실상
    # 없다. paragraph_order는 (A)(B)(C) 라벨 위주로 짧게 나올 수 있어 이 검사에서 제외한다.
    if problem_type != "paragraph_order" and len(_ALPHA_RE.findall(passage)) < 40:
        return "passage_text has too little English content (likely a listening-question fragment)"
    if len(choices) != 5:
        return f"choice count {len(choices)} != 5"
    if problem_type != "paragraph_order" and any(len(c) > 250 for c in choices):
        return "a choice is implausibly long (likely swallowed passage text)"
    if not explanation or not _HANGUL_RE.search(explanation):
        return "explanation missing or has no Hangul"
    if answer is not None and answer not in {"1", "2", "3", "4", "5"}:
        return f"answer {answer!r} is not one of the 5 choice positions"

    if problem_type == "paragraph_order":
        labels = set(_PAREN_LABEL_RE.findall(passage))
        if not {"A", "B", "C"}.issubset(labels):
            return "paragraph_order item missing one of (A)(B)(C) labels in passage_text"
        if not all(_ORDER_CHOICE_RE.fullmatch(c.strip()) for c in choices):
            return "paragraph_order choices don't look like (A)-(B)-(C) permutation strings"

    if problem_type == "embedded_marker":
        markers_found = sum(1 for ch in _CIRCLED_CHARS if ch in passage)
        if markers_found < 5:
            return f"embedded_marker item needs 5 embedded ①-⑤ markers in passage_text, found {markers_found}"

    if problem_type == "chart":
        # chart_page/chart_side가 없으면 어느 페이지의 어느 쪽 이미지를 잘라야 할지 전혀
        # 알 수 없다 — 이미지 없이 발행되면 2026 수능 25번과 똑같은 사고(도표 없이 지어낸
        # 수치로 해설이 발행됨)가 재발하므로, 이미지를 못 만들 문항은 아예 들이지 않는다.
        chart_page = item.get("chart_page")
        chart_side = item.get("chart_side")
        if not isinstance(chart_page, int) or chart_page < 1:
            return f"chart item missing a valid chart_page: {chart_page!r}"
        if chart_side not in _VALID_CHART_SIDES:
            return f"chart item missing a valid chart_side: {chart_side!r}"

    return None


def _plan_batches(manifest: List[Dict], batch_size: int = 6) -> List[List[int]]:
    """Chunk manifest problem numbers into contiguous windows of ~batch_size, never
    splitting a 장문독해 passage_group across two batches. Pure — takes/returns plain
    problem-number lists, no Gemini/DB IO. `manifest` is a list of dicts each with at
    least "problem_number" and "passage_group" (list, possibly empty/singleton) keys.
    """
    seen: set = set()
    groups: List[List[int]] = []
    for m in sorted(manifest, key=lambda m: m["problem_number"]):
        num = m["problem_number"]
        if num in seen:
            continue
        group = sorted(m.get("passage_group") or [num])
        for n in group:
            seen.add(n)
        groups.append(group)

    batches: List[List[int]] = []
    current: List[int] = []
    for group in groups:
        if current and len(current) + len(group) > batch_size:
            batches.append(current)
            current = []
        current.extend(group)
    if current:
        batches.append(current)
    return batches


def parse_answers_text(text: str) -> Dict[int, str]:
    """Parse an answer-sheet text into {problem_number: answer_string} (pure).

    Circled digits are normalized to '1'..'5'. Best-effort — malformed lines are ignored.
    Callers with a combined 홀수형+짝수형 sheet MUST slice to one form first via
    extract_form_section() — this function has no way to tell which table a match came
    from, so feeding it the whole combined text lets the later (짝수형) table silently
    overwrite the earlier (홀수형) one for every problem number they share.
    """
    answers: Dict[int, str] = {}
    for m in _ANSWER_RE.finditer(text or ""):
        num = int(m.group(1))
        raw = m.group(2)
        answers[num] = _CIRCLED_TO_NUM.get(raw, raw)
    return answers


def extract_form_section(text: str, form: str) -> str:
    """Slice a combined answer-sheet text down to just one booklet form's table.

    KICE answer-key PDFs bundle 홀수형 (odd form) and 짝수형 (even form) tables in one
    file, in that order, and the two forms have DIFFERENT correct answers for the same
    problem number (their choice ordering is shuffled between forms) — so which table a
    given passage's answer must come from depends entirely on which form the *question*
    PDF that passage's choices were extracted from was. `form` must be "홀수형" or
    "짝수형". Falls back to the full text unchanged if no form markers are found (a
    single-form answer sheet, or a sheet using different wording).
    """
    odd_pos = text.find("홀수")
    even_pos = text.find("짝수")
    markers = sorted(
        (pos, name) for pos, name in [(odd_pos, "홀수형"), (even_pos, "짝수형")] if pos >= 0
    )
    if not markers:
        return text
    for i, (pos, name) in enumerate(markers):
        if name != form:
            continue
        end = markers[i + 1][0] if i + 1 < len(markers) else len(text)
        return text[pos:end]
    return text


# ---------- Chart image cropping (pure bbox math + a thin IO wrapper) ----------
#
# problem_type == "chart" 문항의 도표는 KICE PDF 안에서 인쇄 텍스트가 아니라 내장 래스터
# 이미지(pdfplumber의 page.images)로 존재한다. 실측(2026 수능 영어 25번, p.4)으로 확인한
# 사실: 도표 하나가 위/아래로 쪼개진 여러 개의 image 객체로 나뉘어 있고, 같은 페이지의 다른
# 문항(오른쪽 칼럼의 안내문 등)도 자기 몫의 image 객체를 여러 개 갖고 있다. 그래서 "페이지의
# 이미지를 전부 하나로 합치기"는 안 되고, chart_side로 먼저 반쪽만 남긴 뒤, 그 반쪽 안에서도
# 세로로 가까이 붙어 있는 이미지들끼리만 하나의 클러스터로 묶어 가장 큰 클러스터를 도표로
# 고른다 — 페이지 상단의 로고 같은 무관한 작은 이미지가 섞여 들어오는 걸 막기 위함이다.

_CHART_CLUSTER_GAP = 25.0  # pt: 이 안에서 세로로 붙어 있으면 같은 도표의 조각으로 본다
_CHART_CROP_PADDING = 6.0  # pt: 클러스터 bbox 바깥 여백(테두리가 잘리지 않도록)


def compute_chart_crop_bbox(
    images: List[Dict], page_width: float, page_height: float, side: str
) -> Optional[tuple]:
    """Pure: given a page's raw pdfplumber `page.images` and which half of the page the
    chart is on (side: "left" | "right" | "full_width"), return the (x0, top, x1, bottom)
    crop box covering the chart, or None if that half has no images at all.

    Picks the largest vertically-contiguous cluster of images on that side (see module
    comment above) rather than the union of everything on that side, so an unrelated small
    image (e.g. a page-header logo straddling the column gutter) sharing the same half
    doesn't drag the crop box up to include a blank gap plus the wrong image.
    """
    if side == "left":
        picked = [im for im in images if (im["x0"] + im["x1"]) / 2 < page_width / 2]
    elif side == "right":
        picked = [im for im in images if (im["x0"] + im["x1"]) / 2 >= page_width / 2]
    else:
        picked = list(images)
    if not picked:
        return None

    picked = sorted(picked, key=lambda im: im["top"])
    clusters: List[List[Dict]] = []
    for im in picked:
        if clusters and im["top"] - max(c["bottom"] for c in clusters[-1]) <= _CHART_CLUSTER_GAP:
            clusters[-1].append(im)
        else:
            clusters.append([im])

    def cluster_area(cluster: List[Dict]) -> float:
        x0 = min(c["x0"] for c in cluster)
        x1 = max(c["x1"] for c in cluster)
        top = min(c["top"] for c in cluster)
        bottom = max(c["bottom"] for c in cluster)
        return (x1 - x0) * (bottom - top)

    best = max(clusters, key=cluster_area)
    x0 = max(0.0, min(c["x0"] for c in best) - _CHART_CROP_PADDING)
    top = max(0.0, min(c["top"] for c in best) - _CHART_CROP_PADDING)
    x1 = min(page_width, max(c["x1"] for c in best) + _CHART_CROP_PADDING)
    bottom = min(page_height, max(c["bottom"] for c in best) + _CHART_CROP_PADDING)
    return (x0, top, x1, bottom)


def crop_chart_image(pdf_path: str, page_number: int, side: str) -> Optional[bytes]:
    """Thin IO wrapper (not unit tested — see compute_chart_crop_bbox for the pure logic
    that is). Renders the cropped chart region to PNG bytes at 300dpi, or returns None if
    the page number is out of range or that half of the page has no images at all (a
    hallucinated chart_page/chart_side, or a chart that isn't a raster image in this PDF).

    Callers MUST treat None as "couldn't get the image" and continue without one rather
    than fail the whole item — an ingest run losing every problem in a batch over one
    uncroppable chart would be a worse outcome than publishing that one chart without its
    image (the text-transcribed data in passage_text still lets the post read correctly).
    """
    import io
    import pdfplumber  # lazy: keeps this module importable where pdfplumber isn't installed

    with pdfplumber.open(pdf_path) as pdf:
        if not (1 <= page_number <= len(pdf.pages)):
            return None
        page = pdf.pages[page_number - 1]
        bbox = compute_chart_crop_bbox(page.images, page.width, page.height, side)
        if bbox is None:
            return None
        cropped_page = page.crop(bbox)
        pil_image = cropped_page.to_image(resolution=300).original
        buf = io.BytesIO()
        pil_image.save(buf, format="PNG")
        return buf.getvalue()


# ---------- Column-aware reconstruction (pure — unit-testable without a real PDF) ----------
#
# 수능 영어영역 문제지는 대부분 페이지가 2단(컬럼) 레이아웃이다. pdfplumber의 기본
# extract_text()는 페이지를 y좌표 밴드 단위 좌→우로 읽어, 좌/우 컬럼의 텍스트가 줄 단위로
# 인터리빙되어 서로 다른 지문·문제가 뒤섞인다(실측: 33번 지문에 35번 문제 텍스트가 섞임).
# 컬럼 사이 여백(거터)을 찾아 컬럼별로 나눠 읽은 뒤 좌→우 순서로 이어붙인다.

def find_gutter_x(words: List[Dict], page_width: float) -> Optional[float]:
    """Find the x-coordinate of the widest gap between word spans in the middle 30~70%
    of the page width (the column gutter). Returns None when no clear gap exists
    (single-column page) — callers should treat that as "everything is one column".
    """
    band_lo, band_hi = page_width * 0.3, page_width * 0.7
    edges = sorted(
        (w["x0"], w["x1"]) for w in words if band_lo <= (w["x0"] + w["x1"]) / 2 <= band_hi
    )
    if len(edges) < 2:
        return None

    best_gap = 0.0
    best_mid = None
    max_x1_so_far = edges[0][1]
    for x0, x1 in edges[1:]:
        gap = x0 - max_x1_so_far
        if gap > best_gap:
            best_gap = gap
            best_mid = (max_x1_so_far + x0) / 2
        max_x1_so_far = max(max_x1_so_far, x1)

    # A real column gutter is a visually obvious gap, not incidental word spacing.
    return best_mid if best_gap >= 8 else None


def is_underline_shape(x0: float, x1: float, top: float, bottom: float) -> bool:
    """True when a drawn line/rect looks like a single underline stroke rather than a
    page border, table gridline, or textbox outline.

    수능 "밑줄 친 부분 중" (which underlined part) questions mark answer choices by
    drawing a thin horizontal stroke under a word or short phrase — never under a whole
    page-width line. width>=3pt excludes stray hairline artifacts; height<=1.5pt is the
    tell for a flat stroke (as opposed to a filled box); width<=400pt excludes page
    borders/dividers that happen to be thin but span most of the page width.
    """
    width = x1 - x0
    height = abs(bottom - top)
    return 3 <= width <= 400 and height <= 1.5


def collect_underline_shapes(lines_objs: List[Dict], rects_objs: List[Dict]) -> List[Dict]:
    """Filter a page's raw `lines` + `rects` (pdfplumber) down to underline-shaped strokes.

    KICE PDFs draw underlines as either a straight line or a thin filled rect depending on
    the export tool, so both object types are checked with the same shape heuristic.
    """
    shapes: List[Dict] = []
    for obj in list(lines_objs or []) + list(rects_objs or []):
        x0, x1, top, bottom = obj["x0"], obj["x1"], obj["top"], obj["bottom"]
        if is_underline_shape(x0, x1, top, bottom):
            shapes.append({"x0": x0, "x1": x1, "top": top, "bottom": bottom})
    return shapes


def word_is_underlined(word: Dict, underline_shapes: List[Dict], tolerance: float = 3.0) -> bool:
    """True when an underline stroke sits just below `word`'s baseline and overlaps it.

    The stroke must be at/below the word's bottom edge (never above — that would be a
    strikethrough or the previous line's descender) and within `tolerance` points of it
    (real underlines sit close to the baseline, not floating below). Horizontal overlap
    must cover at least half the word's width so a stroke spanning several words in a
    phrase still marks each of them, while a stroke under a neighboring word doesn't.
    """
    wx0, wx1, wbottom = word["x0"], word["x1"], word["bottom"]
    word_width = wx1 - wx0
    if word_width <= 0:
        return False
    for shape in underline_shapes:
        if shape["top"] < wbottom - 1 or shape["top"] - wbottom > tolerance:
            continue
        overlap = min(wx1, shape["x1"]) - max(wx0, shape["x0"])
        if overlap >= word_width * 0.5:
            return True
    return False


def _words_to_text(words: List[Dict], underline_shapes: Optional[List[Dict]] = None) -> str:
    """Group words into lines by vertical position, then join lines top-to-bottom.

    Words whose baseline has a matching underline stroke (see word_is_underlined) are
    wrapped in `<u>...</u>`, merging contiguous underlined words into a single span so a
    multi-word underlined phrase renders as one tag rather than one per word.
    """
    if not words:
        return ""
    underline_shapes = underline_shapes or []
    lines: List[List[Dict]] = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if lines and abs(lines[-1][0]["top"] - w["top"]) <= 3:
            lines[-1].append(w)
        else:
            lines.append([w])

    out_lines: List[str] = []
    for line in lines:
        line_words = sorted(line, key=lambda w: w["x0"])
        pieces: List[str] = []
        run: List[str] = []
        run_underlined = False

        def flush() -> None:
            if not run:
                return
            text = " ".join(run)
            pieces.append(f"<u>{text}</u>" if run_underlined else text)
            run.clear()

        for w in line_words:
            underlined = word_is_underlined(w, underline_shapes)
            if run and underlined != run_underlined:
                flush()
            run.append(w["text"])
            run_underlined = underlined
        flush()
        out_lines.append(" ".join(pieces))
    return "\n".join(out_lines)


def reconstruct_page_text(
    words: List[Dict], page_width: float, underline_shapes: Optional[List[Dict]] = None
) -> str:
    """Reorder a page's words into reading order: left column top-to-bottom, then
    right column top-to-bottom. Falls back to single-column (page-wide) order when no
    gutter is detected. Underline shapes are split across columns the same way words are,
    so a stroke under a right-column word isn't matched against a left-column word.
    """
    underline_shapes = underline_shapes or []
    gutter = find_gutter_x(words, page_width)
    if gutter is None:
        return _words_to_text(words, underline_shapes)

    left = [w for w in words if (w["x0"] + w["x1"]) / 2 < gutter]
    right = [w for w in words if (w["x0"] + w["x1"]) / 2 >= gutter]
    left_shapes = [s for s in underline_shapes if (s["x0"] + s["x1"]) / 2 < gutter]
    right_shapes = [s for s in underline_shapes if (s["x0"] + s["x1"]) / 2 >= gutter]
    return (
        _words_to_text(left, left_shapes) + "\n" + _words_to_text(right, right_shapes)
    )


# Recurring per-page footer furniture printed on every 수능 문제지 page (copyright notice,
# bare page number, 홀수형/짝수형 booklet-version watermark). Left in place, this bleeds into
# whichever choice/passage happens to end at a page boundary — observed live: choice (E) of
# a problem ending mid-page got "...8\n이 문제지에 관한 저작권은 한국교육과정평가원에
# 있습니다.\n홀수형" appended. None of this is exam content, so strip it before parsing.
_PAGE_FURNITURE_RE = re.compile(
    r"(?m)^\s*(?:\d{1,3}|이 문제지에 관한 저작권은 한국교육과정평가원에 있습니다\.?|홀수형|짝수형)\s*$"
)


def strip_page_furniture(text: str) -> str:
    """Remove recurring page-footer lines (page number / copyright notice / 홀짝 watermark)."""
    lines = [ln for ln in text.splitlines() if not _PAGE_FURNITURE_RE.match(ln)]
    return "\n".join(lines)


# ---------- Thin IO wrapper (monkeypatchable in tests) ----------

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract the text layer of a PDF via pdfplumber (lazy import), column-aware.

    Not a scan — no OCR. Reconstructs 2-column pages via reconstruct_page_text() instead
    of pdfplumber's default extract_text(), which interleaves columns line-by-line, then
    strips recurring page-footer furniture (see strip_page_furniture) that would otherwise
    bleed into whichever choice/passage ends at a page boundary.
    """
    import pdfplumber  # lazy: keeps this module importable where pdfplumber isn't installed

    parts: List[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            words = page.extract_words()
            underline_shapes = collect_underline_shapes(page.lines, page.rects)
            parts.append(
                strip_page_furniture(reconstruct_page_text(words, page.width, underline_shapes))
            )
    return "\n".join(parts)


# ---------- Orchestration (DB + AI IO) ----------

def backfill_answers(
    *,
    answers_path: Optional[str] = None,
    year: int,
    exam_type: str,
    month: Optional[int] = None,
    form: str = "홀수형",
    answers: Optional[Dict[int, str]] = None,
) -> None:
    """Fill in `answer` for already-ingested passages that were inserted without one.

    ingest()'s idempotency check skips any (year, exam_type, month, problem_number) that
    already exists, so it can never retroactively add an answer to a passage inserted
    earlier without an answer-key PDF. This is the separate path for that: it never touches
    passage_text/question_text/choices, only fills `answer` where it's currently NULL.

    `form` selects which booklet's table to read out of a combined 홀수형+짝수형 answer
    sheet — it MUST match the form the original *question* PDF (passage_text/choices) was
    ingested from, or every answer for a problem whose choices were reordered between
    forms will be wrong (see extract_form_section's docstring).

    Pass a pre-parsed `answers` dict directly (skipping `answers_path`/extraction
    entirely) for an answer sheet with no extractable text layer (e.g. a scanned/
    image-only PDF pdfplumber can't read) that was transcribed by some other means.
    """
    from app.core.database import SessionLocal
    from app.models.exam_passage import ExamPassage
    from sqlalchemy import select

    if answers is None:
        if not answers_path:
            raise ValueError("answers_path or a pre-parsed answers dict is required")
        print(f"Extracting answers: {answers_path} (form={form})")
        section = extract_form_section(extract_text_from_pdf(answers_path), form)
        answers = parse_answers_text(section)
        print(f"Parsed {len(answers)} answers.")
    else:
        print(f"Using {len(answers)} pre-parsed answers (no PDF extraction).")

    updated: List[int] = []
    not_found: List[int] = []
    already_had_answer: List[int] = []
    db = SessionLocal()
    try:
        for num, answer in answers.items():
            passage = db.scalar(
                select(ExamPassage).where(
                    ExamPassage.year == year,
                    ExamPassage.exam_type == exam_type,
                    ExamPassage.month == month,
                    ExamPassage.problem_number == num,
                )
            )
            if passage is None:
                not_found.append(num)
                continue
            if passage.answer is not None:
                already_had_answer.append(num)
                continue
            passage.answer = answer
            db.commit()
            updated.append(num)
        print(f"Updated {len(updated)}: {sorted(updated)}")
        if already_had_answer:
            print(f"Already had an answer, skipped {len(already_had_answer)}: {sorted(already_had_answer)}")
        if not_found:
            print(f"No matching passage in DB, skipped {len(not_found)}: {sorted(not_found)}")
    finally:
        db.close()
    print("Done.")


def ingest(
    *,
    pdf_path: str,
    year: int,
    exam_type: str,
    source_label: str,
    month: Optional[int] = None,
    answers_path: Optional[str] = None,
    form: str = "홀수형",
    do_tagging: bool = True,
) -> None:
    """Read PDFs -> AI extract (manifest scan + windowed batches) -> validate ->
    idempotent insert. Tolerates partial batch/validation failures — never crashes the
    whole run over one bad batch or one implausible item."""
    from pathlib import Path
    from app.core.database import SessionLocal
    from app.models.exam_passage import ExamPassage
    from app.services.gemini_service import GeminiService
    from sqlalchemy import select

    exam_bytes = Path(pdf_path).read_bytes()
    answers_bytes = Path(answers_path).read_bytes() if answers_path else None

    gemini = GeminiService()
    manifest = asyncio.run(gemini.scan_exam_pdf_manifest(exam_bytes))
    if not manifest:
        # ASCII hyphen, not an em dash: cp949 (the Windows console this script runs in)
        # cannot encode U+2014, so an em dash here turns the intended clean abort message
        # into a UnicodeEncodeError traceback.
        print("FATAL: manifest scan failed (see error above) - aborting, nothing inserted.")
        return
    print(f"Manifest: {len(manifest)} problems found.")

    batches = _plan_batches([m.model_dump() for m in manifest], batch_size=6)

    all_items: List[Dict] = []
    failed_batches: List[List[int]] = []
    for numbers in batches:
        result = asyncio.run(
            gemini.extract_exam_problems_from_pdfs(exam_bytes, answers_bytes, numbers, form=form)
        )
        if result is None:
            failed_batches.append(numbers)
            continue
        all_items.extend(r.model_dump() for r in result)
    if failed_batches:
        print(f"WARN: {len(failed_batches)} batch(es) failed entirely: {failed_batches}")

    skipped_invalid: List[tuple] = []
    inserted_ids: List[int] = []
    skipped_existing: List[int] = []
    db = SessionLocal()
    try:
        for item in all_items:
            num = item["problem_number"]
            reason = validate_extracted_item(item)
            if reason is not None:
                skipped_invalid.append((num, reason))
                continue
            exists = db.scalar(
                select(ExamPassage).where(
                    ExamPassage.year == year,
                    ExamPassage.exam_type == exam_type,
                    ExamPassage.month == month,
                    ExamPassage.problem_number == num,
                )
            )
            if exists is not None:
                skipped_existing.append(num)
                continue
            # 장문독해 세트는 같은 지문을 각 row에 그대로 복제해 넣고, 이 키로만 묶어둔다
            # (관찰용 태그 — 어떤 조회 쿼리도 이 컬럼을 읽지 않는다).
            group = item.get("passage_group") or [num]
            group_key = (
                f"{year}-{exam_type}-{month or 0}-{min(group)}-{max(group)}"
                if len(group) > 1 else None
            )
            chart_image = None
            if item["problem_type"] == "chart":
                chart_image = crop_chart_image(
                    pdf_path, item["chart_page"], item["chart_side"]
                )
                if chart_image is None:
                    print(
                        f"  WARN: problem {num} is a chart but cropping found no image "
                        f"(page={item['chart_page']}, side={item['chart_side']!r}) — "
                        "inserting without one, text-transcribed data only."
                    )
            passage = ExamPassage(
                year=year,
                exam_type=exam_type,
                month=month,
                problem_number=num,
                source_label=source_label,
                problem_type=item["problem_type"],
                passage_text=item["passage_text"],
                question_text=item["question_text"],
                choices=item["choices"],
                answer=item.get("answer"),
                explanation=item["explanation"],
                tags=(item.get("tags") or None) if do_tagging else None,
                passage_group_key=group_key,
                chart_image=chart_image,
                status="unused",
            )
            db.add(passage)
            db.commit()
            db.refresh(passage)
            inserted_ids.append(passage.id)
        print(f"Inserted {len(inserted_ids)}, skipped {len(skipped_existing)} existing, "
              f"{len(skipped_invalid)} invalid: {skipped_invalid}")
    finally:
        db.close()
    print("Done.")


def main() -> None:
    parser = argparse.ArgumentParser(description="수능/모의고사 영어 기출 PDF 인제스트")
    parser.add_argument("--pdf", default=None, help="문제 PDF 경로 (--answers-only일 땐 불필요)")
    parser.add_argument("--answers", default=None, help="정답 PDF 경로(선택)")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--exam-type", required=True, choices=["수능", "모의고사"])
    parser.add_argument("--month", type=int, default=None, help="모의고사 시행 월(수능은 생략)")
    parser.add_argument("--source-label", default=None, help='예: "2025학년도 수능 영어" (--answers-only일 땐 불필요)')
    parser.add_argument(
        "--no-tagging", action="store_true",
        help="tags를 저장하지 않는다 (태그는 추출 호출에 포함돼 오므로 별도 AI 호출은 원래 없다)",
    )
    parser.add_argument(
        "--answers-only", action="store_true",
        help="이미 적재된 문제에 정답만 채워넣는다 (--pdf 없이 --answers만으로 실행)",
    )
    parser.add_argument(
        "--form", default="홀수형", choices=["홀수형", "짝수형"],
        help="정답표에서 읽을 표 — 반드시 --pdf(문제지)를 뽑은 판과 같아야 한다 (기본: 홀수형)",
    )
    args = parser.parse_args()

    if args.answers_only:
        if not args.answers:
            parser.error("--answers-only는 --answers가 필요합니다")
        backfill_answers(
            answers_path=args.answers,
            year=args.year,
            exam_type=args.exam_type,
            month=args.month,
            form=args.form,
        )
        return

    if not args.pdf or not args.source_label:
        parser.error("--pdf와 --source-label은 필수입니다 (--answers-only 모드가 아닌 경우)")

    ingest(
        pdf_path=args.pdf,
        year=args.year,
        exam_type=args.exam_type,
        month=args.month,
        source_label=args.source_label,
        answers_path=args.answers,
        form=args.form,
        do_tagging=not args.no_tagging,
    )


if __name__ == "__main__":
    main()
