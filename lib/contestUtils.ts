import { Contest, ContestPhase, JoinRequest, Problem, StandingsRow, Submission, User, Role } from "@/types";

export function getContestById(contests: Contest[], contestId: string): Contest | undefined {
  return contests.find((contest) => contest.id === contestId);
}

export function getContestProblems(allProblems: Problem[], contest: Contest): Problem[] {
  return contest.problemIds.map((problemId) => allProblems.find((problem) => problem.id === problemId)).filter((problem): problem is Problem => Boolean(problem));
}

export function getContestPhase(contest: Contest): ContestPhase {
  const start = new Date(contest.schedule?.startAt ?? contest.startTime).getTime();
  const duration = contest.schedule?.durationMinutes ?? contest.durationMinutes;
  const end = new Date(contest.schedule?.endAt ?? (start + duration * 60 * 1000)).getTime();
  const now = Date.now();
  if (now < start) return "upcoming";
  if (now <= end) return "running";
  return "ended";
}

export function getContestSubmissions(allSubmissions: Submission[], contestId: string): Submission[] {
  return allSubmissions.filter((submission) => submission.contestId === contestId).sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
}

export function getStandings(contest: Contest, allSubmissions: Submission[]): StandingsRow[] {
  const contestSubmissions = getContestSubmissions(allSubmissions, contest.id);
  const penaltyMinutes = contest.ruleSet?.wrongAttemptPenaltyMinutes ?? 10;
  const rows = contest.participants.map((participantId) => {
    const participantSubs = contestSubmissions.filter((submission) => submission.participantId === participantId);
    const acceptedProblemIds = new Set(participantSubs.filter((submission) => (submission.verdict ?? submission.status) === "Accepted").map((submission) => submission.problemId));
    const score = participantSubs.reduce((sum, current) => Math.max(sum, 0) + current.score, 0);
    const wrongAttempts = participantSubs.filter((sub) => (sub.verdict ?? sub.status) !== "Accepted").length;
    return { participantId, participantName: participantId, solved: acceptedProblemIds.size, score, penalty: wrongAttempts * penaltyMinutes, lastAcceptedAt: participantSubs.filter((sub) => (sub.verdict ?? sub.status) === "Accepted").map((sub) => sub.submittedAt).sort().slice(-1)[0], rank: 0, problems: [] };
  });
  rows.sort((a, b) => (b.score - a.score) || (a.penalty - b.penalty) || ((a.lastAcceptedAt ?? "").localeCompare(b.lastAcceptedAt ?? "")));
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function getProblemStats(contest: Contest, allProblems: Problem[], allSubmissions: Submission[]) {
  const contestSubs = getContestSubmissions(allSubmissions, contest.id);
  return contest.problemIds.map((problemId) => {
    const problem = allProblems.find((candidate) => candidate.id === problemId);
    const problemSubs = contestSubs.filter((sub) => sub.problemId === problemId);
    const triedBy = new Set(problemSubs.map((sub) => sub.participantId)).size;
    const solvedBy = new Set(problemSubs.filter((sub) => (sub.verdict ?? sub.status) === "Accepted").map((sub) => sub.participantId)).size;
    return { problemId, title: problem?.title ?? problemId, triedBy, solvedBy, acceptanceRate: triedBy === 0 ? 0 : Number(((solvedBy / triedBy) * 100).toFixed(1)) };
  });
}

export function getContestJoinRequests(contestId: string, requests: JoinRequest[], users: User[]) {
  return requests.filter((request) => request.contestId === contestId).map((request) => ({ ...request, participant: users.find((user) => user.id === request.participantId) }));
}

export const getContestPhaseLabel = (phase: ContestPhase) => phase === "upcoming" ? "Yet to start" : phase === "running" ? "Live" : "Ended";
export const getContestPhaseBadgeClasses = (phase: ContestPhase) => phase === "upcoming" ? "border border-amber-500/40 bg-amber-500/10 text-amber-200" : phase === "running" ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border border-slate-500/40 bg-slate-700/40 text-slate-200";
export function getContestHistoryCta(role: Role, phase: ContestPhase): string {
  if (role === "organiser") return phase === "upcoming" ? "Open upcoming dashboard" : phase === "running" ? "Open live dashboard" : "View final dashboard";
  return phase === "upcoming" ? "Open upcoming contest" : phase === "running" ? "Open live contest" : "View final results";
}
