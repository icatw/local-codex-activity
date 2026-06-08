import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  aggregateActivity,
  dayKeyForTimestamp,
  extractTokenEvent,
} from "../src/activity.js";

function tokenRecord(timestamp, usage, cumulative = {}) {
  return JSON.stringify({
    timestamp,
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: cumulative,
        last_token_usage: usage,
      },
    },
  });
}

test("extractTokenEvent reads incremental usage and ignores cumulative totals", () => {
  const event = extractTokenEvent(
    tokenRecord(
      "2026-06-08T15:00:00.000Z",
      {
        input_tokens: 100,
        cached_input_tokens: 30,
        output_tokens: 20,
        reasoning_output_tokens: 4,
        total_tokens: 120,
      },
      { total_tokens: 999_999 },
    ),
  );

  assert.deepEqual(event, {
    timestamp: "2026-06-08T15:00:00.000Z",
    usage: {
      input_tokens: 100,
      cached_input_tokens: 30,
      output_tokens: 20,
      reasoning_output_tokens: 4,
      total_tokens: 120,
    },
  });
});

test("extractTokenEvent rejects malformed and unrelated records", () => {
  assert.equal(extractTokenEvent("not json"), null);
  assert.equal(
    extractTokenEvent(
      JSON.stringify({
        timestamp: "2026-06-08T15:00:00.000Z",
        type: "event_msg",
        payload: { type: "agent_message" },
      }),
    ),
    null,
  );
  assert.equal(
    extractTokenEvent(
      tokenRecord("invalid timestamp", { total_tokens: -10 }),
    ),
    null,
  );
});

test("dayKeyForTimestamp respects the requested timezone", () => {
  const timestamp = "2026-06-08T16:30:00.000Z";

  assert.equal(dayKeyForTimestamp(timestamp, "UTC"), "2026-06-08");
  assert.equal(
    dayKeyForTimestamp(timestamp, "Asia/Shanghai"),
    "2026-06-09",
  );
});

test("aggregateActivity combines events by day and counts unique sessions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-heatmap-"));
  const nested = path.join(root, "2026", "06", "08");
  await mkdir(nested, { recursive: true });

  await writeFile(
    path.join(nested, "one.jsonl"),
    [
      tokenRecord("2026-06-08T14:00:00.000Z", {
        input_tokens: 100,
        cached_input_tokens: 25,
        output_tokens: 20,
        reasoning_output_tokens: 2,
        total_tokens: 120,
      }),
      "broken json",
      tokenRecord("2026-06-08T15:00:00.000Z", {
        input_tokens: 50,
        cached_input_tokens: 10,
        output_tokens: 10,
        reasoning_output_tokens: 0,
        total_tokens: 60,
      }),
    ].join("\n"),
  );
  await writeFile(
    path.join(nested, "two.jsonl"),
    `${tokenRecord("2026-06-08T15:30:00.000Z", {
      input_tokens: 30,
      cached_input_tokens: 0,
      output_tokens: 5,
      reasoning_output_tokens: 1,
      total_tokens: 35,
    })}\n`,
  );

  const result = await aggregateActivity({
    sessionsDir: root,
    timezone: "Asia/Shanghai",
  });

  assert.deepEqual(result.days, [
    {
      date: "2026-06-08",
      total_tokens: 215,
      input_tokens: 180,
      output_tokens: 35,
      cached_input_tokens: 35,
      reasoning_output_tokens: 3,
      events: 3,
      sessions: 2,
    },
  ]);
  assert.deepEqual(result.coverage, {
    filesDiscovered: 2,
    filesRead: 2,
    filesFailed: 0,
    linesRead: 4,
    tokenEvents: 3,
    malformedLines: 1,
  });
});

test("aggregateActivity returns an empty dataset for a missing directory", async () => {
  const result = await aggregateActivity({
    sessionsDir: path.join(os.tmpdir(), "missing-codex-sessions"),
    timezone: "UTC",
  });

  assert.deepEqual(result.days, []);
  assert.equal(result.coverage.filesDiscovered, 0);
});
