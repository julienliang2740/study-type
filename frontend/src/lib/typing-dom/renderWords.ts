import type { TypingState, TypingWord } from "../typing/types";

function createLetter(
  char: string,
  className: string,
  inputOffset?: number
): HTMLElement {
  const letter = document.createElement("letter");
  letter.className = className;
  letter.textContent = char;

  if (inputOffset !== undefined) {
    letter.dataset.inputOffset = String(inputOffset);
  }

  return letter;
}

function classifyRequiredLetter(
  input: string,
  word: TypingWord,
  offset: number
): string {
  const inputChar = input[offset];
  const targetChar = word.text[offset];

  if (inputChar === undefined) return "letter";
  if (inputChar === targetChar) return "letter correct";
  return "letter incorrect";
}

function renderWordLetters(word: TypingWord, input: string): DocumentFragment {
  const fragment = document.createDocumentFragment();

  for (const token of word.displayTokens) {
    if (token.kind === "faint") {
      fragment.append(createLetter(token.char, "letter faint"));
      continue;
    }

    fragment.append(
      createLetter(
        token.char,
        classifyRequiredLetter(input, word, token.inputOffset),
        token.inputOffset
      )
    );
  }

  if (input.length > word.text.length) {
    for (const extraChar of input.slice(word.text.length)) {
      fragment.append(createLetter(extraChar, "letter incorrect extra"));
    }
  }

  return fragment;
}

function wordHasError(word: TypingWord, input: string): boolean {
  if (input.length > word.text.length) return true;

  for (let index = 0; index < input.length; index += 1) {
    if (input[index] !== word.text[index]) return true;
  }

  return false;
}

function isTypedWord(state: TypingState, wordIndex: number): boolean {
  return wordIndex < state.activeWordIndex || state.status === "finished";
}

function setWordClasses(
  element: HTMLElement,
  state: TypingState,
  wordIndex: number
): void {
  const word = state.words[wordIndex];
  const input = state.inputs[wordIndex] ?? "";

  element.className = "word";

  if (wordIndex === state.activeWordIndex && state.status !== "finished") {
    element.classList.add("active");
  }

  if (isTypedWord(state, wordIndex)) {
    element.classList.add("typed");
  }

  if (word !== undefined && wordHasError(word, input)) {
    element.classList.add("error");
  }
}

export function getWordElement(
  wordsElement: HTMLElement,
  wordIndex: number
): HTMLElement | null {
  return wordsElement.querySelector<HTMLElement>(
    `.word[data-word-index="${wordIndex}"]`
  );
}

export function renderWord(
  wordsElement: HTMLElement,
  state: TypingState,
  wordIndex: number
): void {
  const word = state.words[wordIndex];
  if (word === undefined) return;

  const existing = getWordElement(wordsElement, wordIndex);
  const element = existing ?? document.createElement("div");
  element.dataset.wordIndex = String(wordIndex);
  element.replaceChildren(renderWordLetters(word, state.inputs[wordIndex] ?? ""));
  setWordClasses(element, state, wordIndex);

  if (existing === null) {
    wordsElement.append(element);
  }
}

export function renderAllWords(
  wordsElement: HTMLElement,
  state: TypingState
): void {
  const fragment = document.createDocumentFragment();

  state.words.forEach((word, wordIndex) => {
    const element = document.createElement("div");
    element.dataset.wordIndex = String(wordIndex);
    element.replaceChildren(
      renderWordLetters(word, state.inputs[wordIndex] ?? "")
    );
    setWordClasses(element, state, wordIndex);
    fragment.append(element);
  });

  wordsElement.replaceChildren(fragment);
}

export function updateWordClasses(
  wordsElement: HTMLElement,
  state: TypingState
): void {
  for (let index = 0; index < state.words.length; index += 1) {
    const element = getWordElement(wordsElement, index);
    if (element !== null) {
      setWordClasses(element, state, index);
    }
  }
}
