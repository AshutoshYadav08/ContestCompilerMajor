import { User } from "@/types";

export function getUserDisplayName(user?: Partial<User> | null) {
  if (!user) return "Unknown user";
  if (user.username?.trim()) return `@${user.username.trim()}`;
  if (user.fullName?.trim()) return user.fullName.trim();
  if (user.name?.trim()) return user.name.trim();
  if (user.email?.trim()) return user.email.trim();
  return "Unknown user";
}

export function getUserSecondaryLabel(user?: Partial<User> | null) {
  if (!user) return "";
  if (user.username?.trim() && user.fullName?.trim()) return user.fullName.trim();
  if (user.email?.trim()) return user.email.trim();
  return "";
}
