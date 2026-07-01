import { normalizeText } from "./normalizeText";
import { defaultNormalizationOptions } from "./types";
import type {
  NormalizationOptions,
  NormalizedTypingText
} from "./types";

export type NormalizeTextRequest = {
  rawText: string;
  options?: NormalizationOptions;
};

export type NormalizeDocumentRequest = {
  documentId: string;
  options?: NormalizationOptions;
};

export type NormalizeTextResponse = NormalizedTypingText;

export type NormalizeDocumentResponse = NormalizedTypingText & {
  documentId: string;
  metadata: {
    characterCount: number;
    wordCount: number;
  };
};

function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

export function buildNormalizeDocumentResponse(
  documentId: string,
  normalizedText: NormalizedTypingText
): NormalizeDocumentResponse {
  return {
    documentId,
    ...normalizedText,
    metadata: {
      characterCount: Array.from(normalizedText.inputText).length,
      wordCount: countWords(normalizedText.inputText)
    }
  };
}

export async function normalizeTextService({
  rawText,
  options
}: NormalizeTextRequest): Promise<NormalizeTextResponse> {
  return normalizeText(rawText, options ?? defaultNormalizationOptions);
}
