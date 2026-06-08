import { createReadStream } from "node:fs";
import { opendir } from "node:fs/promises";
import readline from "node:readline";

export const TOKEN_METRICS = [
  "total_tokens",
  "input_tokens",
  "output_tokens",
  "cached_input_tokens",
  "reasoning_output_tokens",
];

const formatterCache = new Map();

function safeTokenCount(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function parseRecord(line) {
  try {
    return { malformed: false, value: JSON.parse(line) };
  } catch {
    return { malformed: true, value: null };
  }
}

function tokenEventFromRecord(record) {
  if (
    record?.type !== "event_msg" ||
    record.payload?.type !== "token_count" ||
    record.payload.info?.last_token_usage == null ||
    !Number.isFinite(Date.parse(record.timestamp))
  ) {
    return null;
  }

  const usage = Object.fromEntries(
    TOKEN_METRICS.map((metric) => [
      metric,
      safeTokenCount(record.payload.info.last_token_usage[metric]),
    ]),
  );

  return { timestamp: record.timestamp, usage };
}

export function extractTokenEvent(line) {
  const parsed = parseRecord(line);
  return parsed.malformed ? null : tokenEventFromRecord(parsed.value);
}

export function dayKeyForTimestamp(timestamp, timezone) {
  let formatter = formatterCache.get(timezone);
  if (formatter == null) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatterCache.set(timezone, formatter);
  }

  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function discoverJsonlFiles(directory) {
  const files = [];

  async function visit(currentDirectory) {
    let entries;
    try {
      entries = await opendir(currentDirectory);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }

    for await (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const entryPath = `${currentDirectory}/${entry.name}`;
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(entryPath);
      }
    }
  }

  await visit(directory);
  return files.sort();
}

function emptyCoverage() {
  return {
    filesDiscovered: 0,
    filesRead: 0,
    filesFailed: 0,
    linesRead: 0,
    tokenEvents: 0,
    malformedLines: 0,
  };
}

function emptyDay(date) {
  return {
    date,
    total_tokens: 0,
    input_tokens: 0,
    output_tokens: 0,
    cached_input_tokens: 0,
    reasoning_output_tokens: 0,
    events: 0,
    sessions: 0,
  };
}

export async function aggregateActivity({ sessionsDir, timezone }) {
  dayKeyForTimestamp("2000-01-01T00:00:00.000Z", timezone);

  const coverage = emptyCoverage();
  const files = await discoverJsonlFiles(sessionsDir);
  coverage.filesDiscovered = files.length;

  const days = new Map();
  const sessionsByDay = new Map();

  for (const filePath of files) {
    try {
      const input = createReadStream(filePath, {
        encoding: "utf8",
        flags: "r",
      });
      const lines = readline.createInterface({
        input,
        crlfDelay: Infinity,
      });

      for await (const line of lines) {
        if (line.length === 0) continue;
        coverage.linesRead += 1;

        const parsed = parseRecord(line);
        if (parsed.malformed) {
          coverage.malformedLines += 1;
          continue;
        }

        const event = tokenEventFromRecord(parsed.value);
        if (event == null) continue;

        coverage.tokenEvents += 1;
        const date = dayKeyForTimestamp(event.timestamp, timezone);
        const day = days.get(date) ?? emptyDay(date);
        for (const metric of TOKEN_METRICS) {
          day[metric] += event.usage[metric];
        }
        day.events += 1;
        days.set(date, day);

        const sessions = sessionsByDay.get(date) ?? new Set();
        sessions.add(filePath);
        sessionsByDay.set(date, sessions);
      }

      coverage.filesRead += 1;
    } catch {
      coverage.filesFailed += 1;
    }
  }

  for (const [date, sessions] of sessionsByDay) {
    days.get(date).sessions = sessions.size;
  }

  return {
    days: [...days.values()].sort((left, right) =>
      left.date.localeCompare(right.date),
    ),
    coverage,
  };
}
