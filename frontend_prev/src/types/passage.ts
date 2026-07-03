import type { NormalizedTypingText } from "../services/normalizationClient";

export type Passage = {
  id: string;
  title: string;
  source: string;
  text: string;
  normalizedText?: NormalizedTypingText;
};
