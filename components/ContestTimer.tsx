"use client";

import { useEffect, useMemo, useState } from "react";

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [
    days > 0 ? `${days}d` : null,
    `${hours.toString().padStart(2, "0")}h`,
    `${minutes.toString().padStart(2, "0")}m`,
    `${seconds.toString().padStart(2, "0")}s`
  ].filter(Boolean);

  return parts.join(" ");
}

export function ContestTimer({
  startTime,
  durationMinutes,
  compact = false,
  mini = false
}: {
  startTime: string;
  durationMinutes: number;
  compact?: boolean;
  mini?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timer = useMemo(() => {
    const start = new Date(startTime).getTime();
    const end = start + durationMinutes * 60 * 1000;

    if (now < start) {
      return {
        phase: "upcoming" as const,
        label: "Starts in",
        shortLabel: "Starts",
        value: formatDuration(start - now),
        exact: `Start: ${new Date(start).toLocaleString()}`,
        progress: 0
      };
    }

    if (now <= end) {
      const elapsed = now - start;
      const total = Math.max(1, end - start);
      return {
        phase: "running" as const,
        label: "Time left",
        shortLabel: "Left",
        value: formatDuration(end - now),
        exact: `Ends: ${new Date(end).toLocaleString()}`,
        progress: Math.min(100, Math.max(0, (elapsed / total) * 100))
      };
    }

    return {
      phase: "ended" as const,
      label: "Contest ended",
      shortLabel: "Ended",
      value: `Ended ${new Date(end).toLocaleString()}`,
      exact: `Duration: ${durationMinutes} min`,
      progress: 100
    };
  }, [durationMinutes, now, startTime]);

  const barClassName =
    timer.phase === "upcoming"
      ? "bg-blue-500"
      : timer.phase === "running"
        ? "bg-emerald-500"
        : "bg-slate-500";

  if (mini) {
    return (
      <div className="inline-flex h-8 items-center gap-2 rounded-full border border-slate-700 bg-slate-800/90 px-3 text-[11px] leading-none text-slate-200">
        <span className={`h-2 w-2 shrink-0 rounded-full ${timer.phase === "running" ? "bg-emerald-400" : timer.phase === "upcoming" ? "bg-blue-400" : "bg-slate-400"}`} />
        <span className="uppercase tracking-wide text-slate-400">{timer.shortLabel}</span>
        <span className="font-semibold text-white">{timer.phase === "ended" ? "Completed" : timer.value}</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded border border-slate-700 bg-slate-900/80 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{timer.label}</p>
            <p className="text-lg font-semibold text-white">{timer.value}</p>
          </div>
          <div className="text-right text-xs text-slate-400">{timer.exact}</div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
          <div className={`h-full rounded-full transition-all ${barClassName}`} style={{ width: `${timer.progress}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-700 bg-slate-800 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Contest Timer</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-300">{timer.label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{timer.value}</p>
        </div>
        <div className="text-sm text-slate-300">
          <p>{timer.exact}</p>
          <p className="mt-1">Start: {new Date(startTime).toLocaleString()}</p>
          <p>Duration: {durationMinutes} minutes</p>
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-900">
        <div className={`h-full rounded-full transition-all ${barClassName}`} style={{ width: `${timer.progress}%` }} />
      </div>
    </div>
  );
}
