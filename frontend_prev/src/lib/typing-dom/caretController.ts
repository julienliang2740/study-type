import type { TypingState } from "../../types/typing";
import { getWordElement } from "./renderWords";

type CaretTarget = {
  left: number;
  top: number;
  height: number;
};

const SMOOTH_CARET_MS = 85;
const LINE_JUMP_MS = 125;
const CARET_BLINK_RESUME_MS = 225;

function readCaretTarget(element: HTMLElement): CaretTarget | null {
  const style = window.getComputedStyle(element);
  const left = parseFloat(style.left);
  const top = parseFloat(style.top);
  const height = parseFloat(style.height);

  if (
    !Number.isFinite(left) ||
    !Number.isFinite(top) ||
    !Number.isFinite(height)
  ) {
    return null;
  }

  return { left, top, height };
}

function getLetterForCaret(
  wordElement: HTMLElement,
  inputLength: number,
  wordLength: number
): { letter: HTMLElement; side: "before" | "after" } | null {
  if (inputLength < wordLength) {
    const letter = wordElement.querySelector<HTMLElement>(
      `.letter[data-input-index="${inputLength}"]`
    );
    if (letter !== null) {
      return { letter, side: "before" };
    }
  }

  const previousIndex = Math.max(0, inputLength - 1, wordLength - 1);
  const previousLetter = wordElement.querySelector<HTMLElement>(
    `.letter[data-input-index="${previousIndex}"]`
  );
  if (previousLetter !== null) {
    return { letter: previousLetter, side: "after" };
  }

  const firstLetter = wordElement.querySelector<HTMLElement>(
    ".letter[data-input-index]"
  );
  return firstLetter === null ? null : { letter: firstLetter, side: "before" };
}

export class CaretController {
  private readonly caretElement: HTMLElement;
  private readonly wordsElement: HTMLElement;
  private animation: Animation | null = null;
  private pendingFrame: number | null = null;
  private blinkTimer: number | null = null;
  private currentTarget: CaretTarget | null = null;

  constructor(caretElement: HTMLElement, wordsElement: HTMLElement) {
    this.caretElement = caretElement;
    this.wordsElement = wordsElement;
  }

  show(): void {
    this.caretElement.classList.remove("hidden");
  }

  hide(): void {
    this.caretElement.classList.add("hidden");
  }

  destroy(): void {
    this.animation?.cancel();
    if (this.pendingFrame !== null) {
      window.cancelAnimationFrame(this.pendingFrame);
      this.pendingFrame = null;
    }
    if (this.blinkTimer !== null) {
      window.clearTimeout(this.blinkTimer);
      this.blinkTimer = null;
    }
  }

  startBlinking(): void {
    this.caretElement.style.animationName = "";
    this.caretElement.style.opacity = "1";
  }

  stopBlinkingBriefly(): void {
    this.caretElement.style.animationName = "none";
    this.caretElement.style.opacity = "1";

    if (this.blinkTimer !== null) {
      window.clearTimeout(this.blinkTimer);
    }

    this.blinkTimer = window.setTimeout(() => {
      this.startBlinking();
      this.blinkTimer = null;
    }, CARET_BLINK_RESUME_MS);
  }

  updatePosition(
    state: TypingState,
    wordsOffsetY: number,
    animate: boolean,
    lineJumping: boolean
  ): void {
    if (this.pendingFrame !== null) {
      window.cancelAnimationFrame(this.pendingFrame);
    }

    this.pendingFrame = window.requestAnimationFrame(() => {
      this.pendingFrame = null;
      const target = this.measureTarget(state, wordsOffsetY);
      if (target === null) return;

      this.moveTo(target, animate, lineJumping ? LINE_JUMP_MS : SMOOTH_CARET_MS);
    });
  }

  private measureTarget(
    state: TypingState,
    wordsOffsetY: number
  ): CaretTarget | null {
    const word = state.words[state.activeWordIndex];
    const wordElement = getWordElement(this.wordsElement, state.activeWordIndex);
    if (word === undefined || wordElement === null) return null;

    const inputLength = state.inputs[state.activeWordIndex]?.length ?? 0;
    const target = getLetterForCaret(wordElement, inputLength, word.text.length);
    if (target === null) return null;

    const fontSize = parseFloat(window.getComputedStyle(wordElement).fontSize);
    const caretHeight = Number.isFinite(fontSize)
      ? fontSize * 1.2
      : target.letter.offsetHeight;
    const caretWidth = this.caretElement.offsetWidth;
    const sideCorrection =
      target.side === "after" ? target.letter.offsetWidth : 0;

    return {
      left:
        wordElement.offsetLeft +
        target.letter.offsetLeft +
        sideCorrection -
        caretWidth / 2,
      top:
        wordElement.offsetTop +
        target.letter.offsetTop +
        (target.letter.offsetHeight - caretHeight) / 2 +
        wordsOffsetY,
      height: caretHeight
    };
  }

  private moveTo(target: CaretTarget, animate: boolean, duration: number): void {
    const previous = readCaretTarget(this.caretElement) ?? this.currentTarget;
    this.currentTarget = target;
    this.animation?.cancel();
    this.show();
    this.stopBlinkingBriefly();

    if (!animate || previous === null) {
      this.setTarget(target);
      return;
    }

    this.setTarget(previous);
    this.animation = this.caretElement.animate(
      [
        {
          left: `${previous.left}px`,
          top: `${previous.top}px`,
          height: `${previous.height}px`
        },
        {
          left: `${target.left}px`,
          top: `${target.top}px`,
          height: `${target.height}px`
        }
      ],
      {
        duration,
        easing: "cubic-bezier(0.25, 1, 0.5, 1)",
        fill: "both"
      }
    );

    this.animation.onfinish = () => {
      this.setTarget(target);
      this.animation = null;
    };
  }

  private setTarget(target: CaretTarget): void {
    this.caretElement.style.left = `${target.left}px`;
    this.caretElement.style.top = `${target.top}px`;
    this.caretElement.style.height = `${target.height}px`;
  }
}
