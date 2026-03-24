"use client";

import { AlertIcon, CheckCircleIcon, ShieldIcon, UserIcon } from "@/components/Icons";
import { LoadingState } from "@/components/LoadingState";
import { PageScaffold } from "@/components/PageScaffold";
import { useAuth } from "@/context/AuthContext";
import { updateMyProfile } from "@/lib/apiClient";
import { getUserDisplayName, getUserSecondaryLabel } from "@/lib/userDisplay";
import { useEffect, useState } from "react";

const inputClassName = "w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500";

export default function ProfilePage() {
  const { user, loading, refreshUser } = useAuth();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [dob, setDob] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUsername(user?.username ?? "");
    setFullName(user?.fullName ?? user?.name ?? "");
    setOrganisation(user?.organisation ?? "");
    setDob(user?.dob ?? "");
  }, [user]);

  if (loading) return <LoadingState label="Loading your profile..." />;

  if (!user) {
    return <div className="rounded border border-amber-600 bg-amber-950 p-4">Sign in to access your profile.</div>;
  }

  const secondary = getUserSecondaryLabel(user);

  return (
    <PageScaffold
      title="Profile"
      titleIcon={<UserIcon />}
      description="Manage the name and details other users see across contests and submissions."
      bodyClassName="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]"
    >
      <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
            <UserIcon size={24} />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-100">{getUserDisplayName(user)}</p>
            {secondary ? <p className="text-sm text-slate-400">{secondary}</p> : null}
            <p className="mt-1 text-xs text-slate-500">{user.email}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <ShieldIcon size={16} className="text-emerald-300" />
            Profile tips
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li>• Username must stay unique across the platform.</li>
            <li>• Lowercase letters, numbers, and underscores work best.</li>
            <li>• This handle appears in standings, join requests, and submission updates.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-sm font-medium text-slate-200">Available dashboards</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-200">
            {(user.roles?.length ? user.roles : [user.role]).map((role) => (
              <span key={role} className="rounded-full border border-emerald-600/40 bg-emerald-500/10 px-3 py-1 capitalize text-emerald-200">
                {role}
              </span>
            ))}
          </div>
        </div>
      </aside>

      <form
        className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setMessage("");
          try {
            await updateMyProfile({
              username: username.trim(),
              fullName: fullName.trim(),
              organisation: organisation.trim(),
              dob: dob || undefined,
            });
            await refreshUser();
            setMessage("Profile updated successfully.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not update profile");
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="shrink-0 border-b border-slate-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-100">Basic details</h2>
          <p className="mt-1 text-sm text-slate-400">Keep your contest identity clear and easy to recognise.</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Username</label>
              <input value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} className={inputClassName} placeholder="ashu_codes" />
              <p className="text-xs text-slate-500">Shown as @{username || "your_handle"} in standings.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Full name</label>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClassName} placeholder="Ashutosh Yadav" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Organisation</label>
              <input value={organisation} onChange={(event) => setOrganisation(event.target.value)} className={inputClassName} placeholder="College, company, or community" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Date of birth</label>
              <input value={dob} onChange={(event) => setDob(event.target.value)} type="date" className={inputClassName} />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm text-slate-300">Email</label>
              <input value={user.email} readOnly className={`${inputClassName} cursor-not-allowed opacity-70`} />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-800 bg-slate-950/80 px-5 py-4">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              {message ? (
                message.toLowerCase().includes("success") ? (
                  <CheckCircleIcon size={16} className="text-emerald-300" />
                ) : (
                  <AlertIcon size={16} className="text-amber-300" />
                )
              ) : null}
              <span>{message || "Save your changes to update how your profile appears in contests."}</span>
            </div>
            <button type="submit" disabled={saving} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto w-full">
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </div>
      </form>
    </PageScaffold>
  );
}
