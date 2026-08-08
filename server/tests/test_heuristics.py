"""The heuristic kit, written with stdlib ``unittest`` (pytest runs it too).

Shows the ``unittest.TestCase`` style alongside the plain-function tests, so the
team can write either. Focused on the plug-n-play distance heuristics.
"""

import unittest
from typing import get_args

from route_lab.shared.graph import build_graph
from route_lab.shared.heuristics import (
    DEFAULT_HEURISTIC,
    HEURISTICS,
    HeuristicName,
    euclidean_heuristic,
    haversine_heuristic,
    manhattan_heuristic,
    zero_heuristic,
)

from .fixtures import diamond_payload


class HeuristicKitTest(unittest.TestCase):
    def setUp(self) -> None:
        self.graph = build_graph(diamond_payload())
        self.goal = "D"

    def test_zero_heuristic_is_always_zero(self) -> None:
        self.assertEqual(zero_heuristic("A"), 0.0)
        self.assertEqual(zero_heuristic("D"), 0.0)

    def test_every_heuristic_is_zero_at_the_goal(self) -> None:
        for factory in (haversine_heuristic, euclidean_heuristic, manhattan_heuristic):
            estimate = factory(self.graph, self.goal, 1.0)
            self.assertAlmostEqual(estimate(self.goal), 0.0, places=6)

    def test_haversine_and_euclidean_agree_at_city_scale(self) -> None:
        # The planar approximation is within a fraction of a percent of the exact
        # great-circle distance over a few kilometres.
        haversine = haversine_heuristic(self.graph, self.goal, 1.0)
        euclidean = euclidean_heuristic(self.graph, self.goal, 1.0)
        self.assertAlmostEqual(haversine("A"), euclidean("A"), places=2)

    def test_manhattan_never_undercuts_euclidean(self) -> None:
        # L1 >= L2, which is exactly why Manhattan can overestimate and is not
        # admissible.
        euclidean = euclidean_heuristic(self.graph, self.goal, 1.0)
        manhattan = manhattan_heuristic(self.graph, self.goal, 1.0)
        self.assertGreaterEqual(manhattan("A"), euclidean("A"))

    def test_scale_multiplies_the_estimate(self) -> None:
        one = haversine_heuristic(self.graph, self.goal, 1.0)
        ten = haversine_heuristic(self.graph, self.goal, 10.0)
        self.assertAlmostEqual(ten("A"), 10.0 * one("A"), places=6)

    def test_the_registry_holds_exactly_the_named_heuristics(self) -> None:
        # `HeuristicName` and `HEURISTICS` have to agree for the lookup in
        # `build_problem` to be total; a name added to one only would either be
        # unselectable or a KeyError at plan time.
        self.assertEqual(set(HEURISTICS), set(get_args(HeuristicName)))
        self.assertIn(DEFAULT_HEURISTIC, HEURISTICS)


if __name__ == "__main__":
    unittest.main()
