export type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

export type RecognitionConstructor = new () => Recognition;

export function getRecognitionConstructor(): RecognitionConstructor | undefined {
  const browser = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}

const messages: Record<string, string> = {
  "not-allowed": "Нет доступа к микрофону. Разреши его в настройках браузера или введи описание текстом.",
  "service-not-allowed": "Браузер не разрешает распознавание речи. Введи описание текстом.",
  "audio-capture": "Микрофон недоступен. Проверь подключение или введи описание текстом.",
  "no-speech": "Речь не распознана. Попробуй ещё раз или введи описание текстом.",
  network: "Не удалось распознать речь из-за ошибки сети. Попробуй ещё раз.",
  "language-not-supported": "Распознавание русской речи недоступно в этом браузере.",
};

// One session owns its handlers; late events after cancel/dispose are ignored.
export function createVoiceSession(Constructor: RecognitionConstructor, original: string, callbacks: {
  text(value: string): void;
  status(value: "listening" | "stopping" | "idle"): void;
  message(value: string): void;
  complete?(text: string, successful: boolean): void;
}, limit = 1500) {
  const recognition = new Constructor();
  let active = true;
  let finalText = original;
  let heard = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = (successful = false) => {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    recognition.onresult = recognition.onerror = recognition.onend = null;
    callbacks.text(finalText);
    callbacks.status("idle");
    callbacks.complete?.(finalText, successful);
  };
  const stop = () => {
    if (!active || timer) return;
    callbacks.status("stopping");
    timer = setTimeout(() => { finish(); recognition.abort(); }, 5000);
    try { recognition.stop(); } catch { finish(); recognition.abort(); }
  };
  recognition.lang = "ru-RU";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = ({ results }) => {
    if (!active) return;
    const final: string[] = [];
    const interim: string[] = [];
    Array.from(results).forEach(result => {
      const text = result[0]?.transcript.trim();
      if (text) (result.isFinal ? final : interim).push(text);
    });
    heard = heard || final.length > 0;
    const join = (parts: string[]) => parts.filter(Boolean).join(" ");
    finalText = join([original, ...final]).slice(0, limit);
    const displayed = join([original, ...final, ...interim]);
    callbacks.text(displayed.slice(0, limit));
    if (finalText.length >= limit) {
      callbacks.message(`Достигнут лимит ${limit} символов. Проверь описание перед отправкой.`);
      stop();
    }
  };
  recognition.onerror = ({ error }) => {
    if (!active) return;
    callbacks.message(messages[error] || "Не получилось распознать речь. Попробуй ещё раз или введи описание текстом.");
    finish();
    recognition.abort();
  };
  recognition.onend = () => {
    if (!active) return;
    if (!heard) callbacks.message(messages["no-speech"]);
    finish(heard);
  };
  return {
    start() {
      callbacks.message("");
      callbacks.status("listening");
      try { recognition.start(); } catch {
        callbacks.message("Не удалось включить микрофон. Попробуй ещё раз или введи описание текстом.");
        finish();
        recognition.abort();
      }
    },
    stop,
    cancel() {
      finalText = original;
      finish();
      recognition.abort();
    },
    dispose() {
      active = false;
      clearTimeout(timer);
      recognition.onresult = recognition.onerror = recognition.onend = null;
      recognition.abort();
    },
  };
}
