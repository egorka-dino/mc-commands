"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createVoiceSession, getRecognitionConstructor } from "./voice-input";
import { useCommandAssistant } from "./useCommandAssistant";

type Props<T> = {
  mode: "summon" | "give";
  snapshot: T;
  onApply: (snapshot: T) => void;
  normalize: (snapshot: T) => T;
  adminMode?: boolean;
};
const labels = {
  summon: {
    object: "моба", title: "Собрать моба словами",
    example: "Например: зомби в незеритке с мечом на остроту V и курицей-пассажиром",
    followUp: "Например: добавь алмазный меч, убери свечение и сделай пассажира маленьким",
    extra: "До 6 мобов вместе с пассажирами.",
  },
  give: {
    object: "предмета", title: "Собрать предмет словами",
    example: "Например: незеритовый меч на остроту V и добычу III с именем Дедов аргумент",
    followUp: "Например: добавь добычу III, убери остроту, имя оставь",
    extra: "Количество и получатель сохраняются, пока ты не попросишь их изменить.",
  },
};

export function CommandAssistant<T>({ mode, snapshot, onApply, normalize, adminMode = false }: Props<T>) {
  const label = labels[mode];
  const inputId = useId();
  const ai = useCommandAssistant({ mode, snapshot, onApply, normalize,
    confirmRestart: `Собрать нового ${label.object} по этому описанию? Текущие настройки и история будут заменены после успешного ответа.`,
  });
  const [voiceSupported, setVoiceSupported] = useState<boolean | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "stopping">("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
  const voiceRef = useRef<ReturnType<typeof createVoiceSession> | null>(null);
  const voiceBusy = voiceStatus !== "idle";
  useEffect(() => {
    setVoiceSupported(Boolean(getRecognitionConstructor()));
    const stopOnLeave = () => voiceRef.current?.cancel();
    window.addEventListener("pagehide", stopOnLeave);
    return () => {
      window.removeEventListener("pagehide", stopOnLeave);
      voiceRef.current?.dispose();
    };
  }, []);
  function startVoiceInput() {
    if (ai.busy || voiceBusy) return;
    const Constructor = getRecognitionConstructor();
    if (!Constructor) { setVoiceSupported(false); return; }
    voiceRef.current?.dispose();
    const session = createVoiceSession(Constructor, ai.prompt, {
      text: ai.setPrompt, status: setVoiceStatus, message: setVoiceMessage,
    });
    voiceRef.current = session;
    session.start();
  }
  return <section className="panel ai-panel">
    <h2>{adminMode ? label.title : "Собрать словами"} <span className="sub">AI-помощник</span></h2>
    {ai.history.length ? <div className="ai-history" role="log" aria-label="История доработок">{ai.history.map((turn, index) => <div className="ai-turn" key={index}>
      <p><strong>Ты:</strong> {turn.prompt}</p>
      <div><strong>Помощник:</strong><ul className="ai-notes">{turn.notes.map((note, noteIndex) => <li key={noteIndex}>{note}</li>)}</ul></div>
    </div>)}</div> : null}
    <label htmlFor={inputId} className="lab">Что собрать или изменить?</label>
    <textarea id={inputId} value={ai.prompt} onChange={event => ai.setPrompt(event.target.value)} disabled={ai.busy || voiceBusy} maxLength={1500} placeholder={ai.history.length ? label.followUp : label.example} rows={3} />
    <>
      <div className="btn-row voice-actions">
        <button type="button" className="sec" onClick={startVoiceInput} disabled={ai.busy || voiceBusy || voiceSupported !== true || ai.prompt.length >= 1500}>
          <svg aria-hidden="true" width="16" height="18" viewBox="0 0 16 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="1" width="6" height="11" rx="3" /><path d="M2 8v2a6 6 0 0 0 12 0V8M8 16v3M5 19h6" /></svg>
          Надиктовать
        </button>
        {voiceBusy ? <>
          <button type="button" className="sec" disabled={voiceStatus === "stopping"} onClick={() => voiceRef.current?.stop()}>Остановить</button>
          <button type="button" className="sec" onClick={() => { voiceRef.current?.cancel(); setVoiceMessage(""); }}>Отменить диктовку</button>
        </> : null}
      </div>
      <p className="hint" role="status" aria-live="polite">{voiceBusy
        ? voiceStatus === "listening" ? "Слушаю… Говори по-русски, затем нажми Остановить." : "Завершаю распознавание…"
        : voiceSupported === false ? "Голосовой ввод недоступен в этом браузере. Введи описание текстом."
        : "Можно надиктовать описание, проверить текст и применить его. Распознавание может передавать аудио сервису браузера."}</p>
      {voiceMessage ? <p className="warn" role="alert">{voiceMessage}</p> : null}
    </>
    <div className="btn-row ai-actions">
      <button type="button" onClick={() => ai.generate()} disabled={ai.busy || voiceBusy || ai.prompt.trim().length < 3}>{ai.busy ? "Думаю..." : "Применить к текущему"}</button>
      <button className="sec" type="button" onClick={() => ai.generate(true)} disabled={ai.busy || voiceBusy || ai.prompt.trim().length < 3}>Собрать заново</button>
      <button className="sec" type="button" disabled={voiceBusy || !ai.canUndo} onClick={ai.undoLast}>Отменить AI-правку</button>
    </div>
    <p className="hint">Каждый запрос дорабатывает текущего {label.object}, включая ручные правки. "Собрать заново" заменяет его по новому описанию. {label.extra}</p>
    <p className="hint">История хранится до перезагрузки страницы; помощник учитывает последние 6 запросов и текущее состояние.</p>
    {adminMode ? <p className="hint">Метаданные шаблона — ID, название, категорию и описание — сохрани отдельно.</p> : null}
    {ai.changedAfterAnswer ? <p className="hint">После ручных изменений отмена AI-правки недоступна, чтобы сохранить твою работу.</p> : null}
    {ai.busy ? <p role="status" className="hint">Помощник готовит изменения…</p> : null}
    {ai.error ? <p role="alert" className="warn">{ai.error}</p> : null}
  </section>;
}
