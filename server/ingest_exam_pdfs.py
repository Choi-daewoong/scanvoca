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
- pdfplumber로 텍스트 레이어 추출(스캔본 아니므로 OCR 불필요).
- 문제번호/선택지(①②③④⑤) 정규식으로 지문·문제·선택지 분리. 파싱 실패 항목은 건너뛰고
  마지막에 스킵한 문제 번호를 요약 출력(부분 실패를 견디는 구조 — 중간에 죽지 않음).
- 멱등: 같은 (year, exam_type, month, problem_number) 조합이 이미 있으면 스킵.
- 인제스트 후 각 신규 지문에 대해 AI 1회 호출로 tags(문법 포인트 + 소재 키워드)를 채운다.

아래 순수 함수(extract 제외)는 pytest로 검증 가능하도록 IO와 분리되어 있다.
"""
from __future__ import annotations

import argparse
import asyncio
import re
from typing import Dict, List, Optional

CIRCLED = "①②③④⑤"
# A problem starts with "18." at the beginning of a line (1~2 digit number + dot).
_PROBLEM_RE = re.compile(r"(?m)^\s*(\d{1,2})\.\s")
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


# ---------- Pure parsing helpers (unit-testable, no IO) ----------

def split_problems(text: str) -> List[tuple]:
    """Slice raw exam text into (problem_number, block_text) by leading 'NN.' markers."""
    matches = list(_PROBLEM_RE.finditer(text or ""))
    blocks: List[tuple] = []
    for i, m in enumerate(matches):
        num = int(m.group(1))
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        blocks.append((num, text[start:end].strip()))
    return blocks


def parse_choices(block: str) -> tuple:
    """Split a problem block into (text_before_choices, [choice_texts]).

    Choices are delimited by circled digits ①..⑤ in document order. Returns [] when the
    block has no circled markers.
    """
    positions = [(c, block.find(c)) for c in CIRCLED]
    present = sorted([(c, i) for c, i in positions if i >= 0], key=lambda x: x[1])
    if not present:
        return block.strip(), []
    body = block[: present[0][1]].strip()
    choices: List[str] = []
    for j, (c, pos) in enumerate(present):
        cstart = pos + len(c)
        cend = present[j + 1][1] if j + 1 < len(present) else len(block)
        choices.append(block[cstart:cend].strip())
    return body, choices


# 어법상 틀린 것/문맥상 낱말 쓰임 유형: ①~⑤ 표시가 지문 끝에 나열된 목록이 아니라, 지문
# 문장 중간중간 밑줄 친 단어/구 바로 앞에 박혀 있다. 이 유형은 word_is_underlined()가 남긴
# <u>...</u> 구간(collect_underline_shapes 참고)이 실제 선택지이므로, 마커 위치로 지문을
# 자르지 않고 그 구간들을 그대로 뽑아 쓴다(parse_underline_choice_block).
_UNDERLINE_CHOICE_QUESTION_RE = re.compile(r"밑줄\s*친\s*부분\s*중")
# 무관 문장 찾기: ①~⑤가 밑줄 없이 문장 앞에만 붙는다 — 문장 단위 분리가 별도로 필요해
# 아직 지원하지 않는다(이 유형은 계속 스킵).
_UNSUPPORTED_EMBEDDED_QUESTION_RE = re.compile(r"전체\s*흐름과\s*관계\s*없는\s*문장")
_UNDERLINE_SPAN_RE = re.compile(r"<u>(.*?)</u>", re.DOTALL)
# 실제 수능 지시문("다음 빈칸에 들어갈 말로...", "다음 글의 목적으로...")은 항상 한글이다.
# parse_exam_text의 기본 분리(lines[0] = 문제, 나머지 = 지문)는 블록 첫 줄이 지시문이라는
# 전제에 의존하는데, 빈칸 추론 유형처럼 문항 앞에 별도 한글 지시문이 없고 지문이 곧바로
# 시작되는 경우 지문의 첫 문장이 통째로 "문제"로 오인식된다(실제 발생 사례: 2025 수능 33번
# "We are famously living in the era of the attention economy,"가 question_text로 잘못
# 들어가고, 지문은 "where the largest..."부터 시작하며 빈칸 표시까지 유실됨 — 이 사고로
# 라이브 블로그 글의 지문·해설이 깨져서 발견됨). 한글이 전혀 없는 question_text는 지시문이
# 아니라 지문 일부가 잘못 잘린 것이므로 복구를 시도하지 말고 건너뛴다.
_HANGUL_RE = re.compile(r"[가-힣]")
# The circled digit sits immediately against the underlined word in the source PDF with
# no space ("①producing"), so pdfplumber's whitespace-delimited word extraction fuses
# them into one token and the underline stroke covers both — strip the label back off
# the extracted choice text (real answer text is never itself a circled digit).
_LEADING_CIRCLED_RE = re.compile(r"^[①②③④⑤]\s*")


def parse_underline_choice_block(block: str) -> Dict[str, object]:
    """Parse an 어법상 틀린 것/문맥상 낱말 쓰임 block into {question_text, passage_text, choices}.

    Unlike parse_choices, the passage is kept whole (never truncated at a marker
    position) — the quoted passage must stay complete for a reader to judge "which
    underlined part", and the actual choices come from the <u>...</u> spans already
    present in `block`'s text (see word_is_underlined / _words_to_text), not from
    slicing at circled-digit positions.
    """
    lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
    # The question stem can wrap across 2+ physical lines when it's long (real case:
    # "다음 글의 밑줄 친 부분 중, 문맥상 낱말의 쓰임이 적절하지\n않은 것은?" — 2022 30번).
    # Taking only lines[0] then left the second half ("않은 것은?") glued onto the front
    # of passage_text, which also dragged that line's stray emphasis-underline into the
    # choice scan below. The stem always ends in '?', so join every line up to and
    # including the first one containing '?' — a single-line stem (the common case)
    # degrades to exactly the old lines[0] behavior.
    q_end = next((i for i, ln in enumerate(lines) if "?" in ln), 0)
    # The question stem itself sometimes has its own emphasis underline (e.g. "어법상
    # <u>틀린</u> 것은?") from the same detection pass — that's typographic emphasis in
    # the source, not an answer choice, so it's stripped back to plain text here rather
    # than leaking raw <u> markup into a field nothing downstream expects it in.
    question_text = _UNDERLINE_SPAN_RE.sub(r"\1", " ".join(lines[: q_end + 1])) if lines else ""
    passage_text = "\n".join(lines[q_end + 1 :]).strip()
    choices = [
        _LEADING_CIRCLED_RE.sub("", m.group(1).strip()).strip()
        for m in _UNDERLINE_SPAN_RE.finditer(passage_text)
    ]
    return {"question_text": question_text, "passage_text": passage_text, "choices": choices}


def validate_parsed_item(item: Dict) -> Optional[str]:
    """Return a skip-reason string if `item` looks like a bad parse, else None.

    수능 영어영역 has several problem types this parser's simple "passage, then a
    trailing list of 5 short choices" model doesn't fit — e.g. 무관 문장 찾기 (the
    ①~⑤ markers sit *inside* the passage narrative, not after it) or 장문독해 (several
    problem numbers share one long passage). Rather than special-case every 수능 유형,
    detect the parse going wrong and drop the item: a real 수능 choice is always one of
    5 short options, so anything wildly off that shape is almost certainly passage text
    that got swallowed into `choices` (or the reverse) rather than a genuine short option.
    """
    question_text = item.get("question_text", "")
    choices = item.get("choices")
    if question_text and not _HANGUL_RE.search(question_text):
        return "question_text has no Hangul (likely passage text swallowed as the question — see _HANGUL_RE comment)"
    # Type-classification must run on de-tagged text: a stray emphasis-underline on a
    # word *inside* the matched phrase (real case: "관계 <u>없는</u> 문장" — 무관 문장
    # 찾기's own instruction word got underlined) breaks a literal-phrase regex match,
    # letting the item silently fall through to the old marker-splitting path instead of
    # being rejected — the exact corruption this whole check exists to prevent.
    classify_text = _UNDERLINE_SPAN_RE.sub(r"\1", question_text)
    if _UNSUPPORTED_EMBEDDED_QUESTION_RE.search(classify_text):
        return "무관 문장 찾기 unsupported by this parser (no underline to anchor choices to)"
    is_underline_choice = bool(_UNDERLINE_CHOICE_QUESTION_RE.search(classify_text))
    if is_underline_choice:
        # Real 수능 어법/어휘-문맥 items always underline exactly 5 spans. Anything else
        # means underline detection missed/over-matched on this passage — skip rather
        # than ingest choices that don't correspond to the real ①~⑤ markers (the exact
        # failure mode that produced a wrong live post — see conversation history).
        if not choices or len(choices) != 5:
            return f"underline-choice item needs exactly 5 <u> spans, got {len(choices or [])}"
        if any(len(c) > 250 for c in choices):
            return "an underlined span is implausibly long"
    elif choices is not None:
        if len(choices) != 5:
            return f"choice count {len(choices)} != 5"
        if any(len(c) > 250 for c in choices):
            return "a choice is implausibly long (likely swallowed passage text)"
    if len(question_text) > 200:
        return "question_text implausibly long (likely cross-contaminated block)"
    passage = item.get("passage_text", "")
    if len(passage) < 20:
        return "passage_text implausibly short"
    # Listening-question fragments (e.g. a lone "Man:"/"Jason:" speaker cue plus a stray
    # tail of the previous question's Korean instruction, like "적절한 것을 고르시오.
    # [3점]\nMan:") clear the raw-length bar above but aren't a real reading passage — the
    # audio script isn't printed in the 문제지, so 수능's listening items (usually 1~17)
    # have nothing worth quoting anyway. A genuine printed passage is mostly English; these
    # fragments are almost entirely Korean instruction text. Empirically (5 real exam
    # years): garbage tops out at 6 Latin letters, real passages start at 89+ — 40 is a
    # safe cut with margin on both sides.
    if len(_ALPHA_RE.findall(passage)) < 40:
        return "passage_text has too little English content (likely a listening-question fragment)"
    return None


def parse_exam_text(text: str) -> List[Dict]:
    """Parse raw exam text into a list of passage dicts (pure — tolerant of partial failure).

    Each item: {problem_number, question_text, passage_text, choices|None}. Problems whose
    question or passage cannot be recovered, or that fail validate_parsed_item's shape
    check, are omitted — the caller reports the skips (both reasons) so nothing is
    silently dropped without a trace.
    """
    results: List[Dict] = []
    for num, block in split_problems(text):
        first_line = next((ln.strip() for ln in block.splitlines() if ln.strip()), "")
        # Classify on de-tagged text (see validate_parsed_item's matching comment) — a
        # stray emphasis-underline landing inside the matched phrase itself would
        # otherwise break this routing check the same way it broke the reject-check for
        # 무관 문장 찾기 (real case: "관계 <u>없는</u> 문장").
        if _UNDERLINE_CHOICE_QUESTION_RE.search(_UNDERLINE_SPAN_RE.sub(r"\1", first_line)):
            parsed = parse_underline_choice_block(block)
            question_text = str(parsed["question_text"])
            passage_text = str(parsed["passage_text"])
            choices = parsed["choices"] or None
        else:
            body, raw_choices = parse_choices(block)
            lines = [ln.strip() for ln in body.splitlines() if ln.strip()]
            if not lines:
                continue
            question_text = lines[0]
            passage_text = "\n".join(lines[1:]).strip()
            choices = raw_choices or None
        if not question_text or not passage_text:
            continue  # unrecoverable — skip (reported by caller)
        item = {
            "problem_number": num,
            "question_text": question_text,
            "passage_text": passage_text,
            "choices": choices,
        }
        if validate_parsed_item(item) is not None:
            continue  # implausible shape — skip (reported by caller)
        results.append(item)
    return results


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

async def _tag_new_passages(passage_ids: List[int]) -> None:
    """Backfill tags for freshly-inserted passages via one AI call each."""
    if not passage_ids:
        return
    from app.core.database import SessionLocal
    from app.models.exam_passage import ExamPassage
    from app.services.gemini_service import GeminiService

    gemini = GeminiService()
    db = SessionLocal()
    try:
        for pid in passage_ids:
            passage = db.get(ExamPassage, pid)
            if passage is None or passage.tags:
                continue
            tags = await gemini.tag_exam_passage(passage.passage_text, passage.question_text)
            if tags:
                passage.tags = tags
                db.commit()
                print(f"  tagged #{passage.problem_number}: {tags}")
    finally:
        db.close()


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
    """Extract → parse → idempotent insert → AI tag. Tolerates partial parse failures."""
    from app.core.database import SessionLocal
    from app.models.exam_passage import ExamPassage
    from sqlalchemy import select

    print(f"Extracting text: {pdf_path}")
    text = extract_text_from_pdf(pdf_path)
    parsed = parse_exam_text(text)
    print(f"Parsed {len(parsed)} problems.")

    all_nums = sorted({n for n, _ in split_problems(text)})
    parsed_nums = {item["problem_number"] for item in parsed}
    skipped_nums = [n for n in all_nums if n not in parsed_nums]
    if skipped_nums:
        print(
            f"Skipped {len(skipped_nums)} unparseable/implausible problems "
            f"(often 무관문장/순서/장문 유형): {skipped_nums}"
        )

    answers: Dict[int, str] = {}
    if answers_path:
        try:
            section = extract_form_section(extract_text_from_pdf(answers_path), form)
            answers = parse_answers_text(section)
            print(f"Parsed {len(answers)} answers (form={form}).")
        except Exception as e:  # noqa: BLE001 - answers are optional
            print(f"WARN: failed to parse answers PDF ({e}); continuing without answers.")

    inserted_ids: List[int] = []
    skipped_existing: List[int] = []
    db = SessionLocal()
    try:
        for item in parsed:
            num = item["problem_number"]
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
            passage = ExamPassage(
                year=year,
                exam_type=exam_type,
                month=month,
                problem_number=num,
                source_label=source_label,
                passage_text=item["passage_text"],
                question_text=item["question_text"],
                choices=item["choices"],
                answer=answers.get(num),
                status="unused",
            )
            db.add(passage)
            db.commit()
            db.refresh(passage)
            inserted_ids.append(passage.id)
        print(f"Inserted {len(inserted_ids)}, skipped {len(skipped_existing)} existing.")
    finally:
        db.close()

    if do_tagging and inserted_ids:
        print("Tagging new passages with AI...")
        asyncio.run(_tag_new_passages(inserted_ids))

    print("Done.")


def main() -> None:
    parser = argparse.ArgumentParser(description="수능/모의고사 영어 기출 PDF 인제스트")
    parser.add_argument("--pdf", default=None, help="문제 PDF 경로 (--answers-only일 땐 불필요)")
    parser.add_argument("--answers", default=None, help="정답 PDF 경로(선택)")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--exam-type", required=True, choices=["수능", "모의고사"])
    parser.add_argument("--month", type=int, default=None, help="모의고사 시행 월(수능은 생략)")
    parser.add_argument("--source-label", default=None, help='예: "2025학년도 수능 영어" (--answers-only일 땐 불필요)')
    parser.add_argument("--no-tagging", action="store_true", help="AI 태깅 단계 생략")
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
