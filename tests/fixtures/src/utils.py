def format_percent(value: float) -> str:
    return f"{value:.1f}%"


def clamp(value: float, min_val: float, max_val: float) -> float:
    return max(min_val, min(max_val, value))
