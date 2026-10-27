from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from .pipeline import GenerationCancelled, GenerationFailure, GenerationPipeline, GeneratedImage, get_pipeline
from ..config import get_settings


@dataclass
class Job:
    id: str
    client_id: str
    nickname: Optional[str]
    state: str
    created_at: float
    params: dict[str, Any]
    final_prompt: str
    color_words: list[str]
    started_at: Optional[float] = None
    finished_at: Optional[float] = None
    error: Optional[dict] = None
    progress: float = 0.0
    result_bytes: Optional[bytes] = None
    seed_used: Optional[int] = None
    cancel_event: threading.Event = field(default_factory=threading.Event)


@dataclass
class QueueSnapshot:
    length: int
    running: int
    avg_seconds: Optional[float] = None


class JobQueue:
    def __init__(self, pipeline: Optional[GenerationPipeline] = None):
        self.jobs: dict[str, Job] = {}
        self.pending: list[str] = []
        self.running_job_id: Optional[str] = None
        self.lock = threading.RLock()
        self.pipeline = pipeline or get_pipeline()
        self.worker_thread: Optional[threading.Thread] = None
        self.history_times: list[float] = []
        self.stopping = threading.Event()

    def start(self) -> None:
        with self.lock:
            if self.worker_thread and self.worker_thread.is_alive():
                return
        self.pipeline.load()
        self.stopping.clear()
        self.worker_thread = threading.Thread(target=self._worker_loop, name="scribble-generation-worker", daemon=True)
        self.worker_thread.start()

    def stop(self) -> None:
        self.stopping.set()
        with self.lock:
            if self.running_job_id and self.running_job_id in self.jobs:
                self.jobs[self.running_job_id].cancel_event.set()
            self.pending.clear()
            worker = self.worker_thread
        if worker and worker.is_alive():
            worker.join(timeout=10)
        self.worker_thread = None

    def submit(self, params: dict[str, Any], client: Any, final_prompt: str, color_words: list[str]) -> Job:
        with self.lock:
            if not self.worker_thread or not self.worker_thread.is_alive():
                raise RuntimeError("The image-generation model is not ready yet.")
            if len(self.pending) >= get_settings().max_queue:
                raise RuntimeError("QUEUE_FULL")
            job_id = f"job_{int(time.time() * 1000)}_{threading.get_ident()}_{len(self.jobs) + 1}"
            job = Job(
                id=job_id, client_id=client.client_id, nickname=client.nickname,
                state="queued", created_at=time.time(), params=params,
                final_prompt=final_prompt, color_words=color_words,
            )
            self.jobs[job_id] = job
            self.pending.append(job_id)
            return job

    def get(self, job_id: str) -> Optional[Job]:
        with self.lock:
            return self.jobs.get(job_id)

    def cancel(self, job_id: str) -> bool:
        with self.lock:
            job = self.jobs.get(job_id)
            if not job:
                return False
            if job.state == "queued":
                self.pending.remove(job_id)
                job.state = "cancelled"
                job.finished_at = time.time()
                job.cancel_event.set()
                return True
            if job.state == "running":
                job.cancel_event.set()
                return True
            return False

    def snapshot(self) -> QueueSnapshot:
        with self.lock:
            avg = sum(self.history_times) / len(self.history_times) if self.history_times else None
            return QueueSnapshot(length=len(self.pending), running=1 if self.running_job_id else 0, avg_seconds=avg)

    def clear_pending(self) -> int:
        with self.lock:
            pending = list(self.pending)
            self.pending.clear()
            for job_id in pending:
                job = self.jobs[job_id]
                job.state = "cancelled"
                job.finished_at = time.time()
                job.cancel_event.set()
            return len(pending)

    def jobs_for_client(self, client_id: str) -> list[Job]:
        with self.lock:
            return [job for job in self.jobs.values() if job.client_id == client_id and job.state in ("queued", "running")]

    def _worker_loop(self) -> None:
        while not self.stopping.is_set():
            with self.lock:
                job = self.jobs[self.pending.pop(0)] if self.pending else None
                if job:
                    self.running_job_id = job.id
                    job.state = "running"
                    job.started_at = time.time()
            if job is None:
                self.stopping.wait(0.1)
                continue

            started = time.monotonic()

            def progress_cb(progress: float) -> None:
                with self.lock:
                    job.progress = max(job.progress, max(0.0, min(1.0, float(progress))))

            try:
                result: GeneratedImage = self.pipeline.generate(job.params, progress_cb, job.cancel_event)
                if time.monotonic() - started > get_settings().job_timeout_s:
                    raise GenerationFailure("GENERATION_TIMEOUT", "Image generation took too long. Try Fast quality.")
                if job.cancel_event.is_set():
                    raise GenerationCancelled()
                with self.lock:
                    job.result_bytes = result.png_bytes
                    job.seed_used = result.seed
                    job.state = "done"
                    job.progress = 1.0
            except GenerationCancelled:
                with self.lock:
                    job.state = "cancelled"
            except GenerationFailure as error:
                with self.lock:
                    job.state = "error"
                    job.error = {"code": error.code, "message": str(error), "retry_after_s": None}
            except Exception as error:
                with self.lock:
                    job.state = "error"
                    job.error = {"code": "GENERATION_FAILED", "message": f"Image generation failed ({type(error).__name__}). Try again.", "retry_after_s": None}
            finally:
                job.finished_at = time.time()
                elapsed = time.monotonic() - started
                with self.lock:
                    if job.state == "done":
                        self.history_times = (self.history_times + [elapsed])[-10:]
                    self.running_job_id = None
                    self._trim_finished_jobs()
                try:
                    from ..workshop.activity import add_activity
                    add_activity(job.client_id, job.nickname, "generate", prompt=job.final_prompt, status=job.state, img_bytes=job.result_bytes)
                except Exception:
                    pass
                job.params.clear()

    def _trim_finished_jobs(self) -> None:
        finished = [job_id for job_id, job in self.jobs.items() if job.state in ("done", "error", "cancelled")]
        for job_id in finished[:-30]:
            del self.jobs[job_id]


_queue: Optional[JobQueue] = None
_queue_lock = threading.Lock()


def get_queue() -> JobQueue:
    global _queue
    with _queue_lock:
        if _queue is None:
            _queue = JobQueue()
        return _queue
