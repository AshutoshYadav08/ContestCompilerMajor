"use client";

import { ArrowRightIcon, CalendarIcon, HomeIcon, SearchIcon, SparklesIcon, TrophyIcon } from "@/components/Icons";
import { LoadingState } from "@/components/LoadingState";
import { PageScaffold } from "@/components/PageScaffold";
import { useAuth } from "@/context/AuthContext";
import { fetchContests } from "@/lib/apiClient";
import { getContestPhase } from "@/lib/contestUtils";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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

  if (loading || !clerkLoaded) {
    return <LoadingState label="Bootstrapping auth context..." />;
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

  return (
    <PageScaffold title="Contest Playground" titleIcon={<HomeIcon />} description={description} bodyClassName="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-center gap-2 text-lg font-semibold text-emerald-300">
          <SearchIcon size={18} /> Join contest
        </div>
        <p className="mt-2 text-sm text-slate-400">Paste a contest id to open it instantly.</p>
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
        <p className="mt-2 text-sm text-slate-400">Only live and upcoming contests are shown here.</p>
        {(() => {
          const liveContests = contests.filter((contest) => getContestPhase(contest) === "running");
          const upcomingContests = contests.filter((contest) => getContestPhase(contest) === "upcoming");
          const renderContestList = (items: Contest[], emptyLabel: string) =>
            items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-500">{emptyLabel}</div>
            ) : (
              <ul className="grid gap-3 xl:grid-cols-2">
                {items.map((contest) => (
                  <li key={contest.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-100">{contest.name}</p>
                        <p className="mt-1 text-xs text-slate-500">ID: {contest.id}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300">
                        <CalendarIcon size={12} /> {new Date(contest.startTime).toLocaleDateString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            );

          if (liveContests.length === 0 && upcomingContests.length === 0) {
            return (
              <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-5 text-sm text-slate-400">
                <div className="flex items-center gap-2 text-slate-300">
                  <SparklesIcon size={16} className="text-emerald-300" />
                  No contests yet.
                </div>
                <p className="mt-2">Organisers can create the first contest from the organiser dashboard.</p>
              </div>
            );
          }

          return (
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
          );
        })()}
      </section>
    </PageScaffold>
  );
}
