import type { NormalizedTypingText } from "./normalization";

export type PassageSourceKind = "sample" | "import";

export type Passage = {
  id: string;
  title: string;
  source: string;
  sourceKind: PassageSourceKind;
  text: string;
  normalizedText?: NormalizedTypingText;
};
