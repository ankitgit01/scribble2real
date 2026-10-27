import io
import threading
import time

from PIL import Image

from app.generation.pipeline import GeneratedImage
from app.generation.queue import JobQueue
from app.schemas import ClientInfo


def png_bytes():
    output = io.BytesIO()
    Image.new("RGB", (64, 64), (108, 164, 214)).save(output, format="PNG")
    return output.getvalue()


class _PipelineDouble:
    def __init__(self):
        self.started = threading.Event()
        self.release = threading.Event()

    def load(self):
        return None

    def generate(self, params, progress_cb, cancel_event):
        self.started.set()
        for progress in (0.2, 0.6, 0.4):
            if cancel_event.wait(0.01):
                from app.generation.pipeline import GenerationCancelled
                raise GenerationCancelled()
            progress_cb(progress)
        self.release.wait(2)
        progress_cb(1)
        return GeneratedImage(png_bytes(), params.get("seed", 123))


def wait_for(job, state, timeout=3):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if job.state == state:
            return
        time.sleep(0.01)
    assert job.state == state


def test_queue_returns_png_and_monotonic_progress():
    pipeline = _PipelineDouble()
    queue = JobQueue(pipeline)
    client = ClientInfo(client_id="generation-test", ip="127.0.0.1")
    try:
        queue.start()
        job = queue.submit({"seed": 91}, client, "A blue house", [])
        assert pipeline.started.wait(2)
        deadline = time.monotonic() + 2
        while job.progress < 0.6 and time.monotonic() < deadline:
            time.sleep(0.01)
        assert job.progress >= 0.6
        pipeline.release.set()
        wait_for(job, "done")
        assert job.result_bytes.startswith(b"\x89PNG\r\n\x1a\n")
        assert job.seed_used == 91
        assert job.progress == 1
        assert queue.snapshot().avg_seconds is not None
    finally:
        pipeline.release.set()
        queue.stop()


def test_queued_job_can_be_cancelled_without_running_it():
    pipeline = _PipelineDouble()
    queue = JobQueue(pipeline)
    client = ClientInfo(client_id="cancel-test", ip="127.0.0.1")
    try:
        queue.start()
        first = queue.submit({}, client, "First", [])
        assert pipeline.started.wait(2)
        second = queue.submit({}, client, "Second", [])
        assert queue.cancel(second.id)
        assert second.state == "cancelled"
        assert first.state == "running"
    finally:
        pipeline.release.set()
        queue.stop()
