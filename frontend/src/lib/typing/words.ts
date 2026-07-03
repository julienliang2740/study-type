import type { CharacterMapEntry } from "../../types/normalization";
import type { NormalizedTypingText } from "../../types/normalization";
import type {
  CommitChar,
  TypingDisplayToken,
  TypingWord
} from "./types";

const displayCommitChars = new Set<CommitChar>(["\n"]);
const openingMarks = new Set(["(", "[", "{"]);
const quoteMarks = new Set(["'", '"']);

export function normalizeTypingText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isSpace(data: string): boolean {
  return data === " " || data === "\u00a0" || data === "\u3000";
}

function requiredTokens(word: string): TypingDisplayToken[] {
  return Array.from(word, (char, inputOffset) => ({
    kind: "required",
    char,
    inputOffset
  }));
}

function createWord(
  text: string,
  inputStart: number,
  commit: CommitChar,
  sectionIndex: number
): TypingWord {
  return {
    text,
    textWithCommit: `${text}${commit}`,
    commit,
    displayTokens: requiredTokens(text),
    inputStart,
    inputEnd: inputStart + text.length,
    sectionIndex
  };
}

function nearestRequiredEntry(
  entries: CharacterMapEntry[],
  from: number,
  direction: -1 | 1
): CharacterMapEntry | null {
  for (
    let index = from;
    index >= 0 && index < entries.length;
    index += direction
  ) {
    const entry = entries[index];
    if (
      entry !== undefined &&
      entry.inputIndex !== null &&
      entry.inputChar !== null &&
      !isSpace(entry.inputChar) &&
      entry.inputChar !== "\n"
    ) {
      return entry;
    }
  }

  return null;
}

function wordIndexForInputIndex(
  words: TypingWord[],
  inputIndex: number
): number {
  return words.findIndex(
    (word) => inputIndex >= word.inputStart && inputIndex < word.inputEnd
  );
}

function faintGoesBefore(
  entry: CharacterMapEntry,
  previous: CharacterMapEntry | null,
  next: CharacterMapEntry | null,
  displayText: string
): boolean {
  if (previous === null) return true;
  if (next === null) return false;
  if (openingMarks.has(entry.displayChar)) return true;

  if (quoteMarks.has(entry.displayChar)) {
    const previousDisplay = displayText[entry.displayIndex - 1];
    return previousDisplay === undefined || /\s/.test(previousDisplay);
  }

  return false;
}

function attachFaintTokens(
  words: TypingWord[],
  normalizedText: NormalizedTypingText
): TypingWord[] {
  const before = words.map(() => new Map<number, string[]>());
  const after = words.map(() => new Map<number, string[]>());
  const entries = normalizedText.characterMap;

  entries.forEach((entry, entryIndex) => {
    if (!entry.faint || entry.required || entry.displayChar === "") return;

    const previous = nearestRequiredEntry(entries, entryIndex - 1, -1);
    const next = nearestRequiredEntry(entries, entryIndex + 1, 1);
    const placeBefore = faintGoesBefore(
      entry,
      previous,
      next,
      normalizedText.displayText
    );
    const anchor = placeBefore ? next ?? previous : previous ?? next;

    if (anchor?.inputIndex === null || anchor?.inputIndex === undefined) {
      return;
    }

    const wordIndex = wordIndexForInputIndex(words, anchor.inputIndex);
    const word = words[wordIndex];
    if (word === undefined) return;

    const offset = Math.max(
      0,
      Math.min(anchor.inputIndex - word.inputStart, word.text.length - 1)
    );
    const targetMap = placeBefore ? before[wordIndex] : after[wordIndex];
    const existing = targetMap?.get(offset) ?? [];
    targetMap?.set(offset, [...existing, entry.displayChar]);
  });

  return words.map((word, wordIndex) => {
    const tokens: TypingDisplayToken[] = [];

    for (let index = 0; index < word.text.length; index += 1) {
      for (const char of before[wordIndex]?.get(index) ?? []) {
        tokens.push({ kind: "faint", char });
      }

      tokens.push({
        kind: "required",
        char: word.text[index] as string,
        inputOffset: index
      });

      for (const char of after[wordIndex]?.get(index) ?? []) {
        tokens.push({ kind: "faint", char });
      }
    }

    if (displayCommitChars.has(word.commit)) {
      tokens.push({ kind: "faint", char: "↵" });
    }

    return {
      ...word,
      displayTokens: tokens
    };
  });
}

export function createTypingWords(
  text: string,
  normalizedText?: NormalizedTypingText
): TypingWord[] {
  const normalized = normalizeTypingText(text);
  const words: TypingWord[] = [];
  const matches = normalized.matchAll(/\S+/g);
  let sectionIndex = 0;

  for (const match of matches) {
    const wordText = match[0];
    const wordStart = match.index;
    const nextChar = normalized[wordStart + wordText.length];
    const commit: CommitChar =
      nextChar === "\n" ? "\n" : nextChar === undefined ? "" : " ";

    words.push(createWord(wordText, wordStart, commit, sectionIndex));

    if (commit === "\n") {
      sectionIndex += 1;
    }
  }

  return normalizedText === undefined
    ? words
    : attachFaintTokens(words, normalizedText);
}
