import { normalizeText } from "./normalizeText";
import type {
  NormalizationOptions,
  NormalizedTypingText
} from "./types";

export type NormalizeTextRequest = {
  rawText: string;
  options: NormalizationOptions;
};

export type NormalizeTextResponse = NormalizedTypingText;

export async function normalizeTextService({
  rawText,
  options
}: NormalizeTextRequest): Promise<NormalizeTextResponse> {
  return normalizeText(rawText, options);
}
