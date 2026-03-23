"use client";

import { LoadingState } from "@/components/LoadingState";
import { PageScaffold } from "@/components/PageScaffold";
import { useAuth } from "@/context/AuthContext";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

export default function LoginTestPage() {
  const { user, loading, activeRole } = useAuth();

  if (loading) return <LoadingState label="Checking auth state..." />;

  return (
    <PageScaffold
      title="Auth status"
      description="Use this page to verify sign-in and profile sync."
      bodyClassName="space-y-6"
    >
      {user ? (
        <div className="rounded border border-slate-700 bg-slate-800 p-4 text-sm text-slate-200">
          <p><span className="text-slate-400">User ID:</span> {user.id}</p>
          <p><span className="text-slate-400">Name:</span> {user.name}</p>
          <p><span className="text-slate-400">Email:</span> {user.email}</p>
          <p><span className="text-slate-400">Active dashboard:</span> {activeRole}</p>
          <p><span className="text-slate-400">Available dashboards:</span> {(user.roles?.length ? user.roles : [user.role]).join(", ")}</p>
        </div>
      ) : (
        <div className="rounded border border-slate-700 bg-slate-800 p-4 text-sm text-slate-200">
          <p className="mb-4">You are currently signed out.</p>
          <div className="flex gap-2">
            <SignInButton mode="modal">
              <button className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600">Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded bg-emerald-700 px-4 py-2 hover:bg-emerald-600">Create account</button>
            </SignUpButton>
          </div>
        </div>
      )}
    </PageScaffold>
  );
}
