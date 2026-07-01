import { Buffer } from "node:buffer";
import { getDocument, VerbosityLevel } from "pdfjs-dist/legacy/build/pdf.mjs";
import { cleanPdfExtractedText } from "./cleanPdfText.js";
import { buildProcessedDocument } from "./processText.js";
import {
  MAX_PDF_BYTES,
  ProcessInputError
} from "./types.js";
import type {
  PdfExtractedText,
  PdfInputRequest,
  PdfTextItemLike
} from "./pdfTypes.js";
import type { ProcessedInputDocument } from "./types.js";

const allowedPdfMimeTypes = new Set([
  "application/pdf",
  "application/octet-stream"
]);

function assertPdfFileName(fileName: unknown): asserts fileName is string {
  if (typeof fileName !== "string" || fileName.trim().length === 0) {
    throw new ProcessInputError(
      400,
      "invalid_request",
      "fileName must be a non-empty string"
    );
  }

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new ProcessInputError(
      400,
      "invalid_file_type",
      "only .pdf files are supported"
    );
  }
}

function assertSupportedPdfMimeType(
  mimeType: unknown
): asserts mimeType is string | undefined {
  if (mimeType === undefined) return;
  if (typeof mimeType !== "string") {
    throw new ProcessInputError(
      400,
      "invalid_request",
      "mimeType must be a string when provided"
    );
  }

  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!allowedPdfMimeTypes.has(normalized)) {
    throw new ProcessInputError(
      400,
      "unsupported_mime_type",
      "only application/pdf content is supported"
    );
  }
}

function decodePdfBase64(dataBase64: unknown): Buffer {
  if (typeof dataBase64 !== "string" || dataBase64.trim().length === 0) {
    throw new ProcessInputError(
      400,
      "invalid_request",
      "dataBase64 must be a non-empty base64 string"
    );
  }

  const normalized = dataBase64.includes(",")
    ? dataBase64.slice(dataBase64.indexOf(",") + 1)
    : dataBase64;
  const compact = normalized.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    throw new ProcessInputError(
      400,
      "invalid_pdf",
      "dataBase64 is not valid base64"
    );
  }

  const bytes = Buffer.from(compact, "base64");
  if (bytes.byteLength === 0) {
    throw new ProcessInputError(400, "invalid_pdf", "PDF payload is empty");
  }

  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new ProcessInputError(
      413,
      "payload_too_large",
      "PDF exceeds the 25 MiB local processing limit"
    );
  }

  if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
    throw new ProcessInputError(
      400,
      "invalid_pdf",
      "payload does not look like a PDF"
    );
  }

  return bytes;
}

function pageItemsToText(items: unknown[]): string {
  let pageText = "";

  for (const item of items as PdfTextItemLike[]) {
    if (typeof item.str !== "string") continue;
    pageText += item.str;
    pageText += item.hasEOL ? "\n" : " ";
  }

  return pageText.trim();
}

async function extractPdfText(pdfBytes: Buffer): Promise<PdfExtractedText> {
  try {
    const loadingTask = getDocument({
      data: new Uint8Array(pdfBytes),
      disableFontFace: true,
      stopAtErrors: false,
      verbosity: VerbosityLevel.ERRORS
    });
    const pdfDocument = await loadingTask.promise;
    const pages: string[] = [];
    const pageCount = pdfDocument.numPages;

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = pageItemsToText(textContent.items);
      if (pageText.length > 0) {
        pages.push(pageText);
      }
      page.cleanup();
    }

    const rawText = pages.join("\n\n");
    const cleanedText = cleanPdfExtractedText(rawText);
    await pdfDocument.cleanup();
    await loadingTask.destroy();

    return {
      rawText,
      cleanedText,
      pageCount
    };
  } catch (error) {
    if (error instanceof ProcessInputError) throw error;
    throw new ProcessInputError(
      422,
      "pdf_extraction_failed",
      error instanceof Error
        ? `PDF text extraction failed: ${error.message}`
        : "PDF text extraction failed"
    );
  }
}

export async function processPdfInput(
  request: Partial<PdfInputRequest>
): Promise<ProcessedInputDocument> {
  if (request === null || typeof request !== "object") {
    throw new ProcessInputError(
      400,
      "invalid_request",
      "request body must be an object"
    );
  }

  assertPdfFileName(request.fileName);
  assertSupportedPdfMimeType(request.mimeType);
  const pdfBytes = decodePdfBase64(request.dataBase64);
  const extracted = await extractPdfText(pdfBytes);

  if (extracted.cleanedText.trim().length === 0) {
    throw new ProcessInputError(
      422,
      "no_extractable_text",
      "PDF has no extractable text; scanned PDFs require OCR, which is not supported yet"
    );
  }

  return buildProcessedDocument({
    title: request.title,
    text: extracted.cleanedText,
    originalTextOverride: extracted.rawText,
    sourceType: "pdf",
    source: {
      fileName: request.fileName,
      mimeType: request.mimeType
    },
    originalSourceBytes: pdfBytes,
    pageCount: extracted.pageCount,
    defaultTitle: request.fileName
  });
}
