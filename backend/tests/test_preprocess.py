import numpy as np

from app.preprocess import to_control_image


def test_opaque_line_map_becomes_white_scribble_on_black_controlnet_input():
    drawing = np.full((1024, 1024, 3), 255, dtype=np.uint8)
    drawing[256:768, 500:524] = 0

    control = np.asarray(to_control_image(drawing[:, :, ::-1].copy()).convert("RGB"))

    assert control.shape == (512, 512, 3)
    assert int(control[256, 256, 0]) > 240
    assert int(control[20, 20, 0]) < 15
