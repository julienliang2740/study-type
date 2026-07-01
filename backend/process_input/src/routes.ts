import type { IncomingMessage, ServerResponse } from "node:http";
import { processPdfInput } from "./processPdf.js";
import {
  processPdfAndStore,
  processTextAndStore,
  processTxtAndStore
} from "./processAndStore.js";
import { processTextInput } from "./processText.js";
import { processTxtInput } from "./processTxt.js";
import {
  createStoredDocumentResponse,
  getDocumentStorageKeys,
  memoryProcessInputStorage
} from "./storage.js";
import {
  MAX_PDF_BYTES,
  ProcessInputError,
  PROCESS_INPUT_VERSION
} from "./types.js";
import type { ProcessInputErrorResponse } from "./types.js";

const MAX_JSON_BODY_BYTES = Math.ceil((MAX_PDF_BYTES * 4) / 3) + 64 * 1024;
const apiProcessPaths = new Set([
  "/api/process/text",
  "/api/process/txt",
  "/api/process/pdf"
]);
const legacyProcessPaths = new Set([
  "/process/text",
  "/process/txt",
  "/process/pdf"
]);

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown
): void {
  const payload = JSON.stringify(body, null, 2);
  response.writeHead(statusCode, {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": "*",
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload, "utf8")
  });
  response.end(payload);
}

function writeEmpty(response: ServerResponse, statusCode: number): void {
  response.writeHead(statusCode, {
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": "*"
  });
  response.end();
}

function writeError(
  response: ServerResponse,
  error: ProcessInputError
): void {
  const body: ProcessInputErrorResponse = {
    error: {
      code: error.code,
      message: error.message
    }
  };
  writeJson(response, error.statusCode, body);
}

function toProcessInputError(error: unknown): ProcessInputError {
  if (error instanceof ProcessInputError) return error;
  return new ProcessInputError(
    500,
    "invalid_request",
    error instanceof Error ? error.message : "unknown processing error"
  );
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.byteLength;

    if (receivedBytes > MAX_JSON_BODY_BYTES) {
      throw new ProcessInputError(
        413,
        "payload_too_large",
        "request body exceeds the local processing limit"
      );
    }

    chunks.push(buffer);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
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

function isKnownPath(pathname: string): boolean {
  return (
    pathname === "/health" ||
    pathname === "/api/health" ||
    legacyProcessPaths.has(pathname) ||
    apiProcessPaths.has(pathname) ||
    getDocumentIdFromDocumentPath(pathname) !== null ||
    getDocumentIdFromProcessedPath(pathname) !== null
  );
}

export async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  try {
    if (request.method === "OPTIONS") {
      writeEmpty(response, 204);
      return;
    }

    if (
      request.method === "GET" &&
      (url.pathname === "/health" || url.pathname === "/api/health")
    ) {
      writeJson(response, 200, {
        ok: true,
        service: "process_input",
        version: PROCESS_INPUT_VERSION
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/process/text") {
      const body = await readJsonBody(request);
      writeJson(
        response,
        200,
        await processTextAndStore(body, memoryProcessInputStorage)
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/process/txt") {
      const body = await readJsonBody(request);
      writeJson(
        response,
        200,
        await processTxtAndStore(body, memoryProcessInputStorage)
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/process/pdf") {
      const body = await readJsonBody(request);
      writeJson(
        response,
        200,
        await processPdfAndStore(body, memoryProcessInputStorage)
      );
      return;
    }

    const processedDocumentId = getDocumentIdFromProcessedPath(url.pathname);
    if (request.method === "GET" && processedDocumentId !== null) {
      const document =
        await memoryProcessInputStorage.getProcessedDocument(processedDocumentId);
      if (document === null) {
        throw new ProcessInputError(404, "not_found", "document not found");
      }
      writeJson(response, 200, document);
      return;
    }

    const documentId = getDocumentIdFromDocumentPath(url.pathname);
    if (request.method === "GET" && documentId !== null) {
      const document = await memoryProcessInputStorage.getProcessedDocument(
        documentId
      );
      if (document === null) {
        throw new ProcessInputError(404, "not_found", "document not found");
      }
      writeJson(
        response,
        200,
        createStoredDocumentResponse({
          document,
          storage: getDocumentStorageKeys(document.id, document.sourceType)
        })
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/process/text") {
      const body = await readJsonBody(request);
      writeJson(response, 200, processTextInput(body as object));
      return;
    }

    if (request.method === "POST" && url.pathname === "/process/txt") {
      const body = await readJsonBody(request);
      writeJson(response, 200, processTxtInput(body as object));
      return;
    }

    if (request.method === "POST" && url.pathname === "/process/pdf") {
      const body = await readJsonBody(request);
      writeJson(response, 200, await processPdfInput(body as object));
      return;
    }

    if (isKnownPath(url.pathname)) {
      throw new ProcessInputError(
        405,
        "method_not_allowed",
        "method not allowed for this endpoint"
      );
    }

    throw new ProcessInputError(404, "not_found", "endpoint not found");
  } catch (error) {
    writeError(response, toProcessInputError(error));
  }
}
