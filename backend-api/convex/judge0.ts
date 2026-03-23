"use node";

import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { normalizeProblem, resolveRuntime } from "./utils";

type ExecutionResult = {
  token: string;
  statusId: number;
  statusDescription: string;
  verdict?: string;
  passed: boolean;
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  timeMs: number;
  memoryKb: number;
};

function providerConfig() {
  const requestedMode = (process.env.JDOODLE_MODE || "real").toLowerCase();
  const hasCreds = Boolean(process.env.JDOODLE_CLIENT_ID && process.env.JDOODLE_CLIENT_SECRET);
  if (requestedMode === "fake") {
    return {
      mode: "fake",
      baseUrl: (process.env.JDOODLE_BASE_URL || "https://api.jdoodle.com/v1").replace(/\/$/, ""),
      clientId: process.env.JDOODLE_CLIENT_ID,
      clientSecret: process.env.JDOODLE_CLIENT_SECRET
    } as const;
  }
  if (!hasCreds) {
    throw new Error("JDoodle credentials are missing in the Convex environment. Set JDOODLE_CLIENT_ID and JDOODLE_CLIENT_SECRET, or set JDOODLE_MODE=fake explicitly for local testing.");
  }
  return {
    mode: "real",
    baseUrl: (process.env.JDOODLE_BASE_URL || "https://api.jdoodle.com/v1").replace(/\/$/, ""),
    clientId: process.env.JDOODLE_CLIENT_ID,
    clientSecret: process.env.JDOODLE_CLIENT_SECRET
  } as const;
}

function normalizeText(value?: string | null) {
  return (value ?? "").replace(/\r\n/g, "\n").trim();
}

function normalizeNullableText(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return text.toLowerCase() === "none" || text.toLowerCase() === "null" ? null : text;
}

function looksLikeMemoryIssue(text?: string | null) {
  return /memory limit|out of memory|cannot allocate memory|heap space|std::bad_alloc|killed|bad alloc|oom/i.test(text ?? "");
}

function looksLikeTimeout(text?: string | null) {
  return /JDoodle - Timeout|time limit|timed out|timeout|infinite loop|execution timed out/i.test(text ?? "");
}

function looksLikeRuntimeIssue(text?: string | null) {
  return /traceback|exception|runtime error|segmentation fault|segfault|core dumped|non-zero exit|zerodivisionerror|indexerror|valueerror|nameerror|syntaxerror|typeerror/i.test(text ?? "");
}

function looksLikeCompileIssue(text?: string | null) {
  return /error:|compilation failed|compiler|undefined reference|expected .* before|no matching function|was not declared in this scope|fatal error:/i.test(text ?? "");
}

function classifyExecution(params: {
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  cpuSeconds: number;
  memoryKb: number;
  expectedOutput?: string;
  cpuLimitSeconds?: number;
  isCompiled?: boolean | null;
  isExecutionSuccess?: boolean | number | null;
}) {
  const stdout = params.stdout;
  const stderr = params.stderr;
  const compileOutput = params.compileOutput;
  const isCompiled = params.isCompiled;
  const isExecutionSuccess = params.isExecutionSuccess;

  if (compileOutput || isCompiled === false || looksLikeCompileIssue(stderr) || looksLikeCompileIssue(stdout)) {
    return { statusDescription: "Compilation Error", verdict: "Compilation Error", passed: false };
  }
  if (looksLikeMemoryIssue(stderr) || looksLikeMemoryIssue(stdout)) {
    return { statusDescription: "Memory Limit Exceeded", verdict: "Memory Limit Exceeded", passed: false };
  }
  if (looksLikeTimeout(stdout) || looksLikeTimeout(stderr) || (params.cpuLimitSeconds && params.cpuSeconds > params.cpuLimitSeconds + 0.001)) {
    return { statusDescription: "Time Limit Exceeded", verdict: "Time Limit Exceeded", passed: false };
  }
  if (stderr || looksLikeRuntimeIssue(stdout) || looksLikeRuntimeIssue(stderr) || isExecutionSuccess === false || isExecutionSuccess === 0) {
    return { statusDescription: "Runtime Error", verdict: "Runtime Error", passed: false };
  }
  if (params.expectedOutput !== undefined) {
    const accepted = normalizeText(stdout) === normalizeText(params.expectedOutput);
    return { statusDescription: accepted ? "Accepted" : "Wrong Answer", verdict: accepted ? "Accepted" : "Wrong Answer", passed: accepted };
  }
  return { statusDescription: "Finished", verdict: undefined, passed: true };
}

function fakeExecution(sourceCode: string, expectedOutput?: string, runtimeName = "python3"): ExecutionResult {
  const lower = sourceCode.toLowerCase();
  if (lower.includes("compile_error") || lower.includes("syntax_error")) {
    return {
      token: `fake_${Math.random().toString(36).slice(2, 10)}`,
      statusId: 6,
      statusDescription: "Compilation Error",
      verdict: "Compilation Error",
      passed: false,
      stdout: null,
      stderr: null,
      compileOutput: `Fake ${runtimeName} compiler error`,
      timeMs: 0,
      memoryKb: 0
    };
  }
  if (lower.includes("memory_limit") || lower.includes("out_of_memory")) {
    return {
      token: `fake_${Math.random().toString(36).slice(2, 10)}`,
      statusId: 12,
      statusDescription: "Memory Limit Exceeded",
      verdict: "Memory Limit Exceeded",
      passed: false,
      stdout: null,
      stderr: "Fake memory limit exceeded",
      compileOutput: null,
      timeMs: 15,
      memoryKb: 0
    };
  }
  if (lower.includes("infinite_loop") || lower.includes("timeout")) {
    return {
      token: `fake_${Math.random().toString(36).slice(2, 10)}`,
      statusId: 5,
      statusDescription: "Time Limit Exceeded",
      verdict: "Time Limit Exceeded",
      passed: false,
      stdout: "JDoodle - Timeout. If your program reads input, please enter the inputs in the STDIN box above.",
      stderr: null,
      compileOutput: null,
      timeMs: 60000,
      memoryKb: 8192
    };
  }
  if (lower.includes("runtime_error") || lower.includes("segfault")) {
    return {
      token: `fake_${Math.random().toString(36).slice(2, 10)}`,
      statusId: 11,
      statusDescription: "Runtime Error",
      verdict: "Runtime Error",
      passed: false,
      stdout: null,
      stderr: "Fake runtime error: non-zero exit code",
      compileOutput: null,
      timeMs: 12,
      memoryKb: 8192
    };
  }

  const hash = [...sourceCode].reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) >>> 0, 7);
  const accepted = expectedOutput ? (lower.includes("accepted") || lower.includes("correct") || (hash % 100) > 45) : true;
  const stdout = accepted ? (expectedOutput ?? "Execution completed") : `${expectedOutput ?? "Execution completed"}_wrong`;
  return {
    token: `fake_${Math.random().toString(36).slice(2, 10)}`,
    statusId: accepted ? 3 : 4,
    statusDescription: expectedOutput ? (accepted ? "Accepted" : "Wrong Answer") : "Finished",
    verdict: expectedOutput ? (accepted ? "Accepted" : "Wrong Answer") : undefined,
    passed: expectedOutput ? accepted : true,
    stdout,
    stderr: null,
    compileOutput: null,
    timeMs: 20 + (hash % 50),
    memoryKb: 8192 + (hash % 4096)
  };
}

async function executeWithJDoodle(params: {
  sourceCode: string;
  stdin?: string;
  expectedOutput?: string;
  language: string;
  versionIndex: string;
  cpuLimitSeconds?: number;
}) {
  const cfg = providerConfig();
  if (cfg.mode === "fake") {
    return fakeExecution(params.sourceCode, params.expectedOutput, params.language);
  }

  const response = await fetch(`${cfg.baseUrl}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      script: params.sourceCode,
      stdin: params.stdin ?? "",
      language: params.language,
      versionIndex: params.versionIndex,
      compileOnly: false
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`JDoodle execute failed: ${response.status} ${text}`);
  }

  const result = await response.json();
  const stdout = normalizeNullableText(result.output);
  const stderr = normalizeNullableText(result.error);
  const compileOutput = normalizeNullableText(result.compilationStatus);
  const cpuSeconds = Number(result.cpuTime ?? 0) || 0;
  const timeMs = Math.round(cpuSeconds * 1000);
  const memoryKb = Number(result.memory ?? 0) || 0;
  const classified = classifyExecution({
    stdout,
    stderr,
    compileOutput,
    cpuSeconds,
    memoryKb,
    expectedOutput: params.expectedOutput,
    cpuLimitSeconds: params.cpuLimitSeconds,
    isCompiled: typeof result.isCompiled === "boolean" ? result.isCompiled : (result.isCompiled === 1 ? true : result.isCompiled === 0 ? false : null),
    isExecutionSuccess: result.isExecutionSuccess
  });

  return {
    token: `jdoodle_${Math.random().toString(36).slice(2, 10)}`,
    statusId: result.statusCode ?? (classified.statusDescription === "Accepted" ? 3 : 4),
    statusDescription: classified.statusDescription,
    verdict: classified.verdict,
    passed: classified.passed,
    stdout,
    stderr,
    compileOutput,
    timeMs,
    memoryKb
  } satisfies ExecutionResult;
}

export const dispatchSubmissionBatch = internalAction({
  args: { submissionId: v.string() },
  handler: async (ctx, args) => {
    const payload = await ctx.runQuery(api.submissions.getDispatchContext, { submissionId: args.submissionId });
    if (!payload) {
      await ctx.runMutation(internal.submissions.markFailed, { submissionId: args.submissionId, message: "Submission context missing" });
      return;
    }

    const runtime = resolveRuntime(payload.problem, payload.submission.languageId);
    await ctx.runMutation(internal.submissions.markBatchDispatched, {
      submissionId: args.submissionId,
      taskUpdates: payload.tasks.map((task, index) => ({
        taskId: task.id,
        token: `jdoodle_${payload.submission.id}_${index}`,
        statusId: 1,
        statusDescription: "Processing"
      }))
    });

    const taskResults = [] as Array<{
      taskId: string;
      token?: string;
      statusId?: number;
      statusDescription: string;
      verdict?: string;
      passed: boolean;
      stdout: string | null;
      stderr: string | null;
      compileOutput: string | null;
      timeMs: number;
      memoryKb: number;
      completedAt: string;
    }>;

    for (const task of payload.tasks) {
      try {
        const result = await executeWithJDoodle({
          sourceCode: payload.submission.sourceCode,
          stdin: task.stdin ?? "",
          expectedOutput: task.expectedOutput ?? "",
          language: runtime.jdoodleLanguage,
          versionIndex: runtime.versionIndex,
          cpuLimitSeconds: payload.problem.execution.cpuTimeLimitSeconds
        });
        taskResults.push({ ...result, taskId: task.id, completedAt: new Date().toISOString() });
      } catch (error) {
        taskResults.push({
          taskId: task.id,
          token: `jdoodle_error_${task.id}`,
          statusId: 13,
          statusDescription: "Judge Error",
          verdict: "Runtime Error",
          passed: false,
          stdout: null,
          stderr: error instanceof Error ? error.message : "JDoodle request failed",
          compileOutput: null,
          timeMs: 0,
          memoryKb: 0,
          completedAt: new Date().toISOString()
        });
      }
    }

    await ctx.runMutation(internal.submissions.completeBatchJudging, {
      submissionId: args.submissionId,
      taskResults
    });
  }
});

export const dispatchRun = internalAction({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const run = await ctx.runQuery(api.runs.getById, { runId: args.runId });
    if (!run) {
      await ctx.runMutation(internal.runs.markFailed, { runId: args.runId, message: "Run context missing" });
      return;
    }

    const problem = run.problemId ? await ctx.runQuery(api.contests.getProblemById, { problemId: run.problemId }) : null;
    const normalizedProblem = problem ? normalizeProblem(problem as any) : null;
    const runtime = resolveRuntime(normalizedProblem, run.languageId);

    await ctx.runMutation(internal.runs.markDispatched, { runId: args.runId, judgeToken: `jdoodle_${run.id}`, statusId: 1, statusDescription: "Processing" });

    try {
      const result = await executeWithJDoodle({
        sourceCode: run.sourceCode,
        stdin: run.stdin ?? "",
        expectedOutput: run.expectedOutput,
        language: runtime.jdoodleLanguage,
        versionIndex: runtime.versionIndex,
        cpuLimitSeconds: normalizedProblem?.execution.cpuTimeLimitSeconds
      });
      await ctx.runMutation(internal.runs.completeRun, {
        runId: args.runId,
        token: result.token,
        statusId: result.statusId,
        statusDescription: result.statusDescription,
        verdict: result.verdict,
        stdout: result.stdout,
        stderr: result.stderr,
        compileOutput: result.compileOutput,
        timeMs: result.timeMs,
        memoryKb: result.memoryKb
      });
    } catch (error) {
      await ctx.runMutation(internal.runs.markFailed, {
        runId: args.runId,
        message: error instanceof Error ? error.message : "JDoodle request failed"
      });
    }
  }
});
