import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHeatmapDates,
  initialHeatmapScrollLeft,
  intensityLevel,
  summarizeMetric,
} from "../public/app.js";

test("buildHeatmapDates creates 52 Sunday-first weeks ending in the current week", () => {
  const dates = buildHeatmapDates("2026-06-08");

  assert.equal(dates.length, 364);
  assert.equal(dates[0], "2025-06-15");
  assert.equal(dates.at(-1), "2026-06-13");
  assert.equal(new Date(`${dates[0]}T00:00:00Z`).getUTCDay(), 0);
});

test("intensityLevel maps positive values into four relative levels", () => {
  assert.equal(intensityLevel(0, 100), 0);
  assert.equal(intensityLevel(1, 100), 1);
  assert.equal(intensityLevel(25, 100), 1);
  assert.equal(intensityLevel(26, 100), 2);
  assert.equal(intensityLevel(51, 100), 3);
  assert.equal(intensityLevel(76, 100), 4);
  assert.equal(intensityLevel(100, 100), 4);
});

test("initialHeatmapScrollLeft aligns an overflowing heatmap to the current week", () => {
  assert.equal(initialHeatmapScrollLeft(716, 366), 350);
  assert.equal(initialHeatmapScrollLeft(700, 900), 0);
});

test("summarizeMetric reports total, peak, active days, and current streak", () => {
  const summary = summarizeMetric(
    [
      { date: "2026-06-05", total_tokens: 10 },
      { date: "2026-06-06", total_tokens: 20 },
      { date: "2026-06-08", total_tokens: 30 },
    ],
    "total_tokens",
    "2026-06-08",
  );

  assert.deepEqual(summary, {
    total: 60,
    peak: 30,
    activeDays: 3,
    currentStreak: 1,
  });
});
