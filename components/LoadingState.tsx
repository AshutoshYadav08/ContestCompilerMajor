import { SparklesIcon } from "@/components/Icons";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-emerald-500/20" />
          <span className="absolute inset-1 rounded-full border border-emerald-400/30 border-t-emerald-300 animate-spin" />
          <span className="absolute inset-3 rounded-full border border-blue-400/20 border-b-blue-300 animate-spin [animation-direction:reverse] [animation-duration:1.3s]" />
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-300 animate-pulse">
            <SparklesIcon size={16} />
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-100">{label}</p>
          <p className="text-xs text-slate-400">Getting everything ready.</p>
        </div>
      </div>
    </div>
  );
}
