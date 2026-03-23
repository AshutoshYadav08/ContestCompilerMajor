import { ReactNode } from "react";

type PageScaffoldProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  titleIcon?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  contentClassName?: string;
};

export function PageScaffold({
  title,
  description,
  actions,
  titleIcon,
  children,
  bodyClassName = "space-y-4",
  contentClassName = "",
}: PageScaffoldProps) {
  return (
    <div className={`flex h-[calc(100vh-7.5rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 md:h-[calc(100vh-6rem)] ${contentClassName}`.trim()}>
      <div className="shrink-0 border-b border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {titleIcon ? <span className="inline-flex rounded-xl border border-emerald-700/40 bg-emerald-500/10 p-2 text-emerald-300">{titleIcon}</span> : null}
              <h1 className="text-2xl font-semibold text-emerald-300">{title}</h1>
            </div>
            {description ? <div className="mt-2 text-sm text-slate-300">{description}</div> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto p-4 ${bodyClassName}`.trim()}>{children}</div>
    </div>
  );
}
