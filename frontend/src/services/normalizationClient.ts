import {
  defaultNormalizationOptions,
  normalizeTextService
} from "../../../backend/normalization";
import type {
  NormalizeTextRequest,
  NormalizeTextResponse,
  NormalizationOptions,
  NormalizedTypingText
} from "../../../backend/normalization";

export {
  defaultNormalizationOptions,
  type NormalizationOptions,
  type NormalizedTypingText
};

export const emptyNormalizedTypingText: NormalizedTypingText = {
  originalText: "",
  displayText: "",
  inputText: "",
  characterMap: []
};

const normalizationApiUrl = import.meta.env.VITE_NORMALIZATION_API_URL;

export async function normalizeImportedText(
  request: NormalizeTextRequest
): Promise<NormalizeTextResponse> {
  if (normalizationApiUrl !== undefined && normalizationApiUrl !== "") {
    const response = await fetch(normalizationApiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Normalization failed with ${response.status}`);
    }

    return (await response.json()) as NormalizeTextResponse;
  }

  return normalizeTextService(request);
}
