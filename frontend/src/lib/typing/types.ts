import type { Passage } from "../../types/passage";

export type CommitChar = " " | "\n" | "";

export type TypingDisplayToken =
  | {
      kind: "required";
      char: string;
      inputOffset: number;
    }
  | {
      kind: "faint";
      char: string;
    };

export type TypingWord = {
  text: string;
  textWithCommit: string;
  commit: CommitChar;
  displayTokens: TypingDisplayToken[];
  inputStart: number;
  inputEnd: number;
  sectionIndex: number;
};

export type TypingStatus = "idle" | "running" | "finished";

export type TypingInputEvent = {
  wordIndex: number;
  charIndex: number;
  data: string;
  correct: boolean;
  inputValue: string;
  timestamp: number;
  inputType: "insertText" | "deleteContentBackward" | "deleteWordBackward";
  commitsWord?: true;
  lastWord?: true;
};

export type TypingState = {
  passage: Passage;
  words: TypingWord[];
  inputs: string[];
  activeWordIndex: number;
  status: TypingStatus;
  startedAt: number | null;
  endedAt: number | null;
  events: TypingInputEvent[];
};

export type CharacterStats = {
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
  allCorrect: number;
};

export type TypingResult = {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  elapsedSeconds: number;
  characters: CharacterStats;
  totalKeypresses: number;
};

export type TypingChange = {
  state: TypingState;
  changedWordIndexes: number[];
  finished: boolean;
};
