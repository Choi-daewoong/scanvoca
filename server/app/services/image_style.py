"""Loads the blog image style prompt from drawing_agent.md — the human-edited source of truth.

Edit the fenced ```text prompt block in drawing_agent.md (repo root) and redeploy the backend
to change the look of every AI-generated blog illustration. No other file needs to change.

Path resolution handles two layouts, checked in this order so local dev always prefers the
real repo-root source over any leftover build artifact:
- Local dev: this file lives at <repo>/server/app/services/image_style.py, so the doc is
  three parents up, at <repo>/drawing_agent.md. Checked FIRST.
- Cloud Run image: deploy-final.ps1 copies <repo>/drawing_agent.md into server/ before
  `docker build` (whose context is server/) and removes the copy afterward, so at runtime
  it lands at /app/drawing_agent.md — two parents up from /app/app/services/image_style.py
  inside the container. Checked second (this path doesn't exist in local dev).
"""
import re
from pathlib import Path

# Last-resort default if drawing_agent.md is missing or its prompt block can't be parsed
# (should not happen in normal operation — see path resolution above).
_FALLBACK_STYLE_GUIDE = (
    "Create a hand-drawn ink-pen doodle illustration for an English-learning blog, in the "
    "style of a sketchnote/whiteboard-explainer video. "
    "Rendering: hand-drawn black ink pen line art, deliberately imperfect and slightly wobbly "
    "lines, not machine-perfect vector geometry. No 3D, no photorealism, no painterly shading. "
    "People: simple minimal stick figures — a circle head, two dot eyes, one curved smiling "
    "mouth line, thin single-stroke limbs. No clothing detail, no hair, no realistic faces. "
    "Color: mostly black ink line art on a clean background; use indigo (#4F46E5) and violet "
    "(#7C3AED) only as sparing accent fills on one highlighted shape, arrow, or badge — never "
    "color the whole scene. "
    "Background: a clean, plain white (or very light cream) background — no busy scenery. "
    "Aspect ratio: prefer a wide 16:9 composition suitable for a blog header or inline figure. "
    "ABSOLUTELY NO TEXT: the image must contain no letters, no words, no numbers, no captions, "
    "no signage, no readable characters of any kind. "
    "Do not include any watermark, logo, or brand name."
)

_PROMPT_BLOCK_RE = re.compile(r"```text prompt\s*\n(.*?)\n```", re.DOTALL)


def _load_style_guide() -> str:
    here = Path(__file__).resolve()
    candidates = [
        here.parents[3] / "drawing_agent.md",  # local dev: <repo>/drawing_agent.md
        here.parents[2] / "drawing_agent.md",  # Cloud Run image: /app/drawing_agent.md
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
