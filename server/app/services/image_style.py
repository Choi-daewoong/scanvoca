"""Single source of truth for the blog image generation style.

Edit IMAGE_STYLE_GUIDE here (and redeploy the backend) to change the look of every
AI-generated blog illustration. This English prompt is prepended to each scene
description before it is sent to the image model.
"""

IMAGE_STYLE_GUIDE = (
    "Create a bright, friendly, flat vector illustration for an English-learning blog. "
    "Style requirements: clean modern flat vector art with soft rounded shapes and gentle "
    "shading; a light, airy mood. "
    "Color: use indigo (#4F46E5) and violet (#7C3AED) as the primary accent colors, with "
    "soft supporting pastels. "
    "Background: a clean, plain white (or very light) background — no busy scenery. "
    "Aspect ratio: prefer a wide 16:9 composition suitable for a blog header or inline figure. "
    "People: when students, office workers, or learners appear, depict them as natural, "
    "friendly Korean people (students in Korean school uniforms where appropriate), diverse and "
    "warm, never stereotyped. "
    "ABSOLUTELY NO TEXT: the image must contain no letters, no words, no numbers, no captions, "
    "no signage, no readable characters of any kind — not on books, screens, signs, labels, or "
    "anywhere. Use blank pages, abstract shapes, dots, or icons instead of any writing. "
    "Do not include any watermark, logo, or brand name."
)
