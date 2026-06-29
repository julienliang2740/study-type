import type { CommitChar, TypingWord } from "../../types/typing";

const commitCharsToDisplay = new Set<CommitChar>(["\n"]);

export function normalizePassageText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function createTypingWords(text: string): TypingWord[] {
  const normalized = normalizePassageText(text);
  const words: TypingWord[] = [];
  const matches = normalized.matchAll(/\S+/g);

  for (const match of matches) {
    const word = match[0];
    const nextChar = normalized[match.index + word.length];
    const commit: CommitChar =
      nextChar === "\n" ? "\n" : nextChar === undefined ? "" : " ";

    words.push({
      text: word,
      textWithCommit: `${word}${commit}`,
      commit,
      display: `${word}${commitCharsToDisplay.has(commit) ? commit : ""}`,
      sectionIndex: 0
    });
  }

  return words;
}

export function isSpace(data: string): boolean {
  return data === " " || data === "\u00a0" || data === "\u3000";
}
