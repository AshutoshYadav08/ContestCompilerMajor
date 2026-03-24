import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { buildStandingsFromStateDocs, buildStandingsFromSubmissions, DEFAULT_RUNTIMES, getContestPhase, getProblemStats, makeId, normalizeContest, normalizeProblem } from "./utils";
import { normalizeUser } from "./users";
import { ensureContestStateForParticipant } from "./state";

const createProblemDraft = v.object({
  title: v.string(),
  code: v.string(),
  statement: v.string(),
  constraints: v.string(),
  points: v.number(),
  sampleInput: v.string(),
  sampleOutput: v.string(),
  sampleExplanation: v.optional(v.string()),
  hiddenInput: v.optional(v.string()),
  hiddenOutput: v.optional(v.string()),
  cpuTimeLimitSeconds: v.optional(v.number()),
  memoryLimitKb: v.optional(v.number()),
  supportedLanguageIds: v.optional(v.array(v.number()))
});

function buildProblemPayload(draft: any) {
  const sampleId = makeId("sample");
  const hiddenId = makeId("hidden");
  const supportedLanguages = draft.supportedLanguageIds?.length
    ? DEFAULT_RUNTIMES.filter((runtime) => draft.supportedLanguageIds.includes(runtime.id))
    : DEFAULT_RUNTIMES;

  const samples = [{
    id: sampleId,
    input: draft.sampleInput,
    output: draft.sampleOutput,
    ...(draft.sampleExplanation?.trim() ? { explanation: draft.sampleExplanation.trim() } : {})
  }];

  const hiddenTests = [{
    id: hiddenId,
    input: draft.hiddenInput?.trim() || draft.sampleInput,
    output: draft.hiddenOutput?.trim() || draft.sampleOutput,
    weight: 1
  }];

  const execution = {
    cpuTimeLimitSeconds: draft.cpuTimeLimitSeconds ?? 2,
    wallTimeLimitSeconds: draft.cpuTimeLimitSeconds ? draft.cpuTimeLimitSeconds * 2 : 4,
    memoryLimitKb: draft.memoryLimitKb ?? 262144,
    stackLimitKb: 65536,
    maxFileSizeKb: 1024,
    enableNetwork: false,
    supportedLanguages,
    supportedLanguageIds: supportedLanguages.map((runtime) => runtime.id)
  };

  return {
    code: draft.code,
    title: draft.title,
    statement: draft.statement,
    constraints: draft.constraints.split("\n").map((line: string) => line.trim()).filter(Boolean),
    points: draft.points,
    tags: ["contest"],
    samples,
    hiddenTests,
    execution,
    checkerMode: "exact" as const,
    testCases: [
      { id: sampleId, input: draft.sampleInput, output: draft.sampleOutput, isHidden: false },
      { id: hiddenId, input: draft.hiddenInput?.trim() || draft.sampleInput, output: draft.hiddenOutput?.trim() || draft.sampleOutput, isHidden: true }
    ],
    judge: {
      cpuTimeLimitSeconds: execution.cpuTimeLimitSeconds,
      wallTimeLimitSeconds: execution.wallTimeLimitSeconds,
      memoryLimitKb: execution.memoryLimitKb,
      stackLimitKb: execution.stackLimitKb
    }
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const contests = await ctx.db.query("contests").collect();
    return contests
      .map((contest) => normalizeContest(contest as any))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }
});

export const detail = query({
  args: { contestId: v.string() },
  handler: async (ctx, args) => {
    const contestDoc = await ctx.db.query("contests").withIndex("by_public_id", (q) => q.eq("id", args.contestId)).unique();
    if (!contestDoc) throw new Error("Contest not found");

    const contest = normalizeContest(contestDoc as any);
    const problems = (await Promise.all(contest.problemIds.map((problemId) =>
      ctx.db.query("problems").withIndex("by_public_id", (q) => q.eq("id", problemId)).unique()
    )))
      .filter(Boolean)
      .map((problem: any) => normalizeProblem(problem));

    const submissions = await ctx.db.query("submissions").withIndex("by_contest", (q) => q.eq("contestId", contest.id)).collect();
    submissions.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

    const joinRequests = await ctx.db.query("joinRequests").withIndex("by_contest", (q) => q.eq("contestId", contest.id)).collect();
    const users = (await ctx.db.query("users").collect()).map((user: any) => normalizeUser(user));
    const problemStates = await ctx.db.query("participantProblemStates").withIndex("by_contest", (q) => q.eq("contestId", contest.id)).collect();
    const standingDocs = await ctx.db.query("standings").withIndex("by_contest", (q) => q.eq("contestId", contest.id)).collect();

    const standings = standingDocs.length > 0
      ? buildStandingsFromStateDocs(contest, users, standingDocs, problemStates)
      : buildStandingsFromSubmissions(contest, submissions, users);

    return {
      contest,
      phase: getContestPhase(contest),
      problems,
      standings,
      publicStandings: standings,
      leaderboard: { isFrozen: false },
      joinRequests: joinRequests.map((request) => ({
        ...request,
        participant: users.find((user: any) => user.id === request.participantId)
      })),
      events: submissions.map((submission: any) => {
        const participant = users.find((user: any) => user.id === submission.participantId);
        return {
          ...submission,
          participant,
          participantName: participant?.username ? `@${participant.username}` : participant?.name ?? submission.participantId
        };
      }),
      problemStats: getProblemStats(contest, problems.map((problem) => ({ id: problem.id, title: problem.title })), submissions)
    };
  }
});

export const create = mutation({
  args: {
    organiserId: v.string(),
    name: v.string(),
    description: v.string(),
    startTime: v.string(),
    durationMinutes: v.number(),
    registrationMode: v.optional(v.union(v.literal("open"), v.literal("approval"))),
    wrongAttemptPenaltyMinutes: v.optional(v.number()),
    penaltyPerWrongMinutes: v.optional(v.number()),
    scoringMode: v.optional(v.union(v.literal("points"), v.literal("icpc"))),
    maxAttemptsPerProblem: v.optional(v.number()),
    problems: v.array(createProblemDraft)
  },
  handler: async (ctx, args) => {
    const startMs = new Date(args.startTime).getTime();
    if (Number.isNaN(startMs)) throw new Error("Invalid contest start time");
    if (startMs <= Date.now()) throw new Error("Contest start time must be in the future");
    if (args.durationMinutes < 10) throw new Error("Contest duration must be at least 10 minutes");

    const problemIds: string[] = [];
    for (const draft of args.problems) {
      const problemId = makeId("prob");
      problemIds.push(problemId);
      const payload = buildProblemPayload(draft);
      await ctx.db.insert("problems", { id: problemId, ...payload });
    }

    const contestId = makeId("contest");
    const slug = args.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const wrongPenalty = args.wrongAttemptPenaltyMinutes ?? args.penaltyPerWrongMinutes ?? 10;
    const endTime = new Date(new Date(args.startTime).getTime() + args.durationMinutes * 60 * 1000).toISOString();

    await ctx.db.insert("contests", {
      id: contestId,
      name: args.name,
      description: args.description,
      slug,
      organiserId: args.organiserId,
      schedule: {
        startAt: args.startTime,
        endAt: endTime,
        durationMinutes: args.durationMinutes
      },
      startTime: args.startTime,
      durationMinutes: args.durationMinutes,
      registrationMode: args.registrationMode ?? "approval",
      ruleSet: {
        scoringMode: args.scoringMode ?? "points",
        wrongAttemptPenaltyMinutes: wrongPenalty,
        ...(args.maxAttemptsPerProblem ? { maxAttemptsPerProblem: args.maxAttemptsPerProblem } : { maxAttemptsPerProblem: 60 })
      },
      problemIds,
      participants: [],
      joinRequestIds: []
    });

    return { contestId };
  }
});

export const requestJoin = mutation({
  args: { contestId: v.string(), participantId: v.string() },
  handler: async (ctx, args) => {
    const contestDoc = await ctx.db.query("contests").withIndex("by_public_id", (q) => q.eq("id", args.contestId)).unique();
    if (!contestDoc) throw new Error("Contest not found");
    const contest = normalizeContest(contestDoc as any);

    if (contest.participants.includes(args.participantId)) {
      return { ok: true, autoApproved: true };
    }

    const phase = getContestPhase(contest);
    if (phase === "ended") {
      throw new Error("This contest has already ended. New participants cannot join now.");
    }

    const existing = await ctx.db.query("joinRequests").withIndex("by_contest", (q) => q.eq("contestId", args.contestId)).collect();
    const matched = existing.find((request) => request.participantId === args.participantId);
    const now = new Date().toISOString();
    const autoApproved = contest.registrationMode === "open";

    if (matched) {
      if (matched.status === "rejected") {
        await ctx.db.patch(matched._id, {
          status: autoApproved ? "approved" : "pending",
          requestedAt: now,
          ...(autoApproved ? { reviewedAt: now } : {})
        });

        if (autoApproved && !contest.participants.includes(args.participantId)) {
          const participants = [...contest.participants, args.participantId];
          await ctx.db.patch(contestDoc._id, { participants });
          await ensureContestStateForParticipant(ctx, { ...contestDoc, participants }, args.participantId);
        }

        return { ok: true, requestId: matched.id, status: autoApproved ? "approved" : "pending", autoApproved };
      }

      return { ok: true, requestId: matched.id, status: matched.status, autoApproved: matched.status === "approved" };
    }

    const requestId = makeId("jr");

    await ctx.db.insert("joinRequests", {
      id: requestId,
      contestId: args.contestId,
      participantId: args.participantId,
      status: autoApproved ? "approved" : "pending",
      requestedAt: now,
      ...(autoApproved ? { reviewedAt: now } : {})
    });

    const participants = autoApproved && !contest.participants.includes(args.participantId)
      ? [...contest.participants, args.participantId]
      : [...contest.participants];

    await ctx.db.patch(contestDoc._id, {
      joinRequestIds: [...contest.joinRequestIds, requestId],
      participants
    });

    if (autoApproved) {
      await ensureContestStateForParticipant(ctx, { ...contestDoc, participants }, args.participantId);
    }

    return { ok: true, requestId, status: autoApproved ? "approved" : "pending", autoApproved };
  }
});

export const reviewJoinRequest = mutation({
  args: { requestId: v.string(), status: v.union(v.literal("approved"), v.literal("rejected")), organiserId: v.string() },
  handler: async (ctx, args) => {
    const request = await ctx.db.query("joinRequests").withIndex("by_public_id", (q) => q.eq("id", args.requestId)).unique();
    if (!request) throw new Error("Join request not found");
    const contest = await ctx.db.query("contests").withIndex("by_public_id", (q) => q.eq("id", request.contestId)).unique();
    if (!contest) throw new Error("Contest not found");
    if (contest.organiserId !== args.organiserId) throw new Error("Only the contest organiser can review join requests");

    await ctx.db.patch(request._id, { status: args.status, reviewedAt: new Date().toISOString() });

    if (args.status === "approved" && !contest.participants.includes(request.participantId)) {
      const participants = [...contest.participants, request.participantId];
      await ctx.db.patch(contest._id, { participants });
      await ensureContestStateForParticipant(ctx, { ...contest, participants }, request.participantId);
    }

    return { ok: true };
  }
});

export const getProblemById = query({
  args: { problemId: v.string() },
  handler: async (ctx, args) => {
    const problem = await ctx.db.query("problems").withIndex("by_public_id", (q) => q.eq("id", args.problemId)).unique();
    return problem ? normalizeProblem(problem as any) : null;
  }
});
