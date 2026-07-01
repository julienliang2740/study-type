import type {
  CharacterMapEntry,
  NormalizationOptions,
  NormalizedTypingText
} from "./types";

const smallNumbers = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen"
];

const tensNumbers = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety"
];

const punctuation = new Set(
  Array.from("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~")
);

const quoteDashReplacements: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201a": "'",
  "\u201b": "'",
  "\u201c": '"',
  "\u201d": '"',
  "\u201e": '"',
  "\u201f": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2212": "-",
  "\u2026": "..."
};

function normalizeQuotesAndDashes(text: string): string {
  return Array.from(text, (char) => quoteDashReplacements[char] ?? char).join(
    ""
  );
}

function normalizeLineBreaks(
  text: string,
  options: Pick<
    NormalizationOptions,
    "collapseLineBreaks" | "preserveParagraphBreaks"
  >
): string {
  const standardized = text.replace(/\r\n?/g, "\n");

  if (options.preserveParagraphBreaks) {
    return standardized
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.replace(/[ \t]*\n[ \t]*/g, " ").trim())
      .filter(Boolean)
      .join("\n\n");
  }

  if (options.collapseLineBreaks) {
    return standardized.replace(/[ \t]*\n+[ \t]*/g, " ");
  }

  return standardized
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isPunctuation(char: string): boolean {
  return punctuation.has(char);
}

function wordsUnderOneThousand(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;

  if (hundreds > 0) {
    parts.push(smallNumbers[hundreds] as string, "hundred");
  }

  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(smallNumbers[remainder] as string);
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      parts.push(tensNumbers[tens] as string);
      if (ones > 0) {
        parts.push(smallNumbers[ones] as string);
      }
    }
  }

  return parts.join(" ");
}

export function numberToWords(rawNumber: string): string {
  const digits = rawNumber.replace(/,/g, "");
  if (!/^\d+$/.test(digits)) return rawNumber;

  const normalizedDigits = digits.replace(/^0+(?=\d)/, "");
  const value = Number(normalizedDigits);
  if (!Number.isSafeInteger(value)) return rawNumber;
  if (value === 0) return "zero";

  const scaleNames = ["", "thousand", "million", "billion"];
  const chunks: number[] = [];
  let remaining = value;

  while (remaining > 0) {
    chunks.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words: string[] = [];
  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    const chunk = chunks[index] ?? 0;
    if (chunk === 0) continue;

    words.push(wordsUnderOneThousand(chunk));
    const scaleName = scaleNames[index];
    if (scaleName !== undefined && scaleName !== "") {
      words.push(scaleName);
    }
  }

  return words.join(" ");
}

function shouldAppendSeparator(text: string, separator: string): boolean {
  if (text.length === 0) return false;
  if (separator === "\n") return !text.endsWith("\n");
  return !text.endsWith(" ") && !text.endsWith("\n");
}

export function normalizeText(
  rawText: string,
  options: NormalizationOptions
): NormalizedTypingText {
  const originalText = rawText;
  let sourceText = rawText;

  if (options.normalizeQuotesAndDashes) {
    sourceText = normalizeQuotesAndDashes(sourceText);
  }

  if (options.lowercase) {
    sourceText = sourceText.toLowerCase();
  }

  sourceText = normalizeLineBreaks(sourceText, options).trim();

  let displayText = "";
  let inputText = "";
  const characterMap: CharacterMapEntry[] = [];

  const appendDisplayOnly = (char: string, faint: boolean): void => {
    characterMap.push({
      displayIndex: displayText.length,
      inputIndex: null,
      displayChar: char,
      inputChar: null,
      required: false,
      faint
    });
    displayText += char;
  };

  const appendRequiredChar = (char: string): void => {
    characterMap.push({
      displayIndex: displayText.length,
      inputIndex: inputText.length,
      displayChar: char,
      inputChar: char,
      required: true,
      faint: false
    });
    displayText += char;
    inputText += char;
  };

  const appendSeparator = (separator: " " | "\n"): void => {
    if (shouldAppendSeparator(displayText, separator)) {
      appendRequiredChar(separator);
    }
  };

  const appendConvertedNumber = (displayNumber: string, inputNumber: string) => {
    const inputStart = inputText.length;
    inputText += inputNumber;
    const inputEnd = inputText.length - 1;

    for (const char of displayNumber) {
      if (char === ",") {
        if (options.showPunctuationFaintly) {
          appendDisplayOnly(char, true);
        }
        continue;
      }

      characterMap.push({
        displayIndex: displayText.length,
        inputIndex: inputEnd >= inputStart ? inputEnd : null,
        displayChar: char,
        inputChar: inputEnd >= inputStart ? inputText[inputEnd] ?? null : null,
        required: false,
        faint: false
      });
      displayText += char;
    }
  };

  for (let index = 0; index < sourceText.length; index += 1) {
    const char = sourceText[index] as string;

    if (isWhitespace(char)) {
      appendSeparator(char === "\n" ? "\n" : " ");
      continue;
    }

    if (isDigit(char)) {
      let end = index + 1;
      while (
        end < sourceText.length &&
        (isDigit(sourceText[end] as string) || sourceText[end] === ",")
      ) {
        end += 1;
      }

      const displayNumber = sourceText.slice(index, end);
      const inputNumber = options.convertNumbersToWords
        ? numberToWords(displayNumber)
        : displayNumber.replace(/,/g, "");

      if (options.convertNumbersToWords) {
        appendConvertedNumber(displayNumber, inputNumber);
      } else {
        for (const digit of inputNumber) {
          appendRequiredChar(digit);
        }
      }

      index = end - 1;
      continue;
    }

    if (isPunctuation(char)) {
      if (
        options.removePunctuationFromInput ||
        options.showPunctuationFaintly
      ) {
        if (options.showPunctuationFaintly) {
          appendDisplayOnly(char, true);
        }
        continue;
      }

      appendRequiredChar(char);
      continue;
    }

    appendRequiredChar(char);
  }

  return {
    originalText,
    displayText: displayText.trim(),
    inputText: inputText.trim(),
    characterMap
  };
}
