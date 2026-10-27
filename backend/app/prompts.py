from dataclasses import dataclass
from typing import List
from .schemas import Style

@dataclass
class PromptPair:
    positive: str
    negative: str

def build_prompt(user_prompt: str, color_words: List[str], style: Style) -> PromptPair:
    style_prompts = {
        "realistic": "photorealistic, natural lighting, high detail",
        "cartoon": "cartoon style, vibrant, flat colors",
        "watercolor": "watercolor painting, artistic, flowing edges",
        "blueprint": "blueprint, technical drawing, grid background"
    }
    subject = user_prompt if user_prompt.strip() else "a generic subject"
    colors = ", ".join(color_words)
    pos = f"{style_prompts.get(style, '')}, {subject}"
    if colors:
        pos += f", mostly {colors}"
    
    neg = "low quality, deformed, watermark, text, nudity, gore, weapons"
    return PromptPair(positive=pos, negative=neg)