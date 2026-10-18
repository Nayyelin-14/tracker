"use client";

import { useId, useMemo, useState } from "react";
import {
  Cpu,
  EditPencil,
  MapPin,
  Plus,
  Refresh,
  Search,
  Trash,
  WifiOff,
} from "iconoir-react";
import { clsx } from "clsx";
import { PageHeader } from "@/components/page-header";
import { useSession } from "@/components/session";
import {
  AlertBanner,
  Badge,
  Button,
  Dialog,
  Drawer,
  EmptyState,
  Input,
  Select,
  Skeleton,
} from "@/components/ui";
import {
  createDevice,
  deleteDevice,
  getCoverage,
  getDevicesByUser,
  getUsage,
  updateDevice,
} from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { DEVICE_META, deviceMeta } from "@/lib/device-meta";
import { compactDateTime, kwh } from "@/lib/format";
import { DEVICE_TYPES, type DeviceDto, type DeviceType } from "@/lib/types";

type ModalMode = { kind: "create" } | { kind: "edit"; device: DeviceDto } | null;

export default function DevicesPage() {
  const { user, status, error, refresh } = useSession();
  const userId = user?.userId;
  const devices = useAsync<DeviceDto[]>(() => getDevicesByUser(userId!), [userId], {
    enabled: userId != null,
  });
  const usage = useAsync(() => getUsage(userId!, 7), [userId], { enabled: userId != null });
  const coverage = useAsync(() => getCoverage(userId!), [userId], { enabled: userId != null });

  const [modal, setModal] = useState<ModalMode>(null);
  const [detail, setDetail] = useState<DeviceDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeviceDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | DeviceType>("");
  const [locationFilter, setLocationFilter] = useState("");

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const d of devices.data ?? []) set.add(d.location);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [devices.data]);

  const usageById = useMemo(() => {
    const map = new Map<number, number>();
    for (const d of usage.data?.devices ?? []) {
      if (d.deviceId != null) map.set(d.deviceId, d.energyConsumed);
    }
    return map;
  }, [usage.data]);

  const noData = useMemo(
    () => new Set(coverage.data?.devicesWithNoData ?? []),
    [coverage.data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (devices.data ?? []).filter((d) => {
      if (typeFilter && d.type !== typeFilter) return false;
      if (locationFilter && d.location !== locationFilter) return false;
      if (q) {
        const hay = `${d.name} ${d.location} ${d.deviceId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [devices.data, query, typeFilter, locationFilter]);

  async function handleDelete(device: DeviceDto) {
    setBusy(true);
    setActionError(null);
    try {
      await deleteDevice(device.deviceId);
      setPendingDelete(null);
      setDetail(null);
      devices.reload();
      usage.reload();
      coverage.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete device.");
    } finally {
      setBusy(false);
    }
  }

  function statusOf(d: DeviceDto): { tone: "success" | "warning" | "neutral"; label: string } {
    if (coverage.loading) return { tone: "neutral", label: "—" };
    return noData.has(d.deviceId)
      ? { tone: "warning", label: "No data" }
      : { tone: "success", label: "Reporting" };
  }

  if (status === "loading") return <DevicesSkeleton />;

  if (status !== "ready" || !user) {
    return (
      <>
        <PageHeader title="Devices" description="Registered monitoring hardware" />
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

  const total = devices.data?.length ?? 0;
  const filtersActive = Boolean(query || typeFilter || locationFilter);

  return (
    <>
      <PageHeader
        title="Devices"
        description={`Manage your ${total} registered device${total === 1 ? "" : "s"} and their status.`}
        actions={
          <>
            <Button size="sm" onClick={devices.reload} disabled={devices.refreshing}>
              <Refresh
                width={13}
                height={13}
                className={devices.refreshing ? "animate-spin" : undefined}
              />
              {devices.refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setModal({ kind: "create" })}>
              <Plus width={14} height={14} /> Add device
            </Button>
          </>
        }
      />

      {actionError && (
        <div className="mb-4">
          <AlertBanner
            title="Action failed"
            description={actionError}
            onDismiss={() => setActionError(null)}
          />
        </div>
      )}
      {devices.error && (
        <div className="mb-4">
          <AlertBanner
            tone="warning"
            title="Device registry unreachable"
            description={`GET /device/user/${user.userId} failed (${devices.error.status}).`}
            action={
              <Button size="sm" onClick={devices.reload}>
                Retry
              </Button>
            }
          />
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            width={15}
            height={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, location, or ID…"
            aria-label="Search devices"
            className="field pl-9"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "" | DeviceType)}
            aria-label="Filter by type"
            className="field w-full sm:w-40"
          >
            <option value="">All types</option>
            {DEVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {DEVICE_META[t].label}
              </option>
            ))}
          </select>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            aria-label="Filter by location"
            className="field w-full sm:w-44"
          >
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      {devices.loading || devices.refreshing ? (
        <DevicesTableSkeleton />
      ) : total === 0 ? (
        <EmptyState
          icon={<Cpu width={22} height={22} />}
          title="No devices registered"
          description="Register your first monitoring node — speakers, cameras, thermostats, lights, locks, or doorbells."
          actions={
            <Button variant="primary" onClick={() => setModal({ kind: "create" })}>
              <Plus width={14} height={14} /> Register first device
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search width={22} height={22} />}
          title="No matching devices"
          description="No devices match the current filters. Clear them to see the full registry."
          actions={
            <Button
              size="sm"
              onClick={() => {
                setQuery("");
                setTypeFilter("");
                setLocationFilter("");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-surface-1">
                  {["Device", "Type", "Location", "Status", "7d usage", "Last update"].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={clsx(
                          "px-4 py-2.5 text-[12px] font-medium text-text-muted",
                          i === 4 && "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ),
                  )}
                  <th className="px-4 py-2.5" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const meta = deviceMeta(d.type);
                  const Icon = meta.icon;
                  const statusInfo = statusOf(d);
                  const consumed = usageById.get(d.deviceId);
                  return (
                    <tr
                      key={d.deviceId}
                      onClick={() => setDetail(d)}
                      className="group cursor-pointer border-b border-border last:border-b-0 hover:bg-surface-1"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={clsx(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius)] border",
                              meta.tint,
                            )}
                          >
                            <Icon width={14} height={14} />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-text">
                              {d.name}
                            </div>
                            <div className="font-mono text-[10.5px] text-text-muted">
                              DEV-{String(d.deviceId).padStart(3, "0")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-text-secondary">{meta.label}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text-secondary">
                          <MapPin width={12} height={12} className="text-text-muted" />
                          {d.location}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={statusInfo.tone} dot={statusInfo.tone === "success"}>
                          {statusInfo.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-[12.5px] font-semibold tabular text-text">
                        {consumed != null ? (
                          <>
                            {kwh(consumed)}{" "}
                            <span className="font-normal text-text-muted">kWh</span>
                          </>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11.5px] text-text-secondary">
                        {compactDateTime(d.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => setModal({ kind: "edit", device: d })}
                            aria-label={`Edit ${d.name}`}
                          >
                            <EditPencil width={13} height={13} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-critical-text hover:bg-critical-soft hover:text-critical-text"
                            onClick={() => setPendingDelete(d)}
                            aria-label={`Delete ${d.name}`}
                          >
                            <Trash width={13} height={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-text-muted">
            <span>
              Showing {filtered.length} of {total} device{total === 1 ? "" : "s"}
            </span>
            {filtersActive && <span>filters active</span>}
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <Drawer onClose={() => setDetail(null)} title={detail.name}>
          <div className="flex flex-col gap-4">
            <Field label="Device ID">
              <span className="font-mono text-accent-text">{detail.deviceId}</span>
            </Field>
            <Field label="Type">
              <Badge className={clsx(deviceMeta(detail.type).tint)}>
                {deviceMeta(detail.type).label}
              </Badge>
            </Field>
            <Field label="Location">{detail.location}</Field>
            <Field label="Owner user ID">
              <span className="font-mono">{detail.userId}</span>
            </Field>
            <Field label="Registered">
              <span className="font-mono">{compactDateTime(detail.createdAt)}</span>
            </Field>
            <Field label="Last updated">
              <span className="font-mono">{compactDateTime(detail.updatedAt)}</span>
            </Field>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setModal({ kind: "edit", device: detail });
                  setDetail(null);
                }}
              >
                <EditPencil width={12} height={12} /> Edit
              </Button>
              <Button size="sm" variant="danger" onClick={() => setPendingDelete(detail)}>
                <Trash width={12} height={12} /> Delete
              </Button>
            </div>
          </div>
        </Drawer>
      )}

      {/* Create / edit modal */}
      {modal && (
        <DeviceModal
          mode={modal}
          userId={user.userId}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            devices.reload();
            usage.reload();
            coverage.reload();
          }}
        />
      )}

      {/* Delete confirm */}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete device"
          description={`Remove “${pendingDelete.name}” from the registry? Historical usage stays in InfluxDB but the node stops reporting.`}
          busy={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleDelete(pendingDelete)}
        />
      )}
    </>
  );
}

/* ---------- sub-components ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] font-medium text-text-secondary">{label}</div>
      <div className="mt-1 text-[13px] text-text">{children}</div>
    </div>
  );
}

function DeviceModal({
  mode,
  userId,
  onClose,
  onSaved,
}: {
  mode: Exclude<ModalMode, null>;
  userId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = mode.kind === "edit" ? mode.device : null;
  const formId = useId();
  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<DeviceType>(editing?.type ?? "LIGHT");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !location.trim()) {
      setErr("Name and location are required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (editing) {
        await updateDevice(editing.deviceId, {
          name: name.trim(),
          type,
          location: location.trim(),
        });
      } else {
        await createDevice({ name: name.trim(), type, location: location.trim(), userId });
      }
      onSaved();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={editing ? "Edit device" : "Register new device"}
      onClose={onClose}
      footer={
        <>
          <Button type="button" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" size="sm" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Register device"}
          </Button>
        </>
      }
    >
      {err && (
        <div className="mb-3">
          <AlertBanner title="Could not save" description={err} onDismiss={() => setErr(null)} />
        </div>
      )}

      <form id={formId} onSubmit={submit} className="flex flex-col gap-3.5">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Kitchen smart plug"
        />
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value as DeviceType)}>
          {DEVICE_TYPES.map((t) => (
            <option key={t} value={t}>
              {DEVICE_META[t].label}
            </option>
          ))}
        </Select>
        <Input
          label="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Utility pantry"
        />
      </form>
    </Dialog>
  );
}

function ConfirmDialog({
  title,
  description,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      alert
      footer={
        <>
          <Button size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting…" : "Delete device"}
          </Button>
        </>
      }
    >
      <p className="text-[12.5px] leading-relaxed text-text-secondary">{description}</p>
    </Dialog>
  );
}

function DevicesSkeleton() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <DevicesTableSkeleton />
    </>
  );
}

function DevicesTableSkeleton() {
  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border bg-surface-1 px-4 py-3">
        <Skeleton className="h-3 w-full" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border-b border-border px-4 py-4 last:border-b-0">
          <Skeleton className="h-6 w-full" />
        </div>
      ))}
    </div>
  );
}
