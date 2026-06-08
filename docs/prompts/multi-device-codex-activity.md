# Prompt: Add Multi-Device Codex Activity Heatmap Sync

You are working in the `icatw/local-codex-activity` repository.

## Current Project

This project is a local-only Codex token activity heatmap for macOS. It reads
Codex session logs from `~/.codex/sessions/**/*.jsonl`, aggregates local token
activity, serves a browser heatmap on `127.0.0.1`, and can export a privacy-safe
SVG for the GitHub profile README.

The current implementation already includes:

- `src/activity.js`: read-only JSONL discovery, parsing, timezone day grouping,
  and daily aggregation using `payload.info.last_token_usage`.
- `src/server.js`: loopback HTTP server and sanitized `/api/activity` endpoint.
- `public/`: responsive 52-week heatmap UI with metric switching and tooltips.
- `src/profile-svg.js`: static GitHub README SVG export.
- `src/export-profile.js`: CLI for exporting the profile SVG.
- `scripts/update-profile-readme.sh`: local sync script that regenerates
  `assets/codex-activity.svg` and pushes it to the `icatw/icatw` profile repo.
- Tests for parsing, API behavior, client heatmap helpers, and SVG export.

Important privacy rules:

- Never upload raw Codex logs.
- Never expose prompts, responses, thread titles, project paths, or session file
  paths.
- Do not publish exact token totals to the public GitHub profile image.
- The public profile image should only show activity intensity, active day count,
  and update time.

## New Goal

Extend the project so Codex activity from multiple Macs can be merged into one
GitHub profile heatmap.

The desired setup is:

```text
Home Mac ~/.codex/sessions ─┐
                            ├─ privacy-safe snapshot JSON ─→ private snapshot repo
Work Mac ~/.codex/sessions ─┘
                                      ↓
                         merged SVG for icatw/icatw README
```

Each Mac should export only a privacy-safe daily snapshot. The merged profile
SVG should combine all device snapshots into a single heatmap.

## Required Features

1. Add a snapshot export CLI.

   Command shape:

   ```bash
   npm run export:snapshot -- --machine home --output snapshots/home.json --timezone Asia/Shanghai
   npm run export:snapshot -- --machine work --output snapshots/work.json --timezone Asia/Shanghai
   ```

   The snapshot file must contain only privacy-safe fields:

   ```json
   {
     "schemaVersion": 1,
     "machine": "home",
     "timezone": "Asia/Shanghai",
     "updatedAt": "2026-06-09T12:00:00.000Z",
     "days": [
       { "date": "2026-06-09", "level": 3, "active": true }
     ]
   }
   ```

   Do not include exact token totals, event counts, session counts, paths, or raw
   log-derived text.

2. Add a snapshot merge CLI.

   Command shape:

   ```bash
   npm run merge:snapshots -- --input snapshots --output assets/codex-activity.svg --timezone Asia/Shanghai
   ```

   Merge behavior:

   - Read all `*.json` files in the input directory.
   - Validate `schemaVersion`, `machine`, `updatedAt`, and day records.
   - For the same date across devices, merged activity is active if any device is
     active.
   - For the same date across devices, merged level is `max(level)`.
   - Generate the existing GitHub profile SVG format using merged levels instead
     of exact local token totals.
   - Show the number of active days and last merged update time.

3. Keep the current single-device workflow working.

   Existing commands must still work:

   ```bash
   npm start
   npm run export:profile
   npm test
   ```

4. Add sync scripts for two deployment modes.

   Mode A: local snapshot publisher for each Mac.

   ```bash
   scripts/update-device-snapshot.sh --machine home
   scripts/update-device-snapshot.sh --machine work
   ```

   It should:

   - Export the local snapshot.
   - Commit only that machine's snapshot file.
   - Push to a private snapshot repository.

   Mode B: profile SVG merger.

   ```bash
   scripts/update-merged-profile-readme.sh
   ```

   It should:

   - Pull the private snapshot repository.
   - Merge all snapshots into `assets/codex-activity.svg`.
   - Commit and push the updated SVG to the `icatw/icatw` profile repository
     only if content changed.

5. Update documentation.

   Document:

   - How to create or choose a private snapshot repository.
   - How to install the snapshot publisher on each Mac with `launchd`.
   - How to install the merger job.
   - Privacy guarantees and what the project intentionally does not upload.
   - Recovery steps when one device has not updated recently.

## Testing Requirements

Follow TDD. Add tests before implementation.

Tests should cover:

- Snapshot export excludes exact token totals and raw log fields.
- Snapshot export maps local daily totals to 0-4 intensity levels.
- Snapshot validation rejects malformed machine names, invalid dates, invalid
  levels, missing schema versions, and unexpected fields.
- Snapshot merge uses `max(level)` for the same date.
- Snapshot merge computes active days correctly across multiple devices.
- Snapshot merge ignores or fails clearly on invalid snapshot files, depending on
  the chosen design.
- Existing profile SVG export tests still pass.
- Existing API and browser heatmap tests still pass.

Run:

```bash
npm test
```

before committing.

## Suggested File Structure

Add or modify:

- `src/snapshot.js`: snapshot export, validation, and merge logic.
- `src/export-snapshot.js`: CLI wrapper for snapshot export.
- `src/merge-snapshots.js`: CLI wrapper for snapshot merge.
- `scripts/update-device-snapshot.sh`
- `scripts/update-merged-profile-readme.sh`
- `test/snapshot.test.js`
- `README.md`
- `package.json`

Keep implementation zero-dependency unless there is a strong reason to add a
package.

## Design Guidance

Prefer a private snapshot repo over exposing a local HTTP service. GitHub
Actions cannot read `~/.codex/sessions` on each Mac unless a self-hosted runner
is installed, so the normal flow should be local `launchd` jobs that push
privacy-safe snapshots.

The company Mac may need a stricter privacy mode. Support a mode that exports
only `active: true/false` with `level` coerced to `1` for active days.

Make the public profile SVG deterministic and stable. It should not include
machine names unless explicitly configured to do so.
