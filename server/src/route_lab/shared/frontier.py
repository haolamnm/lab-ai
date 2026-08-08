"""The frontier kit — the one thing that actually distinguishes the algorithms.

Every graph search is the same loop: take a state off the frontier, expand it,
put its successors back. What changes between algorithms is *which* state comes
off next, and that is decided entirely by the frontier's discipline:

    BFS   -> Queue   first in, first out   (fewest hops)
    DFS   -> Stack   last in, first out    (deepest branch)
    UCS   -> Heap    lowest g              (cheapest so far)
    A*    -> Heap    lowest g + h          (cheapest + estimate)

So an algorithm here is: pick a frontier, decide the priority you push with, and
write the loop. The two frontiers defined below expose ``push`` / ``pop`` and a
truthy length, so ``while frontier:`` works the same for each.

The two cost-ordered searches take :class:`route_lab.shared.heap.Heap` directly
rather than a wrapper, because they need more from it than a bare state: an
improved state leaves a stale entry behind instead of a decrease-key, and
``pop_fresh`` in ``shared/search.py`` recognises one by comparing the entry's
recorded cost against the current best. A wrapper that returned only the state
would throw away the value that check reads.
"""

from __future__ import annotations

from collections import deque


class Stack:
    """LIFO frontier — pop returns the most recently pushed state (DFS)."""

    def __init__(self) -> None:
        self._items: list[str] = []

    def push(self, state: str) -> None:
        self._items.append(state)

    def pop(self) -> str:
        return self._items.pop()

    def __len__(self) -> int:
        return len(self._items)


class Queue:
    """FIFO frontier — pop returns the earliest pushed state (BFS)."""

    def __init__(self) -> None:
        self._items: deque[str] = deque()

    def push(self, state: str) -> None:
        self._items.append(state)

    def pop(self) -> str:
        return self._items.popleft()

    def __len__(self) -> int:
        return len(self._items)
