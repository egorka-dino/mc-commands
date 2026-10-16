"use client";

import type { ReactNode } from "react";

export function CommandResult({ command, onCopy, onReset, onSave, onUndo, warning, children }: {
  command: string; onCopy: () => void; onReset: () => void; onSave?: () => void;
  onUndo?: () => void; warning?: ReactNode; children?: ReactNode;
}) {
  return <aside className="editor-result" aria-label="Результат">
    {children}
    <section className="panel output-panel">
      <div className="result-heading"><h2>Готовая команда</h2><span className="live-label">Обновляется сразу</span></div>
      <div id="command-output">{command}</div>
      <p className="hint">{command.length} символов · {command.length > 256 ? "Для командного блока" : "Можно вставить в чат"}</p>
      <button className="copy-primary" type="button" onClick={onCopy}>Копировать команду</button>
      {warning ? <div className="warn">{warning}</div> : null}
      <div className="result-secondary">
        {onSave ? <button className="small sec" type="button" onClick={onSave}>В избранное</button> : null}
        {onUndo ? <button className="small sec" type="button" onClick={onUndo}>Отменить замену</button> : null}
        <details className="result-more"><summary>Ещё</summary><button className="small danger" type="button" onClick={onReset}>Сбросить всё</button></details>
      </div>
    </section>
    <div className="mobile-copy-bar"><span>{command.length > 256 ? "Командный блок" : "Команда готова"}</span><button type="button" onClick={onCopy}>Копировать команду</button></div>
  </aside>;
}
