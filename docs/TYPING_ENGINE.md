# Typing Engine

## Lifecycle

`TypingScreen` receives one or more passages. For each session it creates a `DomTypingController`, which creates an initial pure `TypingState`, renders all words, focuses the hidden textarea, and reports state changes back to React.

The pure engine starts in `idle`. The first accepted non-control character sets `startedAt` and switches the state to `running`. The test finishes when the last word is completed or committed, setting `endedAt` and producing the result screen.

## Input Model

The typing surface is not a visible textarea. It uses an invisible textarea with a leading sentinel space so browser delete/caret behavior stays predictable while the app owns the real input state.

The DOM controller listens to:

- `beforeinput` to block unsupported replacements and post-finish input.
- `input` to process inserted text and line breaks one character at a time.
- `keydown` to handle backspace, Ctrl/Meta+Backspace, Tab restart, and Escape restart.
- `paste` and `drop` to block copied input during tests.
- `focus` and `blur` to show the out-of-focus state.

Spaces commit words. Newlines commit words whose normalized target has a newline commit. Extra letters are accepted up to a bounded limit and shown as extra errors.

## Rendering And Caret

`lib/typing-dom/renderWords.ts` renders word containers and custom `letter` elements. Required letters get input offsets; faint display-only characters do not. The renderer updates only changed words, then refreshes active/typed/error classes.

`CaretController` measures the active word and the current required or extra letter after render. It moves an absolute caret element with a short Web Animations API transition and hides it when the textarea is blurred.

The active row is kept visible by comparing the active word `offsetTop` with the visible wrapper window and translating the words container upward. This matches the Monkeytype feel more closely than scrolling the page or using a normal text input.

## Metrics

Results are calculated from `TypingState`:

- WPM: correct characters divided by 5 over elapsed minutes.
- Raw WPM: correct, incorrect, and extra typed characters divided by 5 over elapsed minutes.
- Accuracy: correct insert events divided by all insert events.
- Characters: correct, incorrect, extra, and missed counts.

## Boundaries

The engine is frontend-only and does not know about Worker APIs. Imported text is normalized before it reaches the engine; built-in samples skip the backend. React coordinates sessions and results, while the DOM controller owns keystroke handling and visual updates.