export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return <div className="rounded border border-slate-700 bg-slate-800 p-4 text-slate-200">{label}</div>;
}
