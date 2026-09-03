"""ExamPassage model - real 수능/모의고사 English exam passages for the suneung pipeline.

Populated by the one-off ingest script (ingest_exam_pdfs.py), not by the app at runtime.
Each row is one exam question (passage + question + choices). The auto-blog suneung
pipeline is passage-first: the replenish step picks an unused, not-yet-paired passage,
derives a blog topic FROM its actual content and pairs the two (topic_id), then the publish
step writes an explainer post quoting the original passage verbatim and flips the passage
to 'used'.
"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Text, JSON, ForeignKey, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class ExamPassage(Base):
    """One real exam question (기출 지문). status flips to 'used' once a post cites it."""

    __tablename__ = "exam_passages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Provenance
    year: Mapped[int] = mapped_column(Integer, nullable=False)  # e.g. 2025
    exam_type: Mapped[str] = mapped_column(String(20), nullable=False)  # '수능' | '모의고사'
    month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 모의고사 시행 월, 수능은 NULL
    problem_number: Mapped[int] = mapped_column(Integer, nullable=False)
    source_label: Mapped[str] = mapped_column(String(100), nullable=False)  # "2025학년도 수능 영어"

    # Structural discriminator for how passage_text/choices must be quoted downstream
    # (generate_blog_post branches on it). Every 유형 still boils down to "pick 1 of 5", so
    # the flat passage/question/choices shape holds for all four — only the *rendering
    # contract* differs:
    #   'standard'         — 지문 뒤에 ①~⑤ 선택지가 따로 나열되는 대부분의 유형.
    #   'underline_choice' — 어법/어휘 문맥. passage_text 안에 <u>...</u> 5구간이 살아 있고
    #                        choices가 그 구간 텍스트다 (기존 컨벤션 그대로, 변경 없음).
    #   'embedded_marker'  — 무관 문장 찾기 / 문장 삽입. ①~⑤ 표시가 지문 문장 사이에 박힌
    #                        채로 passage_text에 그대로 남아 있어야 의미가 통한다.
    #   'paragraph_order'  — 글의 순서 배열. passage_text가 (A)(B)(C) 라벨을 유지하고
    #                        choices는 "(B) - (A) - (C)" 같은 순열 문자열이다.
    #   'chart'            — 도표(그래프) 문제. passage_text는 인쇄된 도입 문장 + AI가 도표를
    #                        보고 옮겨 적은 수치 요약이고, 실제 도표 이미지는 chart_image에
    #                        따로 저장된다(아래 설명 참고). 예전엔 'standard'에 섞여 있었는데,
    #                        지문에 "재현할 인쇄 텍스트"가 아예 없다 보니 AI가 매번 그럴듯한
    #                        수치를 지어내 해설을 썼다(2026 수능 25번 실사고 — 실제 수치와
    #                        다른 값으로 오답 해설이 만들어져 발행됨).
    # NOT NULL + server_default='standard': 기존 row는 전부 구 regex 파서 산출물이라
    # standard/underline_choice 모양뿐이고, 아래쪽 <u> 처리는 problem_type과 무관하게 항상
    # 동작하므로 옛 row에 'standard'가 찍혀도 손해가 없다(백필 불필요).
    problem_type: Mapped[str] = mapped_column(
        String(30), default="standard", server_default="standard", nullable=False
    )

    # Content
    passage_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    choices: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # 5지선다, 없으면 NULL
    answer: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # 정답, 미상이면 NULL
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # AI가 부여한 문법/소재 키워드

    # AI가 추출 단계에서 정답표 PDF와 교차 확인하며 함께 작성한 한국어 해설(왜 정답이고 왜
    # 나머지가 오답인지). 나중에 generate_blog_post가 "이미 검증된 해설 논리"로 프롬프트에
    # 넣어 재추론 대신 근거로 삼는다. NULL이면 옛 row(구 파서 산출물)라는 뜻이고, 그때는
    # 예전처럼 모델이 지문·선택지만 보고 스스로 해설을 만든다.
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # problem_type == 'chart'일 때만 채워지는, PDF에서 실제로 잘라낸 도표 이미지(PNG 원본
    # 바이트). ingest_exam_pdfs.py가 AI가 알려준 페이지/좌우 위치(chart_page/chart_side)를
    # 근거로 pdfplumber의 page.images를 클러스터링해 잘라낸다. NULL이면 이 문항엔 크롭할
    # 도표가 없다는 뜻(chart가 아니거나, 크롭이 실패한 경우) — 발행 파이프라인은 NULL을
    # "이미지 없이 텍스트 요약만으로 발행"으로 처리하고 발행 자체를 막지는 않는다.
    chart_image: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)

    # 장문독해(41~42번처럼 여러 문항이 하나의 긴 지문을 공유)에서 같은 지문을 복제해 가진
    # row들을 묶어보기 위한 관찰용 태그. 관계형 개념이 아니다 — FK도, 이 컬럼을 읽는 조회
    # 쿼리도 없다. 각 row는 여전히 독립적으로 자기 토픽 1개와 페어링되는 기존
    # "지문 1 : 토픽 1 : 글 1" 모델을 그대로 따른다. 단일 문항이면 NULL.
    passage_group_key: Mapped[Optional[str]] = mapped_column(
        String(60), nullable=True, index=True
    )

    # 1:1 pairing with the blog topic that was derived FROM this passage (passage-first
    # discovery). Nullable because passages are ingested in bulk long before any topic
    # exists — NULL simply means "no topic derived from this one yet", which is the normal
    # state for freshly ingested rows and the only state get_unused_passage_without_topic
    # will hand out. SET NULL (not CASCADE) on purpose: passages are scarce, hard-won
    # ingested content, so deleting a topic must only unpair the passage, never destroy it.
    topic_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("blog_topics.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
        index=True,
    )

    # Lifecycle
    status: Mapped[str] = mapped_column(
        String(10), default="unused", server_default="unused", nullable=False, index=True
    )  # 'unused' | 'used'

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return (
            f"<ExamPassage(id={self.id}, {self.source_label}, "
            f"no={self.problem_number}, status={self.status})>"
        )
