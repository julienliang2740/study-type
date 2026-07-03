import { useEffect, useMemo, useRef, useState } from "react";
import { buildTypingResult } from "../../lib/typing/metrics";
import type { TypingResult, TypingState } from "../../lib/typing/types";
import { createInitialTypingState } from "../../lib/typing/engine";
import { DomTypingController } from "../../lib/typing-dom/domTypingController";
import type { Passage } from "../../types/passage";
import { ResultScreen } from "./ResultScreen";

type TypingScreenProps = {
  passages: Passage[];
};

function createEmptyPassage(): Passage {
  return {
    id: "empty",
    title: "No typing target",
    source: "No sample text is available",
    sourceKind: "sample",
    text: ""
  };
}

function formatTimer(seconds: number): string {
  if (seconds < 60) return Math.round(seconds).toString();
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const remainder = String(whole % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function TypingScreen({ passages }: TypingScreenProps): React.JSX.Element {
  const safePassages = passages.length > 0 ? passages : [createEmptyPassage()];
  const [passageIndex, setPassageIndex] = useState(0);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [liveState, setLiveState] = useState<TypingState>(() =>
    createInitialTypingState(safePassages[0] ?? createEmptyPassage())
  );
  const [finishedState, setFinishedState] = useState<TypingState | null>(null);
  const [focused, setFocused] = useState(false);
  const [now, setNow] = useState(() => performance.now());

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const wordsRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const caretRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<DomTypingController | null>(null);

  const activePassage = safePassages[passageIndex] ?? safePassages[0] ?? createEmptyPassage();
  const liveResult = useMemo(
    () => buildTypingResult(liveState, now),
    [liveState, now]
  );
  const finalResult: TypingResult | null = useMemo(
    () => (finishedState === null ? null : buildTypingResult(finishedState)),
    [finishedState]
  );

  const restart = (advance: boolean): void => {
    setFinishedState(null);
    setFocused(false);

    if (advance && activePassage.sourceKind === "sample") {
      setPassageIndex((current) => (current + 1) % safePassages.length);
    }

    setSessionVersion((current) => current + 1);
  };

  useEffect(() => {
    if (liveState.status !== "running") return;

    const intervalId = window.setInterval(() => {
      setNow(performance.now());
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [liveState.status]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const words = wordsRef.current;
    const input = inputRef.current;
    const caret = caretRef.current;

    if (
      wrapper === null ||
      words === null ||
      input === null ||
      caret === null
    ) {
      return;
    }

    const controller = new DomTypingController({
      passage: activePassage,
      wrapper,
      words,
      input,
      caret,
      onStateChange: (state) => {
        setLiveState(state);
        setNow(performance.now());
      },
      onFinish: (state) => {
        setFinishedState(state);
      },
      onRestartShortcut: () => {
        restart(true);
      },
      onFocusChange: setFocused
    });

    controllerRef.current = controller;
    controller.mount();

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, [activePassage, sessionVersion]);

  if (finishedState !== null && finalResult !== null) {
    return (
      <ResultScreen
        state={finishedState}
        result={finalResult}
        onRestart={() => {
          restart(false);
        }}
        onNext={() => {
          restart(true);
        }}
      />
    );
  }

  const hasWords = liveState.words.length > 0;
  const progress =
    liveState.words.length === 0
      ? 0
      : ((liveState.activeWordIndex + 1) / liveState.words.length) * 100;

  return (
    <section className="typing-screen" aria-label="Typing test">
      <div className="typing-meta">
        <div>
          <span className="muted">study</span> {activePassage.title}
        </div>
        <div className="live-stats" aria-label="Live typing stats">
          <span>{formatTimer(liveResult.elapsedSeconds)}</span>
          <span>{Math.round(liveResult.wpm)} wpm</span>
          <span>{Math.round(liveResult.accuracy)}%</span>
        </div>
      </div>

      <div
        ref={wrapperRef}
        id="wordsWrapper"
        className={!focused ? "out-of-focus" : undefined}
        role="group"
        aria-label="Typing area"
      >
        <textarea
          ref={inputRef}
          id="wordsInput"
          aria-label="Typing capture input"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {!focused && hasWords ? (
          <div className="focus-warning">click here or press a key to focus</div>
        ) : null}
        {!hasWords ? (
          <div className="empty-typing-target">no typing target available</div>
        ) : null}
        <div ref={caretRef} id="caret" className="hidden" />
        <div ref={wordsRef} id="words" />
      </div>

      <div className="typing-footer">
        <div className="test-progress" aria-hidden="true">
          <div style={{ width: `${progress}%` }} />
        </div>
        <button
          type="button"
          className="icon-button restart-button"
          aria-label="Restart Test"
          onClick={() => {
            restart(true);
          }}
        >
          <span aria-hidden="true">{"\u21bb"}</span>
          <span className="restart-tooltip" role="tooltip">Restart Test</span>
        </button>
        <div className="restart-shortcut" aria-hidden="true">
          <kbd>tab</kbd>
          <span>&gt;</span>
          <kbd>enter</kbd>
          <span>- restart test</span>
        </div>
      </div>
    </section>
  );
}
