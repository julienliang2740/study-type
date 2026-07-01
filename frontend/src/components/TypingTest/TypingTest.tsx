import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { Passage } from "../../types/passage";
import type { TypingState } from "../../types/typing";
import {
  createInitialTypingState,
  deleteTypingData,
  insertTypingData
} from "../../lib/typing/engine";
import { buildTypingResult, getElapsedSeconds } from "../../lib/typing/metrics";
import { RestartIcon } from "./icons";
import { ResultScreen } from "./ResultScreen";
import { WordDisplay } from "./WordDisplay";

type TypingTestProps = {
  passages: Passage[];
};

type CaretPosition = {
  left: number;
  top: number;
  height: number;
  visible: boolean;
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
  const passage = passages[passageIndex] as Passage;
  const [state, setState] = useState<TypingState>(() =>
    createInitialTypingState(passage)
  );
  const [now, setNow] = useState(() => performance.now());
  const [caret, setCaret] = useState<CaretPosition>({
    left: 0,
    top: 0,
    height: 0,
    visible: true
  });
  const [wordsOffsetY, setWordsOffsetY] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wordsWrapperRef = useRef<HTMLDivElement | null>(null);
  const wordRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const letterRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  const result = useMemo(() => buildTypingResult(state, now), [state, now]);
  const elapsedSeconds = getElapsedSeconds(state, now);
  const completionPercent = getCompletionPercent(state);

  const focusInput = useCallback(() => {
    textareaRef.current?.focus({ preventScroll: true });
  }, []);

  const restart = useCallback(() => {
    const nextIndex = (passageIndex + 1) % passages.length;
    const nextPassage = passages[nextIndex] as Passage;
    setPassageIndex(nextIndex);
    setState(createInitialTypingState(nextPassage));
    setNow(performance.now());
    setWordsOffsetY(0);
    setCaret((current) => ({ ...current, visible: true }));
    if (wordsWrapperRef.current !== null) {
      wordsWrapperRef.current.scrollTop = 0;
    }
    requestAnimationFrame(focusInput);
  }, [focusInput, passageIndex, passages]);

  useEffect(() => {
    setState(createInitialTypingState(passage));
  }, [passage]);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  useEffect(() => {
    if (state.status !== "running") return;

    const interval = window.setInterval(() => {
      setNow(performance.now());
    }, 100);

    return () => {
      window.clearInterval(interval);
    };
  }, [state.status]);

  useLayoutEffect(() => {
    if (state.status === "finished") {
      setCaret((current) => ({ ...current, visible: false }));
      return;
    }

    const wrapper = wordsWrapperRef.current;
    const activeWord = wordRefs.current[state.activeWordIndex];
    if (wrapper === null || activeWord === undefined || activeWord === null) {
      return;
    }

    const activeWordTop = Math.round(activeWord.offsetTop);
    const lineTops = Array.from(
      new Set(
        Object.values(wordRefs.current)
          .filter(
            (element): element is HTMLDivElement =>
              element !== null && element.isConnected
          )
          .map((element) => Math.round(element.offsetTop))
      )
    ).sort((a, b) => a - b);
    const activeLineIndex = Math.max(0, lineTops.indexOf(activeWordTop));
    const targetLineTop = lineTops[Math.min(1, activeLineIndex)] ?? 0;
    const nextWordsOffsetY =
      activeLineIndex <= 1 ? 0 : targetLineTop - activeWordTop;
    setWordsOffsetY((current) =>
      Math.abs(current - nextWordsOffsetY) < 0.5 ? current : nextWordsOffsetY
    );

    const animationFrame = requestAnimationFrame(() => {
      const inputLength = state.inputs[state.activeWordIndex]?.length ?? 0;
      const nextLetter =
        letterRefs.current[`${state.activeWordIndex}:${inputLength}`];
      const previousLetter =
        inputLength > 0
          ? letterRefs.current[`${state.activeWordIndex}:${inputLength - 1}`]
          : null;

      const left =
        nextLetter !== undefined && nextLetter !== null
          ? activeWord.offsetLeft + nextLetter.offsetLeft
          : previousLetter !== undefined && previousLetter !== null
            ? activeWord.offsetLeft +
              previousLetter.offsetLeft +
              previousLetter.offsetWidth
            : activeWord.offsetLeft;
      const top =
        nextLetter !== undefined && nextLetter !== null
          ? activeWord.offsetTop + nextLetter.offsetTop + nextWordsOffsetY
          : previousLetter !== undefined && previousLetter !== null
            ? activeWord.offsetTop +
              previousLetter.offsetTop +
              nextWordsOffsetY
            : activeWord.offsetTop + nextWordsOffsetY;
      const height =
        nextLetter?.offsetHeight ??
        previousLetter?.offsetHeight ??
        activeWord.offsetHeight;

      setCaret({
        left,
        top,
        height,
        visible: true
      });
    });

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [state]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Tab" || event.key === "Escape") {
      event.preventDefault();
      restart();
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      setState((current) =>
        deleteTypingData(current, event.ctrlKey || event.metaKey)
      );
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const timestamp = performance.now();
      setNow(timestamp);
      setState((current) => insertTypingData(current, "\n", timestamp));
      return;
    }

    if (event.key.length === 1) {
      event.preventDefault();
      const timestamp = performance.now();
      setNow(timestamp);
      setState((current) => insertTypingData(current, event.key, timestamp));
    }
  };

  const handleTextareaChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    event.currentTarget.value = "";
  };

  const registerWord = useCallback(
    (index: number, element: HTMLDivElement | null) => {
      wordRefs.current[index] = element;
    },
    []
  );

  const registerLetter = useCallback(
    (wordIndex: number, charIndex: number, element: HTMLSpanElement | null) => {
      letterRefs.current[`${wordIndex}:${charIndex}`] = element;
    },
    []
  );

  if (state.status === "finished") {
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
          onClick={focusInput}
          ref={wordsWrapperRef}
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
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            ref={textareaRef}
            spellCheck={false}
          />
          <div
            id="caret"
            className={["full-width", "default", caret.visible ? "" : "hidden"]
              .filter(Boolean)
              .join(" ")}
            style={{
              height: `${caret.height}px`,
              transform: `translate(${caret.left}px, ${caret.top}px)`
            }}
          />
          <WordDisplay
            activeWordIndex={state.activeWordIndex}
            inputs={state.inputs}
            registerLetter={registerLetter}
            registerWord={registerWord}
            status={state.status}
            words={state.words}
            wordsOffsetY={wordsOffsetY}
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
