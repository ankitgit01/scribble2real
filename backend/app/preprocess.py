import numpy as np
import base64
import cv2
from typing import Tuple, List
from .errors import AppError

def decode_image_b64(b64: str, max_bytes: int) -> np.ndarray:
    try:
        if "," in b64:
            b64 = b64.split(",")[1]
        data = base64.b64decode(b64)
        if len(data) > max_bytes:
            raise AppError("BAD_INPUT", "Image too large")
        np_arr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            raise AppError("BAD_INPUT", "Invalid image data")
        return img
    except Exception:
        raise AppError("BAD_INPUT", "Invalid base64 encoding")

def normalize_drawing(img: np.ndarray) -> np.ndarray:
    height, width = img.shape[:2]
    scale = min(1024 / width, 1024 / height)
    resized = cv2.resize(img, (max(1, round(width * scale)), max(1, round(height * scale))), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC)
    canvas = np.full((1024, 1024, 3), 255, dtype=np.uint8)
    x = (1024 - resized.shape[1]) // 2
    y = (1024 - resized.shape[0]) // 2
    canvas[y:y + resized.shape[0], x:x + resized.shape[1]] = resized
    return canvas

def cleanup_photo(img: np.ndarray) -> Tuple[np.ndarray, List[str]]:
    height, width = img.shape[:2]
    scale = min(1024 / width, 1024 / height)
    resized = cv2.resize(img, (max(1, round(width * scale)), max(1, round(height * scale))), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    block_size = min(31, min(gray.shape) if min(gray.shape) % 2 else min(gray.shape) - 1)
    if block_size < 3:
        cleaned = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    else:
        cleaned = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, block_size, 11)
    canvas = np.full((1024, 1024), 255, dtype=np.uint8)
    x = (1024 - cleaned.shape[1]) // 2
    y = (1024 - cleaned.shape[0]) // 2
    canvas[y:y + cleaned.shape[0], x:x + cleaned.shape[1]] = cleaned
    return cv2.cvtColor(canvas, cv2.COLOR_GRAY2BGR), ["Paper background balanced", "Pencil lines sharpened"]

def to_control_image(drawing_1024: np.ndarray):
    from PIL import Image
    if drawing_1024.ndim == 3:
        gray = cv2.cvtColor(drawing_1024, cv2.COLOR_BGR2GRAY)
    else:
        gray = drawing_1024
    gray = cv2.resize(gray, (512, 512), interpolation=cv2.INTER_AREA)
    # ControlNet's scribble checkpoint expects white marks on black.
    control = cv2.bitwise_not(gray)
    return Image.fromarray(cv2.cvtColor(control, cv2.COLOR_GRAY2RGB))

def composite_to_control_image(composite_1024: np.ndarray):
    from PIL import Image
    if composite_1024.ndim == 3:
        gray = cv2.cvtColor(composite_1024, cv2.COLOR_BGR2GRAY)
    else:
        gray = composite_1024
    gray = cv2.resize(gray, (512, 512), interpolation=cv2.INTER_AREA)
    edges = cv2.Canny(gray, 80, 160)
    return Image.fromarray(cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB))

def extract_color_words(color_layer_img, max_words: int = 4) -> List[str]:
    from PIL import Image
    if isinstance(color_layer_img, Image.Image):
        rgba = np.asarray(color_layer_img.convert("RGBA"))
    else:
        array = np.asarray(color_layer_img)
        if array.ndim == 2:
            rgb = cv2.cvtColor(array.astype(np.uint8), cv2.COLOR_GRAY2RGB)
            rgba = np.dstack((rgb, np.full(rgb.shape[:2], 255, dtype=np.uint8)))
        elif array.shape[2] == 4:
            rgba = cv2.cvtColor(array.astype(np.uint8), cv2.COLOR_BGRA2RGBA)
        else:
            rgb = cv2.cvtColor(array.astype(np.uint8), cv2.COLOR_BGR2RGB)
            rgba = np.dstack((rgb, np.full(rgb.shape[:2], 255, dtype=np.uint8)))
    visible = rgba[rgba[:, :, 3] > 24, :3]
    if visible.size == 0:
        return []
    # Quantize to avoid letting antialiased edge pixels count as distinct colors.
    quantized = (visible.astype(np.uint16) // 32) * 32
    colors, counts = np.unique(quantized, axis=0, return_counts=True)
    names = {
        "red": (220, 40, 45), "orange": (245, 130, 35), "yellow": (245, 210, 45),
        "green": (55, 160, 85), "teal": (35, 165, 160), "blue": (50, 110, 220),
        "purple": (135, 75, 195), "pink": (235, 110, 165), "brown": (135, 85, 50),
        "black": (35, 35, 40), "gray": (135, 140, 145), "white": (245, 245, 245),
    }
    ranked = sorted(zip(colors, counts), key=lambda value: int(value[1]), reverse=True)
    selected: List[str] = []
    for color, _count in ranked:
        rgb = color.astype(np.float32)
        name = min(names, key=lambda candidate: float(np.sum((rgb - np.asarray(names[candidate], dtype=np.float32)) ** 2)))
        if name not in selected:
            selected.append(name)
        if len(selected) >= max_words:
            break
    return selected

def encode_png_b64(img: np.ndarray) -> str:
    _, buffer = cv2.imencode('.png', img)
    return base64.b64encode(buffer).decode('utf-8')
