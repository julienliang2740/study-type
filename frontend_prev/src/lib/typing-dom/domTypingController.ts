import type { Passage } from "../../types/passage";
import type { TypingState } from "../../types/typing";
import {
  createInitialTypingState,
  deleteTypingData,
  insertTypingData
} from "../typing/engine";
import { isSpace } from "../typing/words";
import { CaretController } from "./caretController";
import {
  getWordElement,
  renderChangedWords,
  renderWords,
  setWordStatusClass
} from "./renderWords";

type TypingDomControllerElements = {
  wrapperElement: HTMLElement;
  wordsElement: HTMLElement;
  inputElement: HTMLTextAreaElement;
  caretElement: HTMLElement;
};

type TypingDomControllerOptions = {
  passage: Passage;
  elements: TypingDomControllerElements;
  onStateChange: (state: TypingState, timestamp: number) => void;
  onFinish: (state: TypingState, timestamp: number) => void;
  onRestartShortcut: () => void;
};

const INPUT_SENTINEL = " ";
const LINE_JUMP_MS = 125;
const MAX_EXTRA_LETTERS = 20;

export class DomTypingController {
  private readonly passage: Passage;
  private readonly wrapperElement: HTMLElement;
  private readonly wordsElement: HTMLElement;
  private readonly inputElement: HTMLTextAreaElement;
  private readonly caret: CaretController;
  private readonly onStateChange: TypingDomControllerOptions["onStateChange"];
  private readonly onFinish: TypingDomControllerOptions["onFinish"];
  private readonly onRestartShortcut: TypingDomControllerOptions["onRestartShortcut"];
  private state: TypingState;
  private wordsOffsetY = 0;
  private wordsAnimation: Animation | null = null;
  private destroyed = false;

  constructor(options: TypingDomControllerOptions) {
    this.passage = options.passage;
    this.wrapperElement = options.elements.wrapperElement;
    this.wordsElement = options.elements.wordsElement;
    this.inputElement = options.elements.inputElement;
    this.caret = new CaretController(
      options.elements.caretElement,
      options.elements.wordsElement
    );
    this.onStateChange = options.onStateChange;
    this.onFinish = options.onFinish;
    this.onRestartShortcut = options.onRestartShortcut;
    this.state = createInitialTypingState(options.passage);
  }

  mount(): TypingState {
    this.destroyed = false;
    this.wordsOffsetY = 0;
    this.wordsAnimation?.cancel();
    this.wordsElement.style.transform = "translateY(0px)";
    renderWords(this.wordsElement, this.state.words);
    this.applyInitialWordClasses();
    this.syncInputElementValue();

    this.inputElement.addEventListener("beforeinput", this.handleBeforeInput);
    this.inputElement.addEventListener("input", this.handleInput);
    this.inputElement.addEventListener("keydown", this.handleKeyDown);
    this.inputElement.addEventListener("focus", this.handleFocus);
    this.inputElement.addEventListener("blur", this.handleBlur);
    this.wrapperElement.addEventListener("click", this.handleWrapperClick);
    window.addEventListener("resize", this.handleResize);

    window.requestAnimationFrame(() => {
      if (this.destroyed) return;
      this.updateLinePosition(false);
      this.caret.updatePosition(this.state, this.wordsOffsetY, false, false);
      this.focus();
    });

    return this.state;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.wordsAnimation?.cancel();
    this.caret.destroy();

    this.inputElement.removeEventListener("beforeinput", this.handleBeforeInput);
    this.inputElement.removeEventListener("input", this.handleInput);
    this.inputElement.removeEventListener("keydown", this.handleKeyDown);
    this.inputElement.removeEventListener("focus", this.handleFocus);
    this.inputElement.removeEventListener("blur", this.handleBlur);
    this.wrapperElement.removeEventListener("click", this.handleWrapperClick);
    window.removeEventListener("resize", this.handleResize);
  }

  focus(): void {
    this.inputElement.focus({ preventScroll: true });
    this.syncInputElementValue();
  }

  getState(): TypingState {
    return this.state;
  }

  private readonly handleWrapperClick = (): void => {
    this.focus();
  };

  private readonly handleFocus = (): void => {
    this.caret.show();
    this.caret.startBlinking();
    this.syncInputElementValue();
  };

  private readonly handleBlur = (): void => {
    this.caret.hide();
  };

  private readonly handleResize = (): void => {
    const lineJumping = this.updateLinePosition(false);
    this.caret.updatePosition(this.state, this.wordsOffsetY, false, lineJumping);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Tab" || event.key === "Escape") {
      event.preventDefault();
      this.onRestartShortcut();
    }
  };

  private readonly handleInput = (event: Event): void => {
    event.preventDefault();
    this.syncInputElementValue();
  };

  private readonly handleBeforeInput = (event: InputEvent): void => {
    if (this.state.status === "finished") {
      event.preventDefault();
      return;
    }

    switch (event.inputType) {
      case "insertText": {
        event.preventDefault();
        if (event.data !== null && event.data !== "") {
          this.insertText(event.data);
        }
        break;
      }
      case "insertLineBreak": {
        event.preventDefault();
        this.insertText("\n");
        break;
      }
      case "deleteContentBackward": {
        event.preventDefault();
        this.deleteText(false);
        break;
      }
      case "deleteWordBackward": {
        event.preventDefault();
        this.deleteText(true);
        break;
      }
      case "insertFromPaste":
      case "insertReplacementText":
      case "insertFromDrop":
      default: {
        event.preventDefault();
        this.syncInputElementValue();
      }
    }
  };

  private insertText(data: string): void {
    for (const char of Array.from(data)) {
      if (this.shouldBlockInsert(char)) {
        this.syncInputElementValue();
        continue;
      }

      const previousState = this.state;
      const timestamp = performance.now();
      const nextState = insertTypingData(previousState, char, timestamp);
      this.applyState(nextState, previousState, timestamp);

      if (nextState.status === "finished") break;
    }
  }

  private deleteText(deleteWord: boolean): void {
    const previousState = this.state;
    const timestamp = performance.now();
    const nextState = deleteTypingData(previousState, deleteWord);
    this.applyState(nextState, previousState, timestamp);
  }

  private applyState(
    nextState: TypingState,
    previousState: TypingState,
    timestamp: number
  ): void {
    this.state = nextState;

    const changedWords = new Set<number>([
      previousState.activeWordIndex,
      nextState.activeWordIndex
    ]);

    previousState.inputs.forEach((input, index) => {
      if (input !== nextState.inputs[index]) {
        changedWords.add(index);
      }
    });

    renderChangedWords(this.wordsElement, nextState, changedWords);
    for (const wordIndex of changedWords) {
      setWordStatusClass(this.wordsElement, nextState, wordIndex);
    }

    const lineJumping = this.updateLinePosition(
      previousState.activeWordIndex !== nextState.activeWordIndex
    );
    this.syncInputElementValue();
    this.caret.updatePosition(
      nextState,
      this.wordsOffsetY,
      nextState.status !== "idle",
      lineJumping
    );
    this.onStateChange(nextState, timestamp);

    if (nextState.status === "finished") {
      this.caret.hide();
      this.onFinish(nextState, timestamp);
    }
  }

  private shouldBlockInsert(data: string): boolean {
    const word = this.state.words[this.state.activeWordIndex];
    if (word === undefined) return true;

    const input = this.state.inputs[this.state.activeWordIndex] ?? "";

    if (isSpace(data) && input.length === 0) {
      return true;
    }

    if (data === "\n") {
      return word.commit !== "\n" || input !== word.text;
    }

    if (isSpace(data)) {
      return false;
    }

    if (input.length >= word.text.length + MAX_EXTRA_LETTERS) {
      return true;
    }

    return input.length >= word.text.length && this.wouldOverflowActiveWord(data);
  }

  private wouldOverflowActiveWord(data: string): boolean {
    const word = this.state.words[this.state.activeWordIndex];
    const input = this.state.inputs[this.state.activeWordIndex] ?? "";
    const wordElement = getWordElement(
      this.wordsElement,
      this.state.activeWordIndex
    );

    if (word === undefined || wordElement === null) {
      return false;
    }

    if (input.length < word.text.length) {
      return false;
    }

    const beforeTop = wordElement.offsetTop;
    const beforeHeight = wordElement.offsetHeight;
    const probe = document.createElement("letter");
    probe.className = "letter incorrect extra";
    probe.textContent = data === " " ? "_" : data;
    wordElement.append(probe);

    const overflowed =
      wordElement.offsetTop > beforeTop || wordElement.offsetHeight > beforeHeight;
    probe.remove();
    return overflowed;
  }

  private syncInputElementValue(): void {
    const input = this.state.inputs[this.state.activeWordIndex] ?? "";
    const value = `${INPUT_SENTINEL}${input}`;
    if (this.inputElement.value !== value) {
      this.inputElement.value = value;
    }
    this.inputElement.setSelectionRange(value.length, value.length);
  }

  private applyInitialWordClasses(): void {
    this.state.words.forEach((_, wordIndex) => {
      setWordStatusClass(this.wordsElement, this.state, wordIndex);
    });
  }

  private updateLinePosition(animate: boolean): boolean {
    const activeWord = getWordElement(this.wordsElement, this.state.activeWordIndex);
    if (activeWord === null) return false;

    const lineTops = Array.from(
      new Set(
        Array.from(
          this.wordsElement.querySelectorAll<HTMLElement>(".word")
        ).map((wordElement) => Math.round(wordElement.offsetTop))
      )
    ).sort((a, b) => a - b);

    const activeWordTop = Math.round(activeWord.offsetTop);
    const activeLineIndex = Math.max(0, lineTops.indexOf(activeWordTop));
    const targetLineTop = lineTops[Math.min(1, activeLineIndex)] ?? 0;
    const nextOffset =
      activeLineIndex <= 1 ? 0 : targetLineTop - activeWordTop;

    if (Math.abs(this.wordsOffsetY - nextOffset) < 0.5) {
      return false;
    }

    const previousOffset = this.wordsOffsetY;
    this.wordsOffsetY = nextOffset;
    this.wordsAnimation?.cancel();

    if (!animate) {
      this.wordsElement.style.transform = `translateY(${nextOffset}px)`;
      return false;
    }

    this.wordsElement.style.transform = `translateY(${previousOffset}px)`;
    this.wordsAnimation = this.wordsElement.animate(
      [
        { transform: `translateY(${previousOffset}px)` },
        { transform: `translateY(${nextOffset}px)` }
      ],
      {
        duration: LINE_JUMP_MS,
        easing: "cubic-bezier(0.25, 1, 0.5, 1)",
        fill: "both"
      }
    );

    this.wordsAnimation.onfinish = () => {
      this.wordsElement.style.transform = `translateY(${nextOffset}px)`;
      this.wordsAnimation = null;
    };

    return true;
  }
}
