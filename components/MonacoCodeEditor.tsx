"use client";

import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="flex h-full min-h-[420px] items-center justify-center bg-slate-900 text-sm text-slate-400">Loading editor...</div>
});

type MonacoCodeEditorProps = {
  language: string;
  value: string;
  onChange: (value: string) => void;
  height?: string;
};

export function MonacoCodeEditor({ language, value, onChange, height = "100%" }: MonacoCodeEditorProps) {
  return (
    <div className="h-full overflow-hidden bg-slate-900">
      <MonacoEditor
        height={height}
        language={language}
        theme="vs-dark"
        value={value}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbersMinChars: 3,
          scrollBeyondLastLine: false,
          tabSize: 2,
          wordWrap: "on",
          padding: { top: 12 },
          smoothScrolling: true
        }}
      />
    </div>
  );
}
