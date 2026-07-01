import { decodePdfBase64 } from "./processPdf.js";
import { processPdfInput } from "./processPdf.js";
import { processTextInput } from "./processText.js";
import { processTxtInput } from "./processTxt.js";
import {
  ProcessInputError,
  type ProcessTextRequest,
  type ProcessTxtRequest
} from "./types.js";
import type { ProcessPdfRequest, StoredProcessedInputResponse } from "./types.js";
import {
  createStoredDocumentResponse,
  type ProcessInputStorage,
  type SourceObjectForStorage
} from "./storage.js";

const textEncoder = new TextEncoder();

function assertObject(body: unknown): asserts body is Record<string, unknown> {
  if (body === null || typeof body !== "object") {
    throw new ProcessInputError(
      400,
      "invalid_request",
      "request body must be an object"
    );
  }
}

function utf8Source(text: string): SourceObjectForStorage {
  return {
    bytes: textEncoder.encode(text),
    contentType: "text/plain; charset=utf-8"
  };
}

function normalizeMimeType(mimeType: unknown, fallback: string): string {
  return typeof mimeType === "string" && mimeType.trim().length > 0
    ? mimeType
    : fallback;
}

export async function processTextAndStore(
  body: unknown,
  storage: ProcessInputStorage
): Promise<StoredProcessedInputResponse> {
  assertObject(body);
  const request = body as Partial<ProcessTextRequest>;
  const document = processTextInput(request);
  const stored = await storage.saveProcessedDocument(
    document,
    utf8Source(request.text ?? "")
  );
  return createStoredDocumentResponse(stored);
}

export async function processTxtAndStore(
  body: unknown,
  storage: ProcessInputStorage
): Promise<StoredProcessedInputResponse> {
  assertObject(body);
  const request = body as Partial<ProcessTxtRequest>;
  const document = processTxtInput(request);
  const source = utf8Source(request.text ?? "");
  const stored = await storage.saveProcessedDocument(document, {
    ...source,
    contentType: normalizeMimeType(request.mimeType, source.contentType)
  });
  return createStoredDocumentResponse(stored);
}

export async function processPdfAndStore(
  body: unknown,
  storage: ProcessInputStorage
): Promise<StoredProcessedInputResponse> {
  assertObject(body);
  const request = body as Partial<ProcessPdfRequest>;
  const document = await processPdfInput(request);
  const pdfBytes = decodePdfBase64(request.dataBase64);
  const stored = await storage.saveProcessedDocument(document, {
    bytes: new Uint8Array(pdfBytes),
    contentType: normalizeMimeType(request.mimeType, "application/pdf")
  });
  return createStoredDocumentResponse(stored);
}
