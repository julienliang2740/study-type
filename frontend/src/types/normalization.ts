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
