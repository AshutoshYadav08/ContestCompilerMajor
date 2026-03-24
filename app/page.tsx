"use client";

import { ArrowRightIcon, CalendarIcon, HomeIcon, SearchIcon, SparklesIcon, TrophyIcon } from "@/components/Icons";
import { LoadingState } from "@/components/LoadingState";
import { PageScaffold } from "@/components/PageScaffold";
import { useAuth } from "@/context/AuthContext";
import { fetchContests } from "@/lib/apiClient";
import { getContestPhase } from "@/lib/contestUtils";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Contest } from "@/types";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export default function HomePage() {
  const { user, loading, activeRole, syncError } = useAuth();
  const { isLoaded: clerkLoaded, isSignedIn } = useUser();
  const [contests, setContests] = useState<Contest[]>([]);
  const [joinId, setJoinId] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchContests();
        if (!cancelled) {
          setContests(data);
          setError("");
        }
      } catch {
        if (!cancelled) setError("Failed to fetch contests");
      }
    };

    load();
    const interval = setInterval(load, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const onJoin = (event: FormEvent) => {
    event.preventDefault();
    const contestId = joinId.trim();
    if (!contestId) return;
    setError("");
    router.push(`/contest/${contestId}`);
  };

  const liveContests = useMemo(() => contests.filter((contest) => getContestPhase(contest) === "running"), [contests]);
  const upcomingContests = useMemo(() => contests.filter((contest) => getContestPhase(contest) === "upcoming"), [contests]);

  if (loading || !clerkLoaded) {
    return <LoadingState label="Loading dashboard..." />;
  }

  const description = user ? (
    <>
      Signed in as: @{user.username ?? user.name} · {activeRole} dashboard. <Link href="/profile">Profile</Link>
      {syncError ? <span className="ml-2 text-amber-300">Your profile is still syncing.</span> : null}
    </>
  ) : isSignedIn ? (
    <>
      Signed in with Clerk. Your profile is still syncing. <Link href="/profile">Profile</Link>
    </>
  ) : (
    <>Logged in as: Guest. Sign in to create your profile.</>
  );


  const getContestAction = (contest: Contest) => {
    const phase = getContestPhase(contest);
    const isOrganiser = contest.organiserId === user?.id;
    const isRegistered = Boolean(user?.id && contest.participants.includes(user.id));

    if (isOrganiser) {
      return {
        href: `/contest/${contest.id}`,
        label: phase === "upcoming" ? "View dashboard" : phase === "running" ? "Open dashboard" : "View results",
      };
    }

    if (isRegistered) {
      return {
        href: `/contest/${contest.id}`,
        label: phase === "upcoming" ? "Join in" : phase === "running" ? "Join in" : "View results",
      };
    }

    return {
      href: `/contest/${contest.id}`,
      label: phase === "upcoming" ? "View contest" : "Open contest",
    };
  };

  const renderContestList = (items: Contest[], emptyLabel: string) =>
    items.length === 0 ? (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-500">{emptyLabel}</div>
    ) : (
      <ul className="grid gap-3 xl:grid-cols-2">
        {items.map((contest) => {
          const phase = getContestPhase(contest);
          const action = getContestAction(contest);
          const start = new Date(contest.startTime);
          const end = new Date(start.getTime() + contest.durationMinutes * 60 * 1000);
          const isOrganiser = contest.organiserId === user?.id;
          const isRegistered = Boolean(user?.id && contest.participants.includes(user.id));

          return (
            <li key={contest.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100">{contest.name}</p>
                    <p className="mt-1 text-xs text-slate-500">ID: {contest.id}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300">
                    <CalendarIcon size={12} /> {phase === "running" ? "Live" : "Upcoming"}
                  </span>
                </div>

                <div className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Starts</p>
                    <p className="mt-1 text-slate-200">{start.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Ends</p>
                    <p className="mt-1 text-slate-200">{end.toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isOrganiser ? (
                    <span className="rounded-full border border-blue-600/40 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-200">You are the organiser</span>
                  ) : isRegistered ? (
                    <span className="rounded-full border border-emerald-600/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200">You are registered</span>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-800 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-400">
                    {contest.participants.length} registered • {contest.durationMinutes} min
                  </p>
                  <Link href={action.href} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600">
                    {action.label}
                    <ArrowRightIcon size={15} />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );

  return (
    <PageScaffold title="Contest Playground" titleIcon={<HomeIcon />} description={description} bodyClassName="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-center gap-2 text-lg font-semibold text-emerald-300">
          <SearchIcon size={18} /> Join contest
        </div>
        <p className="mt-2 text-sm text-slate-400">Paste a contest id to open the right contest page instantly.</p>
        <form onSubmit={onJoin} className="mt-4 space-y-3">
          <div className="relative">
            <input
              value={joinId}
              onChange={(event) => setJoinId(event.target.value)}
              placeholder="Enter contest id"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 pl-10"
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          </div>
          <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 font-medium text-white hover:bg-blue-600">
            <ArrowRightIcon size={16} /> Join / Open
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-center gap-2 text-lg font-semibold text-emerald-300">
          <TrophyIcon size={18} /> Available contests
        </div>
        <p className="mt-2 text-sm text-slate-400">Live and upcoming contests appear here. Past contests are hidden.</p>
        {liveContests.length === 0 && upcomingContests.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-5 text-sm text-slate-400">
            <div className="flex items-center gap-2 text-slate-300">
              <SparklesIcon size={16} className="text-emerald-300" />
              No contests yet.
            </div>
            <p className="mt-2">Organisers can create the first contest from the organiser dashboard.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Live contests</h3>
              {renderContestList(liveContests, "No live contests right now.")}
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Upcoming contests</h3>
              {renderContestList(upcomingContests, "No upcoming contests yet.")}
            </div>
          </div>
        )}
      </section>
    </PageScaffold>
  );
}
