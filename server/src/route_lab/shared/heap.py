"""A binary min-heap — a faithful port of the ``Heap`` class in search.ts.

Python's ``heapq`` would be the obvious choice, but it is deliberately not used
here. The frontend's binary heap breaks ties between equal-priority entries in a
specific order determined by its sift-up (``<=``) and sift-down (``<``)
comparisons, and that order decides which equal-cost node UCS expands first.
Reproducing the array logic exactly is what keeps this backend's expansion counts
and traces identical to the ones the browser produces, so a UCS pane shows the
same numbers whichever planner ran it.

Improved states leave stale entries behind; callers skip them with
``pop_fresh`` (see shared/search.py) rather than doing a decrease-key.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class HeapEntry:
    id: str
    priority: float
    cost: float


class Heap:
    def __init__(self) -> None:
        self._entries: list[HeapEntry] = []

    @property
    def size(self) -> int:
        return len(self._entries)

    def push(self, state: str, priority: float, cost: float) -> None:
        entries = self._entries
        entries.append(HeapEntry(state, priority, cost))
        index = len(entries) - 1
        while index > 0:
            parent = (index - 1) >> 1
            if entries[parent].priority <= entries[index].priority:
                break
            entries[parent], entries[index] = entries[index], entries[parent]
            index = parent

    def pop(self) -> HeapEntry:
        entries = self._entries
        first = entries[0]
        last = entries.pop()
        if not entries:
            return first

        entries[0] = last
        index = 0
        while True:
            left = index * 2 + 1
            right = left + 1
            smallest = index
            if left < len(entries) and entries[left].priority < entries[smallest].priority:
                smallest = left
            if right < len(entries) and entries[right].priority < entries[smallest].priority:
                smallest = right
            if smallest == index:
                break
            entries[smallest], entries[index] = entries[index], entries[smallest]
            index = smallest
        return first
