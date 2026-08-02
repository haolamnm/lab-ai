"""The binary heap's tie-break order — the reason it exists instead of heapq.

Equal-priority entries must pop in a fixed order (the one the frontend's array
heap produces), because that order decides which equal-cost node UCS expands
first, and therefore the expansion counts a pane shows.
"""

from route_lab.shared.heap import Heap


def test_lowest_priority_pops_first() -> None:
    heap = Heap()
    heap.push("a", 3.0, 3.0)
    heap.push("b", 1.0, 1.0)
    heap.push("c", 2.0, 2.0)
    assert [heap.pop().id for _ in range(3)] == ["b", "c", "a"]


def test_equal_priorities_pop_in_insertion_order() -> None:
    heap = Heap()
    heap.push("a", 1.0, 1.0)
    heap.push("b", 1.0, 1.0)
    heap.push("c", 0.0, 0.0)
    # c is strictly cheapest; the two priority-1 entries then pop first-in-first-out.
    assert [heap.pop().id for _ in range(3)] == ["c", "a", "b"]


def test_size_tracks_pushes_and_pops() -> None:
    heap = Heap()
    assert heap.size == 0
    heap.push("a", 1.0, 1.0)
    heap.push("b", 2.0, 2.0)
    assert heap.size == 2
    _ = heap.pop()
    assert heap.size == 1
