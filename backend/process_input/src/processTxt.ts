import { assertProcessableText, buildProcessedDocument } from "./processText.js";
import { ProcessInputError } from "./types.js";
import type { ProcessedInputDocument, ProcessTxtRequest } from "./types.js";

const allowedTxtMimeTypes = new Set([
  "text/plain",
  "application/octet-stream"
]);

function assertTxtFileName(fileName: unknown): asserts fileName is string {
  if (typeof fileName !== "string" || fileName.trim().length === 0) {
    throw new ProcessInputError(
      400,
      "invalid_request",
      "fileName must be a non-empty string"
    );
  }

  if (!fileName.toLowerCase().endsWith(".txt")) {
    throw new ProcessInputError(
      400,
      "invalid_file_type",
      "only .txt files are supported"
    );
  }
}

function assertSupportedMimeType(mimeType: unknown): asserts mimeType is string | undefined {
  if (mimeType === undefined) return;
  if (typeof mimeType !== "string") {
    throw new ProcessInputError(
      400,
      "invalid_request",
      "mimeType must be a string when provided"
    );
  }

  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!allowedTxtMimeTypes.has(normalized)) {
    throw new ProcessInputError(
      400,
      "unsupported_mime_type",
      "only text/plain .txt content is supported"
    );
  }
}

export function processTxtInput(
  request: Partial<ProcessTxtRequest>
): ProcessedInputDocument {
  if (request === null || typeof request !== "object") {
    throw new ProcessInputError(
      400,
      "invalid_request",
      "request body must be an object"
    );
  }

  assertTxtFileName(request.fileName);
  assertSupportedMimeType(request.mimeType);
  assertProcessableText(request.text);

  return buildProcessedDocument({
    title: request.title,
    text: request.text,
    sourceType: "txt",
    source: {
      fileName: request.fileName,
      mimeType: request.mimeType
    },
    defaultTitle: request.fileName
  });
}
