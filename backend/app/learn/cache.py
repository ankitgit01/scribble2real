import hashlib
from typing import Optional, Dict, Any
import time

class LearnCache:
    def __init__(self, ttl_seconds: int = 3600):
        self.cache: Dict[str, dict] = {}
        self.ttl = ttl_seconds

    def _hash(self, scribble_b64: str, generated_b64: Optional[str], prompt: str, mode: str, language: str, context_b64: Optional[str] = None) -> str:
        h = hashlib.sha256()
        h.update(scribble_b64.encode('utf-8'))
        if generated_b64:
            h.update(generated_b64.encode('utf-8'))
        if context_b64:
            h.update(context_b64.encode('utf-8'))
        h.update(prompt.encode('utf-8'))
        h.update(mode.encode('utf-8'))
        h.update(language.encode('utf-8'))
        return h.hexdigest()

    def get(self, *args) -> Optional[dict]:
        key = self._hash(*args)
        if key in self.cache:
            item = self.cache[key]
            if time.time() - item['timestamp'] < self.ttl:
                return item['data']
            else:
                del self.cache[key]
        return None

    def set(self, data: dict, *args):
        key = self._hash(*args)
        self.cache[key] = {
            'timestamp': time.time(),
            'data': data
        }

_cache = LearnCache()
def get_cache() -> LearnCache:
    return _cache
