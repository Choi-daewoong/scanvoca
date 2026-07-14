"""Loads the blog image style prompt from drawing_agent.md — the human-edited source of truth.

Edit the fenced ```text prompt block in drawing_agent.md (repo root) and redeploy the backend
to change the look of every AI-generated blog illustration. No other file needs to change.

Path resolution handles two layouts:
- Local dev: this file lives at <repo>/server/app/services/image_style.py, so the doc is
  three parents up, at <repo>/drawing_agent.md.
- Cloud Run image: deploy-final.ps1 copies <repo>/drawing_agent.md into server/ before
  `docker build` (whose context is server/), so it lands at /app/drawing_agent.md — two
  parents up from /app/app/services/image_style.py inside the container.
"""
import re
from pathlib import Path

# Last-resort default if drawing_agent.md is missing or its prompt block can't be parsed
# (should not happen in normal operation — see path resolution above).
_FALLBACK_STYLE_GUIDE = (
    "Create a bright, friendly, flat vector illustration for an English-learning blog. "
    "Style requirements: clean modern flat vector art with soft rounded shapes and gentle "
    "shading; a light, airy mood. "
    "Color: use indigo (#4F46E5) and violet (#7C3AED) as the primary accent colors, with "
    "soft supporting pastels. "
    "Background: a clean, plain white (or very light) background — no busy scenery. "
    "Aspect ratio: prefer a wide 16:9 composition suitable for a blog header or inline figure. "
    "ABSOLUTELY NO TEXT: the image must contain no letters, no words, no numbers, no captions, "
    "no signage, no readable characters of any kind. "
    "Do not include any watermark, logo, or brand name."
)

_PROMPT_BLOCK_RE = re.compile(r"```text prompt\s*\n(.*?)\n```", re.DOTALL)


def _load_style_guide() -> str:
    here = Path(__file__).resolve()
    candidates = [
        here.parents[2] / "drawing_agent.md",  # Cloud Run image: /app/drawing_agent.md
        here.parents[3] / "drawing_agent.md",  # local dev: <repo>/drawing_agent.md
    ]
    for path in candidates:
        if path.is_file():
            text = path.read_text(encoding="utf-8")
            match = _PROMPT_BLOCK_RE.search(text)
            if match:
                guide = match.group(1).strip()
                if guide:
                    return guide
            print(f"drawing_agent.md found at {path} but no ```text prompt block parsed")
    print("drawing_agent.md not found or unparseable — using built-in fallback style guide")
    return _FALLBACK_STYLE_GUIDE


IMAGE_STYLE_GUIDE = _load_style_guide()
