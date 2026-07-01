import { stableBlockId } from "./hash.js";
import type { ProcessedTextBlock, ProcessedTextBlockType } from "./types.js";

export function canonicalizeText(originalText: string): string {
  return originalText
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .normalize("NFC")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getWordCount(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

function isLikelyHeading(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (/^#{1,6}\s+\S/.test(trimmed)) return true;
  if (/^(chapter|section|part|book|appendix|prologue|epilogue)\b/i.test(trimmed)) {
    return trimmed.length <= 100;
  }
  if (trimmed.length <= 80 && getWordCount(trimmed) <= 10) {
    if (/^[A-Z0-9][A-Z0-9\s:;'",-]+$/.test(trimmed)) return true;
    if (/^[A-Z0-9]/.test(trimmed) && !/[.!?]$/.test(trimmed)) {
      return /^([A-Z][\w'-]*|\d+|[IVXLCDM]+)(\s+([A-Z][\w'-]*|\d+|[IVXLCDM]+))*$/.test(
        trimmed
      );
    }
  }
  return false;
}

function getBlockType(text: string): ProcessedTextBlockType {
  if (text.trim().length === 0) return "unknown";
  return isLikelyHeading(text) ? "heading" : "paragraph";
}

export function splitTextBlocks(canonicalText: string): ProcessedTextBlock[] {
  if (canonicalText.trim().length === 0) return [];

  return canonicalText
    .split(/\n{2,}/)
    .map((blockText) => blockText.trim())
    .filter((blockText) => blockText.length > 0)
    .map((text, index) => ({
      id: stableBlockId(index, text),
      order: index,
      type: getBlockType(text),
      text
    }));
}

export function countCharacters(text: string): number {
  return Array.from(text).length;
}

export function countWords(text: string): number {
  return getWordCount(text);
}
