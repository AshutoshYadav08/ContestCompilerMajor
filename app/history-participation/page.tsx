"use client";

import { ArrowRightIcon, CalendarIcon, TrophyIcon, UserIcon } from "@/components/Icons";
import { LoadingState } from "@/components/LoadingState";
import { PageScaffold } from "@/components/PageScaffold";
import { useAuth } from "@/context/AuthContext";
import { fetchContestDetail, fetchContests } from "@/lib/apiClient";
import { getContestHistoryCta, getContestPhase, getContestPhaseBadgeClasses, getContestPhaseLabel } from "@/lib/contestUtils";
import { Contest } from "@/types";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function HistoryParticipationPage() {
  const { user, activeRole } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Record<string, { rank: number; score: number; penalty: number }>>({});

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchContests()
      .then(async (allContests) => {
        const participated = allContests
          .filter((contest) => contest.participants.includes(user.id))
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        setContests(participated);

        const detailRows = await Promise.all(
          participated.map(async (contest) => {
            const detail = await fetchContestDetail(contest.id);
            const standing = detail.standings.find((entry) => entry.participantId === user.id);
            return [contest.id, standing ? { rank: standing.rank, score: standing.score, penalty: standing.penalty } : null] as const;
          })
        );

        setRows(
          Object.fromEntries(detailRows.filter((entry): entry is readonly [string, { rank: number; score: number; penalty: number }] => Boolean(entry[1])))
        );
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (!user || activeRole !== "participant") {
    return <div className="rounded border border-amber-600 bg-amber-950 p-4">Switch to participant dashboard to view participation history.</div>;
  }

  if (loading) return <LoadingState />;

  return (
    <PageScaffold
      title="Participation History"
      titleIcon={<TrophyIcon />}
      description="See the contests you joined and jump back in quickly."
      bodyClassName="grid gap-4 lg:grid-cols-2"
    >
      {contests.map((contest) => {
        const phase = getContestPhase(contest);
        const row = rows[contest.id];

        return (
          <div key={contest.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-medium text-slate-100">{contest.name}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2 py-1">
                    <CalendarIcon size={12} /> {new Date(contest.startTime).toLocaleString()}
                  </span>
                  {row ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2 py-1">
                        <TrophyIcon size={12} /> Rank #{row.rank}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2 py-1">
                        <UserIcon size={12} /> Score {row.score} · Penalty {row.penalty}
                      </span>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2 py-1">
                      Standing unavailable
                    </span>
                  )}
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getContestPhaseBadgeClasses(phase)}`}>
                {getContestPhaseLabel(phase)}
              </span>
            </div>

            <div className="mt-5 flex flex-col items-start gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-400">Contest id: <span className="font-mono text-slate-300">{contest.id}</span></p>
              <Link href={`/contest/${contest.id}`} className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600">
                {getContestHistoryCta("participant", phase)} <ArrowRightIcon size={15} />
              </Link>
            </div>
          </div>
        );
      })}
      {contests.length === 0 && <p>You have not joined any contests yet.</p>}
    </PageScaffold>
  );
}
