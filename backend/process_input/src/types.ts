export const PROCESS_INPUT_VERSION = "process_input.v1" as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_BYTES = MAX_UPLOAD_BYTES;
export const MAX_PDF_BYTES = MAX_UPLOAD_BYTES;

export type ProcessedInputVersion = typeof PROCESS_INPUT_VERSION;
export type ProcessedInputSourceType = "paste" | "txt" | "pdf";
export type ProcessedTextBlockType = "paragraph" | "heading" | "unknown";

export type ProcessedInputSource = {
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
};

export type ProcessedTextBlock = {
  id: string;
  order: number;
  type: ProcessedTextBlockType;
  text: string;
};

export type ProcessedInputDocument = {
  id: string;
  version: ProcessedInputVersion;
  title: string;
  sourceType: ProcessedInputSourceType;
  source: ProcessedInputSource;
  originalText: string;
  canonicalText: string;
  blocks: ProcessedTextBlock[];
  metadata: {
    characterCount: number;
    wordCount: number;
    paragraphCount: number;
    pageCount?: number;
    createdAt: string;
  };
};

export type ProcessTextRequest = {
  title?: string;
  text: string;
};

export type ProcessTxtRequest = {
  title?: string;
  fileName: string;
  mimeType?: string;
  text: string;
};

export type ProcessPdfRequest = {
  title?: string;
  fileName: string;
  mimeType?: string;
  dataBase64: string;
};

export type ProcessInputErrorCode =
  | "invalid_json"
  | "invalid_request"
  | "invalid_text"
  | "invalid_file_type"
  | "invalid_pdf"
  | "unsupported_mime_type"
  | "no_extractable_text"
  | "pdf_extraction_failed"
  | "payload_too_large"
  | "not_found"
  | "method_not_allowed";

export type StoredDocumentStatus = "processed";

export type StoredDocumentKeys = {
  originalKey: string;
  processedKey: string;
};

export type StoredProcessedInputResponse = {
  documentId: string;
  status: StoredDocumentStatus;
  title: string;
  sourceType: ProcessedInputSourceType;
  source: ProcessedInputSource;
  metadata: ProcessedInputDocument["metadata"];
  storage: StoredDocumentKeys;
};

export type ProcessInputErrorResponse = {
  error: {
    code: ProcessInputErrorCode;
    message: string;
  };
};

export class ProcessInputError extends Error {
  readonly statusCode: number;
  readonly code: ProcessInputErrorCode;

  constructor(
    statusCode: number,
    code: ProcessInputErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ProcessInputError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
