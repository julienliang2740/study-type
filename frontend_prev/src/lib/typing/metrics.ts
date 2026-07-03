import type { TypingResult, TypingState } from "../../types/typing";

type CharCounts = {
  allCorrect: number;
  correctWord: number;
  incorrect: number;
  extra: number;
  missed: number;
};

function roundTo2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateWpm(
  charCount: number,
  durationSeconds: number
): number {
  if (durationSeconds <= 0) return 0;
  return charCount / 5 / (durationSeconds / 60);
}

export function countChars(
  inputWord: string,
  targetWord: string,
  creditPartial: boolean
): CharCounts {
  let allCorrect = 0;
  let correctWord = 0;
  let incorrect = 0;
  let extra = 0;
  let missed = 0;

  const wordCorrect = inputWord === targetWord;
  const wordPartiallyCorrect = targetWord.startsWith(inputWord);

  for (let i = 0; i < Math.max(inputWord.length, targetWord.length); i += 1) {
    const inputChar = inputWord[i];
    const targetChar = targetWord[i];

    if (inputChar === targetChar) {
      if (targetChar === " " && !wordCorrect) {
        extra += 1;
      } else {
        allCorrect += 1;
      }
      if (wordCorrect || (creditPartial && wordPartiallyCorrect)) {
        correctWord += 1;
      }
    } else if (inputChar === undefined) {
      if (!creditPartial) {
        missed += 1;
      }
    } else if (
      targetChar === undefined ||
      (targetChar === " " && inputChar !== " " && !inputWord.includes(" "))
    ) {
      extra += 1;
    } else {
      incorrect += 1;
    }
  }

  return {
    allCorrect,
    correctWord,
    incorrect,
    extra,
    missed
  };
}

export function getElapsedSeconds(
  state: Pick<TypingState, "startedAt" | "endedAt" | "status">,
  now: number
): number {
  if (state.startedAt === null) return 0;
  const end = state.status === "finished" ? state.endedAt ?? now : now;
  return Math.max(0, (end - state.startedAt) / 1000);
}

export function buildTypingResult(
  state: TypingState,
  now = performance.now()
): TypingResult {
  const elapsedSeconds = getElapsedSeconds(state, now);
  const totals: CharCounts = {
    allCorrect: 0,
    correctWord: 0,
    incorrect: 0,
    extra: 0,
    missed: 0
  };

  const lastScoredWordIndex =
    state.status === "finished"
      ? state.words.length - 1
      : state.activeWordIndex;

  for (let i = 0; i <= lastScoredWordIndex; i += 1) {
    const word = state.words[i];
    if (word === undefined) continue;

    const lastWord = i === state.words.length - 1;
    const input = state.inputs[i] ?? "";
    const inputWithCommit = lastWord ? input : `${input} `;
    const targetWithCommit = lastWord ? word.text : `${word.text} `;
    const counts = countChars(inputWithCommit, targetWithCommit, false);

    totals.allCorrect += counts.allCorrect;
    totals.correctWord += counts.correctWord;
    totals.incorrect += counts.incorrect;
    totals.extra += counts.extra;
    totals.missed += counts.missed;
  }

  const correctEvents = state.events.filter((event) => event.correct).length;
  const scoredEvents = state.events.length;
  const accuracy =
    scoredEvents === 0 ? 0 : roundTo2((correctEvents / scoredEvents) * 100);

  return {
    wpm: roundTo2(calculateWpm(totals.correctWord, elapsedSeconds)),
    accuracy,
    elapsedSeconds: roundTo2(elapsedSeconds),
    correctCharacters: totals.correctWord,
    totalKeypresses: scoredEvents
  };
}
