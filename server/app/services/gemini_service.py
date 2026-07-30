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

# Target hero-image output size: 16:9 at exactly 1.5x the pixel area of the previous
# 1024x1024 default (the model's un-configured fallback — confirmed by live probe, since
# it ignores the text-only "prefer 16:9" hint in drawing_agent.md without a structured
# aspect_ratio param). image_size ("1K"/"2K"/"4K") was probed too and made no difference
# to actual output resolution for this model, so it isn't used — the resize below is the
# only reliable way to control final pixel area.
HERO_IMAGE_WIDTH = 1672
HERO_IMAGE_HEIGHT = 940

# conversation-clipper's dialogue-first discovery (suggest_conversation_topic_from_dialogue)
# runs fully unattended via cron — unlike the manual-add topic flow, no admin reviews a
# discovered topic before it can be auto-published. The prompt tells the model to avoid
# profanity, but a real run still produced a title quoting "Fuck realistic" verbatim
# (source dialogue happened to contain it) — prompt instructions alone aren't a reliable
# content-safety gate for a service whose stated audience is 중·고등학생, so this is a
# code-level backstop, not a replacement for the prompt instruction.
_PROFANITY_RE = re.compile(
    r"\b(fuck|shit|bitch|asshole|dick|pussy|cunt|bastard)\w*\b", re.IGNORECASE
)


def _contains_profanity(*texts: str) -> bool:
    return any(_PROFANITY_RE.search(t) for t in texts)


def _has_api_key() -> bool:
    return bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your-gemini-api-key-here")


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
        {passage_text, question_text, choices, answer, source_label}. When given, the model
        writes an explainer that quotes the passage verbatim (never invents one) and appends
        the original passage/question/answer/explanation + a KICE source line at the bottom.
        source_dialogue (optional, conversation pipeline): a real dialogue clip
        {dialogue_en, dialogue_ko, video_title, clip_url}. When given, the model quotes the
        dialogue and explains its expressions/vocabulary.
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
                "body 안에는 연습문제 내용을 직접 쓰지 말고, practice_questions 필드에만 넣으세요."
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
            choices_str = (
                "\n".join(str(c) for c in choices) if choices else "(선택지 없음)"
            )
            source_label = source_passage.get("source_label", "기출문제")
            problem_number = source_passage.get("problem_number")
            citation_label = (
                f"{source_label} {problem_number}번" if problem_number else source_label
            )
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
                "있다면 본문에 인용할 때도 그대로 유지하세요). 본문 하단에 원문 지문 전체 + 문제 + 정답 + "
                "상세 해설을 포함하세요."
                f'\n12. 본문에 반드시 "본 지문은 한국교육과정평가원이 출제한 기출문제입니다({citation_label})" '
                "라는 출처 문구를 포함하세요."
                + (
                    ""
                    if has_answer
                    else "\n13. 정답이 별도로 제공되지 않았습니다 — 지문·문제·선택지 내용을 근거로 "
                    "정답을 스스로 판단하고, 애매한 태도 없이 확정된 정답으로 제시한 뒤 그렇게 판단한 "
                    "근거를 해설에서 논리적으로 설명하세요."
                )
            )

        # Conversation pipeline: inject a real dialogue clip to quote and explain.
        dialogue_block = ""
        dialogue_instruction = ""
        if source_dialogue:
            dialogue_block = (
                "\n\n[활용할 실제 대사 클립 — 아래 대사를 인용해 표현을 설명할 것]\n"
                f'영상: {source_dialogue.get("video_title", "")}\n'
                f'영어 대사(dialogue_en):\n"""{source_dialogue.get("dialogue_en", "")}"""\n'
                f'한국어 번역(dialogue_ko):\n"""{source_dialogue.get("dialogue_ko", "") or "(없음)"}"""\n'
            )
            dialogue_instruction = (
                "\n11. 위 [활용할 실제 대사 클립]의 영어 대사를 인용하며, 그 안에 등장하는 유용한 "
                "표현·어휘·뉘앙스를 실제 회화에서 어떻게 쓰는지 구체적으로 설명하는 글을 작성하세요. "
                "대사를 임의로 창작하지 말고 주어진 원문을 그대로 인용하세요."
            )

        prompt = f"""당신은 영어 학습 서비스 "Scan Voca"의 콘텐츠 마케터입니다. 중·고등학생과 영어 학습자를 대상으로 하는 한국어 블로그 글을 작성하세요.

{topic_block}
{recent_posts_block}{source_block}{dialogue_block}
작성 요구사항:
1. 언어: 한국어
2. 본문 분량: 1,500~2,500자 (공백 포함)
3. `##` 마크다운 소제목을 3~5개 사용해 구조화
4. 실용적이고 구체적인 내용 (막연한 조언 금지, 실제로 따라 할 수 있는 방법·예시 포함)
5. **마지막 섹션에서는** 방금 다룬 본문 내용(팁·문제·표현 등 이 글의 구체적인 소재)에서 출발해, 그 흐름이 자연스럽게 이어지는 자기만의 문장으로 Scan Voca(https://scanvoca.com)를 홍보하며 마무리하세요. "결국 단어는 외워야 한다" 같은 정해진 문구를 매번 그대로 쓰지 말고, 글마다 다른 표현으로 전환하세요. 마크다운 링크 [Scan Voca 시작하기](https://scanvoca.com) 를 포함하세요.
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
                print(f"Retrying blog generation ({retry_count + 1}/{max_retries})...")
                return await self.generate_blog_post(
                    title=title,
                    angle=angle,
                    custom_prompt=custom_prompt,
                    recent_posts=recent_posts,
                    include_practice_questions=include_practice_questions,
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

    async def suggest_blog_topics(
        self,
        pipeline: str,
        category: str,
        count: int = 5,
        recent_posts: Optional[List[Dict[str, str]]] = None,
        existing_titles: Optional[List[str]] = None,
        available_tags: Optional[List[str]] = None,
    ) -> Optional[List[Dict[str, str]]]:
        """
        Suggest blog topic candidates for a pipeline/category.
        Returns a list of {title, angle} dicts, or None on error. Nothing is persisted —
        the caller (admin UI) edits and confirms candidates separately.
        recent_posts / existing_titles are supplied so the model avoids proposing topics
        that duplicate already-published posts or already-listed topics.
        available_tags (suneung only): the real tag vocabulary of currently unused exam
        passages. run_auto_publish can only use a suneung topic if its angle text shares a
        keyword with some passage's tags (BlogService.find_matching_passage) — natural prose
        written without seeing that vocabulary essentially never does, so every such topic
        silently dead-ends at "no_matching_passage". Passing this makes the model name a
        real tag verbatim in the angle so the topic is actually usable.
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

        tags_block = ""
        tags_instruction = ""
        if available_tags:
            tags_block = "\n\n[실제 사용 가능한 기출 지문 태그 목록]\n" + ", ".join(available_tags) + "\n"
            tags_instruction = (
                "\n6. 위 [실제 사용 가능한 기출 지문 태그 목록]에서 이 주제와 어울리는 태그를 "
                "**최소 1개 골라 angle에 그 단어를 그대로(축약·변형 없이) 포함**시키세요 — "
                "이 주제는 나중에 그 태그를 가진 실제 기출 지문과 매칭되어야만 실제로 글이 "
                "발행됩니다. 목록에 없는 단어를 지어내지 마세요."
            )

        prompt = f"""당신은 영어 학습 서비스 "Scan Voca"의 콘텐츠 전략가입니다. 아래 조건에 맞는 블로그 글 주제 후보 {count}개를 제안하세요.

카테고리: "{category}"
파이프라인 방향: {pipeline_hint}
{recent_block}{existing_block}{tags_block}
요구사항:
1. 언어: 한국어
2. 각 주제는 서로 겹치지 않고, 위 목록에 이미 있는 주제/글과도 겹치지 않게 하세요.
3. 실제 검색 수요가 있을 법한 구체적이고 실용적인 주제로 만드세요.
4. title은 블로그 글 제목 후보(한국어), angle은 글의 방향·타깃·핵심 키워드 메모(한국어 1~2문장).
5. 특정 AI 모델명(Gemini, GPT 등)은 절대 언급하지 마세요.{tags_instruction}

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
        """
        if self.model is None:
            print("Gemini API key not configured")
            return None

        existing_block = ""
        if existing_titles:
            lines = "\n".join(f'- "{t}"' for t in existing_titles)
            existing_block = f"\n[이미 등록된 주제 (중복 금지)]\n{lines}\n"

        prompt = f"""당신은 영어 학습 서비스 "Scan Voca"의 콘텐츠 전략가입니다.
아래는 실제 영상에서 그대로 가져온 대사 구간입니다. 이 대사가 일상 영어회화 학습자에게 가르칠 만한 표현을 담고 있는지 판단하세요.

[영상 제목]
{video_title}

[대사 구간 (원문 그대로)]
{dialogue_en}
{existing_block}
이 서비스의 타겟 사용자는 중·고등학생입니다 — 판단 시 반드시 고려하세요.

판단 기준:
1. 원어민이 실제로 자주 쓰지만 한국인 학습자가 교과서에서 배우기 어려운 표현(관용구, 구동사, 뉘앙스 표현 등)이 있으면 좋은 소재입니다.
2. 다음 중 하나라도 해당하면 좋은 소재가 아닙니다:
   - 의미 없는 필러 대사(yeah, okay, um, hi 등 위주)
   - 중학교 수준의 너무 뻔한 문장
   - 앞뒤 맥락이 잘려 무슨 뜻인지 알 수 없는 대사
   - 고유명사·줄거리에만 의존해서 그 영상을 안 본 사람에게는 쓸모없는 대사
   - **욕설·비속어·성적 표현이 핵심 표현이거나, 그런 단어를 그대로 인용해야만 설명이 되는 대사** (중·고등학생 대상 서비스에 절대 부적절 — 표현 자체가 욕설이 아니어도 주변 대사에 욕설이 섞여 있으면 그 부분은 인용하지 말고, 욕설을 빼면 소재가 안 될 정도라면 has_expression을 false로)
3. 좋은 소재가 아니면 억지로 주제를 만들지 말고 반드시 has_expression을 false로 답하세요. 억지로 만든 주제는 무가치하며, false는 정상적이고 흔한 답입니다.

좋은 소재일 때만:
4. title은 그 표현을 소재로 한 블로그 글 제목(한국어, 구어체, 클릭하고 싶어지는 톤).
5. angle은 글의 방향·타깃·핵심 키워드 메모(한국어 1~2문장). **위 대사 중 핵심 표현을 원문 그대로 인용**해서 포함하세요.
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

    async def tag_exam_passage(
        self, passage_text: str, question_text: str
    ) -> Optional[List[str]]:
        """
        Tag a 수능/모의고사 exam passage with 3~5 keywords (grammar point + topic keywords).
        Returns a list of individual keyword strings, or None on error / [] if nothing usable.
        Used by the one-off ingest script to backfill exam_passages.tags. Keywords are kept
        as individual tokens (e.g. "역접", "빈칸추론") so the simple keyword-overlap matcher in
        BlogService.find_matching_passage can score them against a topic's angle.
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
