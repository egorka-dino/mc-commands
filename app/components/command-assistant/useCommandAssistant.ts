"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Turn = { prompt: string; notes: string[] };
type Options<T> = {
  mode: "summon" | "give";
  snapshot: T;
  onApply: (snapshot: T) => void;
  normalize: (snapshot: T) => T;
};

export function useCommandAssistant<T>({ mode, snapshot, onApply, normalize }: Options<T>) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Turn[]>([]);
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<{ before: T; afterKey: string; history: Turn[] } | null>(null);
  const latest = useRef({ snapshot, onApply, normalize });
  const activeRequest = useRef<AbortController | null>(null);
  useLayoutEffect(() => { latest.current = { snapshot, onApply, normalize }; });
  useEffect(() => () => { activeRequest.current?.abort(); }, []);

  const changedAfterAnswer = Boolean(undo && JSON.stringify(snapshot) !== undo.afterKey);
  const canUndo = Boolean(undo && !changedAfterAnswer && !busy);

  async function generate() {
    const text = prompt.trim();
    if (activeRequest.current || text.length < 3) return;
    const before = latest.current.snapshot;
    const beforeKey = JSON.stringify(before);
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/command", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ mode, prompt: text,
          snapshot: before,
          history: history.slice(-6).flatMap(turn => [
            { role: "user", content: turn.prompt }, { role: "assistant", content: turn.notes.join("\n") },
          ]),
        }),
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data?.error || "Не получилось понять описание");
      if (JSON.stringify(latest.current.snapshot) !== beforeKey) {
        throw new Error("Настройки изменены во время ожидания. Ответ не применён. Отправь запрос ещё раз для текущего состояния.");
      }
      const after = latest.current.normalize(data.snapshot);
      latest.current.onApply(after);
      setUndo({ before, afterKey: JSON.stringify(after), history });
      const notes = [data.summary, ...(Array.isArray(data.notes) ? data.notes : [])]
        .filter((note): note is string => typeof note === "string" && Boolean(note));
      setHistory([...history, { prompt: text, notes: notes.length ? notes : ["Готово"] }].slice(-20));
      setPrompt("");
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Не получилось понять описание");
    } finally {
      if (!controller.signal.aborted) {
        activeRequest.current = null;
        setBusy(false);
      }
    }
  }

  function undoLast() {
    if (!canUndo || !undo) return;
    latest.current.onApply(undo.before);
    setHistory(undo.history);
    setUndo(null);
    setError("");
  }

  return { prompt, setPrompt, busy, history, error, generate, canUndo, undoLast, changedAfterAnswer };
}
