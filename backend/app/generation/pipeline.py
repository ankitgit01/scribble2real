from __future__ import annotations

import io
import logging
import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable

from PIL import Image

from ..config import get_settings

logger = logging.getLogger(__name__)


class GenerationCancelled(Exception):
    """Raised when a student cancels a generation request."""


class GenerationFailure(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass
class GeneratedImage:
    png_bytes: bytes
    seed: int


class GenerationPipeline:
    """SD 1.5 + Scribble ControlNet + LCM LoRA, loaded once per server process."""

    def __init__(self) -> None:
        self._pipe: Any = None
        self._torch: Any = None
        self._device: str | None = None

    def load(self) -> None:
        if self._pipe is not None:
            return

        import torch
        from diffusers import ControlNetModel, LCMScheduler, StableDiffusionControlNetImg2ImgPipeline

        settings = get_settings()
        requested_device = settings.device.strip().lower()
        if requested_device.startswith("cuda") and not torch.cuda.is_available():
            raise RuntimeError("GENERATION_BACKEND=diffusers requires a working CUDA PyTorch install. Set DEVICE=cpu only for a slow CPU run.")
        device = requested_device if requested_device.startswith("cuda") else "cpu"
        dtype = torch.float16 if settings.torch_dtype.lower() == "float16" and device.startswith("cuda") else torch.float32

        logger.info("Loading SD 1.5 and Scribble ControlNet; the first startup downloads the model weights.")
        try:
            controlnet = ControlNetModel.from_pretrained(settings.controlnet_model, torch_dtype=dtype)
            pipe = StableDiffusionControlNetImg2ImgPipeline.from_pretrained(
                settings.sd_base_model,
                controlnet=controlnet,
                torch_dtype=dtype,
                safety_checker=None,
            )
            logger.info("Base image pipeline components loaded.")
            if settings.lcm_lora.strip():
                pipe.load_lora_weights(settings.lcm_lora, adapter_name="lcm")
                logger.info("LCM adapter loaded.")
                pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
            if device.startswith("cuda"):
                if os.name == "nt":
                    # The Diffusers pipeline-level .to() and Accelerate CPU-offload
                    # paths terminate this Windows/CUDA build with a native access
                    # violation. Moving each module explicitly avoids that code path.
                    logger.info("Placing image pipeline on %s (Windows CUDA mode).", device)
                    for component_name, component in pipe.components.items():
                        if isinstance(component, torch.nn.Module):
                            logger.info("Moving %s to %s.", component_name, device)
                            component.to(device)
                    torch.cuda.synchronize()
                    pipe.enable_attention_slicing()
                else:
                    # Model CPU offload keeps SD 1.5 + ControlNet usable on 8 GB GPUs.
                    logger.info("Enabling model CPU offload on %s.", device)
                    pipe.enable_model_cpu_offload(gpu_id=int(device.split(":", 1)[1]) if ":" in device else 0)
                pipe.enable_vae_slicing()
            else:
                pipe.to(device)
            self._pipe = pipe
            self._torch = torch
            self._device = device
            logger.info("Image-generation models are ready on %s.", device)
        except Exception as error:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            raise RuntimeError(f"Could not load the configured image models: {type(error).__name__}: {error}") from error

    def generate(
        self,
        params: dict[str, Any],
        progress_cb: Callable[[float], None],
        cancel_event: threading.Event,
    ) -> GeneratedImage:
        if self._pipe is None or self._torch is None or self._device is None:
            raise RuntimeError("Image-generation models have not finished loading.")
        if cancel_event.is_set():
            raise GenerationCancelled()

        torch = self._torch
        seed = int(params["seed"])
        generator = torch.Generator(device=self._device).manual_seed(seed)
        settings = get_settings()
        init_image: Image.Image = params.get("reference_image") or Image.new("RGB", (512, 512), "white")
        control_image: Image.Image = params["control_image"]
        steps = int(params["steps"])
        guidance = float(params["guidance"])
        control_scale = float(params["control_scale"])
        mode = params["mode"]
        fidelity = float(params["fidelity"])
        strength = 1.0 if mode == "fresh" else max(0.18, min(0.92, 1.0 - 0.78 * fidelity))
        started = time.monotonic()

        def on_step_end(_pipe: Any, step_index: int, _timestep: Any, callback_kwargs: dict[str, Any]) -> dict[str, Any]:
            if cancel_event.is_set():
                raise GenerationCancelled()
            progress_cb(min(0.97, (step_index + 1) / steps))
            if time.monotonic() - started > settings.job_timeout_s:
                raise GenerationFailure("GENERATION_TIMEOUT", "Image generation took too long. Try the fast quality setting.")
            return callback_kwargs

        try:
            result = self._pipe(
                prompt=params["prompt"],
                negative_prompt=params["negative_prompt"],
                image=init_image.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS),
                control_image=control_image.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS),
                strength=strength,
                num_inference_steps=steps,
                guidance_scale=guidance,
                controlnet_conditioning_scale=control_scale,
                generator=generator,
                callback_on_step_end=on_step_end,
                callback_on_step_end_tensor_inputs=[],
            )
            if cancel_event.is_set():
                raise GenerationCancelled()
            image = result.images[0].convert("RGB")
            output = io.BytesIO()
            image.save(output, format="PNG", optimize=True)
            progress_cb(1.0)
            return GeneratedImage(output.getvalue(), seed)
        except (GenerationCancelled, GenerationFailure):
            raise
        except torch.cuda.OutOfMemoryError as error:
            torch.cuda.empty_cache()
            raise GenerationFailure("GPU_OUT_OF_MEMORY", "The GPU ran out of memory. Try Fast quality or ask the mentor to restart the workshop.") from error
        except Exception as error:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            raise GenerationFailure("GENERATION_FAILED", f"Image generation failed ({type(error).__name__}). Please try again.") from error


def get_pipeline() -> GenerationPipeline:
    settings = get_settings()
    if settings.generation_backend.strip().lower() != "diffusers":
        raise RuntimeError("Only the real Diffusers image-generation backend is supported. Set GENERATION_BACKEND=diffusers.")
    return GenerationPipeline()
