export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type ProcessedInputSourceType = "paste" | "txt" | "pdf";

export type ProcessedTextBlock = {
  id: string;
  order: number;
  type: "paragraph" | "heading" | "unknown";
  text: string;
};

export type ProcessedInputDocument = {
  id: string;
  version: "process_input.v1";
  title: string;
  sourceType: ProcessedInputSourceType;
  source: {
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    sha256?: string;
  };
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

export type ProcessedDocumentSummary = {
  documentId: string;
  status: "processed";
  title: string;
  sourceType: ProcessedInputSourceType;
  source: ProcessedInputDocument["source"];
  metadata: ProcessedInputDocument["metadata"];
  storage: {
    originalKey: string;
    processedKey: string;
  };
};

type ProcessInputErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

const processInputApiUrl =
  import.meta.env.VITE_PROCESS_INPUT_API_URL ?? "http://127.0.0.1:8788";

function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function formatUploadLimit(): string {
  return `${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MiB`;
}

function assertFileSize(file: File): void {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File uploads are limited to ${formatUploadLimit()}.`);
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

async function postJson<TResponse>(
  path: string,
  body: object
): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(`${processInputApiUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error(
      `Could not reach process_input at ${processInputApiUrl}. Start backend/process_input with npm run dev:worker.`
    );
  }

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => ({}))) as ProcessInputErrorResponse;
    throw new Error(
      errorBody.error?.message ??
        `process_input failed with status ${response.status}`
    );
  }

  return (await response.json()) as TResponse;
}

async function getJson<TResponse>(path: string): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(`${processInputApiUrl}${path}`);
  } catch {
    throw new Error(
      `Could not reach process_input at ${processInputApiUrl}. Start backend/process_input with npm run dev:worker.`
    );
  }

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => ({}))) as ProcessInputErrorResponse;
    throw new Error(
      errorBody.error?.message ??
        `process_input failed with status ${response.status}`
    );
  }

  return (await response.json()) as TResponse;
}

export async function processPastedText({
  title,
  text
}: {
  title?: string;
  text: string;
}): Promise<ProcessedDocumentSummary> {
  return postJson<ProcessedDocumentSummary>("/api/process/text", {
    title,
    text
  });
}

export async function processImportFile(
  file: File
): Promise<ProcessedDocumentSummary> {
  assertFileSize(file);
  const extension = getFileExtension(file.name);

  if (extension === ".txt" || file.type === "text/plain") {
    return postJson<ProcessedDocumentSummary>("/api/process/txt", {
      title: file.name,
      fileName: file.name,
      mimeType: file.type || "text/plain",
      text: await file.text()
    });
  }

  if (extension === ".pdf" || file.type === "application/pdf") {
    return postJson<ProcessedDocumentSummary>("/api/process/pdf", {
      title: file.name,
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      dataBase64: arrayBufferToBase64(await file.arrayBuffer())
    });
  }

  throw new Error("Choose a .txt or text-based .pdf file.");
}

export async function getProcessedDocument(
  documentId: string
): Promise<ProcessedInputDocument> {
  return getJson<ProcessedInputDocument>(
    `/api/documents/${encodeURIComponent(documentId)}/processed`
  );
}
