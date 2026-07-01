import {
  buildNormalizeDocumentResponse,
  normalizeTextService
} from "../service";
import { defaultNormalizationOptions } from "../types";
import {
  R2ProcessedDocumentLoader,
  type R2BucketLike
} from "../storage/r2ProcessedDocumentLoader";
import type {
  NormalizeDocumentRequest,
  NormalizeTextRequest
} from "../service";

export type NormalizationWorkerEnv = {
  TYPE_STUDY_DOCUMENTS: R2BucketLike;
};

type NormalizationErrorCode =
  | "invalid_json"
  | "invalid_request"
  | "missing_storage_binding"
  | "not_found"
  | "method_not_allowed";

class NormalizationRouteError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: NormalizationErrorCode,
    message: string
  ) {
    super(message);
    this.name = "NormalizationRouteError";
  }
}

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

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    throw new NormalizationRouteError(
      400,
      "invalid_json",
      "request body must be valid JSON"
    );
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new NormalizationRouteError(
      400,
      "invalid_request",
      "request body must be an object"
    );
  }

  return body as Record<string, unknown>;
}

function normalizeError(error: unknown): NormalizationRouteError {
  if (error instanceof NormalizationRouteError) return error;
  return new NormalizationRouteError(
    500,
    "invalid_request",
    error instanceof Error ? error.message : "normalization failed"
  );
}

async function normalizeStoredDocument(
  body: Partial<NormalizeDocumentRequest>,
  env: NormalizationWorkerEnv | undefined
): Promise<Response> {
  if (typeof body.documentId !== "string" || body.documentId.trim() === "") {
    throw new NormalizationRouteError(
      400,
      "invalid_request",
      "documentId must be a non-empty string"
    );
  }

  if (env?.TYPE_STUDY_DOCUMENTS === undefined) {
    throw new NormalizationRouteError(
      500,
      "missing_storage_binding",
      "TYPE_STUDY_DOCUMENTS R2 binding is required to normalize by documentId"
    );
  }

  const loader = new R2ProcessedDocumentLoader(env.TYPE_STUDY_DOCUMENTS);
  const document = await loader.load(body.documentId);
  if (document === null) {
    throw new NormalizationRouteError(404, "not_found", "document not found");
  }

  const normalizedText = await normalizeTextService({
    rawText: document.canonicalText,
    options: body.options ?? defaultNormalizationOptions
  });

  return jsonResponse(buildNormalizeDocumentResponse(document.id, normalizedText));
}

async function normalizeRawText(
  body: Partial<NormalizeTextRequest>
): Promise<Response> {
  if (typeof body.rawText !== "string") {
    throw new NormalizationRouteError(
      400,
      "invalid_request",
      "rawText must be a string"
    );
  }

  return jsonResponse(
    await normalizeTextService({
      rawText: body.rawText,
      options: body.options ?? defaultNormalizationOptions
    })
  );
}

export async function handleNormalizeRequest(
  request: Request,
  env?: NormalizationWorkerEnv
): Promise<Response> {
  try {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return emptyResponse();

    if (
      request.method === "GET" &&
      (url.pathname === "/health" || url.pathname === "/api/health")
    ) {
      return jsonResponse({
        ok: true,
        service: "normalization"
      });
    }

    if (request.method !== "POST") {
      throw new NormalizationRouteError(
        405,
        "method_not_allowed",
        "method not allowed"
      );
    }

    if (url.pathname !== "/" && url.pathname !== "/api/normalize") {
      throw new NormalizationRouteError(404, "not_found", "endpoint not found");
    }

    const body = await readJsonBody(request);

    if (typeof body.documentId === "string") {
      return await normalizeStoredDocument(body, env);
    }

    return await normalizeRawText(body);
  } catch (error) {
    const routeError = normalizeError(error);
    return jsonResponse(
      {
        error: {
          code: routeError.code,
          message: routeError.message
        }
      },
      routeError.statusCode
    );
  }
}
