export { normalizeText, numberToWords } from "./normalizeText";
export { normalizeTextService } from "./service";
export { handleNormalizeRequest } from "./worker";
export { defaultNormalizationOptions } from "./types";
export type {
  CharacterMapEntry,
  NormalizationOptions,
  NormalizedTypingText
} from "./types";
export type {
  NormalizeDocumentRequest,
  NormalizeDocumentResponse,
  NormalizeTextRequest,
  NormalizeTextResponse
} from "./service";
