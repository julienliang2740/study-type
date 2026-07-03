import type { CharacterStats, TypingResult, TypingState } from "./types";

function roundTo2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateWpm(characters: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  return characters / 5 / (elapsedSeconds / 60);
}

function emptyStats(): CharacterStats {
  return {
    correct: 0,
    incorrect: 0,
    extra: 0,
    missed: 0,
    allCorrect: 0
  };
}

export function countWordCharacters(
  input: string,
  target: string,
  includeMissed: boolean
): CharacterStats {
  const stats = emptyStats();
  const limit = Math.max(input.length, target.length);

  for (let index = 0; index < limit; index += 1) {
    const inputChar = input[index];
    const targetChar = target[index];

    if (inputChar === targetChar && inputChar !== undefined) {
      stats.correct += 1;
      stats.allCorrect += 1;
    } else if (inputChar === undefined) {
      if (includeMissed) {
        stats.missed += 1;
      }
    } else if (targetChar === undefined) {
      stats.extra += 1;
    } else {
      stats.incorrect += 1;
    }
  }

  return stats;
}

export function getElapsedSeconds(state: TypingState, now: number): number {
  if (state.startedAt === null) return 0;
  const end = state.status === "finished" ? state.endedAt ?? now : now;
  return Math.max(0, (end - state.startedAt) / 1000);
}

export function buildCharacterStats(state: TypingState): CharacterStats {
  const totals = emptyStats();
  const finalWordIndex =
    state.status === "finished"
      ? state.words.length - 1
      : Math.min(state.activeWordIndex, state.words.length - 1);

  for (let index = 0; index <= finalWordIndex; index += 1) {
    const word = state.words[index];
    if (word === undefined) continue;

    const input = state.inputs[index] ?? "";
    const lastWord = index === state.words.length - 1;
    const inputWithCommit = lastWord ? input : `${input}${word.commit || " "}`;
    const targetWithCommit = lastWord ? word.text : word.textWithCommit || word.text;
    const counts = countWordCharacters(
      inputWithCommit,
      targetWithCommit,
      state.status === "finished" || index < state.activeWordIndex
    );

    totals.correct += counts.correct;
    totals.incorrect += counts.incorrect;
    totals.extra += counts.extra;
    totals.missed += counts.missed;
    totals.allCorrect += counts.allCorrect;
  }

  return totals;
}

export function buildTypingResult(
  state: TypingState,
  now = performance.now()
): TypingResult {
  const elapsedSeconds = roundTo2(getElapsedSeconds(state, now));
  const characters = buildCharacterStats(state);
  const insertEvents = state.events.filter(
    (event) => event.inputType === "insertText"
  );
  const correctKeypresses = insertEvents.filter((event) => event.correct).length;
  const accuracy =
    insertEvents.length === 0
      ? 0
      : roundTo2((correctKeypresses / insertEvents.length) * 100);
  const rawCharacters =
    characters.allCorrect + characters.incorrect + characters.extra;

  return {
    wpm: roundTo2(calculateWpm(characters.correct, elapsedSeconds)),
    rawWpm: roundTo2(calculateWpm(rawCharacters, elapsedSeconds)),
    accuracy,
    elapsedSeconds,
    characters,
    totalKeypresses: insertEvents.length
  };
}
