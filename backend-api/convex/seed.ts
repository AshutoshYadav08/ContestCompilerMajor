import { mutation } from "./_generated/server";
import { rebuildDerivedState } from "./state";
import { DEFAULT_RUNTIMES, normalizeProblem } from "./utils";

function cleanUsernameCandidate(value?: string | null) {
  const cleaned = (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 24);
  return cleaned || "coder";
}

function emailPrefix(email: string) {
  return email.split("@")[0] || "coder";
}

async function ensureUniqueUsername(ctx: any, desired: string, currentUserId?: string) {
  const base = cleanUsernameCandidate(desired);
  let attempt = base;
  let counter = 0;
  while (true) {
    const existing = await ctx.db.query("users").withIndex("by_username", (q: any) => q.eq("username", attempt)).unique();
    if (!existing || existing.id === currentUserId) return attempt;
    counter += 1;
    attempt = `${base.slice(0, Math.max(1, 24 - String(counter).length - 1))}_${counter}`;
  }
}

async function backfillLegacyShape(ctx: any) {
  const users = await ctx.db.query("users").collect();
  for (const user of users) {
    const username = user.username || await ensureUniqueUsername(ctx, emailPrefix(user.email) || user.id, user.id);
    await ctx.db.patch(user._id, {
      username,
      name: username ? `@${username}` : user.name,
    });
  }

  const problems = await ctx.db.query("problems").collect();
  for (const problem of problems) {
    const normalized = normalizeProblem(problem as any);
    await ctx.db.patch(problem._id, {
      samples: normalized.samples,
      hiddenTests: normalized.hiddenTests,
      execution: normalized.execution,
      checkerMode: normalized.checkerMode,
      tags: normalized.tags ?? [],
    });
  }

  const contests = await ctx.db.query("contests").collect();
  for (const contest of contests) {
    const startTime = contest.schedule?.startAt ?? contest.startTime;
    const durationMinutes = contest.schedule?.durationMinutes ?? contest.durationMinutes ?? 90;
    const endTime = contest.schedule?.endAt ?? new Date(new Date(startTime).getTime() + durationMinutes * 60 * 1000).toISOString();
    await ctx.db.patch(contest._id, {
      schedule: { startAt: startTime, endAt: endTime, durationMinutes },
      registrationMode: contest.registrationMode ?? (contest.visibility === "private" ? "approval" : "open"),
      ruleSet:
        contest.ruleSet ??
        {
          scoringMode: "points",
          wrongAttemptPenaltyMinutes: contest.settings?.penaltyPerWrongMinutes ?? 10,
          maxAttemptsPerProblem: contest.settings?.maxSubmissionsPerProblem ?? 60,
        },
    });
  }

  const submissions = await ctx.db.query("submissions").collect();
  for (const submission of submissions) {
    const shouldPatchLanguage = typeof submission.languageId === "number" && !submission.language;
    if (shouldPatchLanguage) {
      const runtime = DEFAULT_RUNTIMES.find((item) => item.id === submission.languageId) ?? DEFAULT_RUNTIMES[0];
      await ctx.db.patch(submission._id, { language: runtime.label });
    }
  }
}

export const bootstrap = mutation({
  args: {},
  handler: async (ctx) => {
    await backfillLegacyShape(ctx);
    await rebuildDerivedState(ctx);

    return {
      seeded: false,
      rebuilt: true,
      counts: {
        users: (await ctx.db.query("users").collect()).length,
        problems: (await ctx.db.query("problems").collect()).length,
        contests: (await ctx.db.query("contests").collect()).length,
        joinRequests: (await ctx.db.query("joinRequests").collect()).length,
        submissions: (await ctx.db.query("submissions").collect()).length,
        judgeTasks: (await ctx.db.query("judgeTasks").collect()).length,
        standings: (await ctx.db.query("standings").collect()).length,
        participantProblemStates: (await ctx.db.query("participantProblemStates").collect()).length,
      },
    };
  },
});
