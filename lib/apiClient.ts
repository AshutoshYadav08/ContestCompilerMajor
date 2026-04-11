import { Contest, Problem, RunExecution, StandingsRow, Submission, User } from "@/types";
// error resolved
export type ContestResponse = {
  contest: Contest;
  phase: "upcoming" | "running" | "ended";
  problems: Problem[];
  standings: StandingsRow[];
  publicStandings: StandingsRow[];
  leaderboard: { isFrozen: boolean };
  joinRequests: Array<{
    id: string;
    contestId: string;
    participantId: string;
    status: "pending" | "approved" | "rejected";
    requestedAt: string;
    reviewedAt?: string;
    participant?: User;
  }>;
  events: Submission[];
  problemStats: Array<{ problemId: string; title: string; triedBy: number; solvedBy: number; acceptanceRate: number }>;
};

export type CreateContestPayload = {
  name: string;
  description: string;
  startTime: string;
  durationMinutes: number;
  registrationMode: "open" | "approval";
  wrongAttemptPenaltyMinutes: number;
  scoringMode?: "points" | "icpc";
  maxAttemptsPerProblem?: number;
  problems: Array<{
    title: string;
    code: string;
    statement: string;
    constraints: string;
    points: number;
    sampleInput: string;
    sampleOutput: string;
    sampleExplanation?: string;
    hiddenInput?: string;
    hiddenOutput?: string;
    cpuTimeLimitSeconds?: number;
    memoryLimitKb?: number;
    supportedLanguageIds?: number[];
  }>;
};

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store"
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) throw new Error(data?.message || data?.error || "Request failed");
  return data as T;
}

export const fetchContests = () => request<Contest[]>("/api/contests");
export const fetchUsers = () => request<User[]>("/api/users");
export const fetchContestDetail = (contestId: string) => request<ContestResponse>(`/api/contest?id=${encodeURIComponent(contestId)}`);
export const createContest = async (payload: CreateContestPayload) => (await request<{ contestId: string }>("/api/contests", { method: "POST", body: JSON.stringify(payload) })).contestId;
export const sendJoinRequest = (contestId: string) => request<{ ok: boolean; requestId?: string; status?: string }>("/api/join-request", { method: "POST", body: JSON.stringify({ contestId }) });
export const reviewJoinRequest = (requestId: string, status: "approved" | "rejected") => request<{ ok: boolean }>("/api/join-request/review", { method: "POST", body: JSON.stringify({ requestId, status }) });
export const runCode = (payload: { sourceCode: string; languageId: number; stdin?: string; expectedOutput?: string; contestId?: string; problemId?: string; inputMode?: "sample" | "custom"; sampleCaseId?: string; inputLabel?: string }) => request<RunExecution>("/api/run-code", { method: "POST", body: JSON.stringify(payload) });
export const fetchRunExecution = (runId: string) => request<RunExecution>(`/api/run-code?id=${encodeURIComponent(runId)}`);
export const submitCode = (payload: { contestId: string; problemId: string; language?: string; languageId: number; sourceCode: string }) => request<Submission>("/api/submissions", { method: "POST", body: JSON.stringify(payload) });
export const fetchSubmission = (submissionId: string) => request<Submission>(`/api/submissions?id=${encodeURIComponent(submissionId)}`);
export const fetchMyProfile = () => request<User>("/api/profile");
export const updateMyProfile = (payload: { username?: string; fullName?: string; organisation?: string; dob?: string }) => request<User>("/api/profile", { method: "POST", body: JSON.stringify(payload) });
