import type { ReactNode } from "react";

export function EditorSection({ title, summary, children, open = false }: {
  title: string; summary?: string; children: ReactNode; open?: boolean;
}) {
  return <details className="editor-section" open={open || undefined}>
    <summary><span>{title}</span>{summary ? <small>{summary}</small> : null}</summary>
    <div className="editor-section-body">{children}</div>
  </details>;
}
