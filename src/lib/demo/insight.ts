import type { InsightDto, ProviderCatalogDto } from "@/lib/types";
import type { UsageStats } from "./store";

/** Catalog surfaced by `GET /insight/providers` — mirrors what the real
 *  insight-service exposes when keys are present in `backend/.env`. */
export const PROVIDER_CATALOG: ProviderCatalogDto = {
  defaultProvider: "groq",
  defaultModel: "llama-3.3-70b-versatile",
  maxDays: 30,
  defaultDays: 7,
  providers: [
    {
      id: "groq",
      displayName: "Groq",
      models: [
        { id: "llama-3.3-70b-versatile", displayName: "Llama 3.3 70B Versatile" },
        { id: "llama-3.1-8b-instant", displayName: "Llama 3.1 8B Instant" },
      ],
    },
    {
      id: "gemini",
      displayName: "Google Gemini",
      models: [
        { id: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash" },
        { id: "gemini-1.5-pro", displayName: "Gemini 1.5 Pro" },
      ],
    },
  ],
};

const num = (v: number, d = 1) =>
  v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const pct = (v: number) => `${Math.round(v * 100)}`;

const clock = (h: number) => `${String(((h % 24) + 24) % 24).padStart(2, "0")}:00`;

function typeAdvice(type: string | undefined): string {
  switch (type) {
    case "THERMOSTAT":
      return "A thermostat that idles at one setpoint all day is the single easiest win: a 1 degree setback while the house is empty is usually worth 3 to 5 percent on its own, and it costs nothing but a schedule.";
    case "LIGHT":
      return "Lighting responds well to a sweep: any lamp still on a filament or halogen bulb is drawing several times what an LED needs for the same output, and daylight hours are free.";
    case "CAMERA":
      return "Cameras record continuously whether or not anything happens. Dropping the frame rate, tightening the motion window, or recording to local storage instead of the cloud cuts both draw and subscription cost.";
    case "SPEAKER":
      return "Speakers look idle but keep a radio warm. Grouping them behind a smart plug and cutting power overnight removes a constant background draw you never see on a bill.";
    case "LOCK":
      return "Smart locks sip power but replace their batteries on a schedule regardless of usage. Slightly longer intervals between motor cycles add up over a year.";
    case "DOORBELL":
      return "Video doorbells stream constantly. Lowering resolution or disabling continuous recording to the cloud keeps the picture while trimming the always-on load.";
    default:
      return "Anything that reports a constant draw while nothing is happening is worth a smart plug and a schedule — the standby share of a household bill is rarely zero.";
  }
}

/**
 * Deterministic, data-grounded saving tips. The real service sends the same
 * numbers to a live model; here they are assembled from the visitor's own
 * window so the advice still changes when the data does.
 */
export function buildSavingTips(stats: UsageStats): string {
  const { total, avgPerDay, top, peakHour, effectiveDays, alertCount, threshold } = stats;

  if (total <= 0) {
    return "There is not enough telemetry in this window to say anything useful yet.\n\nDispatch a few readings from the Simulation page and generate again — the analysis needs at least a day of readings before the patterns are worth trusting.";
  }

  const peak = peakHour ?? 18;
  const peakEnd = (peak + 4) % 24;
  const lines: string[] = [];

  lines.push(
    `Your home used ${num(total)} kWh over the last ${effectiveDays} day${effectiveDays === 1 ? "" : "s"} — ` +
      `${num(avgPerDay)} kWh a day on average. ${
        top ? `${top.name} alone accounts for ${pct(top.share)}% of it. ` : ""
      }Your busiest window opens around ${clock(peak)}. Five changes, roughly in order of payback:`,
  );
  lines.push("");

  if (top) {
    lines.push(
      `1. Move ${top.name} out of the ${clock(peak)} to ${clock(peakEnd)} window\n` +
        `It drew ${num(top.energy)} kWh across the period, ${pct(top.share)}% of everything the house consumed. ` +
        `Shifting a load that size by two hours is usually worth 6 to 9 percent on a household bill and does not touch comfort — ` +
        `pre-heat, pre-cool, or schedule it to start just after the peak instead of during it.`,
    );
    lines.push("");
  }

  lines.push(
    `2. Attack the hours that are not ${clock(peak)}\n` +
      `Your floor sits near ${num(Math.max(0.5, avgPerDay / 24))} kWh an hour even when nothing obvious is running. ` +
      `That standby band is the quietest part of the bill and the easiest to cut: a smart plug on the entertainment stack, ` +
      `the work desk, and the laundry corner removes it without you noticing anything was off.`,
  );
  lines.push("");

  lines.push(
    `3. Fix the ${top ? top.name : "heaviest device"} first\n` +
      typeAdvice(top?.type),
  );
  lines.push("");

  lines.push(
    `4. Turn the ${num(threshold, 0)} kWh threshold into a tripwire, not wallpaper\n` +
      (alertCount > 0
        ? `This account has recorded ${alertCount} crossing${alertCount === 1 ? "" : "s"} already. ` +
          `Keep the limit where it is honest and act on the first notification: the alert fires once on the way up, ` +
          `so silence after that means the load stayed high, not that it went away.`
        : `Nothing has crossed it yet. Set it just above a normal peak rather than far above it — ` +
          `a limit nobody reaches is a limit nobody notices.`),
  );
  lines.push("");

  lines.push(
    `5. Track the daily average, not the worst day\n` +
      `${num(avgPerDay)} kWh a day is the number to move. ` +
      `One spike is an event; a trend that drifts down for a week is a decision. ` +
      `Re-run this over a 30 day window once you have the history and the seasonal shape will show up on its own.`,
  );

  if (stats.periodAdjusted) {
    lines.push("");
    lines.push(
      `Note: you asked for ${stats.requestedDays} days but only ${effectiveDays} day${effectiveDays === 1 ? " is" : "s are"} in the ledger, so the analysis was scoped to what actually exists.`,
    );
  }

  return lines.join("\n");
}

/** One-shot variant: a compact prose summary rather than an action list. */
export function buildOverview(stats: UsageStats): string {
  const { total, avgPerDay, top, peakHour, effectiveDays, deviceCount, alertCount, threshold } = stats;

  if (total <= 0) {
    return "No readings in this window. Dispatch synthetic telemetry from the Simulation page to populate the ledger, then generate again.";
  }

  const peak = peakHour ?? 18;

  const parts = [
    `Across ${effectiveDays} day${effectiveDays === 1 ? "" : "s"} the home drew ${num(total)} kWh, an average of ${num(avgPerDay)} kWh per day, spread over ${deviceCount} monitored device${deviceCount === 1 ? "" : "s"}.`,
    top
      ? `${top.name} is the dominant load at ${num(top.energy)} kWh (${pct(top.share)}% of the total), and consumption peaks in the ${clock(peak)} hour. Together those two facts explain most of the shape of the chart: a low overnight floor, a modest morning rise, and a heavy evening block.`
      : "No single device dominates the profile yet.",
    alertCount > 0
      ? `The ${num(threshold, 0)} kWh threshold has been crossed ${alertCount} time${alertCount === 1 ? "" : "s"} in this window. Each crossing was notified once on the way up and then held quiet while the load stayed elevated.`
      : `The ${num(threshold, 0)} kWh threshold has not been crossed in this window.`,
    `On current behaviour the household lands near ${num(avgPerDay * 30)} kWh over a full month. The highest-leverage change is moving the top device out of the ${clock(peak)} peak; everything else is fine tuning.`,
  ];

  return parts.join("\n\n");
}

export function insightDto(
  userId: number,
  type: "SAVING_TIPS" | "OVERVIEW",
  tips: string,
  stats: UsageStats,
  provider: string,
  model: string,
  latencyMs: number,
): InsightDto {
  const tokens = Math.max(1, Math.round(tips.length / 4));
  return {
    userId,
    type,
    tips,
    energyUsage: stats.total,
    requestedDays: stats.requestedDays,
    effectiveDays: stats.effectiveDays,
    periodAdjusted: stats.periodAdjusted,
    metrics: {
      provider,
      model,
      promptTokens: Math.round(tokens * 0.35),
      completionTokens: tokens,
      totalTokens: tokens,
      latencyMs,
    },
  };
}
