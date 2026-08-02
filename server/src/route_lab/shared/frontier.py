"""The frontier kit — the one thing that actually distinguishes the algorithms.

Every graph search is the same loop: take a state off the frontier, expand it,
put its successors back. What changes between algorithms is *which* state comes
off next, and that is decided entirely by the frontier's discipline:

    BFS   -> Queue           first in, first out       (fewest hops)
    DFS   -> Stack           last in, first out        (deepest branch)
    UCS   -> PriorityQueue   lowest g                   (cheapest so far)
    A*    -> PriorityQueue   lowest g + h               (cheapest + estimate)
    Greedy-> PriorityQueue   lowest h                   (closest estimate)

So an algorithm here is: pick a frontier, decide the priority you push with, and
write the loop. All three expose ``push`` / ``pop`` and a truthy length, so
``while frontier:`` works the same for each.

The priority queue leaves stale entries behind when a state's cost improves,
rather than doing a decrease-key; the caller skips them with a
``if state in memory.closed`` check after popping (see ``algorithms/ucs.py``).
"""

from __future__ import annotations

from collections import deque

from route_lab.shared.heap import Heap


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


class PriorityQueue:
    """Min-first frontier — pop returns the lowest-priority state (UCS/A*/Greedy).

    Push the same state again with a lower priority to "improve" it; the older,
    worse entry stays in the heap and is skipped when popped because the state is
    already closed by then.
    """

    def __init__(self) -> None:
        self._heap = Heap()

    def push(self, state: str, priority: float) -> None:
        # `cost` on the heap entry is unused here — the algorithm tracks the real
        # cost in its SearchMemory — so priority is passed for both.
        self._heap.push(state, priority, priority)

    def pop(self) -> str:
        return self._heap.pop().id

    def __len__(self) -> int:
        return self._heap.size
