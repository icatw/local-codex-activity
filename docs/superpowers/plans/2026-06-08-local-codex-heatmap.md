# Local Codex Token Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-only web app that reads Codex JSONL session logs and renders a 52-week token activity heatmap.

**Architecture:** A zero-dependency Node.js service streams local session logs, aggregates incremental token events by local calendar date, and exposes sanitized daily totals to a static browser UI. The server binds to loopback and never modifies Codex files.

**Tech Stack:** Node.js 22+, `node:test`, built-in HTTP/filesystem modules, native HTML/CSS/JavaScript.

---

### Task 1: Token event parsing and aggregation

**Files:**
- Create: `package.json`
- Create: `src/activity.js`
- Create: `test/activity.test.js`

- [ ] Write tests proving that only `last_token_usage` is counted, malformed
      records are ignored, dates respect an IANA timezone, and daily totals
      include event and session counts.
- [ ] Run `npm test -- test/activity.test.js` and verify failure because
      `src/activity.js` does not exist.
- [ ] Implement streaming JSONL parsing, safe numeric normalization, timezone
      day-key conversion, and daily aggregation.
- [ ] Run `npm test -- test/activity.test.js` and verify all parser tests pass.

### Task 2: Read-only local API

**Files:**
- Create: `src/server.js`
- Create: `test/server.test.js`

- [ ] Write API tests for `/api/activity`, invalid timezones, missing session
      directories, and static index serving.
- [ ] Run `npm test -- test/server.test.js` and verify failure because the
      server module does not exist.
- [ ] Implement a loopback HTTP server with sanitized JSON responses and static
      file serving restricted to `public/`.
- [ ] Run the full `npm test` suite and verify all tests pass.

### Task 3: Heatmap interface

**Files:**
- Create: `public/index.html`
- Create: `public/styles.css`
- Create: `public/app.js`

- [ ] Add a DOM-level test for 52-week date construction and intensity levels.
- [ ] Run the test and verify it fails before the client helpers exist.
- [ ] Implement the responsive heatmap, metric selector, summary statistics,
      month labels, accessible cells, tooltip, loading state, and empty state.
- [ ] Run the full test suite and verify all tests pass.

### Task 4: Runtime verification and documentation

**Files:**
- Create: `README.md`

- [ ] Document requirements, commands, privacy properties, metric definitions,
      and known limitations.
- [ ] Run the server against `~/.codex/sessions` and verify `/api/activity`
      returns non-empty daily totals without log content.
- [ ] Open the app in the in-app browser and verify desktop and mobile layouts,
      metric switching, tooltip behavior, and zero console errors.
- [ ] Run `npm test` once more and record the successful result.
