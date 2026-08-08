"""The registry tables cover every algorithm key, with nothing extra.

``POINT_SEARCHES`` and ``ALGO_OPTIMAL`` are both looked up by a key taken
straight off the wire, so a missing entry is a ``KeyError`` inside a request —
an HTTP 500, not the graceful ``found=False`` an unimplemented algorithm gets.

The type system does not catch this. A ``dict[SomeLiteral, V]`` is satisfied by
a dict holding *any* subset of that Literal's members, so deleting an entry is
accepted by both ty and basedpyright in strict mode. Only a ``TypedDict`` would
type-check totality, and spelling out four keys twice to buy that is worse than
the three assertions below. Python also has no Literal subtraction, so
``PointSearchKey`` cannot be derived from ``AlgoKey`` the way the frontend
derives it with ``Exclude<AlgoKey, 'nearest' | 'held_karp'>`` — the two are
kept in step here instead.

So this is the check that makes adding an algorithm fail by name: register it
in both tables, or one of these three tells you which one you forgot.
"""

from typing import get_args

from route_lab.algorithms.registry import ALGO_OPTIMAL, POINT_SEARCHES, PointSearchKey
from route_lab.contract.request import AlgoKey

ALGO_KEYS = frozenset(get_args(AlgoKey))
POINT_SEARCH_KEYS = frozenset(get_args(PointSearchKey))


def test_point_search_keys_are_algo_keys() -> None:
    # A point search the wire cannot ask for is unreachable code; the planner
    # only ever indexes POINT_SEARCHES with a key that parsed as an AlgoKey.
    assert POINT_SEARCH_KEYS <= ALGO_KEYS


def test_every_point_search_key_has_an_algorithm() -> None:
    assert frozenset(POINT_SEARCHES) == POINT_SEARCH_KEYS


def test_every_algo_key_has_an_optimality_verdict() -> None:
    # Trip-level strategies are absent from POINT_SEARCHES on purpose, but every
    # key without exception reaches ALGO_OPTIMAL[request.algo] in the planner.
    assert frozenset(ALGO_OPTIMAL) == ALGO_KEYS
