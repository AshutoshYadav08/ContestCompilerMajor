export type ContestDocLike = {
  id: string;
  name: string;
  description?: string;
  slug: string;
  organiserId: string;
  startTime?: string;
  durationMinutes?: number;
  schedule?: {
    startAt: string;
    endAt: string;
    durationMinutes: number;
  };
  registrationMode?: "open" | "approval";
  ruleSet?: {
    scoringMode: "points" | "icpc";
    wrongAttemptPenaltyMinutes: number;
    maxAttemptsPerProblem?: number;
  };
  visibility?: "public" | "private";
  settings?: {
    maxSubmissionsPerProblem?: number;
    penaltyPerWrongMinutes?: number;
    allowLateJoin?: boolean;
    freezeLeaderboardLastMinutes?: number;
  };
  problemIds: string[];
  participants: string[];
  joinRequestIds: string[];
};

export type UserLike = { id: string; name: string };

export type ParticipantProblemStateLike = {
  contestId: string;
  participantId: string;
  problemId: string;
  attempts: number;
  wrongAttemptsBeforeAccepted: number;
  solved: boolean;
  bestScore: number;
  acceptedAt?: string;
  latestVerdict?: string;
};

export type StandingDocLike = {
  participantId: string;
  solved: number;
  score: number;
  penalty: number;
  lastAcceptedAt?: string;
};

export type SubmissionLike = {
  contestId: string;
  participantId: string;
  problemId: string;
  status: string;
  verdict?: string;
  score: number;
  submittedAt: string;
};

export type RuntimeSpec = {
  id: number;
  label: string;
  monaco: string;
  jdoodleLanguage: string;
  versionIndex: string;
};

export const DEFAULT_RUNTIMES: RuntimeSpec[] = [
  { id: 71, label: "Python 3", monaco: "python", jdoodleLanguage: "python3", versionIndex: "5" },
  { id: 54, label: "C++17", monaco: "cpp", jdoodleLanguage: "cpp17", versionIndex: "2" },
  { id: 62, label: "Java 21", monaco: "java", jdoodleLanguage: "java", versionIndex: "5" },
  { id: 63, label: "JavaScript", monaco: "javascript", jdoodleLanguage: "nodejs", versionIndex: "6" }
];

export type ProblemDocLike = {
  id: string;
  code: string;
  title: string;
  statement: string;
  constraints: string[];
  points: number;
  tags?: string[];
  samples?: Array<{ id: string; input: string; output: string; explanation?: string }>;
  hiddenTests?: Array<{ id: string; input: string; output: string; weight?: number }>;
  execution?: {
    cpuTimeLimitSeconds: number;
    wallTimeLimitSeconds?: number;
    memoryLimitKb: number;
    stackLimitKb?: number;
    maxFileSizeKb?: number;
    enableNetwork?: boolean;
    supportedLanguages?: RuntimeSpec[];
    supportedLanguageIds?: number[];
  };
  checkerMode?: "exact";
  testCases?: Array<{ id: string; input: string; output: string; isHidden: boolean }>;
  judge?: {
    cpuTimeLimitSeconds: number;
    wallTimeLimitSeconds?: number;
    memoryLimitKb: number;
    stackLimitKb?: number;
  };
};

export type NormalizedContest = ContestDocLike & {
  startTime: string;
  durationMinutes: number;
  endTime: string;
  registrationMode: "open" | "approval";
  ruleSet: {
    scoringMode: "points" | "icpc";
    wrongAttemptPenaltyMinutes: number;
    maxAttemptsPerProblem?: number;
  };
};

export type NormalizedProblem = ProblemDocLike & {
  samples: Array<{ id: string; input: string; output: string; explanation?: string }>;
  hiddenTests: Array<{ id: string; input: string; output: string; weight?: number }>;
  execution: {
    cpuTimeLimitSeconds: number;
    wallTimeLimitSeconds?: number;
    memoryLimitKb: number;
    stackLimitKb?: number;
    maxFileSizeKb?: number;
    enableNetwork?: boolean;
    supportedLanguages: RuntimeSpec[];
    supportedLanguageIds: number[];
  };
  checkerMode: "exact";
};

export type StandingsRow = {
  participantId: string;
  participantName: string;
  solved: number;
  score: number;
  penalty: number;
  lastAcceptedAt?: string;
  rank: number;
  problems: Array<{
    problemId: string;
    bestScore: number;
    attempts: number;
    wrongAttemptsBeforeSolved: number;
    solved: boolean;
    acceptedAt?: string;
  }>;
};

export function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function coerceRuntimes(ids?: number[], explicit?: RuntimeSpec[]) {
  if (explicit?.length) return explicit;
  if (ids?.length) return DEFAULT_RUNTIMES.filter((runtime) => ids.includes(runtime.id));
  return DEFAULT_RUNTIMES;
}

export function normalizeContest(contest: ContestDocLike): NormalizedContest {
  const startTime = contest.schedule?.startAt ?? contest.startTime ?? new Date().toISOString();
  const durationMinutes = contest.schedule?.durationMinutes ?? contest.durationMinutes ?? 90;
  const endTime = contest.schedule?.endAt ?? new Date(new Date(startTime).getTime() + durationMinutes * 60 * 1000).toISOString();
  const registrationMode = contest.registrationMode ?? (contest.visibility === "private" ? "approval" : "open");
  const maxAttempts = contest.ruleSet?.maxAttemptsPerProblem ?? contest.settings?.maxSubmissionsPerProblem;
  return {
    ...contest,
    startTime,
    durationMinutes,
    endTime,
    registrationMode,
    ruleSet: {
      scoringMode: contest.ruleSet?.scoringMode ?? "points",
      wrongAttemptPenaltyMinutes: contest.ruleSet?.wrongAttemptPenaltyMinutes ?? contest.settings?.penaltyPerWrongMinutes ?? 10,
      ...(maxAttempts ? { maxAttemptsPerProblem: maxAttempts } : {})
    }
  };
}

export function normalizeProblem(problem: ProblemDocLike): NormalizedProblem {
  const samples = problem.samples ?? (problem.testCases ?? []).filter((test) => !test.isHidden).map((test) => ({
    id: test.id,
    input: test.input,
    output: test.output
  }));
  const hiddenTests = problem.hiddenTests ?? (problem.testCases ?? []).filter((test) => test.isHidden).map((test) => ({
    id: test.id,
    input: test.input,
    output: test.output,
    weight: 1
  }));
  const supportedLanguages = coerceRuntimes(problem.execution?.supportedLanguageIds, problem.execution?.supportedLanguages);
  return {
    ...problem,
    tags: problem.tags ?? [],
    samples,
    hiddenTests,
    execution: {
      cpuTimeLimitSeconds: problem.execution?.cpuTimeLimitSeconds ?? problem.judge?.cpuTimeLimitSeconds ?? 2,
      wallTimeLimitSeconds: problem.execution?.wallTimeLimitSeconds ?? problem.judge?.wallTimeLimitSeconds ?? ((problem.execution?.cpuTimeLimitSeconds ?? problem.judge?.cpuTimeLimitSeconds ?? 2) * 2),
      memoryLimitKb: problem.execution?.memoryLimitKb ?? problem.judge?.memoryLimitKb ?? 262144,
      stackLimitKb: problem.execution?.stackLimitKb ?? problem.judge?.stackLimitKb ?? 65536,
      maxFileSizeKb: problem.execution?.maxFileSizeKb ?? 1024,
      enableNetwork: problem.execution?.enableNetwork ?? false,
      supportedLanguages,
      supportedLanguageIds: supportedLanguages.map((runtime) => runtime.id)
    },
    checkerMode: problem.checkerMode ?? "exact"
  };
}

export function getContestPhase(contest: ContestDocLike) {
  const normalized = normalizeContest(contest);
  const now = Date.now();
  const start = new Date(normalized.startTime).getTime();
  const end = new Date(normalized.endTime).getTime();
  if (now < start) return "upcoming" as const;
  if (now <= end) return "running" as const;
  return "ended" as const;
}


function getUserStandingsName(user: UserLike | undefined) {
  if (!user) return "Unknown user";
  if ((user as any).username) return `@${(user as any).username}`;
  return user.name || user.email || user.id;
}

export function resolveRuntime(problem: ProblemDocLike | NormalizedProblem | null | undefined, languageId?: number) {
  const normalized = problem ? normalizeProblem(problem as ProblemDocLike) : undefined;
  const runtimes = normalized?.execution.supportedLanguages ?? DEFAULT_RUNTIMES;
  return runtimes.find((runtime) => runtime.id === languageId) ?? runtimes[0] ?? DEFAULT_RUNTIMES[0];
}

function sortStandingsRows(rows: StandingsRow[]) {
  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.solved !== a.solved) return b.solved - a.solved;
    if (a.penalty !== b.penalty) return a.penalty - b.penalty;
    return (a.lastAcceptedAt ?? "9999-12-31T23:59:59.999Z").localeCompare(
      b.lastAcceptedAt ?? "9999-12-31T23:59:59.999Z"
    );
  });

  let previous: StandingsRow | null = null;
  return rows.map((row, index) => {
    const sameAsPrevious = previous && previous.score === row.score && previous.solved === row.solved && previous.penalty === row.penalty && previous.lastAcceptedAt === row.lastAcceptedAt;
    const rankedRow = { ...row, rank: sameAsPrevious ? previous!.rank : index + 1 };
    previous = rankedRow;
    return rankedRow;
  });
}

export function buildStandingsFromStateDocs(contestDoc: ContestDocLike, users: UserLike[], standingDocs: StandingDocLike[], problemStates: ParticipantProblemStateLike[]) {
  const contest = normalizeContest(contestDoc);
  const nameMap = new Map(users.map((user) => [user.id, getUserStandingsName(user)]));

  const rows = contest.participants.map((participantId) => {
    const problems = contest.problemIds.map((problemId) => {
      const state = problemStates.find((item) => item.contestId === contest.id && item.participantId === participantId && item.problemId === problemId);
      return {
        problemId,
        bestScore: state?.bestScore ?? 0,
        attempts: state?.attempts ?? 0,
        wrongAttemptsBeforeSolved: state?.wrongAttemptsBeforeAccepted ?? 0,
        solved: state?.solved ?? false,
        acceptedAt: state?.acceptedAt
      };
    });
    const standing = standingDocs.find((item) => item.participantId === participantId);
    return {
      participantId,
      participantName: nameMap.get(participantId) ?? participantId,
      solved: standing?.solved ?? 0,
      score: standing?.score ?? 0,
      penalty: standing?.penalty ?? 0,
      lastAcceptedAt: standing?.lastAcceptedAt,
      rank: 0,
      problems
    };
  });

  return sortStandingsRows(rows);
}

function normalizeProblemStates(problemIds: string[], participantSubs: SubmissionLike[]) {
  return problemIds.map((problemId) => {
    const problemSubs = participantSubs
      .filter((submission) => submission.problemId === problemId)
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

    let bestScore = 0;
    let acceptedAt: string | undefined;
    let wrongAttemptsBeforeSolved = 0;

    for (const submission of problemSubs) {
      bestScore = Math.max(bestScore, submission.score);
      const verdict = submission.verdict ?? submission.status;
      if (acceptedAt) continue;
      if (verdict === "Accepted") {
        acceptedAt = submission.submittedAt;
      } else {
        wrongAttemptsBeforeSolved += 1;
      }
    }

    return {
      problemId,
      bestScore,
      attempts: problemSubs.length,
      wrongAttemptsBeforeSolved: acceptedAt ? wrongAttemptsBeforeSolved : 0,
      solved: Boolean(acceptedAt),
      acceptedAt
    };
  });
}

export function buildStandingsFromSubmissions(contestDoc: ContestDocLike, allSubmissions: SubmissionLike[], users: UserLike[]) {
  const contest = normalizeContest(contestDoc);
  const contestSubmissions = allSubmissions
    .filter((submission) => submission.contestId === contest.id)
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  const userNames = new Map(users.map((user) => [user.id, getUserStandingsName(user)]));

  const rows = contest.participants.map((participantId) => {
    const participantSubs = contestSubmissions.filter((submission) => submission.participantId === participantId);
    const problems = normalizeProblemStates(contest.problemIds, participantSubs);
    const solved = problems.filter((problem) => problem.solved).length;
    const score = problems.reduce((sum, problem) => sum + problem.bestScore, 0);
    const penalty = problems.reduce(
      (sum, problem) => sum + problem.wrongAttemptsBeforeSolved * contest.ruleSet.wrongAttemptPenaltyMinutes,
      0
    );
    const acceptedAtValues = problems.map((problem) => problem.acceptedAt).filter(Boolean) as string[];
    const lastAcceptedAt = acceptedAtValues.length > 0 ? acceptedAtValues[acceptedAtValues.length - 1] : undefined;

    return {
      participantId,
      participantName: userNames.get(participantId) ?? participantId,
      solved,
      score,
      penalty,
      lastAcceptedAt,
      rank: 0,
      problems
    };
  });

  return sortStandingsRows(rows);
}

export function getProblemStats(
  contestDoc: ContestDocLike,
  allProblems: Array<{ id: string; title: string }>,
  allSubmissions: Array<{ contestId: string; problemId: string; participantId: string; status: string; verdict?: string; submittedAt: string }>
) {
  const contest = normalizeContest(contestDoc);
  const contestSubs = allSubmissions
    .filter((submission) => submission.contestId === contest.id)
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  return contest.problemIds.map((problemId) => {
    const problem = allProblems.find((candidate) => candidate.id === problemId);
    const problemSubs = contestSubs.filter((sub) => sub.problemId === problemId);
    const triedBy = new Set(problemSubs.map((sub) => sub.participantId)).size;
    const solvedBy = new Set(
      problemSubs.filter((sub) => (sub.verdict ?? sub.status) === "Accepted").map((sub) => sub.participantId)
    ).size;

    return {
      problemId,
      title: problem?.title ?? problemId,
      triedBy,
      solvedBy,
      acceptanceRate: triedBy === 0 ? 0 : Number(((solvedBy / triedBy) * 100).toFixed(1))
    };
  });
}

export function getSupportedLanguages(problem?: ProblemDocLike) {
  const normalized = problem ? normalizeProblem(problem) : undefined;
  return normalized?.execution.supportedLanguages ?? DEFAULT_RUNTIMES;
}
