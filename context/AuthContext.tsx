"use client";

import { User } from "@/types";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type DashboardRole = "organiser" | "participant";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  clerkLoading: boolean;
  syncError: string | null;
  activeRole: DashboardRole;
  setActiveRole: (role: DashboardRole) => void;
  canAccessRole: (role: DashboardRole) => boolean;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function readCurrentUser(): Promise<User | null> {
  const response = await fetch("/api/me", { cache: "no-store" });
  if (response.status === 401 || response.status === 404) return null;
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || "Failed to load current user");
  }
  return response.json();
}

async function syncCurrentUser(): Promise<User | null> {
  const response = await fetch("/api/me/sync", {
    method: "POST",
    cache: "no-store",
  });
  if (response.status === 401) return null;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || "Could not sync your account");
  }
  return payload;
}

function fallbackUsernameFromClerk(clerkUser: ReturnType<typeof useUser>["user"], email: string) {
  const source = (clerkUser?.username || email.split("@")[0] || "coder")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 24);
  return source || "coder";
}

function fallbackUserFromClerk(
  clerkUser: ReturnType<typeof useUser>["user"]
): User | null {
  if (!clerkUser) return null;

  const email =
    clerkUser.emailAddresses.find(
      (entry) => entry.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ||
    clerkUser.emailAddresses[0]?.emailAddress ||
    "";

  const username = fallbackUsernameFromClerk(clerkUser, email);

  return {
    id: clerkUser.id,
    name: `@${username}`,
    email,
    role: "participant",
    roles: ["participant", "organiser"],
    rating: 1500,
    username,
    fullName: clerkUser.fullName ?? undefined,
    imageUrl: clerkUser.imageUrl ?? undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const clerk = useClerk();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [activeRole, setActiveRoleState] =
    useState<DashboardRole>("participant");

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const canAccessRole = (role: DashboardRole) => {
    if (!user) return false;
    const roles = user.roles?.length ? user.roles : [user.role];
    return roles.includes(role);
  };

  const loadUser = async (allowSync = true) => {
    const existing = await readCurrentUser();
    if (existing) {
      setUser(existing);
      setSyncError(null);
      return existing;
    }

    if (!allowSync) return null;

    const synced = await syncCurrentUser();
    if (synced) {
      setUser(synced);
      setSyncError(null);
      return synced;
    }
    return null;
  };

  useEffect(() => {
    if (!isLoaded) return;

    clearRetryTimer();

    if (!isSignedIn) {
      setUser(null);
      setSyncError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSyncError(null);

    (async () => {
      try {
        const nextUser = await loadUser(true);
        if (cancelled) return;
        setUser(nextUser ?? fallbackUserFromClerk(clerkUser));
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "Could not sync your account";
        console.error("Profile sync failed:", error);
        setSyncError(message);
        setUser(fallbackUserFromClerk(clerkUser));

        retryTimerRef.current = setTimeout(async () => {
          try {
            const recovered = await loadUser(false);
            if (!cancelled && recovered) {
              setUser(recovered);
              setSyncError(null);
            }
          } catch (retryError) {
            console.error("Profile retry failed:", retryError);
          }
        }, 2500);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearRetryTimer();
    };
  }, [isLoaded, isSignedIn, clerkUser?.id]);

  useEffect(() => {
    if (!user) {
      setActiveRoleState("participant");
      return;
    }

    const storageKey = `dashboard-role:${user.id}`;
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(storageKey)
        : null;

    const roles = user.roles?.length ? user.roles : [user.role];
    const fallback = roles.includes("participant") ? "participant" : roles[0];
    const nextRole =
      saved && roles.includes(saved as DashboardRole)
        ? (saved as DashboardRole)
        : (fallback as DashboardRole);

    setActiveRoleState(nextRole);
  }, [user]);

  const setActiveRole = (role: DashboardRole) => {
    if (!user) return;
    if (!canAccessRole(role)) return;

    setActiveRoleState(role);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(`dashboard-role:${user.id}`, role);
    }
  };

  const refreshUser = async () => {
    if (!isSignedIn) {
      setUser(null);
      setSyncError(null);
      return;
    }

    try {
      const nextUser =
        (await readCurrentUser()) ??
        (await syncCurrentUser()) ??
        fallbackUserFromClerk(clerkUser);

      setUser(nextUser);
      setSyncError(null);
    } catch (error) {
      console.error("Refresh profile failed:", error);
      setSyncError(
        error instanceof Error ? error.message : "Could not refresh profile"
      );
      setUser(fallbackUserFromClerk(clerkUser));
    }
  };

  const signOut = async () => {
    await clerk.signOut({ redirectUrl: "/" });
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      clerkLoading: !isLoaded,
      syncError,
      activeRole,
      setActiveRole,
      canAccessRole,
      refreshUser,
      signOut,
    }),
    [user, loading, isLoaded, syncError, activeRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
