"use client";

import { CalendarIcon, CheckCircleIcon, CopyIcon, FolderIcon, LayoutIcon, TrophyIcon, UsersIcon } from "@/components/Icons";
import { ContestTimer } from "@/components/ContestTimer";
import { InfoCard } from "@/components/InfoCard";
import { LoadingState } from "@/components/LoadingState";
import { PageScaffold } from "@/components/PageScaffold";
import { useAuth } from "@/context/AuthContext";
import { ContestResponse, fetchContestDetail, reviewJoinRequest, sendJoinRequest } from "@/lib/apiClient";
import { getUserDisplayName, getUserSecondaryLabel } from "@/lib/userDisplay";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";

type OrganiserTab = "standings" | "lobby" | "events" | "stats";

function StatusBadge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "amber" | "rose" | "emerald" | "blue" }) {
  const toneClass = {
    slate: "border-slate-600 bg-slate-700/60 text-slate-200",
    amber: "border-amber-600/40 bg-amber-500/15 text-amber-200",
    rose: "border-rose-600/40 bg-rose-500/15 text-rose-200",
    emerald: "border-emerald-600/40 bg-emerald-500/15 text-emerald-200",
    blue: "border-blue-600/40 bg-blue-500/15 text-blue-200"
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>{children}</span>;
}

export default function ContestViewPage() {
  const { id } = useParams<{ id: string }>();
  const { user, activeRole } = useAuth();
  const [detail, setDetail] = useState<ContestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<OrganiserTab>("standings");
  const [eventsSeenAt, setEventsSeenAt] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<ContestResponse["events"][number] | null>(null);
  const eventsSeenKey = `contest:${id}:events-seen:${user?.id ?? "anon"}`;

  const load = useCallback(async () => {
    try {
      const response = await fetchContestDetail(id);
      setDetail(response);
      setError("");
    } catch {
      setError("Contest not found");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [load]);

  const participantRequest = useMemo(
    () => detail?.joinRequests.find((request) => request.participantId === user?.id),
    [detail, user?.id]
  );

  const isOrganiser = user?.id === detail?.contest.organiserId;
  const isParticipantAllowed = detail?.contest.participants.includes(user?.id ?? "") ?? false;
  const canOpenProblems = Boolean(isOrganiser || isParticipantAllowed || participantRequest?.status === "approved");
  const visibleStandings = isOrganiser ? detail?.standings ?? [] : detail?.publicStandings ?? [];
  const pendingLobbyCount = detail?.joinRequests.filter((request) => request.status === "pending").length ?? 0;
  const canRequestJoin = Boolean(user) && !isOrganiser && !isParticipantAllowed && detail?.phase !== "ended";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(eventsSeenKey);
    if (saved) setEventsSeenAt(saved);
  }, [eventsSeenKey]);

  useEffect(() => {
    if (!isOrganiser || !detail || typeof window === "undefined") return;
    const latestEventTime = detail.events.slice().sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0]?.submittedAt;
    if (!eventsSeenAt && latestEventTime) {
      setEventsSeenAt(latestEventTime);
      window.localStorage.setItem(eventsSeenKey, latestEventTime);
    }
  }, [detail, eventsSeenAt, eventsSeenKey, isOrganiser]);

  useEffect(() => {
    if (!isOrganiser || !detail || activeTab !== "events" || typeof window === "undefined") return;
    const latestEventTime = detail.events.slice().sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0]?.submittedAt;
    if (latestEventTime) {
      setEventsSeenAt(latestEventTime);
      window.localStorage.setItem(eventsSeenKey, latestEventTime);
    }
  }, [activeTab, detail, eventsSeenKey, isOrganiser]);

  const newEventsCount = useMemo(() => {
    if (!detail || !eventsSeenAt) return 0;
    return detail.events.filter((event) => new Date(event.submittedAt).getTime() > new Date(eventsSeenAt).getTime()).length;
  }, [detail, eventsSeenAt]);

  const copyInviteLink = async () => {
    if (typeof window === "undefined" || !detail) return;
    const inviteUrl = `${window.location.origin}/contest/${detail.contest.id}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      window.alert("Contest link copied to clipboard");
    } catch {
      window.prompt("Copy contest link:", inviteUrl);
    }
  };



  const submissionCodeModal = selectedSubmission ? (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-lg font-semibold text-slate-100">Submitted code</p>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
              <span>{selectedSubmission.participantName ?? selectedSubmission.participantId}</span>
              <span>•</span>
              <span>{selectedSubmission.problemId}</span>
              <span>•</span>
              <span>{selectedSubmission.language}</span>
              <span>•</span>
              <span>{new Date(selectedSubmission.submittedAt).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(selectedSubmission.sourceCode ?? "");
                } catch {}
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
            >
              <CopyIcon size={14} />
              Copy code
            </button>
            <button
              type="button"
              onClick={() => setSelectedSubmission(null)}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white"
            >
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-5">
          <pre className="min-h-full overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-black/40 p-4 text-sm leading-6 text-emerald-100">{selectedSubmission.sourceCode || "// Submitted code unavailable"}</pre>
        </div>
      </div>
    </div>
  ) : null;


  if (loading) return <LoadingState label="Loading contest details..." />;
  if (error || !detail) return <div className="text-rose-400">{error || "No data"}</div>;

  const title = `${detail.contest.name} · ${isOrganiser ? "Organiser Dashboard" : "Participant View"}`;
  const description = (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-xs text-slate-300">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1"><LayoutIcon size={12} /> {detail.contest.id}</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1"><CalendarIcon size={12} /> {detail.phase}</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1"><UsersIcon size={12} /> {detail.contest.participants.length} participants</span>
      </div>
      <p className="text-xs text-slate-400">
        {isOrganiser ? "Review registrations, standings, and recent submissions from one place." : "Check contest details, open problems, and follow your progress here."}
      </p>
      {!isOrganiser && detail.leaderboard.isFrozen && (
        <p className="text-xs text-amber-300">Standings are frozen until the contest ends.</p>
      )}
    </div>
  );

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {detail.phase !== "ended" ? (
        <button
          type="button"
          onClick={copyInviteLink}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:border-slate-500"
        >
          <CopyIcon size={15} /> Invite to contest
        </button>
      ) : null}
      <ContestTimer startTime={detail.contest.startTime} durationMinutes={detail.contest.durationMinutes} />
    </div>
  );

  if (isOrganiser) {
    const tabs: Array<{ key: OrganiserTab; label: string; badge?: number; icon: ReactNode }> = [
      { key: "standings", label: "Standings", icon: <TrophyIcon size={16} /> },
      { key: "lobby", label: "Lobby", badge: pendingLobbyCount, icon: <UsersIcon size={16} /> },
      { key: "events", label: "Events", badge: newEventsCount, icon: <CalendarIcon size={16} /> },
      { key: "stats", label: "Stats", icon: <FolderIcon size={16} /> }
    ];

    return (
      <>
        {submissionCodeModal}
        <PageScaffold title={title} titleIcon={<TrophyIcon />} description={description} actions={headerActions} bodyClassName="space-y-4">
        <div className="sticky top-0 z-10 -mx-3 sm:-mx-4 border-b border-slate-800 bg-slate-950/95 px-3 sm:px-4 pb-4 pt-0 backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  activeTab === tab.key ? "bg-emerald-700 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge ? <StatusBadge tone={tab.key === "events" ? "blue" : "amber"}>{tab.badge}</StatusBadge> : null}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "standings" && (
          <InfoCard title="Standings (live)">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="pb-2">Rank</th>
                    <th className="pb-2">Participant</th>
                    <th className="pb-2">Solved</th>
                    <th className="pb-2">Score</th>
                    <th className="pb-2">Penalty</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.standings.map((row) => (
                    <tr key={row.participantId} className="border-t border-slate-700">
                      <td className="py-2">#{row.rank}</td>
                      <td className="py-2 font-medium text-slate-100">{row.participantName}</td>
                      <td className="py-2">{row.solved}</td>
                      <td className="py-2">{row.score}</td>
                      <td className="py-2">{row.penalty}</td>
                    </tr>
                  ))}
                  {detail.standings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">No standings yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </InfoCard>
        )}

        {activeTab === "lobby" && (
          <InfoCard title="Lobby (join requests)">
            <ul className="space-y-2 text-sm">
              {detail.joinRequests.map((request) => {
                const primary = getUserDisplayName(request.participant);
                const secondary = getUserSecondaryLabel(request.participant);
                return (
                  <li key={request.id} className="rounded-xl bg-slate-900 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-100">{primary}</span>
                          {secondary ? <span className="block truncate text-xs text-slate-400">{secondary}</span> : null}
                        </span>
                        <StatusBadge tone={request.status === "pending" ? "amber" : request.status === "approved" ? "emerald" : "rose"}>{request.status}</StatusBadge>
                      </span>
                      {request.status === "pending" && (
                        <span className="flex gap-2">
                          <button className="rounded-xl bg-emerald-700 px-3 py-1.5" onClick={async () => { await reviewJoinRequest(request.id, "approved"); await load(); }}>Approve</button>
                          <button className="rounded-xl bg-rose-700 px-3 py-1.5" onClick={async () => { await reviewJoinRequest(request.id, "rejected"); await load(); }}>Reject</button>
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
              {detail.joinRequests.length === 0 && <li className="text-slate-400">No join requests yet.</li>}
            </ul>
          </InfoCard>
        )}

        {activeTab === "events" && (
          <InfoCard title="Events (submissions feed)">
            <ul className="space-y-2 text-sm">
              {detail.events.slice().reverse().map((event) => {
                const isNew = eventsSeenAt ? new Date(event.submittedAt).getTime() > new Date(eventsSeenAt).getTime() : false;
                return (
                  <li key={event.id} className="rounded-xl bg-slate-900 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>[{new Date(event.submittedAt).toLocaleTimeString()}] {event.participantName ?? event.participantId} → {event.problemId}</span>
                        <StatusBadge tone={event.pipelineStatus === "judged" ? (event.verdict === "Accepted" ? "emerald" : "rose") : "amber"}>
                          {event.pipelineStatus === "judged" ? event.verdict ?? event.status : event.status}
                        </StatusBadge>
                        {isNew ? <StatusBadge tone="blue">new</StatusBadge> : null}
                      </div>
                      <button type="button" onClick={() => setSelectedSubmission(event)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-slate-500">
                        View code
                      </button>
                    </div>
                  </li>
                );
              })}
              {detail.events.length === 0 && <li className="text-slate-400">No events yet.</li>}
            </ul>
          </InfoCard>
        )}

        {activeTab === "stats" && (
          <InfoCard title="Problem stats">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {detail.problemStats.map((stat) => (
                <div key={stat.problemId} className="rounded-xl bg-slate-900 p-3 text-sm">
                  <p className="font-medium text-slate-100">{stat.title}</p>
                  <p className="mt-2 text-slate-300">Tried by: {stat.triedBy}</p>
                  <p className="text-slate-300">Solved by: {stat.solvedBy}</p>
                  <p className="text-slate-300">Acceptance: {stat.acceptanceRate}%</p>
                </div>
              ))}
              {detail.problemStats.length === 0 && <p className="text-slate-400">No stats yet.</p>}
            </div>
          </InfoCard>
        )}
      </PageScaffold>
      </>
    );
  }

  const statusCard = () => {
    if (isParticipantAllowed || participantRequest?.status === "approved" || isOrganiser) return null;

    if (detail.phase === "ended") {
      return (
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
          <p className="font-medium text-slate-100">This contest has ended.</p>
          <p className="mt-1 text-sm text-slate-400">New participants cannot join after the contest is over.</p>
        </div>
      );
    }

    if (!user) {
      return (
        <div className="rounded-xl border border-blue-600/40 bg-blue-950/40 p-4">
          <p className="font-medium text-blue-100">Sign in to join this contest.</p>
          <p className="mt-1 text-sm text-blue-100/80">Once you sign in, you can send a join request from this page.</p>
          <Link
            href={`/sign-in?redirect_url=${encodeURIComponent(`/contest/${detail.contest.id}`)}`}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600"
          >
            <CheckCircleIcon size={16} /> Sign in to continue
          </Link>
        </div>
      );
    }

    if (participantRequest?.status === "rejected") {
      return (
        <div className="rounded-xl border border-rose-600 bg-rose-950/40 p-4">
          <p className="font-medium text-rose-200">Your join request was rejected.</p>
          <p className="mt-1 text-sm text-rose-100/90">You can send a new request if you still want to participate.</p>
          <button
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600"
            onClick={async () => {
              if (!user) return;
              await sendJoinRequest(detail.contest.id);
              await load();
            }}
          >
            <CheckCircleIcon size={16} /> Request join again
          </button>
        </div>
      );
    }

    if (participantRequest?.status === "pending") {
      return (
        <div className="rounded-xl border border-amber-600 bg-amber-950 p-4">
          <p>Your join request has been sent.</p>
          <p className="mt-2 text-xs text-amber-200">Your join request is pending approval.</p>
        </div>
      );
    }

    if (!canRequestJoin) return null;

    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
        <p className="font-medium text-slate-100">You are not part of this contest yet.</p>
        <p className="mt-1 text-sm text-slate-400">Send a join request to participate in this contest.</p>
        <button
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          onClick={async () => {
            if (!user) return;
            await sendJoinRequest(detail.contest.id);
            await load();
          }}
        >
          <CheckCircleIcon size={16} /> Request to join
        </button>
      </div>
    );
  };

  return (
    <>
      {submissionCodeModal}
      <PageScaffold title={title} titleIcon={<UsersIcon />} description={description} actions={headerActions} bodyClassName="space-y-4">
      {statusCard()}

      {canOpenProblems && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-slate-400">Contest phase</p>
              <p className="mt-1 text-lg font-semibold text-slate-100 capitalize">{detail.phase}</p>
              {detail.phase === "upcoming" && <p className="mt-2 text-sm text-slate-400">Starts at {new Date(detail.contest.startTime).toLocaleString()}</p>}
            </div>
            {detail.phase !== "ended" ? (
              <button
                type="button"
                onClick={copyInviteLink}
                className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
              >
                <CopyIcon size={15} className="mr-2" /> Invite to contest
              </button>
            ) : null}
          </div>
          {detail.phase !== "upcoming" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {detail.problems.map((problem) => (
                <Link key={problem.id} href={`/contest/${detail.contest.id}/${problem.id}`} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 hover:border-slate-600">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-100">{problem.code}</span>
                    <StatusBadge tone="blue">{problem.points} pts</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{problem.title}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <InfoCard title={detail.leaderboard.isFrozen ? "Leaderboard (frozen for participants)" : "Standings"}>
        <ul className="space-y-1 text-sm">
          {visibleStandings.slice(0, 10).map((row) => (
            <li key={row.participantId} className={row.participantId === user?.id ? "text-emerald-200" : "text-slate-200"}>
              #{row.rank} {row.participantName} · score {row.score} · solved {row.solved} · penalty {row.penalty}
            </li>
          ))}
          {visibleStandings.length === 0 && <li className="text-slate-400">No standing rows yet.</li>}
        </ul>
      </InfoCard>
    </PageScaffold>
    </>
  );
}