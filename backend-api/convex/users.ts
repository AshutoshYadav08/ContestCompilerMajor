import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const roleValidator = v.union(v.literal("organiser"), v.literal("participant"));

function normalizeRoles(user: any): Array<"organiser" | "participant"> {
  const fromArray = Array.isArray(user.roles) && user.roles.length ? user.roles : null;
  if (fromArray) {
    return Array.from(new Set(fromArray.filter((role: string) => role === "organiser" || role === "participant"))) as Array<"organiser" | "participant">;
  }
  if (user.role === "organiser" || user.role === "participant") return [user.role];
  return ["participant", "organiser"];
}

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
    if (!existing || existing.id === currentUserId) {
      return attempt;
    }
    counter += 1;
    attempt = `${base.slice(0, Math.max(1, 24 - String(counter).length - 1))}_${counter}`;
  }
}

async function buildInitialUsername(
  ctx: any,
  args: { username?: string; fullName?: string; email: string; clerkUserId: string },
  currentUserId?: string
) {
  const seed = args.username || emailPrefix(args.email) || args.clerkUserId;
  return ensureUniqueUsername(ctx, seed, currentUserId);
}

export function normalizeUser(user: any) {
  const roles = normalizeRoles(user);
  const primaryName = user.username ? `@${user.username}` : user.fullName || user.name || user.email;
  return {
    id: user.id,
    name: primaryName,
    email: user.email,
    role: (roles[0] ?? user.role ?? "participant") as "organiser" | "participant",
    roles,
    rating: user.rating ?? 1500,
    ...(user.college ? { college: user.college } : {}),
    ...(user.username ? { username: user.username } : {}),
    ...(user.fullName ? { fullName: user.fullName } : {}),
    ...(user.organisation ? { organisation: user.organisation } : {}),
    ...(user.dob ? { dob: user.dob } : {}),
    ...(user.imageUrl ? { imageUrl: user.imageUrl } : {})
  };
}

export const list = query({
  args: {
    id: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    if (args.id) {
      const user = await ctx.db.query("users").withIndex("by_public_id", (q) => q.eq("id", args.id!)).unique();
      return user ? [normalizeUser(user)] : [];
    }

    const users = await ctx.db.query("users").collect();
    return users.map(normalizeUser);
  }
});

export const syncFromClerk = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    username: v.optional(v.string()),
    fullName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    roles: v.optional(v.array(roleValidator))
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("users").withIndex("by_public_id", (q) => q.eq("id", args.clerkUserId)).unique();
    const roles = args.roles?.length ? Array.from(new Set(args.roles)) : (existing?.roles?.length ? existing.roles : ["participant", "organiser"]);
    const username = existing?.username || await buildInitialUsername(ctx, args, existing?.id);
    const displayName = args.fullName || existing?.fullName || existing?.name || username || emailPrefix(args.email);
    const patch = {
      email: args.email,
      name: username ? `@${username}` : displayName,
      role: (existing?.role ?? roles[0] ?? "participant") as "organiser" | "participant",
      roles,
      rating: existing?.rating ?? 1500,
      username,
      ...(args.fullName !== undefined ? { fullName: args.fullName } : {}),
      ...(args.imageUrl !== undefined ? { imageUrl: args.imageUrl } : {})
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return normalizeUser({ ...existing, ...patch });
    }

    const inserted = {
      id: args.clerkUserId,
      ...patch
    };
    await ctx.db.insert("users", inserted);
    return normalizeUser(inserted);
  }
});

export const updateProfile = mutation({
  args: {
    userId: v.string(),
    username: v.optional(v.string()),
    fullName: v.optional(v.string()),
    organisation: v.optional(v.string()),
    dob: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_public_id", (q) => q.eq("id", args.userId)).unique();
    if (!user) throw new Error("USER_NOT_FOUND");

    const fullName = args.fullName?.trim();
    const rawUsername = args.username?.trim();
    let username = user.username || await buildInitialUsername(ctx, { email: user.email, fullName, username: rawUsername, clerkUserId: user.id }, user.id);

    if (rawUsername !== undefined) {
      username = cleanUsernameCandidate(rawUsername);
      if (username.length < 3) throw new Error("INVALID_USERNAME");
      const existing = await ctx.db.query("users").withIndex("by_username", (q) => q.eq("username", username)).unique();
      if (existing && existing._id !== user._id) throw new Error("USERNAME_TAKEN");
    }

    const patch = {
      username,
      ...(fullName !== undefined ? { fullName } : {}),
      ...(args.organisation !== undefined ? { organisation: args.organisation.trim() } : {}),
      ...(args.dob !== undefined ? { dob: args.dob } : {}),
      name: username ? `@${username}` : fullName || user.fullName || user.name || user.email
    };

    await ctx.db.patch(user._id, patch);
    return normalizeUser({ ...user, ...patch });
  }
});

export const removeById = mutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_public_id", (q) => q.eq("id", args.clerkUserId)).unique();
    if (!user) return { ok: true };
    await ctx.db.delete(user._id);
    return { ok: true };
  }
});
