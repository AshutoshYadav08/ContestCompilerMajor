"use client";

import { ArrowRightIcon, CalendarIcon, FolderIcon, TrophyIcon, UsersIcon } from "@/components/Icons";
import { LoadingState } from "@/components/LoadingState";
import { PageScaffold } from "@/components/PageScaffold";
import { useAuth } from "@/context/AuthContext";
import { fetchContests } from "@/lib/apiClient";
import { getContestHistoryCta, getContestPhase, getContestPhaseBadgeClasses, getContestPhaseLabel } from "@/lib/contestUtils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Contest } from "@/types";

export default function HistoryContestsPage() {
  const { user, activeRole } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContests()
      .then(setContests)
      .finally(() => setLoading(false));
  }, []);

  const organiserContests = useMemo(
    () => contests
      .filter((contest) => contest.organiserId === user?.id)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [contests, user?.id]
  );

  if (!user || activeRole !== "organiser") {
    return <div className="rounded border border-amber-600 bg-amber-950 p-4">Switch to organiser dashboard to view organiser contest history.</div>;
  }

  if (loading) return <LoadingState />;

  return (
    <PageScaffold
      title="Organiser Contest History"
      titleIcon={<FolderIcon />}
      description="See your contests, check their status, and jump back in quickly."
      bodyClassName="grid gap-4 lg:grid-cols-2"
    >
      {organiserContests.map((contest) => {
        const phase = getContestPhase(contest);

        return (
          <div key={contest.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-medium text-slate-100">{contest.name}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2 py-1">
                    <CalendarIcon size={12} /> {new Date(contest.startTime).toLocaleString()}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2 py-1">
                    <UsersIcon size={12} /> {contest.participants.length} participants
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2 py-1">
                    <TrophyIcon size={12} /> {contest.problemIds.length} problems
                  </span>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getContestPhaseBadgeClasses(phase)}`}>
                {getContestPhaseLabel(phase)}
              </span>
            </div>

            <div className="mt-5 flex flex-col items-start gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">Contest id: <span className="font-mono text-slate-300">{contest.id}</span></p>
              <Link href={`/contest/${contest.id}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600">
                {getContestHistoryCta("organiser", phase)} <ArrowRightIcon size={15} />
              </Link>
            </div>
          </div>
        );
      })}
      {organiserContests.length === 0 && <p>You have not created any contests yet.</p>}
    </PageScaffold>
  );
}
