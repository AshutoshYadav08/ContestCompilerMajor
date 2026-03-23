import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const role = v.union(v.literal("organiser"), v.literal("participant"));
const registrationMode = v.union(v.literal("open"), v.literal("approval"));
const scoringMode = v.union(v.literal("points"), v.literal("icpc"));
const pipelineStatus = v.union(v.literal("queued"), v.literal("processing"), v.literal("judged"), v.literal("failed"));
const ownerType = v.union(v.literal("submission"), v.literal("run"));

const runtimeSpec = v.object({
  id: v.number(),
  label: v.string(),
  monaco: v.string(),
  jdoodleLanguage: v.string(),
  versionIndex: v.string()
});

const executionConfig = v.object({
  cpuTimeLimitSeconds: v.number(),
  wallTimeLimitSeconds: v.optional(v.number()),
  memoryLimitKb: v.number(),
  stackLimitKb: v.optional(v.number()),
  maxFileSizeKb: v.optional(v.number()),
  enableNetwork: v.optional(v.boolean()),
  supportedLanguages: v.optional(v.array(runtimeSpec)),
  supportedLanguageIds: v.optional(v.array(v.number()))
});

const sampleCase = v.object({
  id: v.string(),
  input: v.string(),
  output: v.string(),
  explanation: v.optional(v.string())
});

const hiddenCase = v.object({
  id: v.string(),
  input: v.string(),
  output: v.string(),
  weight: v.optional(v.number())
});

const testcaseResult = v.object({
  taskId: v.string(),
  testCaseId: v.string(),
  order: v.number(),
  hidden: v.boolean(),
  weight: v.number(),
  token: v.optional(v.string()),
  statusId: v.optional(v.number()),
  statusDescription: v.string(),
  verdict: v.optional(v.string()),
  passed: v.boolean(),
  stdout: v.optional(v.union(v.string(), v.null())),
  stderr: v.optional(v.union(v.string(), v.null())),
  compileOutput: v.optional(v.union(v.string(), v.null())),
  timeMs: v.optional(v.number()),
  memoryKb: v.optional(v.number()),
  completedAt: v.optional(v.string())
});

export default defineSchema({
  users: defineTable({
    id: v.string(),
    name: v.string(),
    email: v.string(),
    role,
    roles: v.optional(v.array(role)),
    rating: v.number(),
    college: v.optional(v.string()),
    username: v.optional(v.string()),
    fullName: v.optional(v.string()),
    organisation: v.optional(v.string()),
    dob: v.optional(v.string()),
    imageUrl: v.optional(v.string())
  })
    .index("by_public_id", ["id"])
    .index("by_username", ["username"])
    .index("by_role", ["role"]),

  problems: defineTable({
    id: v.string(),
    code: v.string(),
    title: v.string(),
    statement: v.string(),
    constraints: v.array(v.string()),
    points: v.number(),
    tags: v.optional(v.array(v.string())),
    samples: v.array(sampleCase),
    hiddenTests: v.array(hiddenCase),
    execution: executionConfig,
    checkerMode: v.literal("exact"),
    testCases: v.optional(v.array(v.object({
      id: v.string(),
      input: v.string(),
      output: v.string(),
      isHidden: v.boolean()
    }))),
    judge: v.optional(v.object({
      cpuTimeLimitSeconds: v.number(),
      wallTimeLimitSeconds: v.optional(v.number()),
      memoryLimitKb: v.number(),
      stackLimitKb: v.optional(v.number())
    }))
  }).index("by_public_id", ["id"]),

  contests: defineTable({
    id: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    slug: v.string(),
    organiserId: v.string(),
    schedule: v.object({
      startAt: v.string(),
      endAt: v.string(),
      durationMinutes: v.number()
    }),
    registrationMode,
    ruleSet: v.object({
      scoringMode,
      wrongAttemptPenaltyMinutes: v.number(),
      maxAttemptsPerProblem: v.optional(v.number())
    }),
    problemIds: v.array(v.string()),
    participants: v.array(v.string()),
    joinRequestIds: v.array(v.string()),
    startTime: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
    settings: v.optional(v.object({
      maxSubmissionsPerProblem: v.optional(v.number()),
      penaltyPerWrongMinutes: v.optional(v.number()),
      allowLateJoin: v.optional(v.boolean()),
      freezeLeaderboardLastMinutes: v.optional(v.number())
    }))
  })
    .index("by_public_id", ["id"])
    .index("by_organiser", ["organiserId"]),

  joinRequests: defineTable({
    id: v.string(),
    contestId: v.string(),
    participantId: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    requestedAt: v.string(),
    reviewedAt: v.optional(v.string())
  })
    .index("by_public_id", ["id"])
    .index("by_contest", ["contestId"]),

  submissions: defineTable({
    id: v.string(),
    contestId: v.string(),
    problemId: v.string(),
    participantId: v.string(),
    language: v.string(),
    languageId: v.number(),
    providerRequestId: v.optional(v.string()),
    sourceCode: v.string(),
    status: v.string(),
    pipelineStatus,
    verdict: v.optional(v.string()),
    testcaseResults: v.optional(v.array(testcaseResult)),
    passedTests: v.optional(v.number()),
    totalTests: v.optional(v.number()),
    score: v.number(),
    executionMs: v.number(),
    memoryKb: v.optional(v.number()),
    stdout: v.optional(v.union(v.string(), v.null())),
    stderr: v.optional(v.union(v.string(), v.null())),
    compileOutput: v.optional(v.union(v.string(), v.null())),
    judgeToken: v.optional(v.string()),
    judgeStatusId: v.optional(v.number()),
    judgeStatusDescription: v.optional(v.string()),
    latestMessage: v.optional(v.string()),
    queuedAt: v.optional(v.string()),
    startedAt: v.optional(v.string()),
    judgedAt: v.optional(v.string()),
    submittedAt: v.string(),
    finishedAt: v.optional(v.string())
  })
    .index("by_public_id", ["id"])
    .index("by_contest", ["contestId"])
    .index("by_contest_participant", ["contestId", "participantId"])
    .index("by_contest_participant_problem", ["contestId", "participantId", "problemId"]),

  judgeTasks: defineTable({
    id: v.string(),
    ownerType,
    ownerId: v.string(),
    contestId: v.optional(v.string()),
    problemId: v.optional(v.string()),
    participantId: v.optional(v.string()),
    providerRequestId: v.optional(v.string()),
    token: v.optional(v.string()),
    order: v.number(),
    testCaseId: v.optional(v.string()),
    hidden: v.boolean(),
    weight: v.number(),
    stdin: v.optional(v.string()),
    expectedOutput: v.optional(v.string()),
    statusId: v.optional(v.number()),
    statusDescription: v.string(),
    verdict: v.optional(v.string()),
    stdout: v.optional(v.union(v.string(), v.null())),
    stderr: v.optional(v.union(v.string(), v.null())),
    compileOutput: v.optional(v.union(v.string(), v.null())),
    timeMs: v.optional(v.number()),
    memoryKb: v.optional(v.number()),
    createdAt: v.string(),
    completedAt: v.optional(v.string())
  })
    .index("by_public_id", ["id"])
    .index("by_owner", ["ownerType", "ownerId"]),

  runExecutions: defineTable({
    id: v.string(),
    contestId: v.optional(v.string()),
    problemId: v.optional(v.string()),
    languageId: v.number(),
    sourceCode: v.string(),
    stdin: v.optional(v.string()),
    inputMode: v.optional(v.union(v.literal("sample"), v.literal("custom"))),
    sampleCaseId: v.optional(v.string()),
    expectedOutput: v.optional(v.string()),
    inputLabel: v.optional(v.string()),
    status: v.string(),
    pipelineStatus,
    verdict: v.optional(v.string()),
    latestMessage: v.optional(v.string()),
    providerRequestId: v.optional(v.string()),
    judgeToken: v.optional(v.string()),
    judgeStatusId: v.optional(v.number()),
    judgeStatusDescription: v.optional(v.string()),
    stdout: v.optional(v.union(v.string(), v.null())),
    stderr: v.optional(v.union(v.string(), v.null())),
    compileOutput: v.optional(v.union(v.string(), v.null())),
    executionMs: v.number(),
    memoryKb: v.optional(v.number()),
    createdAt: v.string(),
    startedAt: v.optional(v.string()),
    finishedAt: v.optional(v.string())
  })
    .index("by_public_id", ["id"])
    .index("by_problem", ["problemId"]),

  participantProblemStates: defineTable({
    id: v.string(),
    contestId: v.string(),
    participantId: v.string(),
    problemId: v.string(),
    attempts: v.number(),
    wrongAttemptsBeforeAccepted: v.number(),
    solved: v.boolean(),
    bestScore: v.number(),
    acceptedAt: v.optional(v.string()),
    lastSubmissionAt: v.optional(v.string()),
    latestVerdict: v.optional(v.string())
  })
    .index("by_contest_participant", ["contestId", "participantId"])
    .index("by_contest_participant_problem", ["contestId", "participantId", "problemId"])
    .index("by_contest", ["contestId"]),

  standings: defineTable({
    id: v.string(),
    contestId: v.string(),
    participantId: v.string(),
    solved: v.number(),
    score: v.number(),
    penalty: v.number(),
    lastAcceptedAt: v.optional(v.string()),
    updatedAt: v.string()
  })
    .index("by_contest", ["contestId"])
    .index("by_contest_participant", ["contestId", "participantId"])
});
