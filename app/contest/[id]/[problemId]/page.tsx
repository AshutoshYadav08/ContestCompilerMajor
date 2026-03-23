"use client";

import { LoadingState } from "@/components/LoadingState";
import { MonacoCodeEditor } from "@/components/MonacoCodeEditor";
import { useAuth } from "@/context/AuthContext";
import { fetchContestDetail, fetchRunExecution, fetchSubmission, runCode, submitCode } from "@/lib/apiClient";
import { PipelineStatus, RunExecution, RuntimeSpec, Submission } from "@/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const boilerplates: Record<number, string> = {
  71: `import sys


def solve() -> None:
    data = sys.stdin.read().strip().split()
    # Write your solution here
    print()


if __name__ == "__main__":
    solve()
`,
  54: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // Write your solution here

    return 0;
}
`,
  62: `import java.io.*;
import java.util.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        // Write your solution here
    }
}
`,
  63: `"use strict";

const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim();

// Write your solution here
console.log("");
`
};

function getBoilerplate(languageId: number) {
  return boilerplates[languageId] ?? `# Write your solution here
`;
}

const fallbackLanguages: RuntimeSpec[] = [
  { id: 71, label: "Python 3", monaco: "python", jdoodleLanguage: "python3", versionIndex: "5" },
  { id: 54, label: "C++17", monaco: "cpp", jdoodleLanguage: "cpp17", versionIndex: "2" },
  { id: 62, label: "Java 21", monaco: "java", jdoodleLanguage: "java", versionIndex: "5" },
  { id: 63, label: "JavaScript", monaco: "javascript", jdoodleLanguage: "nodejs", versionIndex: "6" }
];

type LeftTab = "statement" | "submissions";
type LatestKind = "run" | "submission";

function badgeClass(status?: string, pipelineStatus?: PipelineStatus) {
  if (pipelineStatus === "queued" || pipelineStatus === "processing") return "border border-amber-500/30 bg-amber-500/20 text-amber-300";
  if (pipelineStatus === "failed") return "border border-rose-500/30 bg-rose-500/20 text-rose-300";
  if ((status ?? "").toLowerCase().includes("accepted") || (status ?? "").toLowerCase().includes("finished")) return "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300";
  if ((status ?? "").toLowerCase().includes("wrong") || (status ?? "").toLowerCase().includes("runtime") || (status ?? "").toLowerCase().includes("time") || (status ?? "").toLowerCase().includes("memory") || (status ?? "").toLowerCase().includes("compilation")) return "border border-rose-500/30 bg-rose-500/20 text-rose-300";
  return "border border-slate-600 bg-slate-700/60 text-slate-200";
}

function PrettyBlock({ title, value }: { title: string; value?: string | null }) {
  if (!value && value !== "") return null;
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs text-emerald-100">{value || "(empty)"}</pre>
    </div>
  );
}

export default function ProblemPage() {
  const params = useParams<{ id: string; problemId: string }>();
  const { user } = useAuth();
  const [code, setCode] = useState(getBoilerplate(71));
  const [codesByLanguage, setCodesByLanguage] = useState<Record<number, string>>({ 71: getBoilerplate(71) });
  const [customInput, setCustomInput] = useState("");
  const [useCustomInput, setUseCustomInput] = useState(false);
  const [selectedSampleId, setSelectedSampleId] = useState<string>("");
  const [languageId, setLanguageId] = useState<number>(71);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchContestDetail>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LeftTab>("statement");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLDivElement | null>(null);
  const [leftWidth, setLeftWidth] = useState(43);
  const [editorHeight, setEditorHeight] = useState(62);
  const [dragging, setDragging] = useState<null | "vertical" | "horizontal">(null);
  const [latestKind, setLatestKind] = useState<LatestKind>("run");
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeRun, setActiveRun] = useState<RunExecution | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);
  const [latestError, setLatestError] = useState<string>("");

  const load = async () => {
    const response = await fetchContestDetail(params.id);
    setDetail(response);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 2500);
    return () => clearInterval(interval);
  }, [params.id]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: MouseEvent) => {
      if (dragging === "vertical") {
        const width = window.innerWidth;
        const next = (event.clientX / width) * 100;
        setLeftWidth(Math.min(64, Math.max(28, next)));
        return;
      }

      const rightPanel = rightPanelRef.current;
      if (!rightPanel) return;
      const rect = rightPanel.getBoundingClientRect();
      const next = ((event.clientY - rect.top) / rect.height) * 100;
      setEditorHeight(Math.min(78, Math.max(38, next)));
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  useEffect(() => {
    if (!activeRun || !activeRun.id || activeRun.pipelineStatus === "judged" || activeRun.pipelineStatus === "failed") return;
    const interval = setInterval(async () => {
      try {
        const freshRun = await fetchRunExecution(activeRun.id);
        setActiveRun(freshRun);
      } catch {
        clearInterval(interval);
      }
    }, 900);
    return () => clearInterval(interval);
  }, [activeRun?.id, activeRun?.pipelineStatus]);

  useEffect(() => {
    if (!activeSubmission || !activeSubmission.id || activeSubmission.pipelineStatus === "judged" || activeSubmission.pipelineStatus === "failed") return;
    const interval = setInterval(async () => {
      try {
        const freshSubmission = await fetchSubmission(activeSubmission.id);
        setActiveSubmission(freshSubmission);
      } catch {
        clearInterval(interval);
      }
    }, 1200);
    return () => clearInterval(interval);
  }, [activeSubmission?.id, activeSubmission?.pipelineStatus]);

  useEffect(() => {
    if (activeSubmission?.pipelineStatus === "judged") {
      setTimeout(load, 600);
    }
  }, [activeSubmission?.pipelineStatus]);

  const problem = useMemo(() => detail?.problems.find((candidate) => candidate.id === params.problemId), [detail, params.problemId]);
  const problemIndex = useMemo(() => detail?.problems.findIndex((candidate) => candidate.id === params.problemId) ?? -1, [detail?.problems, params.problemId]);
  const previousProblem = problemIndex > 0 ? detail?.problems[problemIndex - 1] : null;
  const nextProblem = problemIndex >= 0 && detail && problemIndex < detail.problems.length - 1 ? detail.problems[problemIndex + 1] : null;
  const isAllowedParticipant = Boolean(user && detail && (user.id === detail.contest.organiserId || detail.contest.participants.includes(user.id)));
  const canSubmit = Boolean(user) && detail?.phase === "running" && isAllowedParticipant;
  const availableLanguages = problem?.execution?.supportedLanguages?.length ? problem.execution.supportedLanguages : fallbackLanguages;
  const selectedLanguage = availableLanguages.find((entry) => entry.id === languageId) ?? availableLanguages[0] ?? fallbackLanguages[0];
  const mySubmissions = useMemo(
    () =>
      (detail?.events ?? [])
        .filter((submission) => submission.problemId === params.problemId && submission.participantId === user?.id)
        .slice()
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
    [detail?.events, params.problemId, user?.id]
  );
  const acceptedFromHistory = mySubmissions.some((submission) => submission.pipelineStatus === "judged" && ((submission.verdict ?? submission.status).toLowerCase() === "accepted"));
  const isAccepted = acceptedFromHistory || (activeSubmission?.pipelineStatus === "judged" && (activeSubmission.verdict ?? activeSubmission.status).toLowerCase() === "accepted");
  const maxSubmissions = detail?.contest.ruleSet?.maxAttemptsPerProblem ?? 0;
  const submissionsLeft = maxSubmissions > 0 ? Math.max(0, maxSubmissions - mySubmissions.length) : null;
  const judgePending = running || submitting || activeRun?.pipelineStatus === "queued" || activeRun?.pipelineStatus === "processing" || activeSubmission?.pipelineStatus === "queued" || activeSubmission?.pipelineStatus === "processing";
  const latestRecord = latestKind === "run" ? activeRun : activeSubmission;
  const publicTestCases = problem?.samples ?? [];
  const chosenSample = publicTestCases.find((entry) => entry.id === selectedSampleId) ?? publicTestCases[0];
  const sampleLabel = publicTestCases.length <= 1
    ? "Sample test case"
    : `Sample case ${Math.max(1, publicTestCases.findIndex((entry) => entry.id === chosenSample?.id) + 1)}`;

  useEffect(() => {
    const available = problem?.execution?.supportedLanguages?.length ? problem.execution.supportedLanguages : fallbackLanguages;
    const firstLanguageId = available[0]?.id ?? 71;
    setLanguageId((current) => (available.some((entry) => entry.id === current) ? current : firstLanguageId));
    setCodesByLanguage((prev) => {
      const next = { ...prev };
      for (const runtime of available) {
        if (!next[runtime.id]) next[runtime.id] = getBoilerplate(runtime.id);
      }
      return next;
    });
  }, [problem?.id, problem?.execution?.supportedLanguages]);

  useEffect(() => {
    setCode(codesByLanguage[languageId] ?? getBoilerplate(languageId));
  }, [languageId, codesByLanguage]);

  useEffect(() => {
    if (publicTestCases.length && !publicTestCases.some((entry) => entry.id === selectedSampleId)) {
      setSelectedSampleId(publicTestCases[0].id);
    }
  }, [publicTestCases, selectedSampleId]);

  const handleEditorChange = (nextValue: string) => {
    setCode(nextValue);
    setCodesByLanguage((prev) => ({ ...prev, [languageId]: nextValue }));
  };

  const handleLanguageChange = (nextLanguageId: number) => {
    setCodesByLanguage((prev) => ({ ...prev, [languageId]: code }));
    setLanguageId(nextLanguageId);
    setLatestError("");
  };

  if (loading) return <LoadingState label="Loading problem..." />;
  if (!problem || !detail) return <div className="text-rose-400">Problem not found in this contest.</div>;

  const runResultView = activeRun && latestKind === "run" ? (
    <div className="space-y-3 text-sm">
      <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
        <p>Mode: <span className="text-slate-100">{activeRun.inputMode === "custom" ? "Custom input" : activeRun.inputLabel ?? "Sample test case"}</span></p>
        <p>Runtime: <span className="text-slate-100">{activeRun.executionMs} ms</span></p>
        <p>Memory: <span className="text-slate-100">{activeRun.memoryKb ?? 0} KB</span></p>
        <p>Verdict: <span className="text-slate-100">{activeRun.verdict ?? activeRun.status}</span></p>
      </div>
      <PrettyBlock title="Input used" value={activeRun.stdin} />
      {activeRun.inputMode === "sample" ? <PrettyBlock title="Expected output" value={activeRun.expectedOutput} /> : null}
      <PrettyBlock title="Actual output" value={activeRun.stdout} />
      <PrettyBlock title="Compile output" value={activeRun.compileOutput} />
      <PrettyBlock title="Error" value={activeRun.stderr} />
      {activeRun.latestMessage ? <p className="text-xs text-slate-400">{activeRun.latestMessage}</p> : null}
    </div>
  ) : null;

  const submissionResultView = activeSubmission && latestKind === "submission" ? (
    <div className="space-y-3 text-sm">
      <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
        <p>Language: <span className="text-slate-100">{activeSubmission.language}</span></p>
        <p>Verdict: <span className="text-slate-100">{activeSubmission.verdict ?? activeSubmission.status}</span></p>
        <p>Passed tests: <span className="text-slate-100">{activeSubmission.passedTests ?? 0}/{activeSubmission.totalTests ?? 0}</span></p>
        <p>Score: <span className="text-slate-100">{activeSubmission.score}</span></p>
        <p>Runtime: <span className="text-slate-100">{activeSubmission.executionMs} ms</span></p>
        <p>Memory: <span className="text-slate-100">{activeSubmission.memoryKb ?? 0} KB</span></p>
      </div>
      <PrettyBlock title="Output" value={activeSubmission.stdout} />
      <PrettyBlock title="Compile output" value={activeSubmission.compileOutput} />
      <PrettyBlock title="Error" value={activeSubmission.stderr} />
      {activeSubmission.testcaseResults?.length ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Hidden testcase summary</p>
          <div className="space-y-2">
            {activeSubmission.testcaseResults.map((result, index) => (
              <div key={result.taskId} className="rounded-lg border border-slate-800 bg-black/25 px-3 py-2 text-xs text-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Hidden test {index + 1}</span>
                  <span className={`rounded-full px-2 py-0.5 ${badgeClass(result.verdict ?? result.statusDescription, activeSubmission.pipelineStatus)}`}>{result.verdict ?? result.statusDescription}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {activeSubmission.latestMessage ? <p className="text-xs text-slate-400">{activeSubmission.latestMessage}</p> : null}
    </div>
  ) : null;

  return (
    <div ref={containerRef} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
      <div className="flex h-[calc(100vh-88px)] min-h-[660px] flex-col overflow-hidden lg:flex-row">
        <section className="flex h-full min-h-0 w-full min-w-[320px] flex-col lg:min-w-0 lg:w-[var(--left-width)]" style={{ ["--left-width" as any]: `${leftWidth}%` }}>
          <div className="border-b border-slate-800 bg-slate-950/70 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <Link href={`/contest/${detail.contest.id}`} className="text-slate-400 hover:text-slate-200">← {detail.contest.name}</Link>
                  <span>/</span>
                  <span>{problem.code}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold text-white">{problem.title}</h1>
                  <span className="rounded-full border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-xs text-slate-300">{problem.points} pts</span>
                  {isAccepted ? <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">Accepted</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previousProblem ? <Link href={`/contest/${detail.contest.id}/${previousProblem.id}`} className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">Prev</Link> : null}
                {nextProblem ? <Link href={`/contest/${detail.contest.id}/${nextProblem.id}`} className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">Next</Link> : null}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setActiveTab("statement")} className={`rounded-md px-3 py-1.5 text-sm ${activeTab === "statement" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}>Statement</button>
                <button type="button" onClick={() => setActiveTab("submissions")} className={`rounded-md px-3 py-1.5 text-sm ${activeTab === "submissions" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}>Submissions</button>
              </div>
              <div className="text-xs text-slate-400">{maxSubmissions > 0 ? `Submissions left: ${submissionsLeft}` : `Submissions: ${mySubmissions.length}`}</div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {activeTab === "statement" ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-emerald-300">Problem statement</h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-200">{problem.statement}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Constraints</h3>
                  <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-300">
                    {problem.constraints.map((constraint) => <li key={constraint}>{constraint}</li>)}
                  </ul>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-300">CPU limit: {problem.execution.cpuTimeLimitSeconds ?? 2}s</div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-300">Memory limit: {problem.execution.memoryLimitKb ?? 262144} KB</div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Sample test case</h3>
                  <div className="mt-3 space-y-3">
                    {publicTestCases.map((testCase, index) => (
                      <div key={testCase.id} className={`rounded-xl border p-4 ${testCase.id === chosenSample?.id ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-800 bg-slate-950/80"}`}>
                        <p className="text-sm font-medium text-white">{publicTestCases.length <= 1 ? "Sample test case" : `Sample case ${index + 1}`}</p>
                        <div className="mt-3 space-y-3 text-sm">
                          <div>
                            <p className="mb-1 text-slate-400">Input</p>
                            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-slate-200">{testCase.input}</pre>
                          </div>
                          <div>
                            <p className="mb-1 text-slate-400">Output</p>
                            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-slate-200">{testCase.output}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                    {publicTestCases.length === 0 ? <p className="text-sm text-slate-500">No public examples available.</p> : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-300">Latest accepted status: <span className={isAccepted ? "text-emerald-300" : "text-slate-100"}>{isAccepted ? "Accepted" : "Not solved yet"}</span></div>
                {mySubmissions.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 text-sm text-slate-400">No submissions yet.</div>
                ) : (
                  mySubmissions.map((submission) => (
                    <div key={submission.id} className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-white">Submission {submission.id}</p>
                          <p className="mt-1 text-xs text-slate-400">{new Date(submission.submittedAt).toLocaleString()}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${badgeClass(submission.verdict ?? submission.status, submission.pipelineStatus)}`}>{submission.pipelineStatus === "judged" ? submission.verdict ?? submission.status : "Pending"}</span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                        <p>Language: <span className="text-slate-200">{submission.language}</span></p>
                        <p>Score: <span className="text-slate-200">{submission.score}</span></p>
                        <p>Runtime: <span className="text-slate-200">{submission.executionMs} ms</span></p>
                        <p>Memory: <span className="text-slate-200">{submission.memoryKb ?? 0} KB</span></p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>

        <div role="separator" aria-orientation="vertical" onMouseDown={() => setDragging("vertical")} className="hidden w-1.5 shrink-0 cursor-col-resize bg-slate-800 transition hover:bg-emerald-500/70 lg:block" />

        <section ref={rightPanelRef} className="flex min-h-0 flex-1 flex-col border-t border-slate-800 lg:border-t-0">
          <div className="border-b border-slate-800 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Code editor</h2>
                <p className="text-xs text-slate-500">Run uses a selected sample by default. Submit judges hidden tests only.</p>
              </div>
              <select value={languageId} onChange={(event) => handleLanguageChange(Number(event.target.value))} disabled={judgePending} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-60">
                {availableLanguages.map((language) => <option key={language.id} value={language.id}>{language.label}</option>)}
              </select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden p-4">
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-[240px] overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60" style={{ height: `${editorHeight}%` }}>
                <MonacoCodeEditor key={`${problem.id}-${selectedLanguage.id}`} language={selectedLanguage.monaco} value={code} onChange={handleEditorChange} />
              </div>

              <div role="separator" aria-orientation="horizontal" onMouseDown={() => setDragging("horizontal")} className="my-3 h-1.5 shrink-0 cursor-row-resize rounded bg-slate-800 transition hover:bg-emerald-500/70" />

              <div className="min-h-[220px] overflow-hidden" style={{ height: `${100 - editorHeight}%` }}>
                <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                    <div className="flex items-center justify-between gap-2 shrink-0">
                      <label className="text-sm font-medium text-slate-300">Run configuration</label>
                      <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                        <input type="checkbox" checked={useCustomInput} onChange={(event) => setUseCustomInput(event.target.checked)} disabled={judgePending} className="rounded border-slate-600 bg-slate-900" />
                        Use custom input
                      </label>
                    </div>
                    <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {!useCustomInput ? (
                        publicTestCases.length > 1 ? (
                          <label className="block text-sm text-slate-300">
                            Sample case
                            <select value={selectedSampleId} onChange={(event) => setSelectedSampleId(event.target.value)} disabled={judgePending} className="mt-2 w-full rounded-lg border border-slate-700 bg-black/30 p-3 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-70">
                              {publicTestCases.map((sample, index) => <option key={sample.id} value={sample.id}>{`Sample case ${index + 1}`}</option>)}
                            </select>
                          </label>
                        ) : (
                          <div className="rounded-lg border border-slate-800 bg-black/20 p-3 text-sm text-slate-300">
                            Run will use the single sample test case shown in the statement.
                          </div>
                        )
                      ) : null}
                      <label className="block text-sm font-medium text-slate-300">Custom input</label>
                      <textarea value={customInput} onChange={(event) => setCustomInput(event.target.value)} placeholder="Custom input for Run" disabled={judgePending || !useCustomInput} className="h-36 w-full rounded-lg border border-slate-700 bg-black/30 p-3 text-sm text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-50" />
                      {!useCustomInput && chosenSample ? (
                        <p className="text-xs text-slate-400">Run will use the selected sample test case and compare your output against the expected sample output.</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                    <div className="flex h-full min-h-0 flex-1 flex-col">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-medium text-slate-100">Latest result</h3>
                        <p className="mt-1 text-xs text-slate-400">{latestKind === "submission" ? "Submission verdict on hidden tests" : "Most recent run result"}</p>
                      </div>
                      {latestRecord ? (
                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${badgeClass((latestKind === "submission" ? activeSubmission?.verdict : (latestRecord as RunExecution).verdict) ?? latestRecord.status, latestRecord.pipelineStatus)}`}>
                          {latestRecord.pipelineStatus === "queued" || latestRecord.pipelineStatus === "processing" ? "Pending" : latestKind === "submission" ? activeSubmission?.verdict ?? latestRecord.status : (activeRun?.verdict ?? latestRecord.status)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg bg-black/40 p-3 pb-4">
                      {latestError ? <p className="text-sm text-rose-300">{latestError}</p> : null}
                      {!latestRecord && !latestError ? <p className="text-sm text-slate-400">Latest judge result will appear here.</p> : null}
                      {latestRecord?.pipelineStatus === "queued" || latestRecord?.pipelineStatus === "processing" ? <p className="text-sm text-amber-300">{latestKind === "run" ? "Run pending..." : "Submission pending..."} wait until the judge finishes.</p> : null}
                      {runResultView}
                      {submissionResultView}
                    </div>

                    <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/95 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="rounded-md bg-slate-100 px-5 py-2 text-sm font-medium text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={judgePending}
                        onClick={async () => {
                          try {
                            setRunning(true);
                            setLatestError("");
                            setLatestKind("run");
                            setActiveRun(null);
                            const result = await runCode({
                              contestId: detail.contest.id,
                              problemId: problem.id,
                              sourceCode: code,
                              languageId,
                              stdin: useCustomInput ? customInput : chosenSample?.input,
                              expectedOutput: useCustomInput ? undefined : chosenSample?.output,
                              inputMode: useCustomInput ? "custom" : "sample",
                              sampleCaseId: useCustomInput ? undefined : chosenSample?.id,
                              inputLabel: useCustomInput ? "Custom input" : sampleLabel
                            });
                            setActiveRun(result);
                          } catch (error) {
                            setLatestError(error instanceof Error ? error.message : "Run failed");
                          } finally {
                            setRunning(false);
                          }
                        }}
                      >
                        {judgePending && latestKind === "run" ? "Pending..." : "Run"}
                      </button>
                      <button
                        disabled={judgePending || !canSubmit}
                        className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={async () => {
                          if (!user) return;
                          setSubmitting(true);
                          setLatestError("");
                          try {
                            setLatestKind("submission");
                            setActiveSubmission(null);
                            const submission = await submitCode({
                              contestId: detail.contest.id,
                              problemId: problem.id,
                              language: selectedLanguage.label,
                              languageId,
                              sourceCode: code
                            });
                            setActiveSubmission(submission);
                          } catch (error) {
                            setLatestError(error instanceof Error ? error.message : "Submission failed");
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                      >
                        {judgePending && latestKind === "submission" ? "Pending..." : "Submit"}
                      </button>
                      </div>
                      <div className="min-w-[220px] text-right text-xs text-slate-400">
                        {judgePending ? <span className="text-amber-300">Wait until the current evaluation finishes.</span> : null}
                        {!judgePending && !canSubmit ? <span className="text-amber-300">Submissions are allowed only during a running contest for approved participants.</span> : null}
                        {!judgePending && canSubmit ? <span>Language: <span className="text-slate-200">{selectedLanguage.label}</span></span> : null}
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
