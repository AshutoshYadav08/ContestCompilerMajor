export type Role = "organiser" | "participant";
export type ContestPhase = "upcoming" | "running" | "ended";
export type PipelineStatus = "queued" | "processing" | "judged" | "failed";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  roles: Role[];
  rating: number;
  college?: string;
  username?: string;
  fullName?: string;
  organisation?: string;
  dob?: string;
  imageUrl?: string;
};

export type RuntimeSpec = {
  id: number;
  label: string;
  monaco: string;
  jdoodleLanguage: string;
  versionIndex: string;
};

export type SampleCase = {
  id: string;
  input: string;
  output: string;
  explanation?: string;
};

export type HiddenTest = {
  id: string;
  input: string;
  output: string;
  weight?: number;
};

export type ProblemExecution = {
  cpuTimeLimitSeconds: number;
  wallTimeLimitSeconds?: number;
  memoryLimitKb: number;
  stackLimitKb?: number;
  maxFileSizeKb?: number;
  enableNetwork?: boolean;
  supportedLanguages: RuntimeSpec[];
  supportedLanguageIds?: number[];
};

export type Problem = {
  id: string;
  code: string;
  title: string;
  statement: string;
  constraints: string[];
  points: number;
  tags?: string[];
  samples: SampleCase[];
  hiddenTests: HiddenTest[];
  execution: ProblemExecution;
  checkerMode?: "exact";
};

export type SubmissionFinalVerdict =
  | "Accepted"
  | "Wrong Answer"
  | "Time Limit Exceeded"
  | "Memory Limit Exceeded"
  | "Compilation Error"
  | "Runtime Error";

export type TestcaseResult = {
  taskId: string;
  testCaseId: string;
  order: number;
  hidden: boolean;
  weight: number;
  token?: string;
  statusId?: number;
  statusDescription: string;
  verdict?: SubmissionFinalVerdict | string;
  passed: boolean;
  stdout?: string | null;
  stderr?: string | null;
  compileOutput?: string | null;
  timeMs?: number;
  memoryKb?: number;
  completedAt?: string;
};

export type Submission = {
  id: string;
  contestId: string;
  problemId: string;
  participantId: string;
  participantName?: string;
  language: string;
  languageId: number;
  sourceCode: string;
  status: string;
  pipelineStatus: PipelineStatus;
  verdict?: SubmissionFinalVerdict | string;
  testcaseResults?: TestcaseResult[];
  passedTests?: number;
  totalTests?: number;
  score: number;
  executionMs: number;
  memoryKb?: number;
  providerRequestId?: string;
  judgeToken?: string;
  stdout?: string | null;
  stderr?: string | null;
  compileOutput?: string | null;
  submittedAt: string;
  finishedAt?: string;
  latestMessage?: string;
};

export type RunExecution = {
  id: string;
  status: string;
  pipelineStatus: PipelineStatus;
  languageId: number;
  sourceCode: string;
  stdin?: string;
  inputMode?: "sample" | "custom";
  sampleCaseId?: string;
  expectedOutput?: string;
  inputLabel?: string;
  verdict?: SubmissionFinalVerdict | string;
  latestMessage?: string;
  providerRequestId?: string;
  judgeToken?: string;
  stdout?: string | null;
  stderr?: string | null;
  compileOutput?: string | null;
  executionMs: number;
  memoryKb?: number;
  createdAt: string;
  finishedAt?: string;
};

export type JoinRequest = {
  id: string;
  contestId: string;
  participantId: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedAt?: string;
};

export type Contest = {
  id: string;
  name: string;
  description?: string;
  slug: string;
  organiserId: string;
  startTime: string;
  durationMinutes: number;
  endTime?: string;
  schedule: {
    startAt: string;
    endAt: string;
    durationMinutes: number;
  };
  registrationMode: "open" | "approval";
  ruleSet: {
    scoringMode: "points" | "icpc";
    wrongAttemptPenaltyMinutes: number;
    maxAttemptsPerProblem?: number;
  };
  problemIds: string[];
  participants: string[];
  joinRequestIds: string[];
};

export type StandingsProblemRow = {
  problemId: string;
  bestScore: number;
  attempts: number;
  wrongAttemptsBeforeSolved: number;
  solved: boolean;
  acceptedAt?: string;
};

export type StandingsRow = {
  participantId: string;
  participantName: string;
  solved: number;
  score: number;
  penalty: number;
  lastAcceptedAt?: string;
  rank: number;
  problems: StandingsProblemRow[];
};
