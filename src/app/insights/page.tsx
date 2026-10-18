"use client";

import { useEffect, useRef, useState } from "react";
import { Cpu, MagicWand, Sparks, WifiOff } from "iconoir-react";
import { PageHeader } from "@/components/page-header";
import { useSession } from "@/components/session";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  EmptyState,
  SegmentedControl,
  Select,
  Skeleton,
} from "@/components/ui";
import {
  ApiError,
  getOverviewInsight,
  getProviders,
  getSavingTips,
  streamSavingTips,
} from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { kwh } from "@/lib/format";
import type { InsightDto, ProviderCatalogDto } from "@/lib/types";

type InsightMode = "tips" | "overview";
type Days = 3 | 7 | 30;

export default function InsightsPage() {
  const { user, status, error, refresh } = useSession();
  const userId = user?.userId;

  const providers = useAsync<ProviderCatalogDto>(() => getProviders(), []);
  const [mode, setMode] = useState<InsightMode>("tips");
  const [days, setDays] = useState<Days>(7);
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");

  const [result, setResult] = useState<InsightDto | null>(null);
  const [streamText, setStreamText] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  // Explicit user selection wins; otherwise fall back to the catalog defaults.
  const catalog = providers.data;
  const effectiveProvider = provider || catalog?.defaultProvider || "";
  const effectiveModel = model || catalog?.defaultModel || "";

  useEffect(() => () => cancelRef.current?.(), []);

  async function runGenerate(stream: boolean) {
    if (userId == null) return;
    cancelRef.current?.();
    setBusy(true);
    setRunError(null);
    setResult(null);
    setStreamText("");
    try {
      const opts = {
        provider: effectiveProvider || undefined,
        model: effectiveModel || undefined,
        days,
      };
      if (stream && mode === "tips") {
        setStreaming(true);
        await streamSavingTips(
          userId,
          (chunk) => setStreamText((prev) => prev + chunk),
          opts,
          (streamErr) => {
            setRunError(
              streamErr instanceof Error
                ? `Stream interrupted: ${streamErr.message}`
                : "The insight stream was interrupted before it finished.",
            );
          },
        );
        setStreaming(false);
      } else if (mode === "tips") {
        setResult(await getSavingTips(userId, opts));
      } else {
        setResult(await getOverviewInsight(userId, opts));
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setRunError("Rate limited by the insight service — wait a moment and retry.");
      } else if (err instanceof ApiError && err.status >= 500) {
        setRunError(`Upstream provider fault (${err.status}). Try another model or retry.`);
      } else {
        setRunError(err instanceof Error ? err.message : "Insight generation failed.");
      }
      setStreaming(false);
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return <InsightsSkeleton />;

  if (status !== "ready" || !user) {
    return (
      <>
        <PageHeader title="Insights" description="AI-assisted analysis of your telemetry" />
        <EmptyState
          icon={<WifiOff width={22} height={22} />}
          title={status === "missing" ? "Demo session not initialized" : "Demo backend unreachable"}
          description={error ?? "The request to the Next.js API layer failed. Retry in a moment."}
          actions={
            <Button variant="primary" onClick={() => void refresh()}>
              Retry
            </Button>
          }
        />
      </>
    );
  }

  const activeProvider =
    catalog?.providers.find((p) => p.id === effectiveProvider) ?? catalog?.providers[0];
  const hasOutput = Boolean(streamText || result);

  return (
    <>
      <PageHeader
        title="Insights"
        description="AI-generated analysis and recommendations for better energy efficiency."
        actions={
          <Badge tone="info">
            <Cpu width={11} height={11} /> {catalog?.defaultProvider ?? "provider"} · default
          </Badge>
        }
      />

      {/* Compact generation controls — the workspace below is the priority */}
      <Card className="mb-5 p-0">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-text-secondary">Output</span>
            <SegmentedControl
              value={mode}
              onChange={setMode}
              options={[
                { value: "tips", label: "Saving tips" },
                { value: "overview", label: "Overview" },
              ]}
            />
          </div>

          <div className="w-full lg:w-52">
            <Select
              label="Provider"
              value={effectiveProvider}
              onChange={(e) => {
                const next = e.target.value;
                setProvider(next);
                const entry = catalog?.providers.find((p) => p.id === next);
                setModel(entry?.models[0]?.id ?? "");
              }}
            >
              {(catalog?.providers ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
              {!catalog?.providers.length && <option value="">loading…</option>}
            </Select>
          </div>

          <div className="w-full lg:w-52">
            <Select label="Model" value={effectiveModel} onChange={(e) => setModel(e.target.value)}>
              {(activeProvider?.models ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
              {!activeProvider?.models.length && <option value="">default</option>}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-text-secondary">Window</span>
            <SegmentedControl
              value={String(days)}
              onChange={(v) => setDays(Number(v) as Days)}
              options={[
                { value: "3", label: "3 days" },
                { value: "7", label: "7 days" },
                { value: "30", label: "30 days" },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => void runGenerate(mode === "tips")}
              title={mode === "tips" ? "Stream tokens as they arrive" : undefined}
            >
              <Sparks width={13} height={13} />
              {busy ? (streaming ? "Streaming…" : "Generating…") : "Generate"}
            </Button>
            {mode === "tips" && (
              <Button size="sm" disabled={busy} onClick={() => void runGenerate(false)}>
                One-shot
              </Button>
            )}
          </div>
        </div>
        {mode === "tips" && (
          <p className="border-t border-border px-4 py-2.5 text-[11px] text-text-muted">
            Generate streams tokens over SSE; one-shot returns the full response at once.
          </p>
        )}
      </Card>

      {/* Results — full width, prioritised */}
      <div className="flex flex-col gap-5">
        {runError && (
          <AlertBanner
            title="Insight generation failed"
            description={runError}
            onDismiss={() => setRunError(null)}
            action={
              <Button size="sm" onClick={() => void runGenerate(mode === "tips")}>
                Retry
              </Button>
            }
          />
        )}

        {busy && !hasOutput ? (
          <Card>
            <Skeleton className="h-4 w-40" />
            <div className="mt-4 flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[92%]" />
              <Skeleton className="h-4 w-[78%]" />
              <Skeleton className="h-4 w-[85%]" />
            </div>
          </Card>
        ) : hasOutput ? (
          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-1 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-accent-soft text-accent-text">
                  <Sparks width={13} height={13} />
                </span>
                <h2 className="type-section text-text">
                  {mode === "tips" ? "Recommended actions" : "Consumption analysis"}
                </h2>
                {streaming && (
                  <Badge tone="accent" dot>
                    streaming
                  </Badge>
                )}
                {result?.periodAdjusted && (
                  <Badge tone="warning">window adjusted → {result.effectiveDays}d</Badge>
                )}
              </div>
              {result && (
                <span className="text-[11px] text-text-muted">
                  usage {kwh(result.energyUsage)} kWh ·{" "}
                  {(result.metrics?.model ?? effectiveModel) || "default model"}
                </span>
              )}
            </div>

            <div className="whitespace-pre-wrap px-5 py-4 text-[13.5px] leading-relaxed text-text-secondary">
              {mode === "tips" && streamText
                ? streamText
                : result?.tips || "No content returned."}
              {streaming && (
                <span className="ml-0.5 inline-block h-3.5 w-[7px] translate-y-[2px] animate-pulse bg-accent" />
              )}
            </div>

            {result?.metrics && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-5 py-3 font-mono text-[10.5px] text-text-muted">
                {result.metrics.provider && <span>provider={result.metrics.provider}</span>}
                {result.metrics.model && <span>model={result.metrics.model}</span>}
                {result.metrics.totalTokens != null && (
                  <span>tokens={result.metrics.totalTokens}</span>
                )}
                {result.metrics.latencyMs != null && (
                  <span>latency={result.metrics.latencyMs}ms</span>
                )}
              </div>
            )}
          </Card>
        ) : (
          <EmptyState
            icon={<MagicWand width={22} height={22} />}
            title="No insight generated yet"
            description="Pick a provider and window above, then generate. Recommendations stream token-by-token over SSE; the overview returns a single JSON response."
          />
        )}
      </div>
    </>
  );
}

function InsightsSkeleton() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <Skeleton className="mb-5 h-24 w-full" />
      <Skeleton className="h-72 w-full" />
    </>
  );
}
