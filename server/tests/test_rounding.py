"""js_round breaks .5 ties upward, matching the frontend's Math.round / toFixed.

Written with stdlib ``unittest`` (pytest runs it too). Pins the parity rule so a
future refactor to Python's round-half-to-even ``round`` is caught here.
"""

import unittest

from route_lab.shared.rounding import js_round


class JsRoundTest(unittest.TestCase):
    def test_integer_half_ties_go_up_like_math_round(self) -> None:
        # Python's round() would give 0, 2, 2 here (round-half-to-even).
        self.assertEqual(js_round(0.5), 1.0)
        self.assertEqual(js_round(1.5), 2.0)
        self.assertEqual(js_round(2.5), 3.0)

    def test_it_disagrees_with_python_round_at_a_tie(self) -> None:
        # The exact reason the helper exists: on this value the two rules differ.
        self.assertNotEqual(js_round(2.5), round(2.5))

    def test_decimal_half_ties_go_up_like_tofixed(self) -> None:
        # 1.25 is exactly representable; toFixed(1.25, 1) is "1.3", round(1.25, 1) is 1.2.
        self.assertEqual(js_round(1.25, 1), 1.3)
        self.assertEqual(js_round(0.125, 2), 0.13)

    def test_non_tie_values_are_unchanged(self) -> None:
        self.assertEqual(js_round(6.2), 6.0)
        self.assertEqual(js_round(6.8), 7.0)
        self.assertEqual(js_round(2.0, 2), 2.0)


if __name__ == "__main__":
    unittest.main()
