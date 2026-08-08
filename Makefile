# Route Lab — one entry point for both halves of the repo.
#
# `server/Makefile` still owns the backend's individual tools (lint, typecheck,
# imports, deps) for a tight edit-check loop on one of them. This file is the
# layer above: the commands you run on the whole project, so working on Route
# Lab does not start with remembering which directory each toolchain lives in.
#
# Recipes here are bash, not sh: `make dev` needs job control (`set -m`) to put
# each server in its own process group, which is the only way one Ctrl-C can
# reliably take down both. macOS ships GNU Make 3.81, which has no `.ONESHELL`,
# so any recipe needing shell state is one backslash-continued line.
SHELL := /bin/bash

.DEFAULT_GOAL := help
.PHONY: help install dev check test lint format build clean

help:
	@echo "Route Lab"
	@echo
	@echo "  make install   install backend (uv) and frontend (bun) dependencies"
	@echo "  make dev       run backend and frontend together; Ctrl-C stops both"
	@echo "  make check     the full gate, exactly what CI runs"
	@echo "  make test      test suites, both halves"
	@echo "  make lint      lint and typecheck both halves"
	@echo "  make format    format the backend"
	@echo "  make build     production build of the frontend"
	@echo "  make clean     remove build output and tool caches"
	@echo
	@echo "Backend-only tools live in server/Makefile (typecheck, imports, deps)."

install:
	cd server && uv sync
	cd web && bun install

# Both servers, one terminal, one Ctrl-C.
#
# `set -m` gives each background job its own process group, so `kill -TERM -$pid`
# takes down the whole tree rather than just the job leader. That matters because
# neither process is a single process: `uv run` spawns python, and uvicorn
# --reload spawns a reloader supervisor on top of the worker. Signalling only the
# job leader leaves a live server holding port 8787, and because it is the stale
# one, the next `make dev` fails to bind and the app quietly keeps talking to
# code you already edited — a far more confusing failure than a dead port.
#
# The frontend needs no VITE_API_URL prefix here: web/.env.local carries it, and
# web/.env.example is the copy-this template if that file is missing.
#
# The two URLs below are deliberately spelled differently. Vite binds ::1 only,
# so the frontend is reachable as localhost and not as 127.0.0.1; the backend
# binds 127.0.0.1 precisely so it is not found at ::1 by mistake. Printing
# 127.0.0.1:5173 for symmetry would send you to a port that refuses connections.
dev:
	@set -m; \
	trap 'echo; echo "stopping both..."; kill -TERM -$$api -$$web 2>/dev/null; wait 2>/dev/null; exit 0' INT TERM; \
	echo "backend   http://127.0.0.1:8787"; \
	echo "frontend  http://localhost:5173"; \
	echo; \
	( cd server && uv run uvicorn route_lab.api:app --reload --port 8787 ) & api=$$!; \
	( cd web && bun run dev ) & web=$$!; \
	wait

# The same gate CI runs, in the same order: the backend's seven steps, then the
# two frontend commands CONVENTIONS section 8 requires before every commit.
check:
	$(MAKE) -C server check
	cd web && bunx tsc --noEmit
	cd web && bun test
	cd web && bun run build

test:
	$(MAKE) -C server test
	cd web && bun test

lint:
	$(MAKE) -C server lint
	$(MAKE) -C server typecheck
	cd web && bunx tsc --noEmit

format:
	$(MAKE) -C server format

build:
	cd web && bun run build

# Build output and tool caches only. Dependencies are `make install`'s to own,
# so .venv and node_modules survive: deleting them turns a five-second clean
# into a two-minute reinstall, which is rarely what the word meant.
clean:
	rm -rf web/dist
	rm -rf server/.coverage server/.pytest_cache server/.ruff_cache
	find server -type d -name __pycache__ -prune -exec rm -rf {} +
