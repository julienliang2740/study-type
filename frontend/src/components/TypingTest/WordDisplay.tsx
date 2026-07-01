import type { TypingStatus, TypingWord } from "../../types/typing";

type WordDisplayProps = {
  words: TypingWord[];
  inputs: string[];
  activeWordIndex: number;
  status: TypingStatus;
  wordsOffsetY: number;
  registerWord: (index: number, element: HTMLDivElement | null) => void;
  registerLetter: (
    wordIndex: number,
    charIndex: number,
    element: HTMLSpanElement | null
  ) => void;
};

function getWordHasError(input: string, target: string): boolean {
  if (input.length === 0) return false;

  for (let i = 0; i < input.length; i += 1) {
    if (input[i] !== target[i]) return true;
  }

  return false;
}

function getLetterClass(
  inputChar: string | undefined,
  targetChar: string | undefined
): string {
  if (inputChar === undefined) return "";
  if (targetChar === undefined) return "incorrect extra";
  return inputChar === targetChar ? "correct" : "incorrect";
}

function getVisibleCharacter(
  inputChar: string | undefined,
  targetChar: string | undefined
): string {
  if (inputChar !== undefined && targetChar === undefined) {
    return inputChar === " " ? "_" : inputChar;
  }
  return targetChar ?? "";
}

export function WordDisplay({
  words,
  inputs,
  activeWordIndex,
  status,
  wordsOffsetY,
  registerWord,
  registerLetter
}: WordDisplayProps): React.JSX.Element {
  return (
    <div
      id="words"
      className="full-width highlight-word"
      aria-hidden="true"
      style={{ transform: `translateY(${wordsOffsetY}px)` }}
    >
      {words.map((word, wordIndex) => {
        const input = inputs[wordIndex] ?? "";
        const isActive =
          status !== "finished" && wordIndex === activeWordIndex;
        const isTyped = status === "finished" || wordIndex < activeWordIndex;
        const hasError =
          getWordHasError(input, word.text) ||
          (isTyped && input !== "" && input !== word.text);
        const extraInput = input.slice(word.text.length);

        return (
          <div
            className={[
              "word",
              isActive ? "active" : "",
              isTyped ? "typed" : "",
              hasError ? "error" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            data-wordindex={wordIndex}
            key={`${word.text}-${wordIndex}`}
            ref={(element) => {
              registerWord(wordIndex, element);
            }}
          >
            {word.displayTokens.map((token, tokenIndex) => {
              if (token.kind === "faint") {
                return (
                  <span
                    className="letter faint"
                    key={`faint-${tokenIndex}`}
                  >
                    {token.char}
                  </span>
                );
              }

              const charIndex = token.inputOffset;
              const inputChar = input[charIndex];
              const targetChar = word.text[charIndex];
              const className = getLetterClass(inputChar, targetChar);
              const visibleCharacter = getVisibleCharacter(
                inputChar,
                targetChar
              );

              return (
                <span
                  className={["letter", className].filter(Boolean).join(" ")}
                  key={`required-${charIndex}`}
                  ref={(element) => {
                    registerLetter(wordIndex, charIndex, element);
                  }}
                >
                  {visibleCharacter}
                </span>
              );
            })}

            {Array.from(extraInput, (inputChar, extraIndex) => {
              const charIndex = word.text.length + extraIndex;

              return (
                <span
                  className="letter incorrect extra"
                  key={`extra-${charIndex}`}
                  ref={(element) => {
                    registerLetter(wordIndex, charIndex, element);
                  }}
                >
                  {inputChar === " " ? "_" : inputChar}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
