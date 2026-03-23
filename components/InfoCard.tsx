import { ReactNode } from "react";

export function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded border border-slate-700 bg-slate-800 p-4">
      <h2 className="mb-3 text-lg font-semibold text-emerald-300">{title}</h2>
      {children}
    </section>
  );
}
