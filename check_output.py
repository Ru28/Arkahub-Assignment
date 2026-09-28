"""Optional, language-neutral JSON result comparison; Python 3.9+."""
import json
import sys


def matches(expected, actual):
    # JSON has a number type; accept 1 and 1.0 equally, but never True == 1.
    if type(expected) in (int, float) and type(actual) in (int, float):
        return expected == actual
    if type(expected) is not type(actual):
        return False
    if isinstance(expected, dict):
        return expected.keys() == actual.keys() and all(
            matches(value, actual[key]) for key, value in expected.items()
        )
    if isinstance(expected, list):
        return len(expected) == len(actual) and all(
            matches(a, b) for a, b in zip(expected, actual)
        )
    return expected == actual


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python3 check_output.py expected.json actual.json")
    with open(sys.argv[1], encoding="utf-8") as source:
        expected = json.load(source)
    with open(sys.argv[2], encoding="utf-8") as source:
        actual = json.load(source)
    if not matches(expected, actual):
        raise SystemExit("FAIL: output differs in content, array order, or JSON value types")
    print("PASS: output matches")
