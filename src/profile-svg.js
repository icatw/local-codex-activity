import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { aggregateActivity, dayKeyForTimestamp } from "./activity.js";

const WEEKS = 52;
const DAYS_PER_WEEK = 7;
const CELL_SIZE = 10;
const CELL_GAP = 3;
const GRID_X = 112;
const GRID_Y = 66;

function assertDateKey(dateKey) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) ||
    !Number.isFinite(Date.parse(`${dateKey}T00:00:00.000Z`))
  ) {
    throw new Error(`Invalid date: ${dateKey}`);
  }
}

function addDays(dateKey, days) {
  assertDateKey(dateKey);
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(dateKey) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return addDays(dateKey, -date.getUTCDay());
}

function heatmapDates(today) {
  const firstDate = addDays(startOfWeek(today), -(WEEKS - 1) * 7);
  return Array.from({ length: WEEKS * DAYS_PER_WEEK }, (_, index) =>
    addDays(firstDate, index),
  );
}

function levelFor(value, maximum) {
  if (value <= 0 || maximum <= 0) return 0;
  const ratio = value / maximum;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

function formatUpdatedAt(timestamp, timezone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function monthLabels(dates) {
  const labels = [];
  let previousMonth = null;
  for (let week = 0; week < WEEKS; week += 1) {
    const date = new Date(`${dates[week * DAYS_PER_WEEK]}T00:00:00.000Z`);
    const month = date.getUTCMonth();
    if (week === 0 || month !== previousMonth) {
      labels.push({
        label: new Intl.DateTimeFormat("en-US", {
          month: "short",
          timeZone: "UTC",
        }).format(date),
        x: GRID_X + week * (CELL_SIZE + CELL_GAP),
      });
    }
    previousMonth = month;
  }
  return labels;
}

export function renderProfileSvg({
  days,
  today,
  updatedAt,
  timezone,
}) {
  assertDateKey(today);
  const dates = heatmapDates(today);
  const visibleDateSet = new Set(dates.filter((date) => date <= today));
  const dayMap = new Map(days.map((day) => [day.date, day]));
  const values = dates.map((date) =>
    date <= today ? Math.max(0, dayMap.get(date)?.total_tokens ?? 0) : 0,
  );
  const maximum = values.reduce((max, value) => Math.max(max, value), 0);
  const activeDays = days.filter(
    (day) => visibleDateSet.has(day.date) && day.total_tokens > 0,
  ).length;

  const cells = dates
    .map((date, index) => {
      const column = Math.floor(index / DAYS_PER_WEEK);
      const row = index % DAYS_PER_WEEK;
      const level = date > today ? 0 : levelFor(values[index], maximum);
      const x = GRID_X + column * (CELL_SIZE + CELL_GAP);
      const y = GRID_Y + row * (CELL_SIZE + CELL_GAP);
      return `<rect class="day heatmap-day level-${level}" x="${x}" y="${y}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2"/>`;
    })
    .join("");

  const months = monthLabels(dates)
    .map(
      ({ label, x }) =>
        `<text class="month" x="${x}" y="54">${label}</text>`,
    )
    .join("");

  const updatedLabel = formatUpdatedAt(updatedAt, timezone);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="832" height="184" viewBox="0 0 832 184" role="img" aria-labelledby="title description">
<title id="title">Local Codex Activity</title>
<desc id="description">${activeDays} active days in the last 52 weeks. Updated ${updatedLabel} ${timezone}.</desc>
<style>
  .background { fill: #ffffff; stroke: #d0d7de; }
  .title { fill: #1f2328; font: 600 16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  .meta,.month,.weekday { fill: #636c76; font: 11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  .day { shape-rendering: geometricPrecision; }
  .level-0 { fill: #eff2f5; }
  .level-1 { fill: #aceebb; }
  .level-2 { fill: #4ac26b; }
  .level-3 { fill: #2da44e; }
  .level-4 { fill: #116329; }
  @media (prefers-color-scheme: dark) {
    .background { fill: #0d1117; stroke: #30363d; }
    .title { fill: #f0f6fc; }
    .meta,.month,.weekday { fill: #9198a1; }
    .level-0 { fill: #21262d; }
    .level-1 { fill: #0e4429; }
    .level-2 { fill: #006d32; }
    .level-3 { fill: #26a641; }
    .level-4 { fill: #39d353; }
  }
</style>
<rect class="background" x="0.5" y="0.5" width="831" height="183" rx="8"/>
<text class="title" x="18" y="27">Local Codex Activity</text>
<text class="meta" x="18" y="46">${activeDays} active days</text>
<text class="meta" x="814" y="27" text-anchor="end">Updated ${updatedLabel}</text>
${months}
<text class="weekday" x="94" y="87" text-anchor="end">Mon</text>
<text class="weekday" x="94" y="113" text-anchor="end">Wed</text>
<text class="weekday" x="94" y="139" text-anchor="end">Fri</text>
${cells}
<text class="meta" x="618" y="169">Less</text>
<rect class="day level-0" x="648" y="160" width="10" height="10" rx="2"/>
<rect class="day level-1" x="661" y="160" width="10" height="10" rx="2"/>
<rect class="day level-2" x="674" y="160" width="10" height="10" rx="2"/>
<rect class="day level-3" x="687" y="160" width="10" height="10" rx="2"/>
<rect class="day level-4" x="700" y="160" width="10" height="10" rx="2"/>
<text class="meta" x="716" y="169">More</text>
</svg>
`;
}

export async function exportProfileSvg({
  outputPath,
  sessionsDir,
  timezone,
  now = new Date(),
}) {
  const activity = await aggregateActivity({ sessionsDir, timezone });
  const today = dayKeyForTimestamp(now.toISOString(), timezone);
  const svg = renderProfileSvg({
    days: activity.days,
    today,
    updatedAt: now.toISOString(),
    timezone,
  });
  const resolvedOutput = path.resolve(outputPath);
  const temporaryPath = `${resolvedOutput}.tmp`;
  await mkdir(path.dirname(resolvedOutput), { recursive: true });
  await writeFile(temporaryPath, svg, "utf8");
  await rename(temporaryPath, resolvedOutput);
  return {
    outputPath: resolvedOutput,
    activeDays: activity.days.filter(
      (day) => day.date <= today && day.total_tokens > 0,
    ).length,
    coverage: activity.coverage,
  };
}
