import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { exportProfileSvg, renderProfileSvg } from "../src/profile-svg.js";

const DAYS = [
  {
    date: "2026-06-07",
    total_tokens: 100,
    input_tokens: 90,
    output_tokens: 10,
    cached_input_tokens: 40,
    reasoning_output_tokens: 2,
    events: 1,
    sessions: 1,
  },
  {
    date: "2026-06-08",
    total_tokens: 400,
    input_tokens: 360,
    output_tokens: 40,
    cached_input_tokens: 200,
    reasoning_output_tokens: 8,
    events: 2,
    sessions: 1,
  },
];

test("renderProfileSvg creates a 52-week static heatmap without exact token totals", () => {
  const svg = renderProfileSvg({
    days: DAYS,
    today: "2026-06-08",
    updatedAt: "2026-06-08T16:00:00.000Z",
    timezone: "Asia/Shanghai",
  });

  assert.match(svg, /^<svg/);
  assert.match(svg, /Local Codex Activity/);
  assert.match(svg, /2 active days/);
  assert.match(svg, /Updated 2026-06-09 00:00/);
  assert.equal((svg.match(/class="day heatmap-day level-/g) ?? []).length, 364);
  assert.doesNotMatch(svg, />400</);
  assert.doesNotMatch(svg, /total_tokens/);
  assert.doesNotMatch(svg, /session/i);
});

test("renderProfileSvg escapes labels and rejects invalid dates", () => {
  assert.throws(
    () =>
      renderProfileSvg({
        days: [],
        today: "invalid",
        updatedAt: "2026-06-08T16:00:00.000Z",
        timezone: "UTC",
      }),
    /Invalid date/,
  );
});

test("exportProfileSvg writes a generated SVG to the requested path", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-profile-svg-"));
  const outputPath = path.join(directory, "assets", "codex-activity.svg");

  const result = await exportProfileSvg({
    outputPath,
    sessionsDir: path.join(directory, "missing-sessions"),
    timezone: "UTC",
    now: new Date("2026-06-08T16:00:00.000Z"),
  });
  const svg = await readFile(outputPath, "utf8");

  assert.equal(result.outputPath, outputPath);
  assert.equal(result.activeDays, 0);
  assert.match(svg, /0 active days/);
});
