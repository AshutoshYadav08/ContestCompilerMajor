import { makeId, normalizeContest } from "./utils";

function latestIso(a?: string, b?: string) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export async function ensureContestStateForParticipant(ctx: any, contestDoc: any, participantId: string) {
  const contest = normalizeContest(contestDoc);

  for (const problemId of contest.problemIds) {
    const existing = await ctx.db
      .query("participantProblemStates")
      .withIndex("by_contest_participant_problem", (q: any) =>
        q.eq("contestId", contest.id).eq("participantId", participantId).eq("problemId", problemId)
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("participantProblemStates", {
        id: makeId("pps"),
        contestId: contest.id,
        participantId,
        problemId,
        attempts: 0,
        wrongAttemptsBeforeAccepted: 0,
        solved: false,
        bestScore: 0
      });
    }
  }

  const standing = await ctx.db
    .query("standings")
    .withIndex("by_contest_participant", (q: any) => q.eq("contestId", contest.id).eq("participantId", participantId))
    .unique();

  if (!standing) {
    await ctx.db.insert("standings", {
      id: makeId("st"),
      contestId: contest.id,
      participantId,
      solved: 0,
      score: 0,
      penalty: 0,
      updatedAt: new Date().toISOString()
    });
  }
}

export async function recomputeStandingForParticipant(ctx: any, contestDoc: any, participantId: string) {
  const contest = normalizeContest(contestDoc);
  const states = await ctx.db
    .query("participantProblemStates")
    .withIndex("by_contest_participant", (q: any) => q.eq("contestId", contest.id).eq("participantId", participantId))
    .collect();

  const solved = states.filter((state: any) => state.solved).length;
  const score = states.reduce((sum: number, state: any) => sum + state.bestScore, 0);
  const penalty = states.reduce(
    (sum: number, state: any) => sum + state.wrongAttemptsBeforeAccepted * contest.ruleSet.wrongAttemptPenaltyMinutes,
    0
  );
  const lastAcceptedAt = states.reduce((latest: string | undefined, state: any) => latestIso(latest, state.acceptedAt), undefined);

  const standing = await ctx.db
    .query("standings")
    .withIndex("by_contest_participant", (q: any) => q.eq("contestId", contest.id).eq("participantId", participantId))
    .unique();

  const payload = {
    contestId: contest.id,
    participantId,
    solved,
    score,
    penalty,
    ...(lastAcceptedAt ? { lastAcceptedAt } : {}),
    updatedAt: new Date().toISOString()
  };

  if (standing) {
    await ctx.db.patch(standing._id, payload);
  } else {
    await ctx.db.insert("standings", { id: makeId("st"), ...payload });
  }
}

export async function applyJudgedSubmissionToDerivedState(ctx: any, contestDoc: any, submission: any) {
  const contest = normalizeContest(contestDoc);
  await ensureContestStateForParticipant(ctx, contest, submission.participantId);

  const state = await ctx.db
    .query("participantProblemStates")
    .withIndex("by_contest_participant_problem", (q: any) =>
      q.eq("contestId", contest.id).eq("participantId", submission.participantId).eq("problemId", submission.problemId)
    )
    .unique();

  if (!state) throw new Error("Participant problem state missing");

  const verdict = submission.verdict ?? submission.status;
  const patch: Record<string, any> = {
    attempts: state.attempts + 1,
    lastSubmissionAt: submission.submittedAt,
    bestScore: Math.max(state.bestScore, submission.score),
    latestVerdict: verdict
  };

  if (!state.solved) {
    if (verdict === "Accepted") {
      patch.solved = true;
      patch.acceptedAt = submission.submittedAt;
    } else {
      patch.wrongAttemptsBeforeAccepted = state.wrongAttemptsBeforeAccepted + 1;
    }
  }

  await ctx.db.patch(state._id, patch);
  await recomputeStandingForParticipant(ctx, contest, submission.participantId);
}

export async function rebuildDerivedState(ctx: any) {
  for (const row of await ctx.db.query("participantProblemStates").collect()) {
    await ctx.db.delete(row._id);
  }
  for (const row of await ctx.db.query("standings").collect()) {
    await ctx.db.delete(row._id);
  }

  const contests = await ctx.db.query("contests").collect();
  for (const contest of contests) {
    for (const participantId of contest.participants) {
      await ensureContestStateForParticipant(ctx, contest, participantId);
    }
  }

  const submissions = await ctx.db.query("submissions").collect();
  submissions.sort((a: any, b: any) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  for (const submission of submissions) {
    if ((submission.pipelineStatus ?? "judged") !== "judged") continue;
    if (!(submission.verdict ?? submission.status)) continue;
    const contest = contests.find((item: any) => item.id === submission.contestId);
    if (!contest || !contest.participants.includes(submission.participantId)) continue;
    await applyJudgedSubmissionToDerivedState(ctx, contest, submission);
  }
}
