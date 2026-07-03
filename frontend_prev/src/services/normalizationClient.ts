export type NormalizationOptions = {
  lowercase: boolean;
  removePunctuationFromInput: boolean;
  showPunctuationFaintly: boolean;
  collapseLineBreaks: boolean;
  preserveParagraphBreaks: boolean;
  normalizeQuotesAndDashes: boolean;
  convertNumbersToWords: boolean;
};

export type CharacterMapEntry = {
  displayIndex: number;
  inputIndex: number | null;
  displayChar: string;
  inputChar: string | null;
  required: boolean;
  faint: boolean;
};

export type NormalizedTypingText = {
  originalText: string;
  displayText: string;
  inputText: string;
  characterMap: CharacterMapEntry[];
};

export type NormalizeDocumentResponse = NormalizedTypingText & {
  documentId: string;
  metadata: {
    characterCount: number;
    wordCount: number;
  };
};

type NormalizationErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export const defaultNormalizationOptions: NormalizationOptions = {
  lowercase: true,
  removePunctuationFromInput: true,
  showPunctuationFaintly: true,
  collapseLineBreaks: true,
  preserveParagraphBreaks: false,
  normalizeQuotesAndDashes: true,
  convertNumbersToWords: false
};

export const emptyNormalizedTypingText: NormalizedTypingText = {
  originalText: "",
  displayText: "",
  inputText: "",
  characterMap: []
};

const normalizationApiUrl =
  import.meta.env.VITE_NORMALIZATION_API_URL ?? "http://127.0.0.1:8789";

export async function normalizeDocument({
  documentId,
  options
}: {
  documentId: string;
  options: NormalizationOptions;
}): Promise<NormalizeDocumentResponse> {
  let response: Response;
  try {
    response = await fetch(`${normalizationApiUrl}/api/normalize`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        documentId,
        options
      })
    });
  } catch {
    throw new Error(
      `Could not reach normalization at ${normalizationApiUrl}. Start backend/normalization with npm run dev.`
    );
  }

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => ({}))) as NormalizationErrorResponse;
    throw new Error(
      errorBody.error?.message ??
        `normalization failed with status ${response.status}`
    );
  }

  return (await response.json()) as NormalizeDocumentResponse;
}
