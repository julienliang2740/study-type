import { postJson } from "./http";
import type {
  NormalizeDocumentResponse,
  NormalizationOptions
} from "../types/normalization";

const normalizationApiUrl =
  import.meta.env.VITE_NORMALIZATION_API_URL ?? "http://127.0.0.1:8789";

const normalizationUnavailableMessage = `Could not reach normalization at ${normalizationApiUrl}. Start backend/normalization with npm run dev.`;

export async function normalizeDocument({
  documentId,
  options
}: {
  documentId: string;
  options: NormalizationOptions;
}): Promise<NormalizeDocumentResponse> {
  return postJson<NormalizeDocumentResponse>(
    normalizationApiUrl,
    "/api/normalize",
    { documentId, options },
    "normalization",
    normalizationUnavailableMessage
  );
}
