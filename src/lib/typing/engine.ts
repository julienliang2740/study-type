import type { Passage } from "../../types/passage";
import type { TypingInputEvent, TypingState } from "../../types/typing";
import { createTypingWords, isSpace } from "./words";

export function createInitialTypingState(passage: Passage): TypingState {
  const words = createTypingWords(passage.text);

  return {
    words,
    inputs: Array.from({ length: words.length }, () => ""),
    activeWordIndex: 0,
    status: "idle",
    startedAt: null,
    endedAt: null,
    events: [],
    passageId: passage.id
  };
}

function ensureStarted(state: TypingState, timestamp: number): TypingState {
  if (state.status !== "idle") return state;

  return {
    ...state,
    status: "running",
    startedAt: timestamp
  };
}

function withInput(
  state: TypingState,
  wordIndex: number,
  input: string
): string[] {
  const inputs = [...state.inputs];
  inputs[wordIndex] = input;
  return inputs;
}

function appendEvent(
  state: TypingState,
  event: TypingInputEvent
): TypingInputEvent[] {
  return [...state.events, event];
}

function finishIfNeeded(
  state: TypingState,
  timestamp: number,
  shouldFinish: boolean
): TypingState {
  if (!shouldFinish) return state;

  return {
    ...state,
    status: "finished",
    endedAt: timestamp
  };
}

export function insertTypingData(
  currentState: TypingState,
  data: string,
  timestamp: number
): TypingState {
  if (currentState.status === "finished") return currentState;
  if (currentState.words.length === 0) return currentState;

  let state = ensureStarted(currentState, timestamp);
  const wordIndex = state.activeWordIndex;
  const word = state.words[wordIndex];
  if (word === undefined) return state;

  const currentInput = state.inputs[wordIndex] ?? "";

  if (isSpace(data)) {
    if (currentInput.length === 0) {
      return state;
    }

    const correct = currentInput === word.text;
    const lastWord = wordIndex >= state.words.length - 1;
    const event: TypingInputEvent = {
      wordIndex,
      charIndex: currentInput.length,
      data: " ",
      correct,
      inputValue: currentInput,
      timestamp,
      commitsWord: true
    };

    state = {
      ...state,
      events: appendEvent(state, event),
      activeWordIndex: lastWord ? wordIndex : wordIndex + 1
    };

    return finishIfNeeded(state, timestamp, lastWord);
  }

  if (data === "\n") {
    if (word.commit !== "\n" || currentInput !== word.text) {
      return state;
    }

    const lastWord = wordIndex >= state.words.length - 1;
    const event: TypingInputEvent = {
      wordIndex,
      charIndex: currentInput.length,
      data,
      correct: true,
      inputValue: currentInput,
      timestamp,
      commitsWord: true
    };

    state = {
      ...state,
      events: appendEvent(state, event),
      activeWordIndex: lastWord ? wordIndex : wordIndex + 1
    };

    return finishIfNeeded(state, timestamp, lastWord);
  }

  const targetChar = word.text[currentInput.length];
  const correct = data === targetChar;
  const nextInput = `${currentInput}${data}`;
  const inputs = withInput(state, wordIndex, nextInput);
  const lastWord = wordIndex >= state.words.length - 1;
  const event: TypingInputEvent = {
    wordIndex,
    charIndex: currentInput.length,
    data,
    correct,
    inputValue: nextInput,
    timestamp,
    lastWord: lastWord ? true : undefined
  } as TypingInputEvent;

  state = {
    ...state,
    inputs,
    events: appendEvent(state, event)
  };

  return finishIfNeeded(state, timestamp, lastWord && nextInput === word.text);
}

export function deleteTypingData(
  currentState: TypingState,
  deleteWord: boolean
): TypingState {
  if (currentState.status === "finished" || currentState.status === "idle") {
    return currentState;
  }

  const wordIndex = currentState.activeWordIndex;
  const currentInput = currentState.inputs[wordIndex] ?? "";

  if (currentInput.length > 0) {
    const nextInput = deleteWord ? "" : currentInput.slice(0, -1);
    return {
      ...currentState,
      inputs: withInput(currentState, wordIndex, nextInput)
    };
  }

  if (wordIndex === 0) return currentState;

  const previousIndex = wordIndex - 1;
  const previousWord = currentState.words[previousIndex];
  const previousInput = currentState.inputs[previousIndex] ?? "";

  if (previousWord === undefined || previousInput === previousWord.text) {
    return currentState;
  }

  return {
    ...currentState,
    activeWordIndex: previousIndex,
    inputs: withInput(
      currentState,
      previousIndex,
      deleteWord ? "" : previousInput
    )
  };
}
