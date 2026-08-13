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
    haversine_heuristic,
)

from .fixtures import diamond_payload


class HeuristicKitTest(unittest.TestCase):
    def setUp(self) -> None:
        self.graph = build_graph(diamond_payload())
        self.goal = "D"

    def test_haversine_is_zero_at_the_goal(self) -> None:
        estimate = haversine_heuristic(self.graph, self.goal, 1.0)
        self.assertAlmostEqual(estimate(self.goal), 0.0, places=6)

    def test_haversine_is_non_negative(self) -> None:
        estimate = haversine_heuristic(self.graph, self.goal, 1.0)
        for node_id in self.graph.nodes:
            self.assertGreaterEqual(estimate(node_id), 0.0)

    def test_scale_multiplies_the_estimate(self) -> None:
        one = haversine_heuristic(self.graph, self.goal, 1.0)
        ten = haversine_heuristic(self.graph, self.goal, 10.0)
        self.assertAlmostEqual(ten("A"), 10.0 * one("A"), places=6)

    def test_the_registry_holds_exactly_the_named_heuristics(self) -> None:
        # `HeuristicName` and `HEURISTICS` have to agree for the lookup in
        # `build_problem` to be total; a name added to one only would either be
        # unselectable or a KeyError at plan time.
        self.assertEqual(set(HEURISTICS), set(get_args(HeuristicName)))
        self.assertEqual(set(HEURISTICS), {"haversine"})
        self.assertEqual(DEFAULT_HEURISTIC, "haversine")


if __name__ == "__main__":
    unittest.main()
