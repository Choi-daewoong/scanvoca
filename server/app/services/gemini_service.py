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
1. First, check if "{word}" is a REAL English word (including proper nouns, idioms, common abbreviations)
2. If it's NOT a valid English word (e.g., random letters, OCR errors like "geet", "alaoa", "sact", gibberish), return: {{"is_valid": false, "word": "{word}", "reason": "Not a valid English word"}}
3. If it IS a valid English word, return the full definition with "is_valid": true

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
3. Use standard English part of speech labels (noun, verb, adjective, adverb, preposition, conjunction, pronoun, etc.)
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
            prompt = """List all English words visible in this image.

Return ONLY a JSON array, nothing else:
["word1","word2","word3"]

Rules:
- Every English word you can see, lowercase, no duplicates
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
