import { normalizeTextService } from "./service";
import { defaultNormalizationOptions } from "./types";
import type { NormalizeTextRequest } from "./service";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

export async function handleNormalizeRequest(
  request: Request
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: Partial<NormalizeTextRequest>;
  try {
    body = (await request.json()) as Partial<NormalizeTextRequest>;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body.rawText !== "string") {
    return jsonResponse({ error: "rawText must be a string" }, 400);
  }

  const normalizedText = await normalizeTextService({
    rawText: body.rawText,
    options: body.options ?? defaultNormalizationOptions
  });

  return jsonResponse(normalizedText);
}

export default {
  fetch(request: Request): Promise<Response> {
    return handleNormalizeRequest(request);
  }
};
