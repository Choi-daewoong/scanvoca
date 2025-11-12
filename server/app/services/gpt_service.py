"""GPT service for word definitions"""
import json
from typing import Optional, Dict, Any
from openai import OpenAI
from app.core.config import settings


class GPTService:
    """Service for OpenAI GPT API calls"""

    def __init__(self):
        self.client = None
        if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY != "sk-your-openai-api-key-here":
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    async def get_word_definition(self, word: str) -> Optional[Dict[str, Any]]:
        """
        Get word definition from GPT API
        Returns None if API key not configured or error occurs
        """
        if self.client is None:
            print("⚠️  OpenAI API key not configured")
            return None

        try:
            # Construct prompt (same as current app)
            prompt = f"""You are an English-Korean dictionary API. Provide a detailed definition for the word: "{word}"

Return a JSON object with this structure:
{{
  "word": "{word}",
  "pronunciation": "IPA pronunciation",
  "difficulty": 1-5 (1=beginner, 5=advanced),
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
1. Use standard English part of speech labels (noun, verb, adjective, adverb, preposition, conjunction, pronoun, etc.)
2. Provide at least 1-2 meanings for common words
3. Include 1-2 example sentences for each meaning
4. Ensure all JSON is properly formatted
5. Return ONLY the JSON object, no additional text
"""

            # Call GPT API
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",  # Cost-effective model
                messages=[
                    {"role": "system", "content": "You are a helpful English-Korean dictionary assistant that returns only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=1000
            )

            # Parse response
            content = response.choices[0].message.content
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
            print(f"❌ GPT JSON parse error: {e}")
            print(f"Raw content: {content}")
            return None
        except Exception as e:
            print(f"❌ GPT API error: {e}")
            return None

        return None
