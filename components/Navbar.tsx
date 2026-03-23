"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ContestTimer } from "@/components/ContestTimer";
import { fetchContestDetail } from "@/lib/apiClient";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { FolderIcon, HomeIcon, LayoutIcon, PlusIcon, TrophyIcon, UserIcon, UsersIcon } from "@/components/Icons";

export function Navbar() {
  const { user, activeRole, setActiveRole, canAccessRole } = useAuth();
  const { isLoaded: clerkLoaded } = useUser();
  const pathname = usePathname();
  const [problemContestTimer, setProblemContestTimer] = useState<{ startTime: string; durationMinutes: number } | null>(null);

  const problemContestId = useMemo(() => {
    const match = pathname.match(/^\/contest\/([^/]+)\/[^/]+$/);
    return match?.[1] ?? null;
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    if (!problemContestId) {
      setProblemContestTimer(null);
      return;
    }

    fetchContestDetail(problemContestId)
      .then((detail) => {
        if (cancelled) return;
        setProblemContestTimer({
          startTime: detail.contest.startTime,
          durationMinutes: detail.contest.durationMinutes,
        });
      })
      .catch(() => {
        if (!cancelled) setProblemContestTimer(null);
      });

    return () => {
      cancelled = true;
    };
  }, [problemContestId]);

  const showRoleSwitcher = !!user && (canAccessRole("participant") || canAccessRole("organiser"));

  const navItems = user
    ? activeRole === "participant"
      ? [
          { href: "/", label: "Home", icon: HomeIcon },
          { href: "/history-participation", label: "Participation", icon: TrophyIcon },
        ]
      : [
          { href: "/", label: "Home", icon: HomeIcon },
          { href: "/history-contests", label: "Contests", icon: FolderIcon },
          { href: "/createcontest", label: "Create", icon: PlusIcon },
        ]
    : [{ href: "/", label: "Home", icon: HomeIcon }];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-semibold text-emerald-300">
            <LayoutIcon className="text-emerald-400" />
            <span>Contest Compiler</span>
          </Link>

          <nav className="hidden items-center gap-1 text-sm text-slate-200 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 transition ${
                    active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {problemContestTimer && (
            <ContestTimer startTime={problemContestTimer.startTime} durationMinutes={problemContestTimer.durationMinutes} mini />
          )}

          {user && (
            <Link
              href="/profile"
              className="hidden items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 md:inline-flex"
            >
              <UserIcon size={16} />
              <span>Profile</span>
            </Link>
          )}

          {showRoleSwitcher && (
            <div className="hidden items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 md:flex">
              <UsersIcon size={16} className="text-slate-400" />
              <select
                value={activeRole}
                onChange={(event) => setActiveRole(event.target.value as "organiser" | "participant")}
                className="rounded bg-transparent px-2 py-1 text-sm text-slate-100 outline-none"
              >
                {canAccessRole("participant") && <option value="participant">Participant</option>}
                {canAccessRole("organiser") && <option value="organiser">Organiser</option>}
              </select>
            </div>
          )}

          {!clerkLoaded ? (
            <div className="h-8 w-24 animate-pulse rounded bg-slate-800" />
          ) : (
            <>
              <SignedIn>
                <>
                  <span className="hidden max-w-[160px] truncate text-sm text-slate-300 md:inline">{user?.username ? `@${user.username}` : user?.name ?? "Signed in"}</span>
                  <UserButton afterSignOutUrl="/" />
                </>
              </SignedIn>

              <SignedOut>
                <div className="flex items-center gap-2">
                  <SignInButton mode="modal">
                    <button className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:border-slate-500">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-600">
                      Sign up
                    </button>
                  </SignUpButton>
                </div>
              </SignedOut>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-slate-900 px-4 py-2 text-sm text-slate-300 md:hidden">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${
                  active ? "bg-slate-800 text-white" : "bg-slate-900 text-slate-300"
                }`}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {user && (
            <Link href="/profile" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5">
              <UserIcon size={15} />
              <span>Profile</span>
            </Link>
          )}

          {showRoleSwitcher && (
            <select
              value={activeRole}
              onChange={(event) => setActiveRole(event.target.value as "organiser" | "participant")}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-slate-100 outline-none"
            >
              {canAccessRole("participant") && <option value="participant">Participant</option>}
              {canAccessRole("organiser") && <option value="organiser">Organiser</option>}
            </select>
          )}
        </div>
      </div>
    </header>
  );
}
