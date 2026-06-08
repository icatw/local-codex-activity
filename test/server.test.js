import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createAppServer } from "../src/server.js";

function tokenRecord(timestamp, totalTokens) {
  return JSON.stringify({
    timestamp,
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        last_token_usage: {
          input_tokens: totalTokens - 5,
          cached_input_tokens: 2,
          output_tokens: 5,
          reasoning_output_tokens: 1,
          total_tokens: totalTokens,
        },
      },
    },
  });
}

async function startFixtureServer() {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-server-"));
  const sessionsDir = path.join(root, "sessions");
  const publicDir = path.join(root, "public");
  await mkdir(sessionsDir);
  await mkdir(publicDir);
  await writeFile(
    path.join(sessionsDir, "sample.jsonl"),
    `${tokenRecord("2026-06-08T12:00:00.000Z", 42)}\n`,
  );
  await writeFile(
    path.join(publicDir, "index.html"),
    "<!doctype html><title>Local Codex Activity</title>",
  );

  const server = createAppServer({ sessionsDir, publicDir });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("GET /api/activity returns sanitized local activity", async () => {
  const fixture = await startFixtureServer();
  try {
    const response = await fetch(
      `${fixture.baseUrl}/api/activity?timezone=UTC`,
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.timezone, "UTC");
    assert.deepEqual(body.days, [
      {
        date: "2026-06-08",
        total_tokens: 42,
        input_tokens: 37,
        output_tokens: 5,
        cached_input_tokens: 2,
        reasoning_output_tokens: 1,
        events: 1,
        sessions: 1,
      },
    ]);
    assert.equal(body.coverage.filesRead, 1);
    assert.equal(JSON.stringify(body).includes("sample.jsonl"), false);
  } finally {
    await fixture.close();
  }
});

test("GET /api/activity rejects an invalid timezone", async () => {
  const fixture = await startFixtureServer();
  try {
    const response = await fetch(
      `${fixture.baseUrl}/api/activity?timezone=not-a-timezone`,
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Invalid timezone");
  } finally {
    await fixture.close();
  }
});

test("GET / serves the local interface", async () => {
  const fixture = await startFixtureServer();
  try {
    const response = await fetch(`${fixture.baseUrl}/`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(body, /Local Codex Activity/);
  } finally {
    await fixture.close();
  }
});

test("static paths cannot escape the public directory", async () => {
  const fixture = await startFixtureServer();
  try {
    const response = await fetch(`${fixture.baseUrl}/..%2Fpackage.json`);
    assert.equal(response.status, 404);
  } finally {
    await fixture.close();
  }
});
