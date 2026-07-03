import { getJson, postJson } from "./http";
import type {
  ProcessedDocumentSummary,
  ProcessedInputDocument
} from "../types/processInput";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const processInputApiUrl =
  import.meta.env.VITE_PROCESS_INPUT_API_URL ?? "http://127.0.0.1:8788";

const processInputUnavailableMessage = `Could not reach process_input at ${processInputApiUrl}. Start backend/process_input with npm run dev:worker.`;

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export function formatUploadLimit(): string {
  return `${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MiB`;
}

function assertSupportedUpload(file: File): void {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File uploads are limited to ${formatUploadLimit()}.`);
  }

  const extension = getFileExtension(file.name);
  const supported =
    extension === ".txt" ||
    extension === ".pdf" ||
    file.type === "text/plain" ||
    file.type === "application/pdf";

  if (!supported) {
    throw new Error("Choose a .txt or text-based .pdf file.");
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
}

export async function processPastedText({
  title,
  text
}: {
  title?: string;
  text: string;
}): Promise<ProcessedDocumentSummary> {
  return postJson<ProcessedDocumentSummary>(
    processInputApiUrl,
    "/api/process/text",
    { title, text },
    "process_input",
    processInputUnavailableMessage
  );
}

export async function processImportFile(
  file: File
): Promise<ProcessedDocumentSummary> {
  assertSupportedUpload(file);

  const extension = getFileExtension(file.name);
  const isTxt = extension === ".txt" || file.type === "text/plain";

  if (isTxt) {
    return postJson<ProcessedDocumentSummary>(
      processInputApiUrl,
      "/api/process/txt",
      {
        title: file.name,
        fileName: file.name,
        mimeType: file.type || "text/plain",
        text: await file.text()
      },
      "process_input",
      processInputUnavailableMessage
    );
  }

  return postJson<ProcessedDocumentSummary>(
    processInputApiUrl,
    "/api/process/pdf",
    {
      title: file.name,
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      dataBase64: arrayBufferToBase64(await file.arrayBuffer())
    },
    "process_input",
    processInputUnavailableMessage
  );
}

export async function getProcessedDocument(
  documentId: string
): Promise<ProcessedInputDocument> {
  return getJson<ProcessedInputDocument>(
    processInputApiUrl,
    `/api/documents/${encodeURIComponent(documentId)}/processed`,
    "process_input",
    processInputUnavailableMessage
  );
}
