const METRIC_LABELS = {
  total_tokens: "总 token",
  input_tokens: "输入 token",
  output_tokens: "输出 token",
  cached_input_tokens: "缓存输入 token",
  reasoning_output_tokens: "推理输出 token",
};

function addUtcDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function sundayForDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return addUtcDays(dateKey, -date.getUTCDay());
}

export function buildHeatmapDates(todayKey) {
  const currentWeekStart = sundayForDate(todayKey);
  const firstDate = addUtcDays(currentWeekStart, -51 * 7);
  return Array.from({ length: 52 * 7 }, (_, index) =>
    addUtcDays(firstDate, index),
  );
}

export function intensityLevel(value, maximum) {
  if (value <= 0 || maximum <= 0) return 0;
  const ratio = value / maximum;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

export function initialHeatmapScrollLeft(scrollWidth, clientWidth) {
  return Math.max(0, scrollWidth - clientWidth);
}

export function summarizeMetric(days, metric, todayKey) {
  const values = days.map((day) => Math.max(0, day[metric] ?? 0));
  const byDate = new Map(days.map((day) => [day.date, day[metric] ?? 0]));
  let currentStreak = 0;
  let cursor = todayKey;
  while ((byDate.get(cursor) ?? 0) > 0) {
    currentStreak += 1;
    cursor = addUtcDays(cursor, -1);
  }

  return {
    total: values.reduce((sum, value) => sum + value, 0),
    peak: values.reduce((maximum, value) => Math.max(maximum, value), 0),
    activeDays: values.filter((value) => value > 0).length,
    currentStreak,
  };
}

function browserDayKey(timezone, date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatFullNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDate(dateKey) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

function createMonthLabels(dates) {
  const labels = document.querySelector("#month-labels");
  labels.replaceChildren();

  for (let week = 0; week < 52; week += 1) {
    const dateKey = dates[week * 7];
    const previousKey = week === 0 ? null : dates[(week - 1) * 7];
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    const previous = previousKey
      ? new Date(`${previousKey}T00:00:00.000Z`)
      : null;
    const cell = document.createElement("span");
    cell.style.gridColumn = String(week + 1);
    if (
      week === 0 ||
      previous == null ||
      previous.getUTCMonth() !== date.getUTCMonth()
    ) {
      cell.textContent = new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        timeZone: "UTC",
      }).format(date);
    }
    labels.append(cell);
  }
}

function positionTooltip(tooltip, target) {
  const bounds = target.getBoundingClientRect();
  const tooltipBounds = tooltip.getBoundingClientRect();
  const left = Math.min(
    window.innerWidth - tooltipBounds.width - 8,
    Math.max(8, bounds.left + bounds.width / 2 - tooltipBounds.width / 2),
  );
  const above = bounds.top - tooltipBounds.height - 8;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${above > 8 ? above : bounds.bottom + 8}px`;
}

function renderHeatmap(state) {
  const heatmap = document.querySelector("#heatmap");
  const tooltip = document.querySelector("#tooltip");
  const dates = buildHeatmapDates(state.today);
  const dayMap = new Map(state.data.days.map((day) => [day.date, day]));
  const visibleValues = dates
    .filter((date) => date <= state.today)
    .map((date) => dayMap.get(date)?.[state.metric] ?? 0);
  const maximum = Math.max(0, ...visibleValues);

  createMonthLabels(dates);
  heatmap.replaceChildren();
  heatmap.setAttribute("aria-busy", "false");

  for (const date of dates) {
    const day = dayMap.get(date);
    const value = day?.[state.metric] ?? 0;
    const future = date > state.today;
    const level = future ? 0 : intensityLevel(value, maximum);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "heatmap-cell";
    cell.dataset.level = String(level);
    cell.dataset.future = String(future);
    cell.disabled = future;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute(
      "aria-label",
      `${formatDate(date)}，${METRIC_LABELS[state.metric]} ${formatFullNumber(value)}`,
    );

    const showTooltip = () => {
      tooltip.innerHTML = "";
      const title = document.createElement("strong");
      title.textContent = formatDate(date);
      const usage = document.createElement("span");
      usage.textContent = `${METRIC_LABELS[state.metric]}：${formatFullNumber(value)}`;
      const detail = document.createElement("span");
      detail.textContent = ` · ${day?.events ?? 0} 次响应 · ${day?.sessions ?? 0} 个会话`;
      tooltip.append(title, usage, detail);
      tooltip.hidden = false;
      positionTooltip(tooltip, cell);
    };
    const hideTooltip = () => {
      tooltip.hidden = true;
    };
    cell.addEventListener("mouseenter", showTooltip);
    cell.addEventListener("mouseleave", hideTooltip);
    cell.addEventListener("focus", showTooltip);
    cell.addEventListener("blur", hideTooltip);
    heatmap.append(cell);
  }

  if (!state.didAlignHeatmap) {
    const scroll = document.querySelector("#heatmap-scroll");
    scroll.scrollLeft = initialHeatmapScrollLeft(
      scroll.scrollWidth,
      scroll.clientWidth,
    );
    state.didAlignHeatmap = true;
  }
}

function renderSummary(state) {
  const dates = new Set(buildHeatmapDates(state.today));
  const visibleDays = state.data.days.filter(
    (day) => dates.has(day.date) && day.date <= state.today,
  );
  const summary = summarizeMetric(visibleDays, state.metric, state.today);
  document.querySelector("#stat-total").textContent = formatNumber(summary.total);
  document.querySelector("#stat-peak").textContent = formatNumber(summary.peak);
  document.querySelector("#stat-days").textContent = `${summary.activeDays} 天`;
  document.querySelector("#stat-streak").textContent =
    `${summary.currentStreak} 天`;
}

function renderCoverage(state) {
  const coverage = state.data.coverage;
  document.querySelector("#coverage-files").textContent =
    `${coverage.filesRead} / ${coverage.filesDiscovered}`;
  document.querySelector("#coverage-events").textContent = formatFullNumber(
    coverage.tokenEvents,
  );
  document.querySelector("#coverage-malformed").textContent = formatFullNumber(
    coverage.malformedLines,
  );
  document.querySelector("#coverage-timezone").textContent = state.data.timezone;
}

async function bootstrap() {
  const state = {
    metric: "total_tokens",
    data: null,
    today: null,
    didAlignHeatmap: false,
  };
  const status = document.querySelector("#status-text");
  const heatmap = document.querySelector("#heatmap");
  const emptyState = document.querySelector("#empty-state");
  const refreshButton = document.querySelector("#refresh-button");
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const load = async () => {
    refreshButton.disabled = true;
    status.classList.remove("error");
    status.textContent = "正在读取本地 Codex 会话日志…";
    heatmap.setAttribute("aria-busy", "true");

    try {
      const response = await fetch(
        `/api/activity?timezone=${encodeURIComponent(timezone)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.data = await response.json();
      state.today = browserDayKey(state.data.timezone);
      emptyState.hidden = state.data.days.length > 0;
      document.querySelector("#heatmap-scroll").hidden =
        state.data.days.length === 0;
      status.textContent =
        `更新于 ${new Intl.DateTimeFormat("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date(state.data.generatedAt))}`;
      renderSummary(state);
      renderHeatmap(state);
      renderCoverage(state);
    } catch {
      status.textContent = "无法读取本地 Codex 活动";
      status.classList.add("error");
      heatmap.setAttribute("aria-busy", "false");
      emptyState.hidden = false;
      emptyState.textContent =
        "读取失败。请确认本地服务仍在运行，并且可以读取 ~/.codex/sessions。";
    } finally {
      refreshButton.disabled = false;
    }
  };

  document.querySelector("#metric-switcher").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-metric]");
    if (button == null || state.data == null) return;
    state.metric = button.dataset.metric;
    for (const candidate of document.querySelectorAll(
      "#metric-switcher button",
    )) {
      candidate.setAttribute(
        "aria-pressed",
        String(candidate === button),
      );
    }
    renderSummary(state);
    renderHeatmap(state);
  });
  refreshButton.addEventListener("click", load);
  await load();
}

if (typeof document !== "undefined") {
  bootstrap();
}
