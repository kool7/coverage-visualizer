def risky_operation(x):
    if x < 0:
        raise ValueError("Negative not allowed")
    if x > 100:
        return "too large"
    return x * 2


def another_untested(data):
    return sorted(data, reverse=True)
