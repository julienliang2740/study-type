import {
  processPdfAndStore,
  processTextAndStore,
  processTxtAndStore
} from "./processAndStore.js";
import {
  createStoredDocumentResponse,
  getDocumentStorageKeys,
  R2ProcessInputStorage,
  type R2BucketLike
} from "./storage.js";
import {
  MAX_PDF_BYTES,
  ProcessInputError,
  PROCESS_INPUT_VERSION
} from "./types.js";
import type { ProcessInputErrorResponse } from "./types.js";

type ProcessInputWorkerEnv = {
  TYPE_STUDY_DOCUMENTS: R2BucketLike;
};

const MAX_JSON_BODY_BYTES = Math.ceil((MAX_PDF_BYTES * 4) / 3) + 64 * 1024;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-origin": "*",
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function emptyResponse(status = 204): Response {
  return new Response(null, {
    status,
    headers: {
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-origin": "*"
    }
  });
}

function errorResponse(error: ProcessInputError): Response {
  const body: ProcessInputErrorResponse = {
    error: {
      code: error.code,
      message: error.message
    }
  };
  return jsonResponse(body, error.statusCode);
}

function toProcessInputError(error: unknown): ProcessInputError {
  if (error instanceof ProcessInputError) return error;
  return new ProcessInputError(
    500,
    "invalid_request",
    error instanceof Error ? error.message : "unknown processing error"
  );
}

async function readJsonBody(request: Request): Promise<unknown> {
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_JSON_BODY_BYTES) {
    throw new ProcessInputError(
      413,
      "payload_too_large",
      "request body exceeds the processing limit"
    );
  }

  if (rawBody.trim().length === 0) {
    throw new ProcessInputError(
      400,
      "invalid_json",
      "request body must be valid JSON"
    );
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new ProcessInputError(
      400,
      "invalid_json",
      "request body must be valid JSON"
    );
  }
}

function getDocumentIdFromProcessedPath(pathname: string): string | null {
  const match = /^\/api\/documents\/([^/]+)\/processed$/.exec(pathname);
  return match?.[1] === undefined ? null : decodeURIComponent(match[1]);
}

function getDocumentIdFromDocumentPath(pathname: string): string | null {
  const match = /^\/api\/documents\/([^/]+)$/.exec(pathname);
  return match?.[1] === undefined ? null : decodeURIComponent(match[1]);
}

async function handleProcessInputRequest(
  request: Request,
  env: ProcessInputWorkerEnv
): Promise<Response> {
  const url = new URL(request.url);
  const storage = new R2ProcessInputStorage(env.TYPE_STUDY_DOCUMENTS);

  if (request.method === "OPTIONS") return emptyResponse();

  if (
    request.method === "GET" &&
    (url.pathname === "/health" || url.pathname === "/api/health")
  ) {
    return jsonResponse({
      ok: true,
      service: "process_input",
      version: PROCESS_INPUT_VERSION
    });
  }

  if (request.method === "POST" && url.pathname === "/api/process/text") {
    return jsonResponse(await processTextAndStore(await readJsonBody(request), storage));
  }

  if (request.method === "POST" && url.pathname === "/api/process/txt") {
    return jsonResponse(await processTxtAndStore(await readJsonBody(request), storage));
  }

  if (request.method === "POST" && url.pathname === "/api/process/pdf") {
    return jsonResponse(await processPdfAndStore(await readJsonBody(request), storage));
  }

  const processedDocumentId = getDocumentIdFromProcessedPath(url.pathname);
  if (request.method === "GET" && processedDocumentId !== null) {
    const document = await storage.getProcessedDocument(processedDocumentId);
    if (document === null) {
      throw new ProcessInputError(404, "not_found", "document not found");
    }
    return jsonResponse(document);
  }

  const documentId = getDocumentIdFromDocumentPath(url.pathname);
  if (request.method === "GET" && documentId !== null) {
    const document = await storage.getProcessedDocument(documentId);
    if (document === null) {
      throw new ProcessInputError(404, "not_found", "document not found");
    }
    return jsonResponse(
      createStoredDocumentResponse({
        document,
        storage: getDocumentStorageKeys(document.id, document.sourceType)
      })
    );
  }

  throw new ProcessInputError(404, "not_found", "endpoint not found");
}

export default {
  async fetch(request: Request, env: ProcessInputWorkerEnv): Promise<Response> {
    try {
      return await handleProcessInputRequest(request, env);
    } catch (error) {
      return errorResponse(toProcessInputError(error));
    }
  }
};
