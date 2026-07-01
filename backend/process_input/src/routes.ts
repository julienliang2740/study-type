import type { IncomingMessage, ServerResponse } from "node:http";
import { processPdfInput } from "./processPdf.js";
import { processTextInput } from "./processText.js";
import { processTxtInput } from "./processTxt.js";
import {
  MAX_PDF_BYTES,
  MAX_TEXT_BYTES,
  ProcessInputError,
  PROCESS_INPUT_VERSION
} from "./types.js";
import type { ProcessInputErrorResponse } from "./types.js";

const MAX_JSON_BODY_BYTES = Math.ceil((MAX_PDF_BYTES * 4) / 3) + 64 * 1024;

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown
): void {
  const payload = JSON.stringify(body, null, 2);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload, "utf8")
  });
  response.end(payload);
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

export async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, {
        ok: true,
        service: "process_input",
        version: PROCESS_INPUT_VERSION
      });
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

    if (
      url.pathname === "/process/text" ||
      url.pathname === "/process/txt" ||
      url.pathname === "/process/pdf" ||
      url.pathname === "/health"
    ) {
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
