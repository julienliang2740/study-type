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
  display: string;
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
  commitsWord?: true;
  lastWord?: true;
};

export type TypingState = {
  words: TypingWord[];
  inputs: string[];
  activeWordIndex: number;
  status: TypingStatus;
  startedAt: number | null;
  endedAt: number | null;
  events: TypingInputEvent[];
  passageId: string;
};

export type TypingResult = {
  wpm: number;
  accuracy: number;
  elapsedSeconds: number;
  correctCharacters: number;
  totalKeypresses: number;
};
