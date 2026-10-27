from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import asyncio
import importlib
import os
from .config import get_settings
from .errors import install_error_handlers

settings = get_settings()
app = FastAPI(title="Scribble2Real API")
app.state.model_loaded = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

install_error_handlers(app)

ROUTER_MODULES = [
    "app.core_router",
    "app.generation.router",
    "app.learn.router",
    "app.workshop.router",
    "app.translate.router"
]

for mod_name in ROUTER_MODULES:
    try:
        mod = importlib.import_module(mod_name)
        app.include_router(mod.router, prefix="/api")
    except ImportError as e:
        print(f"Failed to load {mod_name}: {e}") # This will now print the exact error!
    except Exception as e:
        print(f"Error in {mod_name}: {e}")

@app.on_event("startup")
async def load_generation_pipeline():
    from .generation.queue import get_queue
    if not settings.mentor_pin.strip():
        raise RuntimeError("Set a private MENTOR_PIN in backend/.env before starting the workshop.")
    await asyncio.to_thread(get_queue().start)
    app.state.model_loaded = True

@app.on_event("shutdown")
async def stop_generation_pipeline():
    from .generation.queue import get_queue
    get_queue().stop()

if os.path.isdir(settings.static_dir):
    app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="static")
