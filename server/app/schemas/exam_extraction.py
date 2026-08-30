"""Pydantic response-schema models for the AI exam-PDF extraction pipeline.

Passed as `response_schema` to google.genai's structured-output config
(GeminiService.scan_exam_pdf_manifest / extract_exam_problems_from_pdfs) — the model's
JSON is guaranteed to conform (no markdown-fence-stripping / manual json.loads needed,
unlike every other GeminiService call in this codebase; this pipeline is the first to use
structured output because it's an unattended, unreviewed batch job where a malformed
response has repeatedly caused production incidents under the free-form JSON convention).
"""
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

ProblemType = Literal["standard", "underline_choice", "embedded_marker", "paragraph_order"]


class ExamManifestEntry(BaseModel):
    """One problem's structural summary from the cheap first-pass manifest scan.

    `passage_group` lists every problem number sharing one long 장문독해 passage (including
    this one); empty for a standalone problem. _plan_batches uses it to keep such a set
    inside a single extraction window.
    """
    problem_number: int
    problem_type: ProblemType
    passage_group: List[int] = Field(default_factory=list)


class ExamManifest(BaseModel):
    problems: List[ExamManifestEntry]


class ExtractedProblem(BaseModel):
    """One fully extracted + verified problem, ready for validate_extracted_item.

    `answer` is Optional because an ingest run may have no answer-key PDF; everything else
    is required — a problem the model can't fill completely is not safely publishable.
    """
    problem_number: int
    problem_type: ProblemType
    passage_group: List[int] = Field(default_factory=list)
    passage_text: str
    question_text: str
    choices: List[str] = Field(default_factory=list)
    answer: Optional[str] = None
    explanation: str
    tags: List[str] = Field(default_factory=list)


class ExtractedProblemBatch(BaseModel):
    problems: List[ExtractedProblem]
