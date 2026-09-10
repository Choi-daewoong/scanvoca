"""Gemini service for word definitions and Vision OCR"""
import json
import re
import base64
from typing import Optional, Dict, Any, List
import google.generativeai as genai
from app.core.config import settings
from app.services.image_style import IMAGE_STYLE_GUIDE

# Image generation runs on the newer google-genai SDK (the legacy google-generativeai
# package cannot request IMAGE output). Imported lazily inside generate_blog_image so
# module import stays cheap and unaffected by the new SDK.
BLOG_IMAGE_MODEL = "gemini-2.5-flash-image"

# Exam-PDF extraction runs on the pro model: it reads two full PDFs jointly and reasons
# about the answer, and it's a rare unattended batch job (a few runs a year), so accuracy
# matters far more than per-call cost or latency.
# gemini-2.5-pro started 404ing ("no longer available to new users") sometime after this
# pipeline shipped, even though it's still listed by client.models.list() — Google's
# per-project entitlement, not the public catalog, gates access. gemini-3.1-pro-preview is
# the model Google's own 404 response names as the replacement, and it responds fine to
# both a plain call and (verified live, 2026-09-08) the PDF+response_schema pattern this
# module uses. It's a preview name, so it may itself get renamed/retired later — if this
# 404s again, check `client.models.list()` for the current pro-tier name.
EXAM_EXTRACTION_MODEL = "gemini-3.1-pro-preview"

# Target hero-image output size: 16:9 at exactly 1.5x the pixel area of the previous
# 1024x1024 default (the model's un-configured fallback — confirmed by live probe, since
# it ignores the text-only "prefer 16:9" hint in drawing_agent.md without a structured
# aspect_ratio param). image_size ("1K"/"2K"/"4K") was probed too and made no difference
# to actual output resolution for this model, so it isn't used — the resize below is the
# only reliable way to control final pixel area.
HERO_IMAGE_WIDTH = 1672
HERO_IMAGE_HEIGHT = 940

# conversation-clipper's dialogue-first discovery (suggest_conversation_topic_from_dialogue)
# runs fully unattended on a self-looping NAS container — unlike the manual-add topic
# flow, no admin reviews a discovered topic before it can be auto-published. The prompt
# tells the model to avoid profanity, but a real run still produced a title quoting "Fuck
# realistic" verbatim (source dialogue happened to contain it) — prompt instructions alone
# aren't a reliable content-safety gate for a service whose stated audience is 중·고등학생,
# so this is a code-level backstop, not a replacement for the prompt instruction.
_PROFANITY_RE = re.compile(
    r"\b(fuck|shit|bitch|asshole|dick|pussy|cunt|bastard)\w*\b", re.IGNORECASE
)


def _contains_profanity(*texts: str) -> bool:
    return any(_PROFANITY_RE.search(t) for t in texts)


def _has_api_key() -> bool:
    return bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your-gemini-api-key-here")


# ---------- Exam-PDF extraction prompts (scan_exam_pdf_manifest /
# extract_exam_problems_from_pdfs — module level so tests can assert on them without a
# client) ----------

EXAM_MANIFEST_PROMPT = """당신은 한국 수능/모의고사 영어영역 문제지 분석 전문가입니다.
첨부된 PDF는 실제 수능/모의고사 영어 문제지입니다. 이 문제지에 등장하는 모든 문항 번호를
빠짐없이 찾아, 각 문항의 유형을 아래 5가지 중 하나로 분류하세요. 본문 내용은 이 단계에서
추출하지 마세요 — 문항 번호와 유형 분류만 필요합니다.

유형 분류 기준:
- "standard": 지문 뒤에 ①~⑤ 선택지가 순서대로 나열되는 일반적인 유형 (목적/주장/함의추론/
  요지/주제/제목/심경/내용일치·불일치/빈칸추론/요약문완성/장문독해 각 문항 등 대부분).
- "chart": 막대그래프·선그래프·원그래프·표 등 시각 자료를 놓고 그 안의 수치를 비교해야
  풀리는 도표 문제. 지문이 인쇄된 문장이 아니라 이미지(그림)로 된 도표라는 점이 "standard"
  와 다른 결정적 차이입니다 — 도표는 절대 "standard"로 분류하지 마세요.
- "underline_choice": "다음 밑줄 친 부분 중 어법상 틀린 것은?" / "문맥상 낱말의 쓰임이 적절
  하지 않은 것은?" 유형 — 선택지가 지문 속 5개의 밑줄 친 구간.
- "embedded_marker": "다음 글에서 전체 흐름과 관계 없는 문장은?" (무관한 문장) 또는
  "주어진 문장이 들어가기에 가장 적절한 곳은?" (문장 삽입) 유형 — ①~⑤ 표시가 지문 문장
  중간중간에 박혀 있음.
- "paragraph_order": "주어진 글 다음에 이어질 글의 순서로 가장 적절한 것은?" 유형 —
  (A)(B)(C)로 표시된 문단들을 재배열하는 문제.

여러 문항 번호(예: 41, 42)가 하나의 긴 지문을 공유하는 장문독해 세트라면, 각 문항의
passage_group에 그 세트에 속한 모든 문항 번호(자기 자신 포함)를 나열하세요. 세트가 아니면
passage_group은 빈 배열로 두세요."""


def _build_extraction_prompt(problem_numbers, form: str, has_answers: bool) -> str:
    """Build the per-batch extraction prompt for extract_exam_problems_from_pdfs.

    Pure (no IO) so tests can assert its content directly. `has_answers` switches between
    "read the answer from the {form} table of the second PDF" and "decide the answer
    yourself" — mirroring generate_blog_post's existing has_answer branch.
    """
    numbers_str = ", ".join(str(n) for n in problem_numbers)
    answer_instruction = (
        f'두 번째 PDF는 정답표입니다. 반드시 "{form}" 표에서 정답을 찾아 answer 필드에 '
        f'"1"~"5" 중 하나로 채우세요 (①=1 ... ⑤=5).'
        if has_answers else
        "정답표가 제공되지 않았습니다 — 지문·문제·선택지 내용을 근거로 정답을 스스로 "
        "판단해 answer 필드에 채우세요."
    )
    return f"""첨부된 문제지 PDF(와 정답표 PDF)를 함께 읽고, 문항 번호 {numbers_str}번만 추출하세요.
다른 번호는 절대 포함하지 마세요.

각 문항에 대해 다음을 정확히 채우세요:
1. problem_type: "standard" | "chart" | "underline_choice" | "embedded_marker" |
   "paragraph_order" 중 실제 이 문항의 유형. 도표(그래프)는 반드시 "chart"로 분류하세요.
2. passage_text: 지문을 인쇄된 그대로 완전히 재현하세요. 절대 요약하거나 창작하지 마세요.
   - problem_type이 "chart"이면, 지문에 인쇄된 도입 문장("The graph above shows..." 등)을
     그대로 옮긴 다음, 줄바꿈 후 도표 안의 모든 항목과 수치를 빠짐없이 옮겨 적으세요(예:
     "[도표 데이터] Text Messaging: Every Day 55%, Less Often 13% / Talking on the Phone:
     Every Day 19%, Less Often 41% / ..."). 절대 대략적인 값을 추측하지 말고, 도표에 실제로
     인쇄된 숫자를 그대로 읽어서 옮기세요 — 이 수치는 나중에 해설과 블로그 글이 그대로
     인용하므로, 틀리면 잘못된 정답 해설이 그대로 학생들에게 발행됩니다.
   - problem_type이 "underline_choice"이면, 선택지에 해당하는 5개의 구간을 <u>...</u>로
     감싸 지문 안에 그대로 표시하세요.
   - problem_type이 "embedded_marker"이면, 지문에 인쇄된 ①②③④⑤ 표시를 실제 위치 그대로
     지문 텍스트 안에 남겨두세요 (마지막에 목록으로 빼지 마세요).
   - problem_type이 "paragraph_order"이면, 지문 도입부와 (A)(B)(C) 문단 표시를 원문 그대로
     유지하세요.
   - 빈칸추론 문제는 빈칸 표시(밑줄/괄호 등 원문 표기)를 절대 빠뜨리지 마세요.
3. question_text: 지시문(한글 질문 문장) 그대로.
4. choices: 정확히 5개.
   - "standard"/"chart"/"underline_choice"/"embedded_marker": 각 선택지(또는 밑줄 구간,
     또는 지문 속 후보 문장)의 텍스트.
   - "paragraph_order": 선택지에 인쇄된 순서 표기 그대로(예: "(B) - (A) - (C)").
5. answer: {answer_instruction}
6. explanation: 정답이 왜 옳고 나머지 선택지가 왜 틀렸는지 한국어로 상세히 설명하세요. 이
   해설은 나중에 블로그 글의 해설 섹션 근거로 그대로 쓰이므로, 각 오답 선택지에 대한 반박
   근거까지 포함해 충분히 구체적으로 작성하세요. problem_type이 "chart"이면 passage_text에
   옮겨 적은 실제 수치만 근거로 쓰고, 그 수치를 다시 옮길 때도 절대 반올림하거나 다른 값으로
   바꿔 쓰지 마세요.
7. tags: 이 문항의 문법/유형 포인트(예: 빈칸추론, 역접, 인과)와 소재 키워드(예: 환경, 심리)를
   섞어 3~5개, 짧은 한국어 단어/구로.
8. chart_page: problem_type이 "chart"일 때만 채우세요 — 이 도표가 인쇄된 문제지 PDF의
   쪽 번호(1부터 시작). 그 외 유형이면 null로 두세요.
9. chart_side: problem_type이 "chart"일 때만 채우세요 — 그 쪽에서 도표가 왼쪽 칼럼에
   있으면 "left", 오른쪽 칼럼이면 "right", 페이지가 한 칼럼뿐이라 폭 전체를 쓰면
   "full_width". 정확한 픽셀 위치가 아니라 이 3가지 중 하나만 고르면 됩니다. 그 외
   유형이면 null로 두세요."""


class GeminiService:
    """Service for Google Gemini API calls"""

    @staticmethod
    def is_image_generation_configured() -> bool:
        """True when an API key is present so the image model can be reached."""
        return _has_api_key()

    def __init__(self):
        self.model = None
        self.vision_model = None
        if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your-gemini-api-key-here":
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel('gemini-2.5-flash-lite')
            self.vision_model = genai.GenerativeModel('gemini-2.5-flash')

    async def get_word_definition(self, word: str, retry_count: int = 0, max_retries: int = 2) -> Optional[Dict[str, Any]]:
        """
        Get word definition from Gemini API with retry logic
        Returns None if API key not configured or error occurs after retries
        """
        if self.model is None:
            print("Gemini API key not configured")
            return None

        try:
            # Construct prompt with word validation
            prompt = f"""You are an English-Korean dictionary API. First, validate if the input is a real English word, then provide a definition.

Input: "{word}"

IMPORTANT - Word Validation Rules:
1. First, check if "{word}" is a REAL English word or expression (including proper nouns, idioms, phrasal verbs, fixed collocations, common abbreviations)
2. If it's NOT valid (e.g., random letters, OCR errors like "geet", "alaoa", "sact", gibberish, or words that don't form a real idiom together), return: {{"is_valid": false, "word": "{word}", "reason": "Not a valid English word"}}
3. If it IS valid, return the full definition with "is_valid": true
4. If "{word}" consists of multiple words (e.g. "be good at", "give up"), treat it as a single idiom/phrasal verb entry, not as separate words

Return a JSON object with this structure:
{{
  "is_valid": true/false,
  "word": "{word}",
  "reason": "Only if is_valid is false - explain why",
  "pronunciation": "IPA pronunciation (only if valid)",
  "difficulty": 1-5 (1=beginner, 5=advanced, only if valid),
  "meanings": [
    {{
      "partOfSpeech": "noun/verb/adjective/etc (in English only)",
      "korean": "Korean translation",
      "english": "English definition",
      "examples": [
        {{
          "en": "Example sentence in English",
          "ko": "Korean translation of example"
        }}
      ]
    }}
  ]
}}

Important:
1. ALWAYS include "is_valid" field (true or false)
2. For invalid words, only return is_valid, word, and reason fields
3. Use standard English part of speech labels (noun, verb, adjective, adverb, preposition, conjunction, pronoun, etc.). For idioms/phrasal verbs/collocations made of multiple words, use "idiom"
4. Provide at least 1-2 meanings for common words
5. Include 1-2 example sentences for each meaning
6. Ensure all JSON is properly formatted and COMPLETE
7. Return ONLY the JSON object, no additional text
"""

            # Call Gemini API
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.3,
                    "max_output_tokens": 2000,  # 1000 → 2000으로 증가 (잘림 방지)
                }
            )

            # Parse response
            content = response.text
            if content:
                # Remove markdown code blocks if present
                content = content.strip()
                if content.startswith("```json"):
                    content = content[7:]
                if content.startswith("```"):
                    content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()

                result = json.loads(content, strict=False)
                return result

        except json.JSONDecodeError as e:
            # UTF-8 인코딩 강제 적용하여 출력
            error_msg = f"Gemini JSON parse error (attempt {retry_count + 1}/{max_retries + 1}): {e}"
            raw_msg = f"Raw content: {content[:500]}"  # 최대 500자만 출력
            try:
                print(error_msg)
                print(raw_msg)
            except UnicodeEncodeError:
                # cp949 인코딩 실패 시 ASCII로 출력
                print(error_msg.encode('ascii', errors='ignore').decode('ascii'))
                print(raw_msg.encode('ascii', errors='ignore').decode('ascii'))

            # 재시도 로직
            if retry_count < max_retries:
                print(f"🔄 Retrying word '{word}' ({retry_count + 1}/{max_retries})...")
                return await self.get_word_definition(word, retry_count + 1, max_retries)
            else:
                print(f"❌ Failed to get definition for '{word}' after {max_retries + 1} attempts")
                return None

        except Exception as e:
            error_msg = f"Gemini API error: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode('ascii', errors='ignore').decode('ascii'))

            # API 오류는 재시도하지 않음 (비용 절감)
            return None

        return None

    async def generate_blog_post(
        self,
        title: Optional[str] = None,
        angle: Optional[str] = None,
        custom_prompt: Optional[str] = None,
        recent_posts: Optional[List[Dict[str, str]]] = None,
        include_practice_questions: bool = False,
        include_word_list: bool = False,
        source_passage: Optional[Dict[str, Any]] = None,
        source_dialogue: Optional[Dict[str, Any]] = None,
        retry_count: int = 0,
        max_retries: int = 2,
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a Korean English-learning blog post.
        Returns a dict: {slug, title, description, category, tags, body} or None on error.
        Either (title[, angle]) or custom_prompt must be provided.
        recent_posts (optional): previously published posts [{slug, title, description,
        category}] so the model avoids repeating content and may naturally cross-link one
        when genuinely relevant (never forced).
        include_practice_questions (optional): when True, the model additionally returns a
        `practice_questions` array which the caller renders into a `## 실전 연습문제` section
        placed before the promo section. The model picks the TOEIC part(s) (5/6 grammar-blank
        vs. 7 reading) that actually match the topic instead of always mixing both. Default
        False keeps the existing manual-workflow output shape unchanged.
        include_word_list (optional): when True, the model additionally returns a `word_list`
        array of 5-15 lowercase English headwords actually covered by the post. Only the
        headwords — meanings/definitions come from the app's own word DB via
        WordService.get_or_create_words, so a reader's imported wordbook matches what the
        app shows everywhere else. Default False leaves the output shape unchanged.
        source_passage (optional, suneung pipeline): a real exam passage
        {passage_text, question_text, choices, answer, source_label, problem_number, tags}.
        When given, the model writes an explainer that quotes the passage verbatim (never
        invents one) and appends the original passage/question/answer/explanation + a KICE
        source line at the bottom. The title is required to lead with source_label +
        problem_number + the tags-derived question type (what people actually search for),
        not the passage's subject matter — see the docstring on that title rule inline below
        for the live case that motivated it (brain-automation-consciousness-grammar-suneung-
        2025-29's content-hook title has zero of the terms a real exam searcher would type).
        source_dialogue (optional, conversation pipeline): a real dialogue clip
        {dialogue_en, dialogue_ko, video_title, clip_url, context_en}. When given, the model
        quotes the dialogue and explains its expressions/vocabulary. context_en (optional) is
        reference-only surrounding scene dialogue — never quoted, used only so the model
        judges tone/intent (e.g. playful vs. defensive) correctly instead of guessing cold
        from the bare excerpt (see window_context_text in local-tools/conversation-clipper).
        Retries on malformed JSON (mirrors get_word_definition) - the model occasionally
        breaks JSON validity in a ~1,500-2,500 char Korean body, and a retry usually fixes it.
        """
        if self.model is None:
            print("Gemini API key not configured")
            return None

        categories = ["토익·비즈니스", "수능·내신", "암기법·학습팁", "일상영어", "자격시험"]
        categories_str = ", ".join(categories)

        if custom_prompt and custom_prompt.strip():
            topic_block = f'사용자가 직접 입력한 주제/지시:\n"""{custom_prompt.strip()}"""'
        else:
            topic_block = f'주제(제목 후보): "{title}"'
            if angle:
                topic_block += f'\n글 방향/타깃/키워드 메모: "{angle}"'

        recent_posts_block = ""
        if recent_posts:
            lines = "\n".join(
                f'- "{p["title"]}" (slug: {p["slug"]}, 카테고리: {p["category"]}) — {p["description"]}'
                for p in recent_posts
            )
            recent_posts_block = f"\n\n[이미 발행된 최근 글 목록]\n{lines}\n"

        # Optional TOEIC practice-question block. When enabled we ask the model both to leave
        # room for a `## 실전 연습문제` section before the promo AND to return the questions as
        # structured JSON (the caller renders the markdown from that structure).
        if include_practice_questions:
            practice_instruction = (
                "\n11. 이 글은 TOEIC RC(Reading, Part 5·6·7)만 다룹니다 — 본문 전체가 문법·어휘·독해 "
                "관련 내용이어야 하며, LC(Listening, Part 1~4)는 본문에서도 절대 다루지 마세요. "
                "\n12. 본문 마지막 홍보 섹션 **앞에** `## 실전 연습문제` 섹션이 들어갈 것입니다. "
                "먼저 위 주제(제목/방향)가 TOEIC의 어느 파트에 해당하는 내용인지 판단하세요 — "
                "문법 공식·품사·어형 변화·빈칸 채우기 같은 문법/어휘 주제라면 Part 5·6, "
                "지문을 읽고 정보를 찾는 독해 전략·스킴 주제라면 Part 7입니다. "
                "**본문 내용과 같은 파트의 문제만** practice_questions에 3~4개 채우세요 — "
                "글이 문법 빈칸 주제인데 지문 독해(Part 7) 문제를 섞거나, 반대로 독해 주제인데 "
                "단문 빈칸(Part 5) 문제만 넣는 식으로 본문과 어긋나는 파트를 섞지 마세요. "
                "각 문제는 type 필드에 실제 해당하는 파트("
                "\"Part 5\"/\"Part 6\"/\"Part 7\")를 쓰고, 보기 4개(choices)와 정답 인덱스"
                "(answer_index, 0부터 시작), 한국어 해설(explanation)을 포함해야 합니다. "
                "Part 6·7 문제는 passage(짧은 영문 지문)를 포함하세요. Part 5 문제는 passage를 비워도 됩니다. "
                "body 문자열 안에는 연습문제 내용을 단 한 글자도 쓰지 마세요 — `## 실전 연습문제` 같은 "
                "소제목은 물론, '아래 문제를 풀어보세요', '다음은 관련 문제입니다' 같은 안내 문장이나 "
                "예고조차 body에 넣지 마세요(연습문제 섹션은 body와 별도로 이미 자동으로 삽입되므로 "
                "body에서 언급할 필요가 전혀 없습니다). body는 마지막 실전 팁 설명이 끝나는 즉시 "
                "홍보 섹션으로 넘어가야 합니다. 또한 body 문자열 안에 마크다운 코드펜스(```)를 "
                "포함하지 마세요 — practice_questions는 반드시 JSON의 별도 필드로만 작성하고, "
                "body 문자열 값 중간에 JSON이나 코드 블록을 끼워 넣으면 전체 응답이 깨집니다."
            )
            practice_schema = (
                ',\n  "practice_questions": [\n'
                '    {"type": "Part 5", "passage": "", "question": "The report must be ____ by Friday.", '
                '"choices": ["submit", "submits", "submitted", "submitting"], "answer_index": 2, '
                '"explanation": "수동태 표현이므로 submitted."}\n'
                "  ]"
            )
        else:
            practice_instruction = ""
            practice_schema = ""

        # Optional word-list block. The caller turns this into a real Wordbook + share post
        # and inserts a "가져가기" CTA, so we only need bare headwords here.
        if include_word_list:
            word_list_instruction = (
                "\n[단어 목록] 본문 마지막 홍보 섹션 앞에 이 글의 핵심 단어 목록 안내가 삽입됩니다. "
                "실제로 본문에서 다루는 단어 중 학습자에게 유용한 5~15개를 word_list에 "
                "소문자 영단어 원형으로만 나열하세요. 뜻·설명·예문은 만들지 마세요(앱 사전 DB에서 "
                "별도로 가져옵니다). body 안에는 별도의 단어 목록 섹션을 쓰지 마세요."
            )
            word_list_schema = ',\n  "word_list": ["contract", "invoice", "negotiate"]'
        else:
            word_list_instruction = ""
            word_list_schema = ""

        # Suneung pipeline: inject a real exam passage the model must quote verbatim.
        source_block = ""
        source_instruction = ""
        if source_passage:
            choices = source_passage.get("choices") or []
            circled = "①②③④⑤"
            # 문장 삽입형(embedded_marker) 문항은 choices가 실제 문장 텍스트가 아니라 마커
            # 기호 자체("①","②"...)인 경우가 있다 — 지문 속 어느 위치에 넣을지 고르는
            # 문제라 "선택지"에 별도로 인용할 텍스트가 없기 때문. 이 경우 그대로 렌더링하면
            # "①. ①" 같은 무의미한 중복 목록이 나온다(실사고: 2022/2024/2026 수능 38·39번).
            # 반면 무관한 문장 찾기처럼 choices가 진짜 문장 텍스트인 embedded_marker 문항은
            # 평소대로 렌더링해야 하므로, "choices가 전부 마커 기호 자체"인 경우만 걸러낸다.
            is_marker_only_choices = bool(choices) and all(
                str(c).strip() in set(circled) for c in choices
            )
            if is_marker_only_choices:
                choices_str = (
                    "(선택지는 지문 안에 표시된 ①~⑤ 위치 자체입니다 — 별도로 인용할 "
                    "선택지 텍스트가 없으니 '선택지:' 목록을 따로 만들지 말고, 위 지문에 "
                    "표시된 ①~⑤ 위치를 그대로 가리키며 설명하세요.)"
                )
            else:
                choices_str = (
                    "\n".join(
                        f"{circled[i] if i < len(circled) else i + 1}. {c}"
                        for i, c in enumerate(choices)
                    )
                    if choices
                    else "(선택지 없음)"
                )
            source_label = source_passage.get("source_label", "기출문제")
            problem_number = source_passage.get("problem_number")
            citation_label = (
                f"{source_label} {problem_number}번" if problem_number else source_label
            )
            passage_tags = [t for t in (source_passage.get("tags") or []) if str(t).strip()]
            tags_str = ", ".join(passage_tags) if passage_tags else "(태그 없음)"
            has_answer = bool(source_passage.get("answer"))
            answer_line = (
                source_passage.get("answer")
                if has_answer
                else "정답 미상 — 아래 지문·문제·선택지 내용을 근거로 정답을 직접 판단해서 명시할 것"
            )
            source_block = (
                "\n\n[활용할 실제 기출 지문 — 창작 금지, 아래 원문을 그대로 인용할 것]\n"
                f'출처: {citation_label}\n'
                f'지문(passage, 밑줄 친 부분은 <u>...</u>로 표시되어 있으면 본문에서도 그대로 밑줄로 살릴 것):'
                f'\n"""{source_passage.get("passage_text", "")}"""\n'
                f'문제(question): {source_passage.get("question_text", "")}\n'
                f'선택지:\n{choices_str}\n'
                f'정답: {answer_line}\n'
            )
            source_instruction = (
                "\n11. 위 [활용할 실제 기출 지문]을 소재로 한 해설형 글을 작성하세요. 지문을 임의로 "
                "창작하거나 변형하지 말고 주어진 원문 그대로 인용해야 합니다(지문에 <u>...</u> 밑줄 표시가 "
                "있다면 본문에 인용할 때도 그대로 유지하세요)."
                "\n12. **글의 구성 순서를 반드시 지키세요**: "
                "(1) 도입부는 짧게 1문단만 — 이 문제가 왜 까다로운지, 어떤 유형인지 정도만 짧게 언급하고 "
                "정답이나 지문 내용을 미리 풀이하거나 스포일러하지 마세요. "
                "(2) 도입 문단 바로 다음에 원문 지문 전체 + 문제(question) + 선택지를 그대로 제시하세요 — "
                "독자가 먼저 스스로 풀어볼 수 있도록 정답과 해설보다 앞에 배치해야 합니다. "
                + (
                    "위 [선택지]에 안내된 대로, 이 문항은 지문 안에 이미 표시된 ①~⑤ 위치를 고르는 "
                    "문제이므로 '선택지:' 목록을 별도로 만들지 마세요 — 지문 속 ①~⑤ 표시만으로 충분합니다. "
                    if is_marker_only_choices
                    else "선택지는 위 [선택지] 목록에 이미 ①②③④⑤ 번호가 붙어 있으니 그 번호와 순서를 그대로 유지하고, "
                    "**각 선택지를 반드시 줄바꿈하여 한 줄에 하나씩** 표시하세요(번호를 빼거나 한 줄로 붙여 쓰지 마세요). "
                )
                + "(2-1) 선택지 바로 다음, 전략·해설보다 앞에 \"**해석:**\" 소제목을 넣고 지문 전체를 자연스러운 "
                "한국어로 완역하세요. 문장을 누락하거나 요약하지 말고 지문 전체를 빠짐없이 번역해, 독자가 "
                "영어 원문을 다 이해하지 못해도 이 번역만으로 지문 내용을 완전히 파악할 수 있게 하세요. "
                "밑줄 친 부분이나 ①~⑤ 표시가 지문 안에 있다면 번역문에서도 그 위치에 표시를 그대로 유지하세요. "
                "(3) 그 다음 섹션에서, 문제 유형(예: 글의 목적/요지/주제/제목, 내용 일치·불일치, 어휘 문맥, "
                "심경·분위기, 도표 해석, 빈칸 추론 등)을 스스로 판단해 **그 유형에 맞는 일반적인 풀이 전략**을 "
                "설명하세요 — 예를 들어 '내용과 일치하지 않는 것은?' 유형이면 지문을 처음부터 정독하기보다 "
                "선택지를 먼저 훑어본 뒤 각 선택지에 해당하는 부분을 지문에서 찾아 대조하는 방식이 효율적이라는 "
                "식으로, 이 문제를 아직 스스로 풀어보지 않은 독자에게 실제로 도움이 되는 접근법을 제시하세요. "
                "이 단계에서도 정답 번호를 직접 밝히지 마세요. "
                "(4) 마지막으로 정답과 선택지별 상세 해설(왜 정답이고 왜 나머지는 오답인지)을 제시하세요."
                f'\n13. 본문에 반드시 "본 지문은 한국교육과정평가원이 출제한 기출문제입니다({citation_label})" '
                "라는 출처 문구를 포함하세요(지문을 제시하는 (2) 섹션 근처가 자연스럽습니다)."
                + (
                    ""
                    if has_answer
                    else "\n14. 정답이 별도로 제공되지 않았습니다 — 지문·문제·선택지 내용을 근거로 "
                    "정답을 스스로 판단하고, 애매한 태도 없이 확정된 정답으로 제시한 뒤 그렇게 판단한 "
                    "근거를 해설에서 논리적으로 설명하세요."
                )
                + (
                    "\n15. **제목(title)은 반드시 검색 유입을 최우선으로 지으세요.** 수능 문제를 검색하는 "
                    "사람들은 지문의 소재(예: 뇌과학, 환경, 심리학 같은 내용 주제)가 아니라 "
                    f"\"{citation_label}\"처럼 **연도·시험명·과목·문제번호**, 그리고 **문제 유형**"
                    f"(아래 [문제 유형 태그]: {tags_str} — 어법이면 구체적 문법 포인트(예: to부정사, 분사구문, "
                    "관계대명사), 독해면 유형명(예: 빈칸추론, 주제찾기, 글의 순서, 무관한 문장, 요지파악) 등)로 "
                    f"검색합니다. 제목에 \"{citation_label}\"과 문제 유형을 반드시 그대로 포함하고, 지문의 "
                    "소재·주제어는 제목에 넣지 마세요(소재는 description이나 본문에서 다루는 것으로 충분합니다). "
                    f'예: "{citation_label} 어법 문제 완벽 정리 — to부정사 함정 피하는 법" 같은 형태이지, '
                    "지문 내용을 은유적으로 요약한 제목(예: \"뇌과학으로 보는 자동화와 의식의 차이\")은 안 됩니다."
                )
            )

            # Structural 유형 hints + the already-verified explanation from the AI ingest
            # pipeline. Both are strictly additive: an old row (problem_type absent or
            # 'standard', explanation NULL) leaves both strings empty, so the prompt is
            # byte-for-byte identical to before this block existed.
            problem_type = source_passage.get("problem_type", "standard")
            explanation = source_passage.get("explanation")

            type_instruction = ""
            if problem_type == "paragraph_order":
                type_instruction = (
                    "\n15. 이 문제는 글의 순서 배열형입니다. 지문에 표시된 (A)(B)(C) 문단 "
                    "구분을 그대로 유지해 인용하고, 선택지도 주어진 순서 표기 그대로(예: "
                    "①(B)-(A)-(C)) 보여주세요. 해설에서는 올바른 문단 순서를 (A)-(B)-(C) "
                    "형태로 명확히 밝히고, 각 문단을 연결하는 단서(지시어·연결사·시간 순서 등)를 "
                    "근거로 설명하세요."
                )
            elif problem_type == "embedded_marker":
                type_instruction = (
                    "\n15. 이 문제는 지문 속 특정 문장을 고르는 유형입니다(무관한 문장 찾기 "
                    "또는 문장 삽입 위치 찾기). 지문 내 ①~⑤ 표시를 원문 그대로 유지해 인용하고, "
                    "해설에서 각 번호가 가리키는 문장을 명확히 지칭하며 설명하세요."
                )
            elif problem_type == "chart":
                type_instruction = (
                    "\n15. 이 문제는 도표(그래프) 문제입니다. 지문 뒤에 실제 도표 이미지가 "
                    "별도로 삽입되므로, 본문에서 도표의 생김새를 다시 설명하거나 도표 이미지를 "
                    "직접 언급(\"위 이미지를 보면\" 등)하지 마세요 — 이미지 삽입은 시스템이 "
                    "자동으로 처리합니다. 해설을 쓸 때는 위 지문(passage)에 이미 옮겨 적힌 "
                    "[도표 데이터] 수치만 근거로 삼고, 그 수치를 다시 옮길 때도 반올림하거나 "
                    "다른 값으로 바꿔 쓰지 마세요 — 절대 스스로 새로운 수치를 추정하거나 "
                    "지어내지 마세요."
                )

            explanation_block = ""
            if explanation:
                explanation_block = (
                    "\n\n[이미 검증된 해설 논리 — 참고해서 (4)번 섹션을 작성하되 문장을 그대로 "
                    "베끼지 말고 자신의 표현으로 재구성할 것. 이 논리를 근거로 삼아 해설을 쓰고, "
                    f"스스로 새로 추론하려다 이 논리와 다른 답을 내지 마세요]\n{explanation}\n"
                )

            source_instruction += type_instruction
            source_block += explanation_block

        # Conversation pipeline: inject a real dialogue clip to quote and explain.
        dialogue_block = ""
        dialogue_instruction = ""
        if source_dialogue:
            context_en = source_dialogue.get("context_en")
            context_dialogue_block = ""
            if context_en:
                context_dialogue_block = (
                    f'\n[참고용 주변 대사 — 인용·설명 금지, 장면의 분위기·긴장도·인물 관계를 '
                    f'올바르게 파악하는 용도로만 참고할 것]\n"""{context_en}"""\n'
                )
            dialogue_block = (
                "\n\n[활용할 실제 대사 클립 — 아래 대사를 인용해 표현을 설명할 것]\n"
                f'영상: {source_dialogue.get("video_title", "")}\n'
                f'영어 대사(dialogue_en):\n"""{source_dialogue.get("dialogue_en", "")}"""\n'
                f'한국어 번역(dialogue_ko):\n"""{source_dialogue.get("dialogue_ko", "") or "(없음)"}"""\n'
                f'{context_dialogue_block}'
            )
            dialogue_instruction = (
                "\n11. 위 [활용할 실제 대사 클립]의 영어 대사를 인용하며, 그 안에 등장하는 유용한 "
                "표현·어휘·뉘앙스를 실제 회화에서 어떻게 쓰는지 구체적으로 설명하는 글을 작성하세요. "
                "대사를 임의로 창작하지 말고 주어진 원문을 그대로 인용하세요. "
                "화자가 누구인지, 두 사람의 관계가 무엇인지(상사·동료·친구·연인 등)는 대사 원문이나 "
                "영상 제목에 명시된 경우에만 언급하고, 그렇지 않다면 관계를 단정하지 마세요 — "
                "실제 장면과 다른 관계를 지어내 설명하면 원본 영상과 어긋나는 글이 됩니다."
            )
            if context_en:
                dialogue_instruction += (
                    " [참고용 주변 대사]가 있다면 그것을 인용·요약하지 말고, 오직 이 대사의 톤(예: "
                    "장난스러운 농담인지, 방어적/책임회피성 발언인지, 진지한 갈등인지)을 정확히 "
                    "판단하는 데만 활용하세요 — 주변 맥락과 어긋나게 무조건 '유머러스하다', "
                    "'재치있다'처럼 톤을 미화하지 마세요."
                )

        prompt = f"""당신은 영어 학습 서비스 "Scan Voca"의 콘텐츠 마케터입니다. 중·고등학생과 영어 학습자를 대상으로 하는 한국어 블로그 글을 작성하세요.

{topic_block}
{recent_posts_block}{source_block}{dialogue_block}
작성 요구사항:
1. 언어: 한국어
2. 본문 분량: 1,500~2,500자 (공백 포함)
3. `##` 마크다운 소제목을 3~5개 사용해 구조화
4. 실용적이고 구체적인 내용 (막연한 조언 금지, 실제로 따라 할 수 있는 방법·예시 포함)
5. **마지막 섹션에서는** 방금 다룬 본문 내용(팁·문제·표현 등 이 글의 구체적인 소재)에서 출발해, 그 흐름이 자연스럽게 이어지는 자기만의 문장으로 전환하세요. "결국 단어는 외워야 한다" 같은 정해진 문구를 매번 그대로 쓰지 말고, 글마다 다른 표현으로 전환하되, 이 전환 문단 바로 다음 줄에는 **반드시 아래 핵심 메시지를 담은 강력한 한 문장**을 넣으세요 — Scan Voca는 영어 단어장 앱이며, 사진 한 장으로 손쉽게 단어장을 만들고, 언제 어디서든 꺼내 보며 외울 수 있다는 점을 강조해야 합니다(예: "Scan Voca는 사진 한 장으로 순식간에 단어장을 만들어, 언제 어디서든 꺼내 보며 외울 수 있게 해주는 영어 단어장 앱입니다." — 이 문장을 그대로 반복하지 말고 글의 맥락에 맞게 자연스럽게 바꿔 쓰되, '사진으로 단어장 생성'과 '언제 어디서든 휴대하며 암기'라는 두 핵심은 절대 빠뜨리지 말고, "영어 단어장 앱"이라는 표현(또는 "영단어 앱")을 반드시 포함하세요). 그 문장 바로 다음에 마크다운 링크 [Scan Voca 시작하기](https://scanvoca.com) 를 포함하세요.
6. 특정 AI 모델명(예: Gemini, GPT, ChatGPT 등)을 본문·제목·어디에도 절대 쓰지 마세요.
7. 카테고리는 다음 고정 목록 중 가장 적합한 하나를 고르세요: {categories_str}
8. slug는 영문 소문자·숫자·하이픈만 사용한 ASCII kebab-case로 만드세요 (예: toeic-vocab-30days).
9. [이미 발행된 최근 글 목록]이 있다면, 그 글들에서 이미 다룬 것과 똑같은 팁·각도·구성을 반복하지 마세요. 가능하면 다른 관점·예시·정보를 다루세요.
10. 목록에 있는 글 중 마지막 홍보 섹션 이전 본문에서 정말 자연스럽게 이어지는 경우에만, **최대 1개**를 실제 slug로 마크다운 링크(예: https://scanvoca.com/blog/{{slug}})를 걸어 언급하세요. 관련 있는 글이 없으면 절대 언급하지 마세요. 목록에 없는 slug를 지어내지 마세요. 마지막 홍보 섹션의 Scan Voca 링크와는 별개입니다.{practice_instruction}{word_list_instruction}{source_instruction}{dialogue_instruction}

반드시 아래 구조의 JSON 객체만 반환하세요. 다른 텍스트는 포함하지 마세요:
{{
  "slug": "ascii-kebab-case-slug",
  "title": "글 제목 (한국어)",
  "description": "SEO용 요약 1~2문장 (검색 결과 노출용)",
  "category": "위 목록 중 하나",
  "tags": ["태그1", "태그2", "태그3"],
  "body": "본문 마크다운 전체 (frontmatter 제외, ## 소제목 포함, 마지막 섹션은 Scan Voca 홍보)"{practice_schema}{word_list_schema}
}}

주의:
- body에는 frontmatter(---)를 넣지 마세요. 순수 본문 마크다운만 넣으세요.
- JSON 문자열 값 안의 줄바꿈은 \\n 으로, 큰따옴표(")는 \\" 로 반드시 이스케이프하세요.
- 반드시 완성된 유효한 JSON만 반환하세요. 문자열이 중간에 끊기지 않도록 끝까지 작성하세요."""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.7,
                    "max_output_tokens": 8192,
                    "response_mime_type": "application/json",
                },
            )

            content = response.text
            if not content:
                return None

            # Strip markdown code fences if present (mirrors get_word_definition)
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            result = json.loads(content, strict=False)

            # Normalize / validate
            slug = str(result.get("slug", "")).strip().lower()
            title_out = str(result.get("title", "")).strip()
            description = str(result.get("description", "")).strip()
            category = str(result.get("category", "")).strip()
            tags = result.get("tags") or []
            if not isinstance(tags, list):
                tags = []
            tags = [str(t).strip() for t in tags if str(t).strip()]
            body = str(result.get("body", "")).strip()

            if not slug or not title_out or not body:
                print("Blog generation returned incomplete fields")
                return None

            if category not in categories:
                category = "암기법·학습팁"

            out: Dict[str, Any] = {
                "slug": slug,
                "title": title_out,
                "description": description,
                "category": category,
                "tags": tags,
                "body": body,
            }

            if include_practice_questions:
                raw_questions = result.get("practice_questions")
                out["practice_questions"] = raw_questions if isinstance(raw_questions, list) else []

            if include_word_list:
                raw_word_list = result.get("word_list")
                if not isinstance(raw_word_list, list):
                    raw_word_list = []
                word_list = [str(w).strip().lower() for w in raw_word_list if str(w).strip()]
                out["word_list"] = word_list[:15]

            return out

        except json.JSONDecodeError as e:
            error_msg = f"Blog generation JSON parse error (attempt {retry_count + 1}/{max_retries + 1}): {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))

            if retry_count < max_retries:
                # If practice_questions is the likely culprit (the model has been observed
                # writing its own "## 실전 연습문제" text plus a stray ```json fence directly
                # into the body string, leaving it unterminated and breaking the whole
                # response), drop it on the final retry so the post can still publish
                # without the bonus section rather than fail outright after every attempt.
                next_include_practice = include_practice_questions
                is_final_retry = retry_count + 1 == max_retries
                if is_final_retry and include_practice_questions:
                    next_include_practice = False
                    print("Final retry: disabling practice_questions to salvage the post")
                print(f"Retrying blog generation ({retry_count + 1}/{max_retries})...")
                return await self.generate_blog_post(
                    title=title,
                    angle=angle,
                    custom_prompt=custom_prompt,
                    recent_posts=recent_posts,
                    include_practice_questions=next_include_practice,
                    include_word_list=include_word_list,
                    source_passage=source_passage,
                    source_dialogue=source_dialogue,
                    retry_count=retry_count + 1,
                    max_retries=max_retries,
                )
            print(f"Blog generation failed after {max_retries + 1} attempts")
            return None
        except Exception as e:
            error_msg = f"Blog generation error: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))
            return None

    async def review_practice_questions(
        self,
        questions: List[Dict[str, Any]],
        retry_count: int = 0,
        max_retries: int = 1,
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Critically re-check each auto-generated TOEIC practice question's marked answer and
        explanation before publish, correcting or dropping ones that don't hold up.

        generate_blog_post(include_practice_questions=True) writes the question/choices/
        answer/explanation for TOEIC posts in the same call as the rest of the article, on
        the fast/cheap generator model — cheap enough to bulk-generate, but occasionally
        confident about a wrong answer (e.g. a real live case: "The company will provide a
        stipend... ____, employees are responsible for..." was marked 'Moreover' when the
        sentence actually contrasts the company's role against the employee's — 'On the
        other hand' — caught only after publish). Nothing downstream re-checks *content*,
        only *shape* (render_practice_questions_markdown skips items with missing fields;
        validate_auto_draft only checks post-level structure like length/category) — this
        call is the missing correctness gate, run once per generated draft before publish.

        Reviews on the stronger flash model (vision_model, not the flash-lite generator) so
        the same blind spot that produced the mistake doesn't just rubber-stamp itself, and
        asks it to return the full corrected {answer_index, explanation} for every item by
        index rather than trust it to faithfully retype passage/type text verbatim.

        Returns a new list in the same {type, passage, question, choices, answer_index,
        explanation} shape as the input, with answer_index/explanation replaced by the
        reviewed versions and any item flagged "drop" (too ambiguous to salvage even after
        correction) removed entirely. Returns None if review couldn't be completed (API
        unconfigured, malformed/incomplete response after retries) so the caller can fail
        safe — drop the whole practice-questions section rather than publish an answer key
        nothing has verified. Empty input returns an empty list (nothing to review).
        """
        if not questions:
            return []
        if self.vision_model is None:
            print("Gemini API key not configured")
            return None

        numbered_blocks = []
        for i, q in enumerate(questions):
            choices = q.get("choices") or []
            choices_str = "\n".join(f"{idx}: {c}" for idx, c in enumerate(choices))
            block = f"[문제 {i}]\n문제: {q.get('question', '')}\n"
            if q.get("passage"):
                block += f"지문: {q.get('passage')}\n"
            block += (
                f"보기(0부터 시작하는 인덱스):\n{choices_str}\n"
                f"현재 표시된 정답 인덱스: {q.get('answer_index')}\n"
                f"현재 해설: {q.get('explanation', '')}\n"
            )
            numbered_blocks.append(block)

        prompt = (
            "당신은 TOEIC 문제 검수자입니다. 아래는 자동 생성된 TOEIC RC 연습문제 목록입니다. "
            "각 문제에 대해 표시된 정답(정답 인덱스)이 실제로 유일하게 맞는 선택지인지, 그리고 "
            "해설이 그 정답을 논리적으로 정확하게 뒷받침하는지 비판적으로 검증하세요. 채점자의 "
            "의도가 아니라 문장 자체의 문법·논리·문맥만을 근거로 판단하세요.\n\n"
            + "\n".join(numbered_blocks)
            + "\n\n검토 기준:\n"
            "1. 현재 정답 인덱스가 문법적·논리적으로 유일하게 옳은 선택지인지 확인하세요. "
            "아니라면 실제로 옳은 선택지의 인덱스로 정정하세요.\n"
            "2. 정답이 맞더라도 해설이 그 정답을 정확히 뒷받침하지 못하거나, 다른 선택지를 "
            "잘못된 근거로 배제하고 있다면 해설을 다시 작성하세요.\n"
            "3. 정정 후에도 여러 선택지가 동시에 정답으로 보이거나(중의적), 문맥 정보가 부족해 "
            "판단이 불가능한 문제는 drop을 true로 표시하세요.\n"
            "4. 원래 정답이 맞고 해설도 문제없다면, answer_index와 explanation을 원본과 "
            "동일하게 그대로 반환하세요.\n\n"
            "모든 문제(index 0부터 빠짐없이)에 대해 최종 확정된 answer_index(정수, 0부터 "
            "시작), explanation(한국어, 정답과 나머지 오답 각각의 근거 포함), drop(boolean)을 "
            "담아 아래 JSON 형식으로만 반환하세요. 다른 텍스트는 포함하지 마세요:\n"
            '{"reviews": [{"index": 0, "answer_index": 0, "explanation": "...", "drop": false}]}'
        )

        try:
            response = self.vision_model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.2,
                    "max_output_tokens": 4096,
                    "response_mime_type": "application/json",
                },
            )

            content = response.text
            if not content:
                raise ValueError("empty response")

            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            parsed = json.loads(content, strict=False)
            reviews = parsed.get("reviews")
            if not isinstance(reviews, list):
                raise ValueError("'reviews' is not a list")

            by_index: Dict[int, Dict[str, Any]] = {}
            for r in reviews:
                if not isinstance(r, dict):
                    continue
                idx = r.get("index")
                if isinstance(idx, int):
                    by_index[idx] = r

            if len(by_index) != len(questions):
                raise ValueError(
                    f"review count mismatch: got {len(by_index)}, expected {len(questions)}"
                )

            result: List[Dict[str, Any]] = []
            for i, q in enumerate(questions):
                r = by_index[i]
                if r.get("drop") is True:
                    continue
                choices = q.get("choices") or []
                answer_index = r.get("answer_index")
                if not isinstance(answer_index, int) or not (0 <= answer_index < len(choices)):
                    raise ValueError(f"invalid answer_index for item {i}: {answer_index!r}")
                explanation = str(r.get("explanation", "")).strip()
                if not explanation:
                    raise ValueError(f"empty explanation for item {i}")

                reviewed_q = dict(q)
                reviewed_q["answer_index"] = answer_index
                reviewed_q["explanation"] = explanation
                result.append(reviewed_q)

            return result

        except (json.JSONDecodeError, ValueError) as e:
            error_msg = f"Practice-question review parse error (attempt {retry_count + 1}/{max_retries + 1}): {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))

            if retry_count < max_retries:
                return await self.review_practice_questions(
                    questions, retry_count=retry_count + 1, max_retries=max_retries
                )
            print(f"Practice-question review failed after {max_retries + 1} attempts")
            return None
        except Exception as e:
            error_msg = f"Practice-question review error: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))
            return None

    async def review_dialogue_usage_examples(
        self,
        dialogue_en: str,
        dialogue_ko: Optional[str],
        video_title: Optional[str],
        body: str,
        context_en: Optional[str] = None,
        retry_count: int = 0,
        max_retries: int = 1,
    ) -> Optional[str]:
        """
        Critically re-check a conversation-pipeline post's explanation of the quoted dialogue
        before publish, correcting body text that misrepresents a scene-specific line as a
        general-purpose expression, or that mischaracterizes the line's tone in a way the
        surrounding scene contradicts.

        generate_blog_post(source_dialogue=...) is told to explain "실제 회화에서 어떻게
        쓰는지" but has no guardrail against overgeneralizing a one-off line whose humor
        depends entirely on the scene's specific setup into an idiom-like "usage example" the
        model invents for unrelated situations. Real case that motivated this: Emily in
        Paris's "babies already smell good enough" — a joke that only lands because the scene
        is a baby-perfume business pitch and the line is immediately undercut by "Not with a
        full diaper" — got rendered with three fabricated dialogues (declining a skydiving
        invite, criticizing a gaming binge, deflecting exam-score pressure) presenting it as a
        stock comeback phrase, published with nothing catching it (validate_auto_draft only
        checks post-level structure like length/category; there is no equivalent of
        review_practice_questions for this pipeline's prose).

        context_en (optional): reference-only surrounding subtitle lines from
        window_context_text, not part of the quotable dialogue — lets this review also catch
        a second, related failure mode: the body confidently framing a line as "재치있는
        유머"/"유머러스한 받아치기" when the surrounding scene reads as a tense or defensive
        exchange instead (live case: commercial-impact-beyond-views.md described a workplace
        blame-deflection line — "if you want to blame someone, just blame yourself" — as a
        witty comeback, with nothing in the reviewed window itself to contradict that
        reading). When context_en isn't given, this tone check is skipped — only the
        fabricated-usage-example check runs, same as before this was added.

        Reviews on the stronger flash model (vision_model, not the flash-lite generator) so
        the same blind spot that produced the mistake doesn't just rubber-stamp itself.

        Returns the (possibly corrected) full body markdown string, or the original body
        unchanged when the review finds the explanation already scene-accurate. Returns None
        if review couldn't be completed (API unconfigured, malformed response after retries)
        so the caller can fail safe by publishing the unreviewed original body rather than
        blocking the whole post on a review-pipeline hiccup — this is a correctness
        improvement, not a hard gate like the TOEIC answer-key review.
        """
        if self.vision_model is None:
            print("Gemini API key not configured")
            return None

        context_block = ""
        tone_criterion = ""
        if context_en:
            context_block = (
                f'[참고용 주변 대사 — 인용 금지, 장면의 분위기·긴장도 파악 용도]\n'
                f'"""{context_en}"""\n\n'
            )
            tone_criterion = (
                "5. [참고용 주변 대사]를 참고했을 때, 초안이 이 대사의 톤을 실제 장면과 다르게 "
                "미화하지 않았는지도 확인하세요 — 예를 들어 주변 맥락이 갈등·스트레스·책임 회피 "
                "상황을 보여주는데, 초안이 이를 '재치있는 유머', '유머러스한 받아치기'처럼 밝고 "
                "긍정적인 톤으로만 설명하고 있다면, 그 표현을 실제 장면에 맞는 톤(예: 방어적으로 "
                "화제를 돌리는 발언)으로 고쳐 쓰세요. 반대로 주변 맥락이 실제로 가벼운 농담·장난 "
                "분위기라면 기존 설명을 그대로 두세요.\n"
            )

        prompt = (
            "당신은 영어 표현 콘텐츠 검수자입니다. 아래는 실제 영상 대사를 소재로 한 한국어 "
            "블로그 글 초안입니다. 이 대사가 특정 장면의 설정이 있어야만 성립하는 말장난·농담인데, "
            "초안이 이를 마치 여러 상황에 두루 쓸 수 있는 일반적인 표현(관용구·받아치기 문구 등)인 "
            "것처럼 설명하며 원래 장면과 무관한 가상의 상황·대화 예시를 지어내지는 않았는지 "
            "비판적으로 검토하세요.\n\n"
            f'영상: {video_title or "(제목 없음)"}\n'
            f'영어 대사(dialogue_en): """{dialogue_en}"""\n'
            f'한국어 번역(dialogue_ko): """{dialogue_ko or "(없음)"}"""\n\n'
            f'{context_block}'
            f'[검토할 초안 본문(body)]\n"""{body}"""\n\n'
            "판단 기준:\n"
            "1. 이 표현이 실제로 다양한 상황에 그대로 옮겨 써도 의미가 통하는 진짜 관용구/일반 "
            "표현인지, 아니면 이 장면의 특정 소재(예: 특정 사업 아이템·설정에 대한 말장난)가 "
            "있어야만 웃음 포인트가 성립하는 일회성 대사인지 구분하세요.\n"
            "2. 후자인데 초안이 '이럴 때도 써요' 식으로 원본 장면과 무관한 가상의 상황·대화 "
            "예시를 지어내 마치 범용 표현처럼 설명하고 있다면, 그 지어낸 예시 부분을 걷어내고 "
            "대신 이 대사가 실제 장면에서 왜 웃긴지·어떤 말장난인지(원래 맥락)를 중심으로 "
            "설명하도록 본문을 다시 쓰세요 — 이 표현을 다른 상황에 그대로 재사용하라고 권하지 "
            "마세요.\n"
            "3. 전자(진짜 일반 표현)이거나 이미 지어낸 가상 상황 없이 정확하게 설명하고 있다면, "
            "본문을 전혀 수정하지 말고 원본 그대로 반환하세요.\n"
            "4. 수정하더라도 본문의 나머지 구조(다른 소제목, 마지막 Scan Voca 홍보 섹션, 문체)는 "
            "그대로 유지하고, 문제가 된 부분만 고치세요.\n"
            f"{tone_criterion}\n"
            "아래 JSON 형식으로만 반환하세요. 다른 텍스트는 포함하지 마세요:\n"
            '{"corrected_body": "본문 마크다운 전체(수정했다면 반영된 최종 버전, 수정하지 않았다면 '
            '원본과 동일한 문자열)"}'
        )

        try:
            response = self.vision_model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.2,
                    "max_output_tokens": 8192,
                    "response_mime_type": "application/json",
                },
            )

            content = response.text
            if not content:
                raise ValueError("empty response")

            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            parsed = json.loads(content, strict=False)
            corrected_body = str(parsed.get("corrected_body", "")).strip()
            if not corrected_body:
                raise ValueError("empty corrected_body")

            return corrected_body

        except (json.JSONDecodeError, ValueError) as e:
            error_msg = f"Dialogue-usage review parse error (attempt {retry_count + 1}/{max_retries + 1}): {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))

            if retry_count < max_retries:
                return await self.review_dialogue_usage_examples(
                    dialogue_en,
                    dialogue_ko,
                    video_title,
                    body,
                    context_en=context_en,
                    retry_count=retry_count + 1,
                    max_retries=max_retries,
                )
            print(f"Dialogue-usage review failed after {max_retries + 1} attempts")
            return None
        except Exception as e:
            error_msg = f"Dialogue-usage review error: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))
            return None

    async def reflow_exam_passage_text(
        self,
        passage_text: str,
        problem_type: str = "standard",
        retry_count: int = 0,
        max_retries: int = 1,
    ) -> Optional[str]:
        """
        Reflow an exam passage's hard PDF line-wraps into natural paragraph structure
        before it's ever quoted into a blog post.

        The exam-PDF extraction prompt tells the model to reproduce passage_text
        "인쇄된 그대로" (exactly as printed), which preserves the PDF's own line breaks —
        wrapped at the print column width, not any web viewport. generate_blog_post then
        quotes passage_text verbatim into the body, and the public page renders every
        single \\n as a forced <br> (remark-breaks — needed elsewhere for numbered choice
        lists), so those PDF-column breaks land mid-sentence on the actual page instead of
        flowing naturally. Commit 82994b8 (2026-09-01) manually reflowed 14 already-
        published files but never touched the extraction/generation pipeline, so every
        suneung post published since keeps reproducing the identical bug (live case:
        them-pronoun-error-suneung-english-2023-29.md, published 2026-09-07).

        Reviews on the stronger flash model (vision_model) and asks it to apply the same
        judgment a human editor used in that manual pass: collapse a continuous prose
        passage into one flowing paragraph, but keep genuine structural breaks (a letter's
        salutation/body/sign-off, (A)/(B)/(C) paragraph-order blocks, footnote lines) each
        on their own line. Never trusts the model's promise not to alter wording — after
        parsing, this asserts the whitespace-collapsed text is byte-identical to the
        original before accepting the result, so a reflow that silently drops, adds, or
        changes a word is rejected exactly like a malformed response.

        Returns the reflowed text, or None if review couldn't be completed / the content-
        preservation check failed, so the caller can fail safe and quote the original
        (still hard-wrapped, but never corrupted) text instead. An empty/whitespace-only
        passage_text is returned unchanged without calling the model.
        """
        if not passage_text or not passage_text.strip():
            return passage_text
        if self.vision_model is None:
            print("Gemini API key not configured")
            return None

        prompt = (
            "당신은 지문 조판 교정 담당자입니다. 아래 영어 지문은 수능/모의고사 PDF에서 그대로 "
            "추출되어, PDF의 인쇄 칼럼 폭에 맞춰 강제로 줄바꿈된 상태입니다. 이 줄바꿈을 그대로 "
            "웹페이지에 옮기면 줄바꿈마다 강제 개행으로 렌더링되어, 문장 중간에서 부자연스럽게 "
            "끊겨 보입니다. 아래 원칙에 따라 줄바꿈 위치만 재구성하세요:\n\n"
            "1. 단어·철자·구두점·순서 등 내용은 단 한 글자도 바꾸지 마세요 — 오직 줄바꿈 위치만 "
            "조정합니다. ①~⑤, <u>...</u> 같은 표시가 있다면 원래 위치 그대로 유지하세요.\n"
            "2. 이어지는 하나의 문단(에세이·설명문 등)은 인쇄상의 줄바꿈을 모두 없애고 하나의 "
            "흐르는 문단으로 합치세요.\n"
            "3. 편지·공지문이라면, 인사말(Dear ..., To whom it may concern 등)과 본문 사이, "
            "본문과 맺음말(Sincerely, 등) 사이의 줄바꿈은 유지하되, 본문 자체는 하나의 문단으로 "
            "합치고, 맺음말의 이름·직함은 각각 줄바꿈으로 구분하세요.\n"
            "4. (A)(B)(C) 같은 문단 순서 배열 라벨이 있다면, 각 라벨로 시작하는 문단끼리는 "
            "줄바꿈으로 구분하되, 각 문단 내부의 인쇄상 줄바꿈은 하나로 합치세요.\n"
            "5. \"*단어: 뜻\" 형태의 각주는 원래 위치(대개 맨 끝)에 줄바꿈으로 구분해 유지하세요.\n\n"
            f"이 지문의 문제 유형(problem_type): {problem_type}\n\n"
            f'원문:\n"""{passage_text}"""\n\n'
            "수정된 지문 전체를 아래 JSON 형식으로만 반환하세요. 다른 텍스트는 포함하지 마세요:\n"
            '{"reflowed_text": "..."}'
        )

        try:
            response = self.vision_model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.0,
                    "max_output_tokens": 4096,
                    "response_mime_type": "application/json",
                },
            )

            content = response.text
            if not content:
                raise ValueError("empty response")

            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            parsed = json.loads(content, strict=False)
            reflowed = str(parsed.get("reflowed_text", "")).strip()
            if not reflowed:
                raise ValueError("empty reflowed_text")

            # Content-preservation guard: whitespace/newlines may move, nothing else may.
            collapse = lambda s: re.sub(r"\s+", "", s)
            if collapse(reflowed) != collapse(passage_text):
                raise ValueError("reflow changed passage content — discarding")

            return reflowed

        except (json.JSONDecodeError, ValueError) as e:
            error_msg = f"Passage-reflow parse error (attempt {retry_count + 1}/{max_retries + 1}): {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))

            if retry_count < max_retries:
                return await self.reflow_exam_passage_text(
                    passage_text,
                    problem_type=problem_type,
                    retry_count=retry_count + 1,
                    max_retries=max_retries,
                )
            print(f"Passage-reflow failed after {max_retries + 1} attempts")
            return None
        except Exception as e:
            error_msg = f"Passage-reflow error: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))
            return None

    async def review_exam_translation_accuracy(
        self,
        passage_text: str,
        body: str,
        retry_count: int = 0,
        max_retries: int = 1,
    ) -> Optional[str]:
        """
        Critically re-check a suneung-pipeline post's quoted passage and "**해석:**"
        translation against the real source passage_text before publish, correcting any
        sentence/clause dropped or mistranslated in a way that changes meaning.

        generate_blog_post(source_passage=...) is told to translate the passage "누락하거나
        요약하지 말고" (without omitting or summarizing) and quote passage_text verbatim, but
        nothing downstream re-checks that the fast/cheap generator model actually did either —
        reflow_exam_passage_text only fixes PDF line-wrap whitespace in the quoted passage, it
        never compares translation content against the source. review_practice_questions
        (toeic) and review_dialogue_usage_examples (conversation) both exist for their
        pipelines' content-accuracy blind spots; suneung had none for its own — the live case
        that motivated this: brain-automation-consciousness-grammar-suneung-2025-29 quoted a
        sentence with a dropped complement in both the body's grammar breakdown and the 해석,
        changing what the sentence actually says, published with nothing catching it.

        Reviews on the stronger flash model (vision_model, not the flash-lite generator) so
        the same blind spot that produced the mistake doesn't just rubber-stamp itself, by
        diffing the draft body against the real passage_text sentence by sentence.

        Returns the (possibly corrected) full body markdown string, or the original body
        unchanged when the review finds the quoted passage and 해석 already complete and
        accurate. Returns None if review couldn't be completed (API unconfigured, malformed
        response after retries) so the caller can fail safe by publishing the unreviewed
        original body rather than blocking the whole post on a review-pipeline hiccup — this
        is a correctness improvement, not a hard gate like the TOEIC answer-key review.
        """
        if not passage_text or not passage_text.strip():
            return body
        if self.vision_model is None:
            print("Gemini API key not configured")
            return None

        prompt = (
            "당신은 수능/모의고사 영어 지문 번역 검수자입니다. 아래는 실제 기출 지문 원문과, "
            "이를 소재로 자동 생성된 블로그 글 초안입니다. 초안 안에서 지문을 인용한 부분과 "
            "\"**해석:**\" 이하 번역, 그리고 문장 구조·문법을 설명하는 부분이 원문의 모든 문장을 "
            "빠짐없이, 의미 왜곡 없이 반영하고 있는지 원문과 한 문장씩 대조해 비판적으로 "
            "검토하세요.\n\n"
            f'지문 원문:\n"""{passage_text}"""\n\n'
            f'[검토할 초안 본문(body)]\n"""{body}"""\n\n'
            "판단 기준:\n"
            "1. 원문의 문장이 하나라도 통째로 누락되지 않았는지 확인하세요.\n"
            "2. 각 문장의 해석·문법 설명에서 주어/동사/목적어/보어 등 문장 성분이 빠지거나 "
            "잘못 옮겨져 원문과 다른 의미가 되지 않았는지 확인하세요(단순 의역·어순 조정은 "
            "문제 삼지 마세요 — 원문에 실제로 있는 정보가 사라지거나 바뀐 경우만 문제입니다).\n"
            "3. 문제를 발견하면 해당 문장의 인용·해석·설명만 원문에 맞게 정확히 고치고, 그 "
            "외 본문 구조(다른 소제목, 문제 선택지, 해설, 마지막 Scan Voca 홍보 섹션, 문체)는 "
            "그대로 유지하세요.\n"
            "4. 이미 모든 문장이 빠짐없이 정확하게 반영되어 있다면, 본문을 전혀 수정하지 말고 "
            "원본 그대로 반환하세요.\n\n"
            "아래 JSON 형식으로만 반환하세요. 다른 텍스트는 포함하지 마세요:\n"
            '{"corrected_body": "본문 마크다운 전체(수정했다면 반영된 최종 버전, 수정하지 않았다면 '
            '원본과 동일한 문자열)"}'
        )

        try:
            response = self.vision_model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.2,
                    "max_output_tokens": 8192,
                    "response_mime_type": "application/json",
                },
            )

            content = response.text
            if not content:
                raise ValueError("empty response")

            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            parsed = json.loads(content, strict=False)
            corrected_body = str(parsed.get("corrected_body", "")).strip()
            if not corrected_body:
                raise ValueError("empty corrected_body")

            return corrected_body

        except (json.JSONDecodeError, ValueError) as e:
            error_msg = f"Exam-translation review parse error (attempt {retry_count + 1}/{max_retries + 1}): {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))

            if retry_count < max_retries:
                return await self.review_exam_translation_accuracy(
                    passage_text,
                    body,
                    retry_count=retry_count + 1,
                    max_retries=max_retries,
                )
            print(f"Exam-translation review failed after {max_retries + 1} attempts")
            return None
        except Exception as e:
            error_msg = f"Exam-translation review error: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))
            return None

    async def suggest_blog_topics(
        self,
        pipeline: str,
        category: str,
        count: int = 5,
        recent_posts: Optional[List[Dict[str, str]]] = None,
        existing_titles: Optional[List[str]] = None,
    ) -> Optional[List[Dict[str, str]]]:
        """
        Suggest blog topic candidates for a pipeline/category.
        Returns a list of {title, angle} dicts, or None on error. Nothing is persisted —
        the caller (admin UI) edits and confirms candidates separately.
        recent_posts / existing_titles are supplied so the model avoids proposing topics
        that duplicate already-published posts or already-listed topics.

        Topic-FIRST by nature, so it is now the toeic pipeline's tool only: suneung topics
        are derived from a real passage by suggest_topic_from_passage instead (a topic
        invented here could never be guaranteed a passage to quote).
        """
        if self.model is None:
            print("Gemini API key not configured")
            return None

        count = max(1, min(int(count or 5), 10))

        pipeline_hints = {
            "toeic": "TOEIC(토익) 시험 대비 학습자를 대상으로, 실전 연습문제를 곁들일 수 있는 실용적인 주제. "
            "반드시 RC(Reading, 문법·어휘·독해 — Part 5·6·7) 관련 주제만 제안하고, "
            "LC(Listening, 파트 1~4) 관련 주제는 절대 제안하지 마세요.",
            "suneung": "수능·내신 영어를 준비하는 고등학생을 대상으로 하는 주제.",
            "conversation": "일상 영어회화 표현·상황을 다루는 주제.",
            "manual": "영어 학습 일반 주제.",
        }
        pipeline_hint = pipeline_hints.get(pipeline, pipeline_hints["manual"])

        recent_block = ""
        if recent_posts:
            lines = "\n".join(f'- "{p["title"]}"' for p in recent_posts)
            recent_block = f"\n\n[이미 발행된 최근 글 (중복 금지)]\n{lines}\n"

        existing_block = ""
        if existing_titles:
            lines = "\n".join(f'- "{t}"' for t in existing_titles)
            existing_block = f"\n\n[이미 등록된 주제 (중복 금지)]\n{lines}\n"

        prompt = f"""당신은 영어 학습 서비스 "Scan Voca"의 콘텐츠 전략가입니다. 아래 조건에 맞는 블로그 글 주제 후보 {count}개를 제안하세요.

카테고리: "{category}"
파이프라인 방향: {pipeline_hint}
{recent_block}{existing_block}
요구사항:
1. 언어: 한국어
2. 각 주제는 서로 겹치지 않고, 위 목록에 이미 있는 주제/글과도 겹치지 않게 하세요.
3. 실제 검색 수요가 있을 법한 구체적이고 실용적인 주제로 만드세요.
4. title은 블로그 글 제목 후보(한국어), angle은 글의 방향·타깃·핵심 키워드 메모(한국어 1~2문장).
5. 특정 AI 모델명(Gemini, GPT 등)은 절대 언급하지 마세요.

반드시 아래 구조의 JSON 객체만 반환하세요. 다른 텍스트 금지:
{{
  "suggestions": [
    {{ "title": "주제 제목 후보", "angle": "글 방향/타깃/키워드 메모" }}
  ]
}}"""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.9,
                    "max_output_tokens": 4096,
                    "response_mime_type": "application/json",
                },
            )
            content = (response.text or "").strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            result = json.loads(content.strip(), strict=False)
            raw = result.get("suggestions") if isinstance(result, dict) else result
            if not isinstance(raw, list):
                return []
            suggestions: List[Dict[str, str]] = []
            for item in raw:
                if not isinstance(item, dict):
                    continue
                s_title = str(item.get("title", "")).strip()
                s_angle = str(item.get("angle", "")).strip()
                if not s_title:
                    continue
                suggestions.append({"title": s_title, "angle": s_angle})
                if len(suggestions) >= count:
                    break
            return suggestions
        except Exception as e:
            error_msg = f"Blog topic suggestion error: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))
            return None

    async def suggest_conversation_topic_from_dialogue(
        self,
        dialogue_en: str,
        video_title: str,
        existing_titles: Optional[List[str]] = None,
        context_en: Optional[str] = None,
    ) -> Optional[Dict[str, str]]:
        """Propose a blog topic FROM a real subtitle excerpt (dialogue-first discovery).

        Inverts the conversation pipeline: instead of writing a topic first and hunting for
        a clip that happens to match its wording (which dead-ends at "no_ready_clip" whenever
        the pre-written phrasing never appears in the videos we actually own), the local
        clipper walks the subtitles and asks this method whether THIS excerpt is worth a post.

        Returns {"title", "angle"} when the excerpt genuinely teaches something, or None when
        it doesn't. None is the expected, common answer: most lines are filler. Forcing a
        topic out of a mediocre excerpt is exactly the failure mode this redesign removes, so
        the prompt states the "no expression -> say so" escape explicitly and the caller is
        expected to just move on to the next excerpt. Also None on any API/parse error — the
        caller has thousands of other excerpts, so a retry here buys nothing.

        context_en (optional): reference-only surrounding subtitle lines from
        window_context_text (local-tools/conversation-clipper), NOT part of the quotable
        excerpt — passed only so the model can gauge whether a line's tone (e.g. "playful
        banter" vs. "tense/defensive") is actually supported by the scene, instead of
        guessing from the bare excerpt alone (live case: a workplace deflection line got
        judged and later written up as "humorous" with nothing to contradict that reading —
        see review_dialogue_usage_examples for where the same gap showed up downstream).
        """
        if self.model is None:
            print("Gemini API key not configured")
            return None

        existing_block = ""
        if existing_titles:
            lines = "\n".join(f'- "{t}"' for t in existing_titles)
            existing_block = f"\n[이미 등록된 주제 (중복 금지)]\n{lines}\n"

        context_block = ""
        if context_en:
            context_block = (
                f"\n[참고용 주변 대사 — 인용 금지, 장면의 분위기·인물 관계·긴장도를 "
                f"파악하는 용도로만 참고할 것]\n{context_en}\n"
                f"위 [참고용 주변 대사]는 그 장면이 실제로 유쾌한 농담인지 아니면 갈등·긴장 "
                f"상황인지 등 분위기를 파악하는 데만 쓰고, angle에 그 내용을 인용하거나 직접 "
                f"언급하지 마세요 — 어디까지나 [대사 구간] 자체를 정확한 톤으로 소개하기 위한 "
                f"배경 판단 자료입니다.\n"
            )

        prompt = f"""당신은 영어 학습 서비스 "Scan Voca"의 콘텐츠 전략가입니다.
아래는 실제 영상에서 그대로 가져온 대사 구간입니다. 이 대사가 일상 영어회화 학습자에게 가르칠 만한 표현을 담고 있는지 판단하세요.

[영상 제목]
{video_title}

[대사 구간 (원문 그대로)]
{dialogue_en}
{context_block}{existing_block}
이 서비스의 타겟 사용자는 중·고등학생입니다 — 판단 시 반드시 고려하세요.

판단 기준:
1. 원어민이 실제로 자주 쓰지만 한국인 학습자가 교과서에서 배우기 어려운 표현(관용구, 구동사, 뉘앙스 표현 등)이 있으면 좋은 소재입니다.
2. 다음 중 하나라도 해당하면 좋은 소재가 아닙니다:
   - 의미 없는 필러 대사(yeah, okay, um, hi 등 위주)
   - 중학교 수준의 너무 뻔한 문장
   - 앞뒤 맥락이 잘려 무슨 뜻인지 알 수 없는 대사
   - 고유명사·줄거리에만 의존해서 그 영상을 안 본 사람에게는 쓸모없는 대사
   - **욕설·비속어·성적 표현이 핵심 표현이거나, 그런 단어를 그대로 인용해야만 설명이 되는 대사** (중·고등학생 대상 서비스에 절대 부적절 — 표현 자체가 욕설이 아니어도 주변 대사에 욕설이 섞여 있으면 그 부분은 인용하지 말고, 욕설을 빼면 소재가 안 될 정도라면 has_expression을 false로)
   - **표현의 설명·재미·뉘앙스가 화자 관계(상사·연인·부모자식 등)를 반드시 전제해야만 성립하는데, 그 관계가 대사 원문이나 영상 제목에 명시되어 있지 않은 대사** (예: 웃음 포인트가 "회사에서 지각을 봐주는 상사"라는 설정 자체에 있는데, 정작 대사는 관계를 밝히지 않는 경우 — 이런 소재는 관계를 지어내지 않으면 애초에 성립하지 않으므로, 아래 5번처럼 관계를 얼버무려 통과시키지 말고 has_expression을 false로. 반대로 표현이 어떤 관계에서 오가든 뜻·쓰임이 그대로인 대사라면 이 항목에 해당하지 않습니다 — 그런 경우는 5번 규칙대로 관계를 일반화·생략하고 계속 진행하세요)
3. 좋은 소재가 아니면 억지로 주제를 만들지 말고 반드시 has_expression을 false로 답하세요. 억지로 만든 주제는 무가치하며, false는 정상적이고 흔한 답입니다.

좋은 소재일 때만:
4. title은 그 표현을 소재로 한 블로그 글 제목(한국어, 구어체, 클릭하고 싶어지는 톤). 단, 후킹을 위해 대사에 없는 상황을 지어내지 마세요 — 아래 5번 규칙이 title에도 동일하게 적용됩니다.
5. angle은 글의 방향·타깃·핵심 키워드 메모(한국어 1~2문장). **위 대사 중 핵심 표현을 원문 그대로 인용**해서 포함하세요. **화자가 누구인지, 둘의 관계가 무엇인지(상사·동료·친구·연인 등)는 대사 원문이나 영상 제목에 명시되지 않은 이상 절대 단정하지 마세요** — 이 표현이 다른 어떤 관계에서도 오갈 수 있는 대사라면, 관계를 특정하지 않고 "직장에서", "친구 사이에서"처럼 일반화하거나 아예 관계를 언급하지 않는 방향으로 title/angle을 쓰세요 (관계 자체가 소재의 핵심인데 명시되지 않은 경우는 이렇게 얼버무리지 말고 위 2번 규칙에 따라 has_expression을 false로 하세요). 대사만으로 알 수 없는 세부 설정을 그럴듯하게 지어내면 실제 영상 장면과 어긋나는 제목이 되어 시청자에게 그대로 들통납니다.
6. 위 [이미 등록된 주제]와 겹치는 주제는 만들지 마세요 (겹친다면 has_expression을 false로).
7. 특정 AI 모델명(Gemini, GPT 등)은 절대 언급하지 마세요.

반드시 아래 구조의 JSON 객체만 반환하세요. 다른 텍스트 금지:
{{
  "has_expression": true 또는 false,
  "title": "주제 제목 (has_expression이 false면 빈 문자열)",
  "angle": "글 방향/타깃/키워드 메모 (has_expression이 false면 빈 문자열)"
}}"""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.8,
                    "max_output_tokens": 2048,
                    "response_mime_type": "application/json",
                },
            )
            content = (response.text or "").strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            result = json.loads(content.strip(), strict=False)
            if not isinstance(result, dict):
                return None
            if not result.get("has_expression"):
                return None
            title = str(result.get("title", "")).strip()
            angle = str(result.get("angle", "")).strip()
            if not title or not angle:
                # has_expression=true but nothing usable -> treat as "no expression".
                return None
            if _contains_profanity(title, angle):
                # Prompt already asks the model to avoid this; a real run still slipped
                # one through (see _PROFANITY_RE comment) — treat like "no expression"
                # rather than raising, since the caller just moves on to the next excerpt.
                print(f"Conversation topic discovery: rejected for profanity: {title!r}")
                return None
            return {"title": title, "angle": angle}
        except Exception as e:  # noqa: BLE001 - caller just moves to the next excerpt
            error_msg = f"Conversation topic discovery error: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))
            return None

    async def suggest_topic_from_passage(
        self,
        passage_text: str,
        question_text: str,
        choices: Optional[list],
        answer: Optional[str],
        source_label: str,
        problem_number: Optional[int] = None,
        tags: Optional[List[str]] = None,
        existing_titles: Optional[List[str]] = None,
    ) -> Optional[Dict[str, str]]:
        """Propose a blog topic FROM a real 기출 지문 (passage-first discovery).

        Mirrors suggest_conversation_topic_from_dialogue's inversion for the suneung
        pipeline — the topic is derived from a passage that already exists, instead of being
        written first and hunted for a match that may never exist. Returns {"title", "angle"}
        grounded in this exact passage, or None on failure/parse error (rare in practice since
        these are curated real exam questions, but the caller must handle it — e.g. OCR
        garble from a bad PDF page).

        title is steered toward what someone searching for this exact exam question would
        type — year/exam/subject/problem number + question type (from `tags`) — rather than
        the passage's subject matter. Live case: brain-automation-consciousness-grammar-
        suneung-2025-29's title described the passage's content (뇌과학/자동화/의식) with none
        of the terms ("2025학년도 수능 영어 29번", "어법") an actual searcher would use.
        angle is a separate field and still carries the content specifics (그대로 유지).

        Deliberately has NO has_expression-style veto field (unlike the dialogue version):
        every row here is an already-curated real exam question, so "this material is not
        teachable" is not a realistic answer and offering the escape hatch would only invite
        the model to skip perfectly good passages. Only genuine breakage (API error, JSON
        parse failure, empty title/angle) yields None.
        """
        if self.model is None:
            print("Gemini API key not configured")
            return None

        existing_block = ""
        if existing_titles:
            lines = "\n".join(f'- "{t}"' for t in existing_titles)
            existing_block = f"\n[이미 등록된 주제 (중복 금지)]\n{lines}\n"

        choices_block = ""
        if choices:
            rendered = "\n".join(f"{i}. {c}" for i, c in enumerate(choices, start=1))
            choices_block = f"\n[선택지]\n{rendered}\n"

        answer_block = f"\n[정답]\n{answer}\n" if answer else ""
        citation_label = f"{source_label} {problem_number}번" if problem_number else source_label
        clean_tags = [t for t in (tags or []) if str(t).strip()]
        tags_str = ", ".join(clean_tags) if clean_tags else "(태그 없음 — 지문/문제 내용으로 유형을 직접 판단할 것)"

        prompt = f"""당신은 영어 학습 서비스 "Scan Voca"의 콘텐츠 전략가입니다.
아래는 실제 기출 시험지에서 그대로 가져온 영어 지문과 문제입니다. 이 지문/문제를 소재로 삼아 블로그 글 주제를 하나 뽑으세요.

[출처]
{citation_label}

[문제 유형 태그]
{tags_str}

[지문 (원문 그대로)]
{passage_text}

[문제]
{question_text}
{choices_block}{answer_block}{existing_block}
이 서비스의 타겟 사용자는 중·고등학생입니다 — 판단 시 반드시 고려하세요.

요구사항:
1. 언어: 한국어.
2. **title은 검색 유입을 최우선으로 지으세요.** 수능 문제를 검색하는 사람들은 지문의 소재(예: 뇌과학,
   환경, 심리학 같은 내용 주제)가 아니라 "{citation_label}"처럼 연도·시험명·과목·문제번호, 그리고
   [문제 유형 태그](어법이면 구체적 문법 포인트(예: to부정사, 분사구문, 관계대명사), 독해면 유형명
   (예: 빈칸추론, 주제찾기, 글의 순서, 무관한 문장, 요지파악) 등)로 검색합니다. title에
   "{citation_label}"과 문제 유형을 반드시 그대로 포함하고, 지문의 소재·주제어는 title에 넣지 마세요
   — 그런 내용은 angle에서 다루세요. 예: "{citation_label} 어법 문제 완벽 정리 — to부정사 함정 피하는 법"
   같은 형태이지, 지문 내용을 은유적으로 요약한 제목(예: "뇌과학으로 보는 자동화와 의식의 차이")은 안 됩니다.
3. angle은 글의 방향·타깃·핵심 키워드 메모(한국어 1~2문장). **이 지문의 핵심 문법 포인트나 소재(주제어)를 반드시 구체적으로 포함**하세요 — "수능 영어 대비" 같은 뭉뚱그린 표현만 쓰지 마세요.
4. 위 [이미 등록된 주제]와 겹치는 제목은 만들지 마세요.
5. 특정 AI 모델명(Gemini, GPT 등)은 절대 언급하지 마세요.

반드시 아래 구조의 JSON 객체만 반환하세요. 다른 텍스트 금지:
{{
  "title": "주제 제목",
  "angle": "글 방향/타깃/키워드 메모"
}}"""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.8,
                    "max_output_tokens": 2048,
                    "response_mime_type": "application/json",
                },
            )
            content = (response.text or "").strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            result = json.loads(content.strip(), strict=False)
            if not isinstance(result, dict):
                return None
            title = str(result.get("title", "")).strip()
            angle = str(result.get("angle", "")).strip()
            if not title or not angle:
                # Nothing usable came back — the caller skips this passage for this run.
                return None
            return {"title": title, "angle": angle}
        except Exception as e:  # noqa: BLE001 - caller just moves to the next passage
            error_msg = f"Passage topic discovery error: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))
            return None

    async def tag_exam_passage(
        self, passage_text: str, question_text: str
    ) -> Optional[List[str]]:
        """
        Tag a 수능/모의고사 exam passage with 3~5 keywords (grammar point + topic keywords).
        Returns a list of individual keyword strings, or None on error / [] if nothing usable.
        Used by the one-off ingest script to backfill exam_passages.tags. Keywords are kept
        as individual tokens (e.g. "역접", "빈칸추론"). They are descriptive metadata for the
        admin passage list only — no selection logic reads them since the pipeline went
        passage-first (topics are derived from the passage text itself, not tag matching).
        """
        if self.model is None:
            print("Gemini API key not configured")
            return None

        prompt = f"""당신은 수능 영어 지문 분석 전문가입니다. 아래 기출 지문과 문제를 읽고, 이 문제의 특성을 나타내는 키워드 3~5개를 뽑으세요.

[지문]
\"\"\"{passage_text}\"\"\"

[문제]
{question_text}

규칙:
1. 문법/유형 포인트(예: 빈칸추론, 역접, 인과, 어법, 주제찾기)와 소재 키워드(예: 환경, 심리, 과학)를 섞어 3~5개.
2. 각 키워드는 짧은 단일 단어/구(띄어쓰기 없이)로 만드세요. 문장 금지.
3. 한국어로.
4. 특정 AI 모델명은 언급하지 마세요.

반드시 아래 JSON 객체만 반환하세요:
{{ "tags": ["키워드1", "키워드2", "키워드3"] }}"""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.3,
                    "max_output_tokens": 512,
                    "response_mime_type": "application/json",
                },
            )
            content = (response.text or "").strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            result = json.loads(content.strip(), strict=False)
            raw = result.get("tags") if isinstance(result, dict) else result
            if not isinstance(raw, list):
                return []
            return [str(t).strip() for t in raw if str(t).strip()][:5]
        except Exception as e:
            error_msg = f"Exam passage tagging error: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))
            return None

    async def scan_exam_pdf_manifest(self, exam_pdf_bytes: bytes):
        """Cheap first pass over the exam PDF alone: every problem number present, its
        structural problem_type, and its 장문독해 grouping — WITHOUT extracting full content.
        Tiny output -> negligible truncation risk; used only to plan batch windows for
        extract_exam_problems_from_pdfs (see ingest_exam_pdfs.py's _plan_batches).
        Returns List[ExamManifestEntry], or None on any failure (caller aborts the whole run
        — there's nothing to batch without a manifest).
        """
        if not _has_api_key():
            print("Gemini API key not configured")
            return None
        from google import genai as genai_new
        from google.genai import types as genai_types
        from app.schemas.exam_extraction import ExamManifest

        try:
            client = genai_new.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=EXAM_EXTRACTION_MODEL,
                contents=[
                    genai_types.Part.from_bytes(data=exam_pdf_bytes, mime_type="application/pdf"),
                    EXAM_MANIFEST_PROMPT,
                ],
                config=genai_types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ExamManifest,
                    temperature=0.1,
                ),
            )
            manifest = ExamManifest.model_validate_json(response.text)
            return manifest.problems
        except Exception as e:
            # UnicodeEncodeError guard, same as every other generate_content handler in this
            # file: this script is run from a Windows console (cp949 here), and an API/
            # validation error message can carry characters that codepage cannot encode —
            # the em dash in this pipeline's own response_schema descriptions is one, and it
            # comes straight back in an echoed 400. Without the guard, print() itself raises
            # from inside except and the failure escapes as a crash instead of a clean None.
            error_msg = f"Exam manifest scan failed: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))
            return None

    async def extract_exam_problems_from_pdfs(
        self,
        exam_pdf_bytes: bytes,
        answers_pdf_bytes,
        problem_numbers,
        form: str = "홀수형",
    ):
        """Extract + verify one window of problem numbers, reading both PDFs jointly.

        Always attaches the FULL exam PDF (and answer-key PDF, if given) regardless of how
        narrow problem_numbers is — re-sending full bytes per batch is a non-issue for this
        rare, non-latency-sensitive script, and it lets the model resolve any single problem
        using full-document context rather than a pre-sliced fragment.

        Returns List[ExtractedProblem] for this batch, or None if the whole batch failed (bad
        JSON / API error) — the caller treats that as "this batch got nothing this run" and
        reports it, never crashing the rest of the ingest.
        """
        if not _has_api_key():
            print("Gemini API key not configured")
            return None
        from google import genai as genai_new
        from google.genai import types as genai_types
        from app.schemas.exam_extraction import ExtractedProblemBatch

        parts = [genai_types.Part.from_bytes(data=exam_pdf_bytes, mime_type="application/pdf")]
        if answers_pdf_bytes:
            parts.append(
                genai_types.Part.from_bytes(data=answers_pdf_bytes, mime_type="application/pdf")
            )
        parts.append(_build_extraction_prompt(problem_numbers, form, bool(answers_pdf_bytes)))

        try:
            client = genai_new.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=EXAM_EXTRACTION_MODEL,
                contents=parts,
                config=genai_types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ExtractedProblemBatch,
                    temperature=0.1,
                ),
            )
            batch = ExtractedProblemBatch.model_validate_json(response.text)
            return batch.problems
        except Exception as e:
            # UnicodeEncodeError guard — see scan_exam_pdf_manifest. Critical here: an
            # unguarded print() would turn "one batch failed, keep going" into a crash that
            # loses every problem the run had already extracted.
            error_msg = f"Exam extraction batch {problem_numbers} failed: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))
            return None

    async def generate_naver_version(
        self, title: str, body: str, source_url: str
    ) -> Optional[Dict[str, str]]:
        """
        Rewrite a published post as a Naver-blog-ready version.
        Full rewrite (never a copy) so Naver's duplicate-document filter doesn't bury it.
        Returns {title, content} or None on error.
        """
        if self.model is None:
            print("Gemini API key not configured")
            return None

        prompt = f"""당신은 영어 학습 서비스 "Scan Voca"의 콘텐츠 마케터입니다. 아래 원문 블로그 글을 바탕으로 네이버 블로그에 올릴 홍보 글을 작성하세요.

원문 제목: "{title}"
원문 링크: {source_url}
원문 본문:
\"\"\"{body}\"\"\"

네이버 블로그는 유사문서 필터가 있어 원문을 그대로 복사하면 검색에서 누락됩니다. 반드시 지키세요:
1. 원문 문장을 그대로 옮기지 말고 **완전히 새로 쓰세요** (같은 정보라도 다른 문장 구조·어휘로)
2. 제목도 원문과 다르게, 단 핵심 검색 키워드는 유지
3. 어조: 친근한 네이버 블로그 말투(~해요체), 이모지 2~4개 자연스럽게
4. 형식: **마크다운 문법 금지** (##, ** 등 사용 금지). 순수 텍스트로, 문단 사이 빈 줄
5. 분량: 800~1,500자 — 원문 전체가 아니라 핵심만 재구성한 요약+맛보기
6. 글 후반에 자연스럽게: 더 자세한 내용은 원문 링크({source_url})에서, 그리고 영단어 암기가 필요하면 사진 한 장으로 단어장을 만들어 주는 Scan Voca(https://scanvoca.com) 소개
7. 마지막 줄: 관련 해시태그 5~8개 (#영어공부 #영단어 형식, 글 주제 반영)
8. 특정 AI 모델명(Gemini, GPT 등) 절대 언급 금지

반드시 아래 구조의 JSON 객체만 반환하세요:
{{
  "title": "네이버용 제목",
  "content": "본문 전체 (플레인 텍스트, 문단 구분 빈 줄, 마지막 줄 해시태그)"
}}"""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.8,
                    "max_output_tokens": 4096,
                    "response_mime_type": "application/json",
                },
            )
            content = (response.text or "").strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            result = json.loads(content.strip(), strict=False)
            naver_title = str(result.get("title", "")).strip()
            naver_content = str(result.get("content", "")).strip()
            if not naver_title or not naver_content:
                print("Naver version returned incomplete fields")
                return None
            return {"title": naver_title, "content": naver_content}
        except Exception as e:
            error_msg = f"Naver version generation error: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))
            return None

    async def plan_blog_images(self, markdown: str) -> Optional[List[Dict[str, Any]]]:
        """
        Analyze a blog draft and propose a context-appropriate set of illustrations.
        Returns a list of plan dicts (raw — the caller validates anchors), or None on error.
        Each item: {anchor_type, anchor_text, scene, alt, role}.
        """
        if self.model is None:
            print("Gemini API key not configured")
            return None

        # Extract the actual level-2 headings so the AI can only reference real ones.
        headings: List[str] = []
        for line in markdown.splitlines():
            stripped = line.strip()
            if stripped.startswith("## ") and not stripped.startswith("###"):
                headings.append(stripped)
        headings_block = "\n".join(headings) if headings else "(본문에 ## 소제목이 없습니다)"

        prompt = f"""당신은 영어 학습 블로그의 아트 디렉터입니다. 아래 블로그 본문(마크다운)을 읽고, 글에 어울리는 삽화 계획을 세우세요.

[본문]
\"\"\"
{markdown}
\"\"\"

[본문에 실제로 존재하는 ## 소제목 목록]
{headings_block}

규칙:
1. 이미지 개수는 본문 길이와 내용에 맞게 **문맥에 따라 0~5개**로 정하세요. 억지로 채우지 말 것 (짧거나 이미지가 불필요하면 0개도 가능).
2. 대표 이미지(role: "hero")는 **최대 1개**만. 나머지는 role: "body".
3. 각 이미지의 위치(anchor):
   - 글 최상단 대표 이미지는 anchor_type: "top", anchor_text: null
   - 특정 소제목 아래에 넣을 이미지는 anchor_type: "after_heading", anchor_text 에는 위 [소제목 목록]에 있는 문자열을 **글자 그대로 정확히** 복사 (예: "## 시작하며"). 목록에 없는 소제목을 지어내지 마세요.
4. scene: 이미지 생성 모델에 넘길 **영문** 장면 묘사. 구체적인 사물·인물·행동을 묘사하세요. 영어 단어나 짧은 영문 문구(한두 단어 수준)는 책 표지, 화면, 칠판 등에 자연스럽게 등장해도 좋습니다 — 다만 한글 텍스트가 들어갈 만한 요소(한글 간판, 한글 책 제목 등)는 피하세요. (스타일·색감·텍스트 세부 규칙은 시스템이 별도로 붙이므로 여기서는 장면만 묘사)
5. alt: 한국어 대체 텍스트(접근성용, 한 문장).

반드시 아래 JSON 객체만 반환하세요. 다른 텍스트 금지:
{{
  "plans": [
    {{ "anchor_type": "top", "anchor_text": null, "scene": "...", "alt": "...", "role": "hero" }},
    {{ "anchor_type": "after_heading", "anchor_text": "## 소제목", "scene": "...", "alt": "...", "role": "body" }}
  ]
}}
이미지가 필요 없으면 {{"plans": []}} 를 반환하세요."""

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.5,
                    "max_output_tokens": 4096,
                    "response_mime_type": "application/json",
                },
            )
            content = response.text
            if not content:
                return []
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            result = json.loads(content, strict=False)
            plans = result.get("plans") if isinstance(result, dict) else result
            if not isinstance(plans, list):
                return []
            return plans

        except json.JSONDecodeError as e:
            msg = f"Blog image-plan JSON parse error: {e}"
            try:
                print(msg)
            except UnicodeEncodeError:
                print(msg.encode("ascii", errors="ignore").decode("ascii"))
            return None
        except Exception as e:
            msg = f"Blog image-plan error: {e}"
            try:
                print(msg)
            except UnicodeEncodeError:
                print(msg.encode("ascii", errors="ignore").decode("ascii"))
            return None

    @staticmethod
    def _resize_hero_image(raw_png: bytes) -> bytes:
        """Resize a generated hero image to the canonical (HERO_IMAGE_WIDTH, HERO_IMAGE_HEIGHT).

        The model's native output resolution isn't guaranteed stable across calls (only
        aspect_ratio is requested; image_size has no measurable effect — see the module-level
        comment), so every image is forced to the same final pixel size here rather than
        trusted as-is. Falls back to the untouched bytes if Pillow can't decode/resize them
        (must never turn an otherwise-successful generation into a hard failure).
        """
        try:
            from PIL import Image
            import io

            img = Image.open(io.BytesIO(raw_png)).convert("RGB")
            img = img.resize((HERO_IMAGE_WIDTH, HERO_IMAGE_HEIGHT), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            return buf.getvalue()
        except Exception as e:  # noqa: BLE001 - resize is best-effort, never block publishing
            print(f"Hero image resize failed, using original: {e}")
            return raw_png

    async def generate_blog_image(self, scene: str) -> Optional[bytes]:
        """
        Generate a single blog illustration (IMAGE_STYLE_GUIDE + scene) and return PNG bytes.
        Uses the google-genai SDK. Returns None if the key is missing or generation fails.
        """
        if not _has_api_key():
            print("Gemini API key not configured")
            return None

        prompt = (
            f"{IMAGE_STYLE_GUIDE}\n\n"
            "SCENE TO DEPICT (this is an instruction describing what to draw, addressed to "
            "you the illustrator — it is NOT text to write, quote, or render inside the "
            "artwork itself; never reproduce this sentence, or any fragment of it, as "
            f"visible text/caption in the image): {scene}"
        )
        try:
            from google import genai as genai_new
            from google.genai import types as genai_types

            client = genai_new.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=BLOG_IMAGE_MODEL,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    image_config=genai_types.ImageConfig(aspect_ratio="16:9"),
                ),
            )
            for cand in getattr(response, "candidates", None) or []:
                parts = getattr(cand.content, "parts", None) or []
                for part in parts:
                    inline = getattr(part, "inline_data", None)
                    if inline and getattr(inline, "data", None):
                        return self._resize_hero_image(inline.data)
            print("Blog image generation returned no image")
            return None
        except Exception as e:
            msg = f"Blog image generation error: {e}"
            try:
                print(msg)
            except UnicodeEncodeError:
                print(msg.encode("ascii", errors="ignore").decode("ascii"))
            return None

    async def extract_words_from_image(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> Optional[Dict[str, Any]]:
        """
        Gemini Vision으로 이미지에서 영어 단어 추출

        Returns:
            { "words": ["word1", "word2", ...], "raw_text": "전체 인식 텍스트" }
            or None on error
        """
        if self.vision_model is None:
            print("Gemini API key not configured")
            return None

        try:
            # google-generativeai inline_data 형식
            image_part = {
                "inline_data": {
                    "mime_type": mime_type,
                    "data": base64.b64encode(image_bytes).decode("utf-8"),
                }
            }

            # raw_text를 요청하지 않음 — 토큰 절약 + 잘림 방지
            # 단어가 많은 이미지에서 raw_text까지 포함하면 2000 토큰 초과 → JSON 잘림
            prompt = """List all English words and idiomatic expressions visible in this image.

Return ONLY a JSON array, nothing else:
["word1","word2","be good at","word3"]

Rules:
- Order the entries by their reading order in the image (top to bottom, left to right) — the order they appear visually, NOT alphabetical order
- Include every individual English word you can see, lowercase, no duplicates
- Additionally, if a group of words shown together forms a well-known idiom, phrasal verb, or fixed collocation (e.g. "be good at", "give up", "look forward to", "make up for"), include that full expression as ONE entry, lowercase
- If you include such an expression as one entry, do NOT also list its individual component words separately
- Only group words this way if it is a genuinely well-known idiom/phrasal verb/collocation from a dictionary, not just any words that happen to appear near each other
- Exclude: pure numbers, single characters (except 'a', 'I'), punctuation marks
- Include proper nouns if they are common English words
- If no English words found, return: []"""

            response = self.vision_model.generate_content(
                [prompt, image_part],
                generation_config={
                    "temperature": 0.1,
                    "max_output_tokens": 8192,  # 2000 → 8192: 단어 많은 이미지 대응
                }
            )

            content = response.text
            if not content:
                return {"words": [], "raw_text": ""}

            content = content.strip()

            # 마크다운 코드블록 제거
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()

            # JSON 배열 블록만 추출
            start = content.find("[")
            end = content.rfind("]") + 1
            if start == -1 or end <= start:
                return {"words": [], "raw_text": ""}

            content = content[start:end]
            words_list = json.loads(content, strict=False)

            if not isinstance(words_list, list):
                return {"words": [], "raw_text": ""}

            cleaned = [
                w.lower().strip() for w in words_list
                if isinstance(w, str) and w.strip()
            ]

            return {"words": cleaned, "raw_text": ""}

        except json.JSONDecodeError as e:
            print(f"Gemini Vision JSON parse error: {e}")
            # 부분적으로 파싱 가능한지 시도
            try:
                # 잘린 배열에서 완성된 요소들만 추출
                import re
                matches = re.findall(r'"([a-zA-Z][a-zA-Z\'-]*)"', content)
                if matches:
                    print(f"Partial recovery: {len(matches)} words extracted")
                    return {"words": [w.lower() for w in matches], "raw_text": ""}
            except Exception:
                pass
            return {"words": [], "raw_text": ""}
        except Exception as e:
            print(f"Gemini Vision error: {e}")
            return None
