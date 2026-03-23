import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { applyJudgedSubmissionToDerivedState } from "./state";
import { makeId, normalizeContest, normalizeProblem, resolveRuntime } from "./utils";

const FINAL_PRIORITY = ["Compilation Error", "Memory Limit Exceeded", "Runtime Error", "Time Limit Exceeded", "Wrong Answer"];

function aggregateResults(results: any[], problem: any, scoringMode: "points" | "icpc") {
  const passedWeight = results.filter((item) => item.passed).reduce((sum, item) => sum + (item.weight || 1), 0);
  const totalWeight = results.reduce((sum, item) => sum + (item.weight || 1), 0) || 1;
  const score = scoringMode === "points"
    ? Math.round((problem.points * passedWeight) / totalWeight)
    : results.every((item) => item.passed) ? problem.points : 0;

  const exactAccepted = results.length > 0 && results.every((item) => item.passed);
  const priorityVerdict = FINAL_PRIORITY.find((candidate) => results.some((item) => item.verdict === candidate));
  const verdict = exactAccepted ? "Accepted" : (priorityVerdict ?? "Wrong Answer");
  const executionMs = Math.max(0, ...results.map((item) => item.timeMs ?? 0));
  const memoryKb = Math.max(0, ...results.map((item) => item.memoryKb ?? 0));
  const representative = exactAccepted
    ? results.slice().sort((a, b) => (a.completedAt ?? "").localeCompare(b.completedAt ?? "")).slice(-1)[0]
    : results.find((item) => item.verdict === verdict) || results.find((item) => !item.passed) || results[0];

  return {
    verdict,
    score,
    passedTests: results.filter((item) => item.passed).length,
    totalTests: results.length,
    executionMs,
    memoryKb,
    stdout: representative?.stdout ?? null,
    stderr: representative?.stderr ?? null,
    compileOutput: representative?.compileOutput ?? null
  };
}

const taskResultValidator = v.object({
  taskId: v.string(),
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
  completedAt: v.string()
});

export const getById = query({
  args: { submissionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("submissions").withIndex("by_public_id", (q) => q.eq("id", args.submissionId)).unique();
  }
});

export const getDispatchContext = query({
  args: { submissionId: v.string() },
  handler: async (ctx, args) => {
    const submission = await ctx.db.query("submissions").withIndex("by_public_id", (q) => q.eq("id", args.submissionId)).unique();
    if (!submission) return null;
    const problemDoc = await ctx.db.query("problems").withIndex("by_public_id", (q) => q.eq("id", submission.problemId)).unique();
    if (!problemDoc) return null;
    const problem = normalizeProblem(problemDoc as any);
    const tasks = await ctx.db.query("judgeTasks").withIndex("by_owner", (q) => q.eq("ownerType", "submission").eq("ownerId", submission.id)).collect();
    tasks.sort((a, b) => a.order - b.order);
    return { submission, problem, tasks };
  }
});

export const queue = mutation({
  args: {
    contestId: v.string(),
    participantId: v.string(),
    problemId: v.string(),
    language: v.optional(v.string()),
    languageId: v.number(),
    sourceCode: v.string()
  },
  handler: async (ctx, args) => {
    const contestDoc = await ctx.db.query("contests").withIndex("by_public_id", (q) => q.eq("id", args.contestId)).unique();
    if (!contestDoc) throw new Error("Contest not found");
    const contest = normalizeContest(contestDoc as any);

    const problemDoc = await ctx.db.query("problems").withIndex("by_public_id", (q) => q.eq("id", args.problemId)).unique();
    if (!problemDoc) throw new Error("Problem not found");
    const problem = normalizeProblem(problemDoc as any);
    const runtime = resolveRuntime(problem, args.languageId);
    if (!runtime) throw new Error("Selected language is not supported for this problem");

    const isAllowed = args.participantId === contest.organiserId || contest.participants.includes(args.participantId);
    if (!isAllowed) throw new Error("Participant is not approved for this contest");

    const nowMs = Date.now();
    if (nowMs < new Date(contest.startTime).getTime()) throw new Error("Contest has not started yet");
    if (nowMs > new Date(contest.endTime).getTime()) throw new Error("Contest has already ended");

    const prior = await ctx.db
      .query("submissions")
      .withIndex("by_contest_participant_problem", (q) =>
        q.eq("contestId", args.contestId).eq("participantId", args.participantId).eq("problemId", args.problemId)
      )
      .collect();

    const maxAttempts = contest.ruleSet.maxAttemptsPerProblem ?? 60;
    if (prior.length >= maxAttempts) throw new Error("Submission limit reached for this problem");

    const hiddenTests = problem.hiddenTests.length > 0 ? problem.hiddenTests : problem.samples.map((sample) => ({ ...sample, weight: 1 }));
    const submissionId = makeId("sub");
    const submittedAt = new Date().toISOString();
    const testcaseResults = [] as any[];
    const taskIds: string[] = [];

    for (const [index, hidden] of hiddenTests.entries()) {
      const taskId = makeId("jt");
      taskIds.push(taskId);
      testcaseResults.push({
        taskId,
        testCaseId: hidden.id,
        order: index,
        hidden: true,
        weight: hidden.weight ?? 1,
        statusDescription: "Queued",
        passed: false
      });
      await ctx.db.insert("judgeTasks", {
        id: taskId,
        ownerType: "submission",
        ownerId: submissionId,
        contestId: args.contestId,
        problemId: args.problemId,
        participantId: args.participantId,
        order: index,
        testCaseId: hidden.id,
        hidden: true,
        weight: hidden.weight ?? 1,
        stdin: hidden.input,
        expectedOutput: hidden.output,
        statusDescription: "Queued",
        createdAt: submittedAt
      });
    }

    const submission = {
      id: submissionId,
      contestId: args.contestId,
      problemId: args.problemId,
      participantId: args.participantId,
      language: runtime.label,
      languageId: runtime.id,
      sourceCode: args.sourceCode,
      status: "Pending",
      pipelineStatus: "queued" as const,
      testcaseResults,
      passedTests: 0,
      totalTests: testcaseResults.length,
      score: 0,
      executionMs: 0,
      latestMessage: "Queued for evaluation",
      queuedAt: submittedAt,
      submittedAt
    };

    await ctx.db.insert("submissions", submission);
    await ctx.scheduler.runAfter(0, internal.judge0.dispatchSubmissionBatch, { submissionId });
    return submission;
  }
});

export const markBatchDispatched = internalMutation({
  args: {
    submissionId: v.string(),
    taskUpdates: v.array(v.object({
      taskId: v.string(),
      token: v.optional(v.string()),
      statusId: v.optional(v.number()),
      statusDescription: v.string()
    }))
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.query("submissions").withIndex("by_public_id", (q) => q.eq("id", args.submissionId)).unique();
    if (!submission) return null;

    const tasks = await ctx.db.query("judgeTasks").withIndex("by_owner", (q) => q.eq("ownerType", "submission").eq("ownerId", submission.id)).collect();
    for (const update of args.taskUpdates) {
      const matched = tasks.find((item: any) => item.id === update.taskId);
      if (matched) {
        await ctx.db.patch(matched._id, {
          ...(update.token ? { token: update.token, providerRequestId: update.token } : {}),
          ...(update.statusId !== undefined ? { statusId: update.statusId } : {}),
          statusDescription: update.statusDescription
        });
      }
    }

    const testcaseResults = (submission.testcaseResults ?? []).map((item: any) => {
      const update = args.taskUpdates.find((candidate) => candidate.taskId === item.taskId);
      return update ? { ...item, ...(update.token ? { token: update.token } : {}), ...(update.statusId !== undefined ? { statusId: update.statusId } : {}), statusDescription: update.statusDescription } : item;
    });

    await ctx.db.patch(submission._id, {
      pipelineStatus: "processing",
      status: "Pending",
      latestMessage: "JDoodle jobs started",
      startedAt: new Date().toISOString(),
      testcaseResults
    });
    return { ok: true };
  }
});

export const markFailed = internalMutation({
  args: { submissionId: v.string(), message: v.string() },
  handler: async (ctx, args) => {
    const submission = await ctx.db.query("submissions").withIndex("by_public_id", (q) => q.eq("id", args.submissionId)).unique();
    if (!submission) return null;
    await ctx.db.patch(submission._id, {
      pipelineStatus: "failed",
      status: "Judge Error",
      latestMessage: args.message,
      stderr: args.message
    });
    return { ok: true };
  }
});

export const completeBatchJudging = internalMutation({
  args: {
    submissionId: v.string(),
    taskResults: v.array(taskResultValidator)
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.query("submissions").withIndex("by_public_id", (q) => q.eq("id", args.submissionId)).unique();
    if (!submission) throw new Error("Submission not found");

    const contestDoc = await ctx.db.query("contests").withIndex("by_public_id", (q) => q.eq("id", submission.contestId)).unique();
    if (!contestDoc) throw new Error("Contest not found");
    const contest = normalizeContest(contestDoc as any);

    const problemDoc = await ctx.db.query("problems").withIndex("by_public_id", (q) => q.eq("id", submission.problemId)).unique();
    if (!problemDoc) throw new Error("Problem not found");
    const problem = normalizeProblem(problemDoc as any);

    const tasks = await ctx.db.query("judgeTasks").withIndex("by_owner", (q) => q.eq("ownerType", "submission").eq("ownerId", submission.id)).collect();
    for (const result of args.taskResults) {
      const task = tasks.find((item: any) => item.id === result.taskId);
      if (task) {
        await ctx.db.patch(task._id, {
          ...(result.token ? { token: result.token, providerRequestId: result.token } : {}),
          ...(result.statusId !== undefined ? { statusId: result.statusId } : {}),
          statusDescription: result.statusDescription,
          ...(result.verdict ? { verdict: result.verdict } : {}),
          ...(result.stdout !== undefined ? { stdout: result.stdout } : {}),
          ...(result.stderr !== undefined ? { stderr: result.stderr } : {}),
          ...(result.compileOutput !== undefined ? { compileOutput: result.compileOutput } : {}),
          ...(result.timeMs !== undefined ? { timeMs: result.timeMs } : {}),
          ...(result.memoryKb !== undefined ? { memoryKb: result.memoryKb } : {}),
          completedAt: result.completedAt
        });
      }
    }

    const updatedResults = (submission.testcaseResults ?? []).map((existing: any) => {
      const result = args.taskResults.find((candidate) => candidate.taskId === existing.taskId);
      return result ? { ...existing, ...result } : existing;
    });

    const aggregate = aggregateResults(updatedResults, problem, contest.ruleSet.scoringMode);
    const completedAt = args.taskResults.map((item) => item.completedAt).sort().slice(-1)[0] ?? new Date().toISOString();

    await ctx.db.patch(submission._id, {
      pipelineStatus: "judged",
      status: aggregate.verdict,
      verdict: aggregate.verdict,
      score: aggregate.score,
      passedTests: aggregate.passedTests,
      totalTests: aggregate.totalTests,
      executionMs: aggregate.executionMs,
      memoryKb: aggregate.memoryKb,
      stdout: aggregate.stdout,
      stderr: aggregate.stderr,
      compileOutput: aggregate.compileOutput,
      testcaseResults: updatedResults,
      latestMessage: aggregate.verdict,
      judgedAt: completedAt,
      finishedAt: completedAt
    });

    const updatedSubmission = {
      ...submission,
      pipelineStatus: "judged",
      status: aggregate.verdict,
      verdict: aggregate.verdict,
      score: aggregate.score,
      executionMs: aggregate.executionMs,
      memoryKb: aggregate.memoryKb,
      submittedAt: submission.submittedAt,
      finishedAt: completedAt
    };

    await applyJudgedSubmissionToDerivedState(ctx, contest, updatedSubmission);
    return updatedSubmission;
  }
});
