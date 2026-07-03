import type { Passage } from "../../types/passage";
import { createTypingWords, isSpace } from "./words";
import type {
  TypingChange,
  TypingInputEvent,
  TypingState,
  TypingWord
} from "./types";

const extraCharacterLimit = 20;

function cloneInputs(inputs: string[], wordIndex: number, value: string): string[] {
  const next = [...inputs];
  next[wordIndex] = value;
  return next;
}

function appendEvent(
  state: TypingState,
  event: TypingInputEvent
): TypingInputEvent[] {
  return [...state.events, event];
}

function startIfNeeded(state: TypingState, timestamp: number): TypingState {
  if (state.status !== "idle") return state;
  return {
    ...state,
    status: "running",
    startedAt: timestamp
  };
}

function finishState(state: TypingState, timestamp: number): TypingState {
  return {
    ...state,
    status: "finished",
    endedAt: timestamp
  };
}

function getWord(state: TypingState): TypingWord | undefined {
  return state.words[state.activeWordIndex];
}

function canCommitWith(data: string, word: TypingWord): boolean {
  if (word.commit === "\n") return data === "\n";
  return isSpace(data);
}

function isWordComplete(input: string, word: TypingWord): boolean {
  return input === word.text;
}

export function createInitialTypingState(passage: Passage): TypingState {
  const text = passage.normalizedText?.inputText ?? passage.text;
  const words = createTypingWords(text, passage.normalizedText);

  return {
    passage,
    words,
    inputs: Array.from({ length: words.length }, () => ""),
    activeWordIndex: 0,
    status: "idle",
    startedAt: null,
    endedAt: null,
    events: []
  };
}

export function insertTypingData(
  currentState: TypingState,
  data: string,
  timestamp: number
): TypingChange {
  if (currentState.status === "finished" || currentState.words.length === 0) {
    return { state: currentState, changedWordIndexes: [], finished: false };
  }

  const word = getWord(currentState);
  if (word === undefined) {
    return { state: currentState, changedWordIndexes: [], finished: false };
  }

  const wordIndex = currentState.activeWordIndex;
  const currentInput = currentState.inputs[wordIndex] ?? "";
  const isCommitKey = canCommitWith(data, word);

  if (isCommitKey) {
    if (currentInput.length === 0) {
      return { state: currentState, changedWordIndexes: [], finished: false };
    }

    let state = startIfNeeded(currentState, timestamp);
    const correct = isWordComplete(currentInput, word);
    const lastWord = wordIndex >= state.words.length - 1;
    const event: TypingInputEvent = {
      wordIndex,
      charIndex: currentInput.length,
      data: word.commit === "\n" ? "\n" : " ",
      correct,
      inputValue: currentInput,
      timestamp,
      inputType: "insertText",
      commitsWord: true,
      lastWord: lastWord ? true : undefined
    };

    state = {
      ...state,
      events: appendEvent(state, event),
      activeWordIndex: lastWord ? wordIndex : wordIndex + 1
    };

    return {
      state: lastWord ? finishState(state, timestamp) : state,
      changedWordIndexes: lastWord ? [wordIndex] : [wordIndex, wordIndex + 1],
      finished: lastWord
    };
  }

  if (isSpace(data) || data === "\n") {
    return { state: currentState, changedWordIndexes: [], finished: false };
  }

  if (currentInput.length >= word.text.length + extraCharacterLimit) {
    return { state: currentState, changedWordIndexes: [], finished: false };
  }

  let state = startIfNeeded(currentState, timestamp);
  const charIndex = currentInput.length;
  const nextInput = `${currentInput}${data}`;
  const targetChar = word.text[charIndex];
  const correct = data === targetChar;
  const lastWord = wordIndex >= state.words.length - 1;
  const finished = lastWord && nextInput === word.text;
  const event: TypingInputEvent = {
    wordIndex,
    charIndex,
    data,
    correct,
    inputValue: nextInput,
    timestamp,
    inputType: "insertText",
    lastWord: lastWord ? true : undefined
  };

  state = {
    ...state,
    inputs: cloneInputs(state.inputs, wordIndex, nextInput),
    events: appendEvent(state, event)
  };

  return {
    state: finished ? finishState(state, timestamp) : state,
    changedWordIndexes: [wordIndex],
    finished
  };
}

export function deleteTypingData(
  currentState: TypingState,
  deleteWord: boolean,
  timestamp: number
): TypingChange {
  if (currentState.status === "finished" || currentState.status === "idle") {
    return { state: currentState, changedWordIndexes: [], finished: false };
  }

  const wordIndex = currentState.activeWordIndex;
  const currentInput = currentState.inputs[wordIndex] ?? "";

  if (currentInput.length > 0) {
    const nextInput = deleteWord ? "" : currentInput.slice(0, -1);
    const state = {
      ...currentState,
      inputs: cloneInputs(currentState.inputs, wordIndex, nextInput),
      events: appendEvent(currentState, {
        wordIndex,
        charIndex: currentInput.length,
        data: "",
        correct: true,
        inputValue: nextInput,
        timestamp,
        inputType: deleteWord ? "deleteWordBackward" : "deleteContentBackward"
      })
    };

    return { state, changedWordIndexes: [wordIndex], finished: false };
  }

  if (wordIndex === 0) {
    return { state: currentState, changedWordIndexes: [], finished: false };
  }

  const previousIndex = wordIndex - 1;
  const previousInput = currentState.inputs[previousIndex] ?? "";
  const nextPreviousInput = deleteWord ? "" : previousInput;
  const state = {
    ...currentState,
    activeWordIndex: previousIndex,
    inputs: cloneInputs(currentState.inputs, previousIndex, nextPreviousInput),
    events: appendEvent(currentState, {
      wordIndex: previousIndex,
      charIndex: previousInput.length,
      data: "",
      correct: true,
      inputValue: nextPreviousInput,
      timestamp,
      inputType: deleteWord ? "deleteWordBackward" : "deleteContentBackward"
    })
  };

  return {
    state,
    changedWordIndexes: [previousIndex, wordIndex],
    finished: false
  };
}
