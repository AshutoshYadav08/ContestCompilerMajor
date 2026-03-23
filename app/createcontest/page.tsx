"use client";

import { AlertIcon, ArrowLeftIcon, BookIcon, CalendarIcon, CheckCircleIcon, ClockIcon, PlusIcon, ShieldIcon, SparklesIcon } from "@/components/Icons";
import { PageScaffold } from "@/components/PageScaffold";
import { useAuth } from "@/context/AuthContext";
import { createContest } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type ProblemDraft = {
  title: string;
  code: string;
  statement: string;
  constraints: string;
  points: number;
  sampleInput: string;
  sampleOutput: string;
  sampleExplanation: string;
  hiddenInput: string;
  hiddenOutput: string;
  cpuTimeLimitSeconds: number;
  memoryLimitKb: number;
};

const blankProblem = (): ProblemDraft => ({
  title: "",
  code: "",
  statement: "",
  constraints: "1 <= n <= 2e5",
  points: 100,
  sampleInput: "",
  sampleOutput: "",
  sampleExplanation: "",
  hiddenInput: "",
  hiddenOutput: "",
  cpuTimeLimitSeconds: 2,
  memoryLimitKb: 262144,
});

type CreateTab = "contest" | "problems";

type FieldProps = { label: string; hint?: string; children: ReactNode };
function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

export default function CreateContestPage() {
  const { user, activeRole } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<CreateTab>("contest");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [registrationMode, setRegistrationMode] = useState<"open" | "approval">("approval");
  const [wrongAttemptPenaltyMinutes, setWrongAttemptPenaltyMinutes] = useState(10);
  const [problems, setProblems] = useState<ProblemDraft[]>([blankProblem(), blankProblem()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successHint, setSuccessHint] = useState("");
  const [minStartTime, setMinStartTime] = useState("");

  const inputClassName = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500";

  useEffect(() => {
    const pad = (value: number) => String(value).padStart(2, "0");
    const now = new Date(Date.now() + 60 * 1000);
    const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setMinStartTime(local);
  }, []);

  const updateProblem = (index: number, field: keyof ProblemDraft, value: string | number) => {
    setProblems((prev) => prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  };

  const canSubmit = useMemo(
    () =>
      Boolean(name.trim()) &&
      Boolean(startTime) &&
      problems.length > 0 &&
      problems.every((problem) => problem.title.trim() && problem.code.trim() && problem.statement.trim() && problem.sampleInput.trim() && problem.sampleOutput.trim()),
    [name, startTime, problems]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const chosenStart = new Date(startTime);
    if (!startTime || Number.isNaN(chosenStart.getTime())) {
      setFormError("Choose a valid future start date and time.");
      return;
    }
    if (chosenStart.getTime() <= Date.now()) {
      setFormError("Contest start time must be in the future.");
      return;
    }

    setFormError("");
    setSaving(true);
    setSuccessHint("");
    try {
      const contestId = await createContest({
        name,
        description,
        startTime: chosenStart.toISOString(),
        durationMinutes,
        registrationMode,
        wrongAttemptPenaltyMinutes,
        scoringMode: "points",
        problems: problems.map((problem) => ({
          ...problem,
          sampleExplanation: problem.sampleExplanation || undefined,
          hiddenInput: problem.hiddenInput || undefined,
          hiddenOutput: problem.hiddenOutput || undefined,
        })),
      });
      setSuccessHint("Contest created. Redirecting to dashboard...");
      router.push(`/contest/${contestId}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create contest");
    } finally {
      setSaving(false);
    }
  };

  if (!user || activeRole !== "organiser") {
    return <div className="rounded border border-amber-600 bg-amber-950 p-4">Switch to organiser dashboard to create a contest.</div>;
  }

  const tabs: Array<{ key: CreateTab; label: string; icon: ReactNode }> = [
    { key: "contest", label: "Contest setup", icon: <CalendarIcon size={16} /> },
    { key: "problems", label: `Problems (${problems.length})`, icon: <BookIcon size={16} /> },
  ];

  return (
    <PageScaffold
      title="Create Contest"
      titleIcon={<SparklesIcon />}
      description={<span>Set the schedule, add problems, and publish when ready.</span>}
      bodyClassName="p-0"
    >
      <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
        <div className="sticky top-0 z-20 shrink-0 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${activeTab === tab.key ? "bg-emerald-700 text-white" : "bg-slate-900 text-slate-300 hover:bg-slate-800"}`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
              {activeTab === "contest" ? "Schedule, registration, and penalties" : "Problem authoring and hidden-judge setup"}
            </div>
          </div>
          {formError ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-700 bg-rose-950/70 px-3 py-2 text-sm text-rose-200">
              <AlertIcon size={16} /> {formError}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {activeTab === "contest" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:col-span-2 xl:col-span-3">
                <div className="flex items-center gap-2 text-slate-200">
                  <ShieldIcon size={16} className="text-emerald-300" />
                  <span className="font-medium">Contest shell</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">You no longer need clutter like visibility or freeze settings here. The contest is driven by schedule, registration mode, and scoring rules.</p>
              </div>
              <Field label="Contest name">
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClassName} placeholder="Weekly Algo Arena" required />
              </Field>
              <Field label="Start date and time">
                <input value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClassName} type="datetime-local" min={minStartTime || undefined} required />
              </Field>
              <Field label="Duration" hint="Minutes">
                <input value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className={inputClassName} type="number" min={10} required />
              </Field>
              <Field label="Registration mode" hint="Open auto-approves. Approval uses the lobby.">
                <select value={registrationMode} onChange={(e) => setRegistrationMode(e.target.value as "open" | "approval")} className={inputClassName}>
                  <option value="approval">Approval required</option>
                  <option value="open">Open join</option>
                </select>
              </Field>
              <Field label="Wrong attempt penalty" hint="Minutes per wrong attempt before AC">
                <input value={wrongAttemptPenaltyMinutes} onChange={(e) => setWrongAttemptPenaltyMinutes(Number(e.target.value))} className={inputClassName} type="number" min={0} required />
              </Field>
              <Field label="Description">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClassName} min-h-[120px]`} placeholder="Arrays, DP, and data structures warm-up contest." />
              </Field>
            </div>
          ) : (
            <div className="space-y-5 pb-2">
              {problems.map((problem, index) => (
                <div key={index} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">Problem {index + 1}</p>
                      <p className="text-xs text-slate-400">One public sample plus one hidden judge case by default. Hidden input/output can mirror the sample if left blank.</p>
                    </div>
                    {problems.length > 1 && (
                      <button type="button" onClick={() => setProblems((prev) => prev.filter((_, i) => i !== index))} className="rounded-xl border border-rose-600 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-600/10">
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Problem title"><input value={problem.title} onChange={(e) => updateProblem(index, "title", e.target.value)} className={inputClassName} required /></Field>
                    <Field label="Problem code"><input value={problem.code} onChange={(e) => updateProblem(index, "code", e.target.value.toUpperCase())} className={inputClassName} required /></Field>
                    <Field label="Points"><input value={problem.points} onChange={(e) => updateProblem(index, "points", Number(e.target.value))} className={inputClassName} type="number" min={1} required /></Field>
                    <Field label="CPU time limit" hint="Seconds"><input value={problem.cpuTimeLimitSeconds} onChange={(e) => updateProblem(index, "cpuTimeLimitSeconds", Number(e.target.value))} className={inputClassName} type="number" min={1} required /></Field>
                    <Field label="Memory limit" hint="KB"><input value={problem.memoryLimitKb} onChange={(e) => updateProblem(index, "memoryLimitKb", Number(e.target.value))} className={inputClassName} type="number" min={1024} required /></Field>
                    <Field label="Constraints"><textarea value={problem.constraints} onChange={(e) => updateProblem(index, "constraints", e.target.value)} className={`${inputClassName} min-h-[90px]`} /></Field>
                    <Field label="Problem statement"><textarea value={problem.statement} onChange={(e) => updateProblem(index, "statement", e.target.value)} className={`${inputClassName} min-h-[170px] md:col-span-2 xl:col-span-3`} required /></Field>
                    <Field label="Sample input"><textarea value={problem.sampleInput} onChange={(e) => updateProblem(index, "sampleInput", e.target.value)} className={`${inputClassName} min-h-[120px]`} required /></Field>
                    <Field label="Sample output"><textarea value={problem.sampleOutput} onChange={(e) => updateProblem(index, "sampleOutput", e.target.value)} className={`${inputClassName} min-h-[120px]`} required /></Field>
                    <Field label="Sample explanation"><textarea value={problem.sampleExplanation} onChange={(e) => updateProblem(index, "sampleExplanation", e.target.value)} className={`${inputClassName} min-h-[120px]`} placeholder="Optional explanation shown below the sample." /></Field>
                    <Field label="Hidden test input"><textarea value={problem.hiddenInput} onChange={(e) => updateProblem(index, "hiddenInput", e.target.value)} className={`${inputClassName} min-h-[120px]`} placeholder="Leave blank to mirror the sample." /></Field>
                    <Field label="Hidden test output"><textarea value={problem.hiddenOutput} onChange={(e) => updateProblem(index, "hiddenOutput", e.target.value)} className={`${inputClassName} min-h-[120px]`} placeholder="Leave blank to mirror the sample." /></Field>
                  </div>
                </div>
              ))}

              <button type="button" onClick={() => setProblems((prev) => [...prev, blankProblem()])} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500">
                <PlusIcon size={16} /> Add another problem
              </button>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-20 shrink-0 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              {successHint ? <CheckCircleIcon size={16} className="text-emerald-300" /> : <ClockIcon size={16} className="text-slate-500" />}
              <span>{successHint || "Action buttons stay fixed here while the form content scrolls."}</span>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500">
                <ArrowLeftIcon size={16} /> Cancel
              </button>
              <button type="submit" disabled={!canSubmit || saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">
                <CheckCircleIcon size={16} /> {saving ? "Creating..." : "Create contest"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </PageScaffold>
  );
}
