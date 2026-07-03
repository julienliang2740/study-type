import {
  createInitialTypingState,
  deleteTypingData,
  insertTypingData
} from "../typing/engine";
import type { TypingChange, TypingState } from "../typing/types";
import type { Passage } from "../../types/passage";
import { CaretController } from "./caretController";
import {
  renderAllWords,
  renderWord,
  updateWordClasses
} from "./renderWords";

type DomTypingControllerOptions = {
  passage: Passage;
  wrapper: HTMLElement;
  words: HTMLElement;
  input: HTMLTextAreaElement;
  caret: HTMLElement;
  onStateChange: (state: TypingState) => void;
  onFinish: (state: TypingState) => void;
  onRestartShortcut: () => void;
  onFocusChange: (focused: boolean) => void;
};

const sentinel = " ";
const supportedInsertInputTypes = new Set([
  "insertText",
  "insertLineBreak",
  "insertCompositionText",
  "insertFromComposition"
]);

export class DomTypingController {
  private state: TypingState;
  private readonly caretController: CaretController;
  private currentTranslateY = 0;
  private resizeObserver: ResizeObserver | null = null;

  constructor(private readonly options: DomTypingControllerOptions) {
    this.state = createInitialTypingState(options.passage);
    this.caretController = new CaretController(
      options.wrapper,
      options.words,
      options.caret
    );
  }

  mount(): void {
    this.prepareInput();
    this.currentTranslateY = 0;
    this.options.words.style.transform = "translate3d(0, 0, 0)";
    renderAllWords(this.options.words, this.state);
    this.options.onStateChange(this.state);
    this.caretController.reset();
    this.bindEvents();
    this.syncAfterRender(false);
    this.focus();
  }

  destroy(): void {
    this.unbindEvents();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  focus(): void {
    this.options.input.focus({ preventScroll: true });
  }

  getState(): TypingState {
    return this.state;
  }

  private prepareInput(): void {
    this.options.input.value = sentinel;
    this.options.input.setSelectionRange(1, 1);
    this.options.input.setAttribute("autocomplete", "off");
    this.options.input.setAttribute("autocapitalize", "none");
    this.options.input.setAttribute("autocorrect", "off");
    this.options.input.setAttribute("spellcheck", "false");
  }

  private bindEvents(): void {
    this.options.wrapper.addEventListener("click", this.handleWrapperClick);
    this.options.input.addEventListener("beforeinput", this.handleBeforeInput);
    this.options.input.addEventListener("input", this.handleInput);
    this.options.input.addEventListener("keydown", this.handleKeyDown);
    this.options.input.addEventListener("focus", this.handleFocus);
    this.options.input.addEventListener("blur", this.handleBlur);
    this.options.input.addEventListener("paste", this.blockEvent);
    this.options.input.addEventListener("drop", this.blockEvent);
    this.options.wrapper.addEventListener("paste", this.blockEvent);
    this.options.wrapper.addEventListener("drop", this.blockEvent);
    window.addEventListener("keydown", this.handleWindowKeyDown);
    window.addEventListener("resize", this.handleResize);

    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.options.wrapper);
  }

  private unbindEvents(): void {
    this.options.wrapper.removeEventListener("click", this.handleWrapperClick);
    this.options.input.removeEventListener("beforeinput", this.handleBeforeInput);
    this.options.input.removeEventListener("input", this.handleInput);
    this.options.input.removeEventListener("keydown", this.handleKeyDown);
    this.options.input.removeEventListener("focus", this.handleFocus);
    this.options.input.removeEventListener("blur", this.handleBlur);
    this.options.input.removeEventListener("paste", this.blockEvent);
    this.options.input.removeEventListener("drop", this.blockEvent);
    this.options.wrapper.removeEventListener("paste", this.blockEvent);
    this.options.wrapper.removeEventListener("drop", this.blockEvent);
    window.removeEventListener("keydown", this.handleWindowKeyDown);
    window.removeEventListener("resize", this.handleResize);
  }

  private readonly blockEvent = (event: Event): void => {
    event.preventDefault();
  };

  private readonly handleWrapperClick = (): void => {
    this.focus();
  };

  private readonly handleFocus = (): void => {
    this.options.onFocusChange(true);
    this.caretController.show();
    this.restoreInputValue();
  };

  private readonly handleBlur = (): void => {
    this.options.onFocusChange(false);
    this.caretController.hide();
  };

  private readonly handleBeforeInput = (event: InputEvent): void => {
    if (this.state.status === "finished") {
      event.preventDefault();
      return;
    }

    if (
      event.inputType.startsWith("delete") ||
      supportedInsertInputTypes.has(event.inputType)
    ) {
      return;
    }

    event.preventDefault();
  };

  private readonly handleInput = (event: Event): void => {
    if (!(event instanceof InputEvent)) {
      this.restoreInputValue();
      return;
    }

    if (event.inputType.startsWith("delete")) {
      this.restoreInputValue();
      return;
    }

    const data =
      event.inputType === "insertLineBreak" ? "\n" : event.data ?? "";

    if (data.length === 0) {
      this.restoreInputValue();
      return;
    }

    for (const char of Array.from(data)) {
      this.applyChange(insertTypingData(this.state, char, performance.now()));
    }

    this.restoreInputValue();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Tab") {
      this.restoreInputValue();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.options.onRestartShortcut();
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      this.applyChange(
        deleteTypingData(this.state, event.ctrlKey || event.metaKey, performance.now())
      );
      this.restoreInputValue();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
      event.preventDefault();
    }
  };

  private readonly handleResize = (): void => {
    this.syncAfterRender(false);
  };

  private readonly handleWindowKeyDown = (event: KeyboardEvent): void => {
    if (document.activeElement === this.options.input) return;
    if (this.state.status === "finished") return;

    const target = event.target as HTMLElement | null;
    const isEditable =
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.tagName === "BUTTON" ||
      target?.isContentEditable === true;

    if (isEditable) return;

    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      this.focus();
    }
  };

  private applyChange(change: TypingChange): void {
    if (change.changedWordIndexes.length === 0 && change.state === this.state) {
      return;
    }

    this.state = change.state;

    for (const wordIndex of change.changedWordIndexes) {
      renderWord(this.options.words, this.state, wordIndex);
    }
    updateWordClasses(this.options.words, this.state);
    this.options.onStateChange(this.state);
    this.syncAfterRender(true);

    if (change.finished) {
      this.options.onFinish(this.state);
    }
  }

  private restoreInputValue(): void {
    const input = this.state.inputs[this.state.activeWordIndex] ?? "";
    this.options.input.value = `${sentinel}${input}`;
    const end = this.options.input.value.length;
    this.options.input.setSelectionRange(end, end);
  }

  private syncAfterRender(animateCaret: boolean): void {
    window.requestAnimationFrame(() => {
      this.keepActiveRowVisible();
      this.caretController.update(this.state, animateCaret);
    });
  }

  private keepActiveRowVisible(): void {
    if (this.state.words.length === 0) return;

    const activeWord = this.options.words.querySelector<HTMLElement>(
      `.word[data-word-index="${this.state.activeWordIndex}"]`
    );
    if (activeWord === null) return;

    const rowTops = this.getRowTops();
    if (rowTops.length === 0) return;

    this.syncWrapperHeight(rowTops);

    const activeRowIndex = this.getRowIndex(rowTops, activeWord.offsetTop);
    const topRowIndex = Math.max(0, activeRowIndex - 1);
    const firstRowTop = rowTops[0] ?? 0;
    const nextTranslateY = Math.max(0, (rowTops[topRowIndex] ?? 0) - firstRowTop);

    if (Math.abs(nextTranslateY - this.currentTranslateY) < 1) return;

    this.currentTranslateY = nextTranslateY;
    this.options.words.style.transform = `translate3d(0, -${nextTranslateY}px, 0)`;
  }

  private getRowTops(): number[] {
    const rowTops: number[] = [];
    const words = Array.from(
      this.options.words.querySelectorAll<HTMLElement>(".word")
    );

    for (const word of words) {
      if (!rowTops.some((top) => Math.abs(top - word.offsetTop) < 1)) {
        rowTops.push(word.offsetTop);
      }
    }

    return rowTops.sort((a, b) => a - b);
  }

  private getRowIndex(rowTops: number[], offsetTop: number): number {
    let closestIndex = 0;

    for (let index = 0; index < rowTops.length; index += 1) {
      if (Math.abs(rowTops[index] - offsetTop) < 1) {
        return index;
      }

      if (rowTops[index] <= offsetTop) {
        closestIndex = index;
      }
    }

    return closestIndex;
  }

  private syncWrapperHeight(rowTops: number[]): void {
    const firstWord = this.options.words.querySelector<HTMLElement>(".word");
    const rowStep =
      rowTops.length > 1
        ? rowTops[1] - rowTops[0]
        : firstWord?.offsetHeight ?? this.options.wrapper.clientHeight / 3;

    if (rowStep <= 0) return;

    this.options.wrapper.style.height = `${Math.ceil(rowStep * 3)}px`;
  }
}
