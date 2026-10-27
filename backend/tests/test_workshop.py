import pytest
from app.workshop.filters import check_prompt
from app.errors import AppError

def test_filter():
    with pytest.raises(AppError) as exc:
        check_prompt("This is a nsfw prompt")
    assert exc.value.code == "PROMPT_BLOCKED"

    # Should pass without error
    check_prompt("A beautiful sunny day")