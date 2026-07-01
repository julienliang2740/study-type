import { Buffer } from "node:buffer";
import { sha256Hex, stableDocumentId } from "./hash.js";
import {
  canonicalizeText,
  countCharacters,
  countWords,
  splitTextBlocks
} from "./textBlocks.js";
import {
  MAX_TEXT_BYTES,
  PROCESS_INPUT_VERSION,
  ProcessInputError
} from "./types.js";
import type {
  ProcessedInputDocument,
  ProcessedInputSource,
  ProcessedInputSourceType,
  ProcessTextRequest
} from "./types.js";

type BuildDocumentInput = {
  title?: string;
  text: string;
  originalTextOverride?: string;
  sourceType: ProcessedInputSourceType;
  source?: Omit<ProcessedInputSource, "sizeBytes" | "sha256">;
  originalSourceBytes?: Buffer;
  pageCount?: number;
  defaultTitle: string;
  createdAt?: Date;
};

export function normalizeTitle(title: string | undefined, fallback: string): string {
  if (title === undefined) return fallback;
  const normalized = title.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : fallback;
}

export function assertProcessableText(text: unknown): asserts text is string {
  if (typeof text !== "string") {
    throw new ProcessInputError(
      400,
      "invalid_text",
      "text must be a string"
    );
  }

  if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) {
    throw new ProcessInputError(
      413,
      "payload_too_large",
      "text exceeds the 10 MiB processing limit"
    );
  }
}

export function buildProcessedDocument({
  title,
  text,
  originalTextOverride,
  sourceType,
  source,
  originalSourceBytes,
  pageCount,
  defaultTitle,
  createdAt = new Date()
}: BuildDocumentInput): ProcessedInputDocument {
  assertProcessableText(text);

  const documentTitle = normalizeTitle(title, defaultTitle);
  const originalText = originalTextOverride ?? text;
  const canonicalText = canonicalizeText(text);
  const blocks = splitTextBlocks(canonicalText);
  const sourceBytes = originalSourceBytes ?? Buffer.from(originalText, "utf8");
  const sourceWithHash: ProcessedInputSource = {
    ...source,
    sizeBytes: sourceBytes.byteLength,
    sha256: sha256Hex(sourceBytes)
  };

  return {
    id: stableDocumentId(sourceType, documentTitle, canonicalText),
    version: PROCESS_INPUT_VERSION,
    title: documentTitle,
    sourceType,
    source: sourceWithHash,
    originalText,
    canonicalText,
    blocks,
    metadata: {
      characterCount: countCharacters(canonicalText),
      wordCount: countWords(canonicalText),
      paragraphCount: blocks.length,
      ...(pageCount === undefined ? {} : { pageCount }),
      createdAt: createdAt.toISOString()
    }
  };
}

export function processTextInput(
  request: Partial<ProcessTextRequest>
): ProcessedInputDocument {
  if (request === null || typeof request !== "object") {
    throw new ProcessInputError(
      400,
      "invalid_request",
      "request body must be an object"
    );
  }

  assertProcessableText(request.text);

  return buildProcessedDocument({
    title: request.title,
    text: request.text,
    sourceType: "paste",
    defaultTitle: "Untitled paste"
  });
}
