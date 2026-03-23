import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Webhook } from "svix";

const http = httpRouter();

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "*";
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin"
  });
}

function jsonResponse(request: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: new Headers({
      "Content-Type": "application/json",
      ...Object.fromEntries(corsHeaders(request).entries())
    })
  });
}

function emptyOptions(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function addOptions(path: string) {
  http.route({
    path,
    method: "OPTIONS",
    handler: httpAction(async (_ctx, request) => emptyOptions(request))
  });
}

function getPrimaryEmail(data: any) {
  const primaryId = data?.primary_email_address_id;
  const addresses = Array.isArray(data?.email_addresses) ? data.email_addresses : [];
  const primary = addresses.find((entry: any) => entry.id === primaryId) || addresses[0];
  return primary?.email_address as string | undefined;
}

http.route({ path: "/api/bootstrap", method: "POST", handler: httpAction(async (ctx, request) => jsonResponse(request, await ctx.runMutation(api.seed.bootstrap, {}))) });
addOptions("/api/bootstrap");

http.route({
  path: "/api/users",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id") || undefined;
    const users = await ctx.runQuery(api.users.list, { ...(id ? { id } : {}) });
    if (id) return users[0] ? jsonResponse(request, users[0]) : jsonResponse(request, { message: "User not found" }, 404);
    return jsonResponse(request, users);
  })
});
addOptions("/api/users");

http.route({
  path: "/api/profile",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonResponse(request, { message: "User id is required" }, 400);
    const users = await ctx.runQuery(api.users.list, { id });
    return users[0] ? jsonResponse(request, users[0]) : jsonResponse(request, { message: "User not found" }, 404);
  })
});
http.route({
  path: "/api/profile/sync",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      return jsonResponse(request, await ctx.runMutation(api.users.syncFromClerk, body));
    } catch (error) {
      return jsonResponse(request, { message: error instanceof Error ? error.message : "Could not sync profile" }, 400);
    }
  })
});
http.route({
  path: "/api/profile/update",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      return jsonResponse(request, await ctx.runMutation(api.users.updateProfile, body));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update profile";
      if (message.includes("USERNAME_TAKEN")) {
        return jsonResponse(request, { message: "Username taken" }, 409);
      }
      if (message.includes("INVALID_USERNAME")) {
        return jsonResponse(request, { message: "Invalid username" }, 400);
      }
      if (message.includes("USER_NOT_FOUND")) {
        return jsonResponse(request, { message: "User not found" }, 404);
      }
      return jsonResponse(request, { message }, 400);
    }
  })
});
addOptions("/api/profile");
addOptions("/api/profile/sync");
addOptions("/api/profile/update");

http.route({
  path: "/api/clerk/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.CLERK_WEBHOOK_SECRET || process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    if (!secret) return jsonResponse(request, { message: "Missing Clerk webhook secret" }, 500);

    const payload = await request.text();
    const headers = {
      "svix-id": request.headers.get("svix-id") || "",
      "svix-timestamp": request.headers.get("svix-timestamp") || "",
      "svix-signature": request.headers.get("svix-signature") || ""
    };

    try {
      const event = new Webhook(secret).verify(payload, headers) as any;
      if (event.type === "user.created" || event.type === "user.updated") {
        const email = getPrimaryEmail(event.data);
        if (!email) return jsonResponse(request, { message: "Email missing in Clerk payload" }, 400);
        const fullName = [event.data?.first_name, event.data?.last_name].filter(Boolean).join(" ") || event.data?.full_name || undefined;
        const user = await ctx.runMutation(api.users.syncFromClerk, {
          clerkUserId: event.data.id,
          email,
          username: event.data?.username ?? undefined,
          fullName,
          imageUrl: event.data?.image_url ?? undefined
        });
        return jsonResponse(request, { ok: true, type: event.type, user });
      }

      if (event.type === "user.deleted") {
        if (event.data?.id) {
          await ctx.runMutation(api.users.removeById, { clerkUserId: event.data.id });
        }
        return jsonResponse(request, { ok: true, type: event.type });
      }

      return jsonResponse(request, { ok: true, ignored: true, type: event.type });
    } catch (error) {
      return jsonResponse(request, { message: error instanceof Error ? error.message : "Invalid Clerk webhook" }, 400);
    }
  })
});

http.route({
  path: "/api/contests",
  method: "GET",
  handler: httpAction(async (ctx, request) => jsonResponse(request, await ctx.runQuery(api.contests.list, {})))
});
http.route({
  path: "/api/contests",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    return jsonResponse(request, await ctx.runMutation(api.contests.create, body), 201);
  })
});
addOptions("/api/contests");

http.route({
  path: "/api/contest",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const contestId = new URL(request.url).searchParams.get("id");
    if (!contestId) return jsonResponse(request, { message: "Contest id is required" }, 400);
    try {
      return jsonResponse(request, await ctx.runQuery(api.contests.detail, { contestId }));
    } catch (error) {
      return jsonResponse(request, { message: error instanceof Error ? error.message : "Contest not found" }, 404);
    }
  })
});
addOptions("/api/contest");

http.route({
  path: "/api/join-request",
  method: "POST",
  handler: httpAction(async (ctx, request) => jsonResponse(request, await ctx.runMutation(api.contests.requestJoin, await request.json()), 201))
});
addOptions("/api/join-request");

http.route({
  path: "/api/join-request/review",
  method: "POST",
  handler: httpAction(async (ctx, request) => jsonResponse(request, await ctx.runMutation(api.contests.reviewJoinRequest, await request.json())))
});
addOptions("/api/join-request/review");

http.route({
  path: "/api/run-code",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const runId = new URL(request.url).searchParams.get("id");
    if (!runId) return jsonResponse(request, { message: "Run id is required" }, 400);
    const run = await ctx.runQuery(api.runs.getById, { runId });
    return run ? jsonResponse(request, run) : jsonResponse(request, { message: "Run not found" }, 404);
  })
});
http.route({
  path: "/api/run-code",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json().catch(() => ({}));
    try {
      const result = await ctx.runMutation(api.runs.queue, {
        sourceCode: body?.sourceCode ?? "",
        languageId: body?.languageId ?? 71,
        stdin: body?.stdin,
        expectedOutput: body?.expectedOutput,
        contestId: body?.contestId,
        problemId: body?.problemId,
        inputMode: body?.inputMode,
        sampleCaseId: body?.sampleCaseId,
        inputLabel: body?.inputLabel
      });
      return jsonResponse(request, result, 202);
    } catch (error) {
      return jsonResponse(request, { message: error instanceof Error ? error.message : "Run failed" }, 400);
    }
  })
});
addOptions("/api/run-code");

http.route({
  path: "/api/submissions",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const submissionId = new URL(request.url).searchParams.get("id");
    if (!submissionId) return jsonResponse(request, { message: "Submission id is required" }, 400);
    const submission = await ctx.runQuery(api.submissions.getById, { submissionId });
    return submission ? jsonResponse(request, submission) : jsonResponse(request, { message: "Submission not found" }, 404);
  })
});
http.route({
  path: "/api/submissions",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    try {
      const result = await ctx.runMutation(api.submissions.queue, body);
      return jsonResponse(request, result, 202);
    } catch (error) {
      return jsonResponse(request, { message: error instanceof Error ? error.message : "Submission failed" }, 400);
    }
  })
});
addOptions("/api/submissions");

export default http;
