from fastapi import APIRouter
from pydantic import BaseModel, Field
from ..learn.service import run_text_task
from ..errors import AppError

router = APIRouter()

class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=300)

class TranslateResponse(BaseModel):
    text_en: str

@router.post("/translate_prompt", response_model=TranslateResponse)
async def translate_prompt(req: TranslateRequest):
    system = "Translate the student's image prompt into concise natural English. Keep the meaning and subject. Return only the translated prompt, without quotation marks or explanation."
    try:
        translated = await run_text_task(system, req.text)
    except AppError:
        raise
    except Exception as error:
        raise AppError("LEARN_UNAVAILABLE", "Prompt translation is temporarily unavailable.", status=502) from error
    return TranslateResponse(text_en=translated.strip().strip('"'))
