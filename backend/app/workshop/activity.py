import time
import base64
import io
from typing import List, Optional
from PIL import Image
from ..schemas import ActivityItem

_activities: List[ActivityItem] = []
_next_id = 1

def add_activity(client_id: str, nickname: Optional[str], kind: str, prompt: Optional[str] = None, status: Optional[str] = None, img_bytes: Optional[bytes] = None):
    global _next_id
    from ..config import get_settings
    
    thumb_data_url = None
    if img_bytes:
        try:
            with Image.open(io.BytesIO(img_bytes)) as source:
                thumbnail = source.convert("RGB")
                thumbnail.thumbnail((128, 128), Image.Resampling.LANCZOS)
                output = io.BytesIO()
                thumbnail.save(output, format="JPEG", quality=72, optimize=True)
                thumb_data_url = "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii")
        except (OSError, ValueError):
            thumb_data_url = None
    
    item = ActivityItem(
        id=_next_id, ts=time.time(), client_id=client_id, nickname=nickname,
        kind=kind, prompt=prompt, status=status, thumb_data_url=thumb_data_url
    )
    _activities.append(item)
    _next_id += 1
    
    max_log = get_settings().activity_log_max
    if len(_activities) > max_log:
        _activities.pop(0)

def get_activities(since_id: int = 0) -> List[ActivityItem]:
    return [a for a in _activities if a.id > since_id]
