"""Gemini service for word definitions and Vision OCR"""
import json
import base64
from typing import Optional, Dict, Any, List
import google.generativeai as genai
from app.core.config import settings


class GeminiService:
    """Service for Google Gemini API calls"""

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

                result = json.loads(content)
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
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a Korean English-learning blog post.
        Returns a dict: {slug, title, description, category, tags, body} or None on error.
        Either (title[, angle]) or custom_prompt must be provided.
        """
        if self.model is None:
            print("Gemini API key not configured")
            return None

        categories = ["중등", "고등", "토익", "일상회화", "비즈니스회화", "학습법"]
        categories_str = ", ".join(categories)

        if custom_prompt and custom_prompt.strip():
            topic_block = f'사용자가 직접 입력한 주제/지시:\n"""{custom_prompt.strip()}"""'
        else:
            topic_block = f'주제(제목 후보): "{title}"'
            if angle:
                topic_block += f'\n글 방향/타깃/키워드 메모: "{angle}"'

        prompt = f"""당신은 영어 학습 서비스 "Scan Voca"의 콘텐츠 마케터입니다. 중·고등학생과 영어 학습자를 대상으로 하는 한국어 블로그 글을 작성하세요.

{topic_block}

작성 요구사항:
1. 언어: 한국어
2. 본문 분량: 1,500~2,500자 (공백 포함)
3. `##` 마크다운 소제목을 3~5개 사용해 구조화
4. 실용적이고 구체적인 내용 (막연한 조언 금지, 실제로 따라 할 수 있는 방법·예시 포함)
5. **마지막 섹션은 반드시** "결국 단어는 외워야 한다"는 필요성으로 자연스럽게 연결한 뒤, Scan Voca(https://scanvoca.com)를 홍보하는 내용으로 마무리하세요. 마크다운 링크 [Scan Voca 시작하기](https://scanvoca.com) 를 포함하세요.
6. 특정 AI 모델명(예: Gemini, GPT, ChatGPT 등)을 본문·제목·어디에도 절대 쓰지 마세요.
7. 카테고리는 다음 고정 목록 중 가장 적합한 하나를 고르세요: {categories_str}
8. slug는 영문 소문자·숫자·하이픈만 사용한 ASCII kebab-case로 만드세요 (예: toeic-vocab-30days).

반드시 아래 구조의 JSON 객체만 반환하세요. 다른 텍스트는 포함하지 마세요:
{{
  "slug": "ascii-kebab-case-slug",
  "title": "글 제목 (한국어)",
  "description": "SEO용 요약 1~2문장 (검색 결과 노출용)",
  "category": "위 목록 중 하나",
  "tags": ["태그1", "태그2", "태그3"],
  "body": "본문 마크다운 전체 (frontmatter 제외, ## 소제목 포함, 마지막 섹션은 Scan Voca 홍보)"
}}

주의:
- body에는 frontmatter(---)를 넣지 마세요. 순수 본문 마크다운만 넣으세요.
- JSON 문자열 안의 줄바꿈은 \\n 으로 이스케이프하세요.
- 반드시 완성된 유효한 JSON만 반환하세요."""

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

            result = json.loads(content)

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
                category = "학습법"

            return {
                "slug": slug,
                "title": title_out,
                "description": description,
                "category": category,
                "tags": tags,
                "body": body,
            }

        except json.JSONDecodeError as e:
            error_msg = f"Blog generation JSON parse error: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))
            return None
        except Exception as e:
            error_msg = f"Blog generation error: {e}"
            try:
                print(error_msg)
            except UnicodeEncodeError:
                print(error_msg.encode("ascii", errors="ignore").decode("ascii"))
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
            words_list = json.loads(content)

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
