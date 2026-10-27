PRESETS = {
    "fast": {"steps": 4, "guidance": 1.5},
    "better": {"steps": 8, "guidance": 2.0}
}

def fidelity_to_control_scale(fidelity: float) -> float:
    # Maps 0.0-1.0 to 0.6-1.4
    return 0.6 + (0.8 * fidelity)

def creativity_to_guidance(creativity: float) -> float:
    # Maps 0.0-1.0 to a multiplier on the preset guidance
    return 0.5 + (1.5 * creativity)