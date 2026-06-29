export type CommitChar = " " | "\n" | "";

export type TypingWord = {
  text: string;
  textWithCommit: string;
  commit: CommitChar;
  display: string;
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
