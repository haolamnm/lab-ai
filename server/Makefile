# Route Lab backend — the same checks CI runs, one target each so a contributor
# can reproduce a red build locally instead of discovering it on a pull request.
# `make check` runs the whole gate; the individual targets exist for a tight
# edit-check loop on one tool at a time.

.PHONY: install dev lint format typecheck imports deps test check

install:
	uv sync

# Serves on http://127.0.0.1:8787. Point the frontend at it with
# VITE_API_URL=http://127.0.0.1:8787 bun run dev (in ../web).
#
# The port is 8787 rather than uvicorn's usual 8000 to stay clear of the range
# other local services tend to claim, and the URLs say 127.0.0.1 rather than
# localhost on purpose: if anything else is listening on ::1, a browser resolves
# localhost there first and the app's POST /plan lands on the wrong server as a
# puzzling 404 rather than a connection error.
dev:
	uv run uvicorn route_lab.api:app --reload --port 8787

lint:
	uv run ruff check

format:
	uv run ruff format

# Two independent type checkers, both strict. A blind spot in one is caught by
# the other; the price is that a tool-specific false positive gets a narrow
# inline ignore rather than a strictness downgrade.
typecheck:
	uv run ty check
	uv run basedpyright

imports:
	uv run lint-imports

deps:
	uv run deptry src

test:
	uv run pytest

# The full gate, in the same order CI runs it. `ruff format --check` fails on
# unformatted code rather than reformatting it, so CI stays read-only.
check:
	uv run ruff check
	uv run ruff format --check
	uv run ty check
	uv run basedpyright
	uv run lint-imports
	uv run deptry src
	uv run pytest
