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

export const defaultNormalizationOptions: NormalizationOptions = {
  lowercase: true,
  removePunctuationFromInput: true,
  showPunctuationFaintly: true,
  collapseLineBreaks: true,
  preserveParagraphBreaks: false,
  normalizeQuotesAndDashes: true,
  convertNumbersToWords: false
};
