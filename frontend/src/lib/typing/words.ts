import type {
  CommitChar,
  TypingDisplayToken,
  TypingWord
} from "../../types/typing";
import type {
  CharacterMapEntry,
  NormalizedTypingText
} from "../../../../backend/normalization";

const commitCharsToDisplay = new Set<CommitChar>(["\n"]);
const openingPunctuation = new Set(["(", "[", "{"]);
const quotePunctuation = new Set(["'", '"']);

export function normalizePassageText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createRequiredDisplayTokens(word: string): TypingDisplayToken[] {
  return Array.from(word, (char, inputOffset) => ({
    kind: "required",
    char,
    inputOffset
  }));
}

function createTypingWord(
  word: string,
  inputStart: number,
  commit: CommitChar
): TypingWord {
  const displayTokens = createRequiredDisplayTokens(word);

  return {
    text: word,
    textWithCommit: `${word}${commit}`,
    commit,
    display: `${word}${commitCharsToDisplay.has(commit) ? commit : ""}`,
    displayTokens,
    inputStart,
    inputEnd: inputStart + word.length,
    sectionIndex: 0
  };
}

function findWordIndexAtInputIndex(
  words: TypingWord[],
  inputIndex: number
): number {
  return words.findIndex(
    (word) => inputIndex >= word.inputStart && inputIndex < word.inputEnd
  );
}

function findNearbyInputEntry(
  entries: CharacterMapEntry[],
  startIndex: number,
  direction: -1 | 1
): CharacterMapEntry | null {
  for (
    let index = startIndex;
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

function shouldAttachFaintBefore(
  entry: CharacterMapEntry,
  previousEntry: CharacterMapEntry | null,
  nextEntry: CharacterMapEntry | null,
  displayText: string
): boolean {
  if (previousEntry === null) return true;
  if (nextEntry === null) return false;

  if (openingPunctuation.has(entry.displayChar)) return true;

  if (quotePunctuation.has(entry.displayChar)) {
    const previousDisplayChar = displayText[entry.displayIndex - 1];
    return previousDisplayChar === undefined || isSpace(previousDisplayChar);
  }

  return false;
}

function applyFaintDisplayTokens(
  words: TypingWord[],
  normalizedText: NormalizedTypingText
): TypingWord[] {
  const beforeTokens = words.map(() => new Map<number, string[]>());
  const afterTokens = words.map(() => new Map<number, string[]>());
  const entries = normalizedText.characterMap;

  entries.forEach((entry, entryIndex) => {
    if (!entry.faint || entry.required || entry.displayChar === "") return;

    const previousEntry = findNearbyInputEntry(entries, entryIndex - 1, -1);
    const nextEntry = findNearbyInputEntry(entries, entryIndex + 1, 1);
    const attachBefore = shouldAttachFaintBefore(
      entry,
      previousEntry,
      nextEntry,
      normalizedText.displayText
    );
    const targetEntry = attachBefore
      ? nextEntry ?? previousEntry
      : previousEntry ?? nextEntry;
    if (targetEntry?.inputIndex === null || targetEntry?.inputIndex === undefined) {
      return;
    }

    const wordIndex = findWordIndexAtInputIndex(words, targetEntry.inputIndex);
    const word = words[wordIndex];
    if (word === undefined) return;

    const inputOffset = Math.max(
      0,
      Math.min(targetEntry.inputIndex - word.inputStart, word.text.length - 1)
    );
    const placement = attachBefore
      ? beforeTokens[wordIndex]
      : afterTokens[wordIndex];
    const existing = placement.get(inputOffset) ?? [];
    placement.set(inputOffset, [...existing, entry.displayChar]);
  });

  return words.map((word, wordIndex) => {
    const tokens: TypingDisplayToken[] = [];
    for (let index = 0; index < word.text.length; index += 1) {
      for (const char of beforeTokens[wordIndex]?.get(index) ?? []) {
        tokens.push({ kind: "faint", char });
      }

      tokens.push({
        kind: "required",
        char: word.text[index] as string,
        inputOffset: index
      });

      for (const char of afterTokens[wordIndex]?.get(index) ?? []) {
        tokens.push({ kind: "faint", char });
      }
    }

    return {
      ...word,
      displayTokens: tokens,
      display: `${tokens.map((token) => token.char).join("")}${
        commitCharsToDisplay.has(word.commit) ? word.commit : ""
      }`
    };
  });
}

export function createTypingWords(
  text: string,
  normalizedText?: NormalizedTypingText
): TypingWord[] {
  const normalized = normalizePassageText(text);
  const words: TypingWord[] = [];
  const matches = normalized.matchAll(/\S+/g);

  for (const match of matches) {
    const word = match[0];
    const nextChar = normalized[match.index + word.length];
    const commit: CommitChar =
      nextChar === "\n" ? "\n" : nextChar === undefined ? "" : " ";

    words.push(createTypingWord(word, match.index, commit));
  }

  return normalizedText === undefined
    ? words
    : applyFaintDisplayTokens(words, normalizedText);
}

export function isSpace(data: string): boolean {
  return data === " " || data === "\u00a0" || data === "\u3000";
}
