import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Passage } from "../../types/passage";
import type { TypingState } from "../../types/typing";
import { DomTypingController } from "../../lib/typing-dom/domTypingController";
import { createInitialTypingState } from "../../lib/typing/engine";
import { buildTypingResult, getElapsedSeconds } from "../../lib/typing/metrics";
import { RestartIcon } from "./icons";
import { ResultScreen } from "./ResultScreen";

type TypingTestProps = {
  passages: Passage[];
};

function formatElapsed(seconds: number): string {
  if (seconds < 60) return seconds.toFixed(1);

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function getCompletionPercent(state: TypingState): number {
  if (state.words.length === 0) return 0;
  if (state.status === "finished") return 100;

  const word = state.words[state.activeWordIndex];
  const input = state.inputs[state.activeWordIndex] ?? "";
  const wordProgress =
    word === undefined || word.text.length === 0
      ? 0
      : Math.min(input.length / word.text.length, 1);

  return Math.min(
    100,
    ((state.activeWordIndex + wordProgress) / state.words.length) * 100
  );
}

export function TypingTest({ passages }: TypingTestProps): React.JSX.Element {
  const [passageIndex, setPassageIndex] = useState(0);
  const [sessionVersion, setSessionVersion] = useState(0);
  const passage = passages[passageIndex] as Passage;
  const [liveState, setLiveState] = useState<TypingState>(() =>
    createInitialTypingState(passage)
  );
  const [finishedState, setFinishedState] = useState<TypingState | null>(null);
  const [now, setNow] = useState(() => performance.now());

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const wordsRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const caretRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<DomTypingController | null>(null);

  const displayState = finishedState ?? liveState;
  const result = useMemo(
    () => buildTypingResult(displayState, now),
    [displayState, now]
  );
  const elapsedSeconds = getElapsedSeconds(displayState, now);
  const completionPercent = getCompletionPercent(displayState);

  const restart = useCallback(() => {
    controllerRef.current?.destroy();
    controllerRef.current = null;
    setFinishedState(null);
    setPassageIndex((current) =>
      passages.length === 0 ? 0 : (current + 1) % passages.length
    );
    setSessionVersion((current) => current + 1);
  }, [passages.length]);

  const handleStateChange = useCallback(
    (state: TypingState, timestamp: number) => {
      setLiveState(state);
      setNow(timestamp);
    },
    []
  );

  const handleFinish = useCallback(
    (state: TypingState, timestamp: number) => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
      setLiveState(state);
      setFinishedState(state);
      setNow(timestamp);
    },
    []
  );

  useEffect(() => {
    const wrapperElement = wrapperRef.current;
    const wordsElement = wordsRef.current;
    const inputElement = inputRef.current;
    const caretElement = caretRef.current;
    const initialState = createInitialTypingState(passage);

    setLiveState(initialState);
    setFinishedState(null);
    setNow(performance.now());

    if (
      wrapperElement === null ||
      wordsElement === null ||
      inputElement === null ||
      caretElement === null
    ) {
      return;
    }

    const controller = new DomTypingController({
      passage,
      elements: {
        wrapperElement,
        wordsElement,
        inputElement,
        caretElement
      },
      onStateChange: handleStateChange,
      onFinish: handleFinish,
      onRestartShortcut: restart
    });

    controllerRef.current = controller;
    controller.mount();

    return () => {
      controller.destroy();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [handleFinish, handleStateChange, passage, restart, sessionVersion]);

  useEffect(() => {
    if (displayState.status !== "running") return;

    const interval = window.setInterval(() => {
      setNow(performance.now());
    }, 100);

    return () => {
      window.clearInterval(interval);
    };
  }, [displayState.status]);

  if (finishedState !== null) {
    return (
      <ResultScreen passage={passage} result={result} onRestart={restart} />
    );
  }

  return (
    <section className="page pageTest full-width content-grid" data-nosnippet>
      <div id="typingTest" className="content-grid full-width-padding">
        <div id="liveStatsMini" className="full-width timerMain">
          <div className="time">{formatElapsed(elapsedSeconds)}</div>
          <div className="speed">{Math.round(result.wpm)}</div>
          <div className="acc">{Math.round(result.accuracy)}%</div>
        </div>

        <div
          id="wordsWrapper"
          className="content-grid full-width"
          ref={wrapperRef}
          translate="no"
        >
          <textarea
            id="wordsInput"
            aria-label="Typing input"
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            data-1p-ignore
            data-bwignore
            data-enable-grammarly="false"
            data-form-type="other"
            data-gramm="false"
            data-gramm_editor="false"
            data-lpignore="true"
            defaultValue=" "
            ref={inputRef}
            spellCheck={false}
          />
          <div id="caret" className="full-width default" ref={caretRef} />
          <div
            id="words"
            className="full-width"
            aria-hidden="true"
            ref={wordsRef}
          />
        </div>

        <button
          id="restartTestButton"
          type="button"
          aria-label="Restart test"
          className="text"
          onClick={restart}
        >
          <RestartIcon />
        </button>

        <div className="test-progress" aria-hidden="true">
          <div
            className="bar"
            style={{ transform: `scaleX(${completionPercent / 100})` }}
          />
        </div>
      </div>
    </section>
  );
}
