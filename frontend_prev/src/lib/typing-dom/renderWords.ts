import type { TypingState, TypingWord } from "../../types/typing";

function createLetter(
  classNames: string[],
  text: string,
  inputIndex?: number
): HTMLElement {
  const letter = document.createElement("letter");
  letter.className = ["letter", ...classNames].filter(Boolean).join(" ");
  letter.textContent = text;

  if (inputIndex !== undefined) {
    letter.dataset.inputIndex = String(inputIndex);
  }

  return letter;
}

function visibleInputChar(char: string): string {
  return char === " " ? "_" : char;
}

function getRequiredLetterClass(
  inputChar: string | undefined,
  targetChar: string | undefined
): string[] {
  if (inputChar === undefined) return [];
  if (targetChar === undefined) return ["incorrect", "extra"];
  return inputChar === targetChar ? ["correct"] : ["incorrect"];
}

export function getWordHasError(
  word: TypingWord,
  input: string,
  isTyped: boolean
): boolean {
  if (input.length === 0) return false;

  for (let i = 0; i < input.length; i += 1) {
    if (input[i] !== word.text[i]) return true;
  }

  return isTyped && input !== word.text;
}

export function renderWordLetters(
  wordElement: HTMLElement,
  word: TypingWord,
  input: string
): void {
  const fragment = document.createDocumentFragment();
  const extraInput = input.slice(word.text.length);

  for (const token of word.displayTokens) {
    if (token.kind === "faint") {
      fragment.append(createLetter(["faint"], token.char));
      continue;
    }

    const inputChar = input[token.inputOffset];
    const targetChar = word.text[token.inputOffset];
    const classNames = getRequiredLetterClass(inputChar, targetChar);
    const visibleChar =
      inputChar !== undefined && targetChar === undefined
        ? visibleInputChar(inputChar)
        : token.char;

    fragment.append(
      createLetter(classNames, visibleChar, token.inputOffset)
    );
  }

  Array.from(extraInput, (inputChar, extraIndex) => {
    const charIndex = word.text.length + extraIndex;
    fragment.append(
      createLetter(
        ["incorrect", "extra"],
        visibleInputChar(inputChar),
        charIndex
      )
    );
  });

  wordElement.replaceChildren(fragment);
}

export function getWordElement(
  wordsElement: HTMLElement,
  wordIndex: number
): HTMLElement | null {
  return wordsElement.querySelector<HTMLElement>(
    `.word[data-wordindex="${wordIndex}"]`
  );
}

export function setWordStatusClass(
  wordsElement: HTMLElement,
  state: TypingState,
  wordIndex: number
): void {
  const word = state.words[wordIndex];
  const wordElement = getWordElement(wordsElement, wordIndex);
  if (word === undefined || wordElement === null) return;

  const isActive =
    state.status !== "finished" && wordIndex === state.activeWordIndex;
  const isTyped = state.status === "finished" || wordIndex < state.activeWordIndex;
  const input = state.inputs[wordIndex] ?? "";

  wordElement.classList.toggle("active", isActive);
  wordElement.classList.toggle("typed", isTyped);
  wordElement.classList.toggle("error", getWordHasError(word, input, isTyped));
}

export function renderWords(
  wordsElement: HTMLElement,
  words: TypingWord[]
): void {
  const fragment = document.createDocumentFragment();

  words.forEach((word, wordIndex) => {
    const wordElement = document.createElement("div");
    wordElement.className = "word";
    wordElement.dataset.wordindex = String(wordIndex);
    renderWordLetters(wordElement, word, "");
    fragment.append(wordElement);

    if (word.commit === "\n") {
      const beforeNewline = document.createElement("div");
      beforeNewline.className = "beforeNewline";
      const newline = document.createElement("div");
      newline.className = "newline";
      const afterNewline = document.createElement("div");
      afterNewline.className = "afterNewline";
      fragment.append(beforeNewline, newline, afterNewline);
    }
  });

  wordsElement.replaceChildren(fragment);
}

export function renderChangedWords(
  wordsElement: HTMLElement,
  state: TypingState,
  wordIndexes: Iterable<number>
): void {
  for (const wordIndex of wordIndexes) {
    const word = state.words[wordIndex];
    const wordElement = getWordElement(wordsElement, wordIndex);
    if (word === undefined || wordElement === null) continue;

    renderWordLetters(wordElement, word, state.inputs[wordIndex] ?? "");
    setWordStatusClass(wordsElement, state, wordIndex);
  }
}
