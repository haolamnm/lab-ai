<!--
Title: same rules as a commit summary — imperative, English, under 72 chars,
no trailing full stop. See CONVENTIONS.md §9.
-->

## What changed

<!-- One or two sentences. The diff shows the detail; say what it amounts to. -->

## Why

<!--
The important part. What was the previous behaviour, what was wrong with it,
and what did you consider and reject? If this fixes a bug, describe the input
or user action that triggered it.
-->

## How it was verified

- [ ] `bunx tsc --noEmit` passes
- [ ] `bun test` passes
- [ ] `bun run build` passes
- [ ] `server/`: `make check` passes — or n/a, if this PR does not touch `server/`
- [ ] Exercised in the running app — describe what you actually clicked:

<!--
`web/`'s tests cover the store and the planner, not rendering, so the last line
is still the evidence for anything that draws. "Loaded the sample graph, added
three panes, ran, paused at step 40" is useful. "Works" is not.
-->

## Left undone

<!-- Anything deliberately out of scope, and why. Write "nothing" if nothing. -->
