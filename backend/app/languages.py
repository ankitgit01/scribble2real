SUPPORTED_LANGUAGES = ["en", "hi"]

def normalize_language(lang: str) -> str:
    if lang in SUPPORTED_LANGUAGES:
        return lang
    return "en"

def language_instruction(lang: str) -> str:
    if lang == "hi":
        return "Write all user-facing fields in simple Hindi at Class 11-12 level. Keep scientific terms with their common English names in brackets. Return 'suggested_prompt' in English."
    return ""