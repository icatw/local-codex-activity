# Local Codex Token Heatmap Design

## Goal

Build a local-only web tool that reads Codex session logs from
`~/.codex/sessions/**/*.jsonl` and displays token activity as a 52-week heatmap.
It must not call the Codex Profile API or modify Codex data.

## Data Source

Each session log may contain `event_msg` records whose payload type is
`token_count`. The parser uses only:

```text
payload.info.last_token_usage
```

`total_token_usage` is cumulative within a session and must not be summed.
Using `last_token_usage` makes each event an incremental usage record and avoids
double counting.

The supported metrics are:

- `total_tokens`
- `input_tokens`
- `output_tokens`
- `cached_input_tokens`
- `reasoning_output_tokens`

Malformed lines, missing fields, negative values, and unrelated records are
ignored. Files are opened read-only and parsed as streams.

## Architecture

`src/activity.js` discovers session files, parses token events, converts event
timestamps into day keys for the requested IANA timezone, and aggregates daily
metrics, event counts, and session counts.

`src/server.js` binds only to `127.0.0.1`, serves static assets, and exposes
`GET /api/activity?timezone=Asia/Shanghai`. The endpoint returns daily aggregates
and coverage metadata without returning prompts, responses, paths, or other
session contents.

`public/` contains a responsive client that renders a Sunday-first, 7-row,
52-week grid. Users can switch metrics and hover or focus cells for exact values.

## Privacy And Failure Handling

- No network request is made outside the loopback server.
- No Codex file is written, renamed, or deleted.
- Symlinks are not followed during recursive discovery.
- A missing sessions directory returns an empty dataset rather than crashing.
- Individual unreadable or malformed files are counted in diagnostics while
  valid files continue to load.
- The UI shows empty and error states without exposing raw log content.

## Verification

- Unit tests cover incremental token selection, malformed lines, timezone day
  boundaries, aggregation, and empty directories.
- API tests verify the response schema and static asset serving.
- A production run against the current user's real Codex session directory
  confirms that non-empty daily data is returned.
- Browser verification covers desktop and mobile layouts, metric switching,
  tooltip content, and console errors.
