from dataclasses import dataclass, field
from typing import Optional, Set, Dict

@dataclass
class WorkshopState:
    paused: bool = False
    banner_message: Optional[str] = None
    learn_enabled: bool = True
    max_jobs_per_client: int = 1
    blocked_clients: Set[str] = field(default_factory=set)
    client_stats: Dict[str, dict] = field(default_factory=dict)

_state = WorkshopState()

def get_workshop_state() -> WorkshopState:
    return _state