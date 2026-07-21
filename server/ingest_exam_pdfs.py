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
_ANSWER_RE = re.compile(r"(\d{1,2})\s*[.)]?\s*([①②③④⑤1-5])")
_CIRCLED_TO_NUM = {c: str(i + 1) for i, c in enumerate(CIRCLED)}


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


def parse_exam_text(text: str) -> List[Dict]:
    """Parse raw exam text into a list of passage dicts (pure — tolerant of partial failure).

    Each item: {problem_number, question_text, passage_text, choices|None}. Problems whose
    question or passage cannot be recovered are omitted (the caller reports the skips).
    """
    results: List[Dict] = []
    for num, block in split_problems(text):
        body, choices = parse_choices(block)
        lines = [ln.strip() for ln in body.splitlines() if ln.strip()]
        if not lines:
            continue
        question_text = lines[0]
        passage_text = "\n".join(lines[1:]).strip()
        if not question_text or not passage_text:
            continue  # unrecoverable — skip (reported by caller)
        results.append(
            {
                "problem_number": num,
                "question_text": question_text,
                "passage_text": passage_text,
                "choices": choices or None,
            }
        )
    return results


def parse_answers_text(text: str) -> Dict[int, str]:
    """Parse an answer-sheet text into {problem_number: answer_string} (pure).

    Circled digits are normalized to '1'..'5'. Best-effort — malformed lines are ignored.
    """
    answers: Dict[int, str] = {}
    for m in _ANSWER_RE.finditer(text or ""):
        num = int(m.group(1))
        raw = m.group(2)
        answers[num] = _CIRCLED_TO_NUM.get(raw, raw)
    return answers


# ---------- Thin IO wrapper (monkeypatchable in tests) ----------

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract the text layer of a PDF via pdfplumber (lazy import). Not a scan — no OCR."""
    import pdfplumber  # lazy: keeps this module importable where pdfplumber isn't installed

    parts: List[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            parts.append(page.extract_text() or "")
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


def ingest(
    *,
    pdf_path: str,
    year: int,
    exam_type: str,
    source_label: str,
    month: Optional[int] = None,
    answers_path: Optional[str] = None,
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

    answers: Dict[int, str] = {}
    if answers_path:
        try:
            answers = parse_answers_text(extract_text_from_pdf(answers_path))
            print(f"Parsed {len(answers)} answers.")
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
    parser.add_argument("--pdf", required=True, help="문제 PDF 경로")
    parser.add_argument("--answers", default=None, help="정답 PDF 경로(선택)")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--exam-type", required=True, choices=["수능", "모의고사"])
    parser.add_argument("--month", type=int, default=None, help="모의고사 시행 월(수능은 생략)")
    parser.add_argument("--source-label", required=True, help='예: "2025학년도 수능 영어"')
    parser.add_argument("--no-tagging", action="store_true", help="AI 태깅 단계 생략")
    args = parser.parse_args()

    ingest(
        pdf_path=args.pdf,
        year=args.year,
        exam_type=args.exam_type,
        month=args.month,
        source_label=args.source_label,
        answers_path=args.answers,
        do_tagging=not args.no_tagging,
    )


if __name__ == "__main__":
    main()
