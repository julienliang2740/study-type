import type { TypingState } from "../typing/types";
import { getWordElement } from "./renderWords";

type CaretTarget = {
  x: number;
  y: number;
  height: number;
};

export class CaretController {
  private lastAnimation: Animation | null = null;

  constructor(
    private readonly wrapper: HTMLElement,
    private readonly wordsElement: HTMLElement,
    private readonly caret: HTMLElement
  ) {}

  reset(): void {
    this.lastAnimation?.cancel();
    this.lastAnimation = null;
    this.caret.style.transform = "translate3d(0px, 0px, 0)";
    this.caret.style.height = "1.2em";
  }

  hide(): void {
    this.caret.classList.add("hidden");
  }

  show(): void {
    this.caret.classList.remove("hidden");
  }

  update(state: TypingState, animate = true): void {
    const target = this.getTarget(state);
    if (target === null) {
      this.hide();
      return;
    }

    this.show();
    this.caret.style.height = `${target.height}px`;
    const transform = `translate3d(${target.x}px, ${target.y}px, 0)`;

    if (!animate) {
      this.lastAnimation?.cancel();
      this.caret.style.transform = transform;
      return;
    }

    const current = getComputedStyle(this.caret).transform;
    this.lastAnimation?.cancel();
    this.caret.classList.add("moving");
    this.lastAnimation = this.caret.animate(
      [{ transform: current === "none" ? this.caret.style.transform : current }, { transform }],
      {
        duration: 70,
        easing: "cubic-bezier(.2, 0, .2, 1)",
        fill: "forwards"
      }
    );
    this.lastAnimation.onfinish = () => {
      this.caret.style.transform = transform;
      this.caret.classList.remove("moving");
      this.lastAnimation = null;
    };
  }

  private getTarget(state: TypingState): CaretTarget | null {
    const wordIndex =
      state.status === "finished"
        ? Math.max(0, state.words.length - 1)
        : state.activeWordIndex;
    const word = state.words[wordIndex];
    const wordElement = getWordElement(this.wordsElement, wordIndex);

    if (word === undefined || wordElement === null) return null;

    const input = state.inputs[wordIndex] ?? "";
    const wrapperRect = this.wrapper.getBoundingClientRect();
    const wordRect = wordElement.getBoundingClientRect();
    const requiredLetters = Array.from(
      wordElement.querySelectorAll<HTMLElement>(".letter[data-input-offset]")
    );
    const currentLetter = wordElement.querySelector<HTMLElement>(
      `.letter[data-input-offset="${input.length}"]`
    );
    const previousRequiredLetters = requiredLetters.filter(
      (letter) => Number(letter.dataset.inputOffset) < input.length
    );
    const previousRequired =
      previousRequiredLetters[previousRequiredLetters.length - 1];
    const extraLetters = Array.from(
      wordElement.querySelectorAll<HTMLElement>(".letter.extra")
    );
    const lastExtra = extraLetters[extraLetters.length - 1];
    const anchor = lastExtra ?? previousRequired;
    const letterRect = currentLetter?.getBoundingClientRect();

    if (letterRect !== undefined) {
      return {
        x: letterRect.left - wrapperRect.left,
        y: letterRect.top - wrapperRect.top,
        height: letterRect.height
      };
    }

    if (anchor !== undefined) {
      const rect = anchor.getBoundingClientRect();
      return {
        x: rect.right - wrapperRect.left,
        y: rect.top - wrapperRect.top,
        height: rect.height
      };
    }

    return {
      x: wordRect.left - wrapperRect.left,
      y: wordRect.top - wrapperRect.top,
      height: wordRect.height
    };
  }
}
