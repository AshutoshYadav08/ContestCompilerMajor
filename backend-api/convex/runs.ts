import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { makeId, normalizeProblem, resolveRuntime } from "./utils";

export const getById = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("runExecutions").withIndex("by_public_id", (q) => q.eq("id", args.runId)).unique();
  }
});

export const queue = mutation({
  args: {
    sourceCode: v.string(),
    languageId: v.number(),
    stdin: v.optional(v.string()),
    expectedOutput: v.optional(v.string()),
    contestId: v.optional(v.string()),
    problemId: v.optional(v.string()),
    inputMode: v.optional(v.union(v.literal("sample"), v.literal("custom"))),
    sampleCaseId: v.optional(v.string()),
    inputLabel: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    let expectedOutput = args.expectedOutput;
    let inputLabel = args.inputLabel;
    let stdin = args.stdin ?? "";
    let sampleCaseId = args.sampleCaseId;
    const inputMode = args.inputMode ?? (args.expectedOutput !== undefined ? "sample" : "custom");

    if (args.problemId) {
      const problemDoc = await ctx.db.query("problems").withIndex("by_public_id", (q) => q.eq("id", args.problemId!)).unique();
      if (problemDoc) {
        const problem = normalizeProblem(problemDoc as any);
        resolveRuntime(problem, args.languageId);

        if (inputMode === "sample") {
          const sample = problem.samples.find((entry) => entry.id === sampleCaseId) ?? problem.samples[0];
          if (!sample) throw new Error("This problem does not have a public sample to run");
          expectedOutput = sample.output;
          stdin = sample.input;
          sampleCaseId = sample.id;
          inputLabel = inputLabel ?? (problem.samples.length <= 1 ? "Sample test case" : `Sample case ${problem.samples.findIndex((entry) => entry.id === sample.id) + 1}`);
        }
      }
    }

    const runId = makeId("run");
    const createdAt = new Date().toISOString();
    const runExecution = {
      id: runId,
      ...(args.contestId ? { contestId: args.contestId } : {}),
      ...(args.problemId ? { problemId: args.problemId } : {}),
      languageId: args.languageId,
      sourceCode: args.sourceCode,
      stdin,
      inputMode,
      ...(sampleCaseId ? { sampleCaseId } : {}),
      ...(expectedOutput !== undefined ? { expectedOutput } : {}),
      ...(inputLabel ? { inputLabel } : {}),
      status: "Pending",
      pipelineStatus: "queued" as const,
      latestMessage: inputMode === "custom" ? "Queued custom run" : "Queued sample run",
      executionMs: 0,
      createdAt
    };
    await ctx.db.insert("runExecutions", runExecution);
    await ctx.scheduler.runAfter(0, internal.judge0.dispatchRun, { runId });
    return runExecution;
  }
});

export const markDispatched = internalMutation({
  args: { runId: v.string(), judgeToken: v.optional(v.string()), statusId: v.optional(v.number()), statusDescription: v.string() },
  handler: async (ctx, args) => {
    const run = await ctx.db.query("runExecutions").withIndex("by_public_id", (q) => q.eq("id", args.runId)).unique();
    if (!run) return null;
    await ctx.db.patch(run._id, {
      pipelineStatus: "processing",
      status: "Pending",
      latestMessage: run.inputMode === "custom" ? "Running custom input..." : "Running selected sample...",
      ...(args.judgeToken ? { judgeToken: args.judgeToken, providerRequestId: args.judgeToken } : {}),
      ...(args.statusId !== undefined ? { judgeStatusId: args.statusId } : {}),
      judgeStatusDescription: args.statusDescription,
      startedAt: new Date().toISOString()
    });
    return { ok: true };
  }
});

export const markFailed = internalMutation({
  args: { runId: v.string(), message: v.string() },
  handler: async (ctx, args) => {
    const run = await ctx.db.query("runExecutions").withIndex("by_public_id", (q) => q.eq("id", args.runId)).unique();
    if (!run) return null;
    await ctx.db.patch(run._id, {
      pipelineStatus: "failed",
      status: "Judge Error",
      latestMessage: args.message,
      stderr: args.message,
      judgeStatusDescription: args.message
    });
    return { ok: true };
  }
});

export const completeRun = internalMutation({
  args: {
    runId: v.string(),
    token: v.optional(v.string()),
    statusId: v.optional(v.number()),
    statusDescription: v.string(),
    verdict: v.optional(v.string()),
    stdout: v.optional(v.union(v.string(), v.null())),
    stderr: v.optional(v.union(v.string(), v.null())),
    compileOutput: v.optional(v.union(v.string(), v.null())),
    timeMs: v.optional(v.number()),
    memoryKb: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.query("runExecutions").withIndex("by_public_id", (q) => q.eq("id", args.runId)).unique();
    if (!run) throw new Error("Run execution not found");

    const finishedAt = new Date().toISOString();
    const patch = {
      pipelineStatus: "judged" as const,
      status: args.statusDescription,
      verdict: args.verdict,
      latestMessage: args.verdict ?? args.statusDescription,
      ...(args.token ? { judgeToken: args.token, providerRequestId: args.token } : {}),
      ...(args.statusId !== undefined ? { judgeStatusId: args.statusId } : {}),
      judgeStatusDescription: args.statusDescription,
      ...(args.stdout !== undefined ? { stdout: args.stdout } : {}),
      ...(args.stderr !== undefined ? { stderr: args.stderr } : {}),
      ...(args.compileOutput !== undefined ? { compileOutput: args.compileOutput } : {}),
      executionMs: args.timeMs ?? 0,
      ...(args.memoryKb !== undefined ? { memoryKb: args.memoryKb } : {}),
      finishedAt
    };

    await ctx.db.patch(run._id, patch);

    return {
      ...run,
      ...patch
    };
  }
});
