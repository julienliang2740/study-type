# Type Study App Repository Overview

This document explains what this repository is, how the major pieces fit together, and how the frontend is structured. It intentionally does not explain the typing engine internals. It only describes the typing engine at the integration boundaries that the UI uses.

## What This Project Is

`type-study-app` is a Monkeytype-style typing practice app for imported study material. The intended product flow is:

1. The user opens the React frontend.
2. The user either types a built-in sample passage or imports text.
3. Imported text can come from a pasted text box, a `.txt` file, or a text-based `.pdf`.
4. The `process_input` backend converts that source into a canonical processed document and stores it.
5. The `normalization` backend loads the processed document, applies user-selected normalization options, and returns a typing target.
6. The frontend starts a typing session using that normalized target.

The app is currently an MVP with a local-first setup and Cloudflare deployment targets:

- Frontend: React 19 + Vite.
- Process input backend: Cloudflare Worker-ready TypeScript service.
- Normalization backend: Cloudflare Worker-ready TypeScript service.
- Storage: Cloudflare R2 bucket shared by both Workers.

## Current Repo Shape

At the repository root:

```txt
type-study-app/
  backend/
    process_input/
    normalization/
  frontend_prev/
    index.html
    src/
  dist/
  docs/
  package.json
  vite.config.ts
  tsconfig*.json
  run_local.ps1
  run_local.sh
  README.md
  DEPLOYMENT.md
```

Important current-state note: `vite.config.ts` is configured with `root: "frontend"`, but this checkout contains `frontend_prev/` and does not contain a `frontend/` directory. The root `tsconfig.app.json` also includes `frontend/src`. The source described in this document is the actual frontend source present in `frontend_prev/src`. As-is, the Vite config and TypeScript include paths appear stale relative to the checked-in frontend directory.

Generated and local runtime artifacts are present but should not be treated as source:

- `node_modules/` at the root and inside both backend packages.
- `dist/` at the root and inside backend packages.
- `.wrangler/` state directories.
- `*.log` local service logs.

`.gitignore` excludes `node_modules/`, `dist/`, `.wrangler/`, `.env*` except `.env.example`, and logs.

## Runtime Services

The app expects three local services for the full MVP flow:

```txt
Frontend:      http://127.0.0.1:5173
process_input: http://127.0.0.1:8788
normalization: http://127.0.0.1:8789
```

Root `package.json` scripts:

```txt
npm run dev       -> Vite dev server
npm run build     -> TypeScript build references, then Vite build
npm run typecheck -> TypeScript build references only
npm run preview   -> Vite preview
```

`run_local.ps1` and `run_local.sh` start all three services:

- `backend/process_input`: `npm run dev:worker`
- `backend/normalization`: `npm run dev`
- repository root: `npm run dev`

Both backend dev commands use Wrangler and persist local R2 state to `../../.wrangler/state`, which lets process-input writes be visible to normalization reads during local development.

## Data Flow

### Sample Typing Flow

The sample typing flow does not call the backend:

1. `App` initializes `activePassages` from `samplePassages`.
2. `TypingTest` receives those passages.
3. The DOM typing controller renders and manages the typing surface.
4. When the session finishes, `TypingTest` shows `ResultScreen`.

### Imported Text Flow

The import flow uses both backend services:

1. User enters pasted text or chooses a `.txt`/`.pdf` file in `ImportTextPage`.
2. User clicks `process/import`.
3. `ImportTextPage` calls:
   - `processPastedText` for pasted text.
   - `processImportFile` for uploaded files.
4. `processInputClient` POSTs to the process-input worker.
5. The process-input worker stores source content and `processed.json` in R2.
6. The worker returns a `ProcessedDocumentSummary`.
7. `ImportTextPage` stores that summary in state.
8. A React effect sees that a processed document exists and calls `normalizeDocument`.
9. `normalizationClient` POSTs `{ documentId, options }` to the normalization worker.
10. The normalization worker loads `documents/{documentId}/processed.json` from R2 and returns a normalized typing payload.
11. `ImportTextPage` renders the display and required-input previews.
12. User clicks `start typing`.
13. The normalized payload is wrapped into a frontend `Passage` and passed back to `App`.
14. `App` swaps to the typing view and starts `TypingTest` with the imported passage.

## Frontend Structure

Frontend source currently lives under:

```txt
frontend_prev/src/
  App.tsx
  main.tsx
  components/
    ImportText/
      ImportTextPage.tsx
      NormalizationOptionsPanel.tsx
    TypingTest/
      TypingTest.tsx
      ResultScreen.tsx
      WordDisplay.tsx
      icons.tsx
  data/
    samplePassages.ts
  lib/
    typing/
    typing-dom/
  services/
    processInputClient.ts
    normalizationClient.ts
  styles/
    index.css
  types/
    passage.ts
    typing.ts
```

### `main.tsx`

`main.tsx` is the React entry point. It creates a root on `#root`, wraps the app in `StrictMode`, renders `App`, and imports the global CSS from `styles/index.css`.

### `App.tsx`

`App` is the top-level frontend state coordinator. It has three central pieces of state:

- `view`: either `"typing"` or `"import"`.
- `typingSessionKey`: a numeric key used to force a fresh `TypingTest` mount.
- `activePassages`: the list of passages currently used by the typing test.

The top bar has two buttons:

- `type`: calls `showSampleTyping`, resets `activePassages` to the built-in samples, increments `typingSessionKey`, and switches to the typing view.
- `import`: switches to the import view.

When imported text is ready, `ImportTextPage` calls `onStartTyping(passage)`. `App` handles that with `startImportedTyping`, replacing `activePassages` with a one-item imported passage list, incrementing `typingSessionKey`, and switching back to the typing view.

### Frontend Types

`types/passage.ts` defines the object passed into the typing test:

```ts
type Passage = {
  id: string;
  title: string;
  source: string;
  text: string;
  normalizedText?: NormalizedTypingText;
};
```

For sample passages, `text` is ordinary text and `normalizedText` is absent.

For imported passages, `text` is the normalized `inputText`, and `normalizedText` is included so the typing display can preserve display/input differences such as faint punctuation.

`types/typing.ts` defines shared typing UI state shapes such as `TypingWord`, `TypingState`, and `TypingResult`. These are consumed by the components and DOM controller. This document does not cover the engine logic that creates or updates them.

### Built-In Data

`data/samplePassages.ts` exports two placeholder passages:

- `local-foundation`
- `long-form-study`

These provide a backend-free default typing experience and a fallback path from the top nav `type` button.

## Import UI

### `ImportTextPage`

`ImportTextPage` owns the entire import workflow. Its props are:

```ts
type ImportTextPageProps = {
  onStartTyping: (passage: Passage) => void;
};
```

It manages these state groups:

- Input state: `rawText`, `selectedFile`, `fileInputVersion`.
- Normalization options: `options`.
- Backend output: `processedDocument`, `normalizedText`.
- Request status: `processStatus`, `normalizeStatus`.
- Error messages: `processError`, `normalizationError`.

The page has three visible regions:

- Import editor: pasted text area, file chooser, file metadata, action buttons, and errors.
- Normalization options panel.
- Normalization preview: one preview for display text and one for required typed input.

The page resets processed/normalized state whenever the user edits raw text, chooses a new file, clears a file, or loads the sample. This prevents a stale processed document or stale normalization preview from being used after the source input changes.

The main action buttons are:

- `load sample`: fills the text area with `"The empire, however, expanded in 476."` and enables number conversion.
- `process/import`: sends the text or selected file to process-input.
- `start typing`: enabled only after a document has been processed, normalization has succeeded, and the normalized `inputText` is non-empty.

The normalization request is driven by a `useEffect` that depends on `processedDocument` and `options`. Once a document is processed, changing any normalization option automatically re-runs normalization for that document.

The effect uses a `cancelled` flag in its cleanup function so late responses do not update state after a newer request has started or the component has moved on.

### `FaintDisplayPreview`

`FaintDisplayPreview` is a local component inside `ImportTextPage`. It renders the normalized `characterMap` as preview spans:

- Entries with `faint: true` receive the `faint-preview-char` class.
- If no character map exists, it shows a muted placeholder.

This lets the import screen preview punctuation or other display characters that are visible but not required for typing.

### `NormalizationOptionsPanel`

`NormalizationOptionsPanel` is a controlled fieldset. It receives the full `NormalizationOptions` object and an `onChange` callback. It renders one checkbox per option:

- `lowercase`
- `removePunctuationFromInput`
- `showPunctuationFaintly`
- `collapseLineBreaks`
- `preserveParagraphBreaks`
- `normalizeQuotesAndDashes`
- `convertNumbersToWords`

Each checkbox clones the current options object and changes one key, so the parent remains the single source of truth.

## Typing UI

### `TypingTest`

`TypingTest` receives a list of passages:

```ts
type TypingTestProps = {
  passages: Passage[];
};
```

It manages:

- `passageIndex`: current passage in the provided list.
- `sessionVersion`: a local counter used to remount/reinitialize the DOM controller.
- `liveState`: current typing state.
- `finishedState`: final state once the test is finished.
- `now`: current performance timestamp for live metrics.

It owns refs for the actual DOM typing surface:

- `wrapperRef`: click/focus wrapper.
- `wordsRef`: rendered word container.
- `inputRef`: hidden textarea that captures input.
- `caretRef`: visual caret element.
- `controllerRef`: `DomTypingController` instance.

On mount and whenever the passage/session changes, `TypingTest`:

1. Creates an initial typing state for the current passage.
2. Clears any finished result.
3. Instantiates `DomTypingController` with the passage, DOM refs, and callbacks.
4. Calls `controller.mount()`.
5. Destroys the controller during cleanup.

While the session is running, a 100ms interval updates `now` so elapsed time and WPM stay live.

The live screen renders:

- Mini stats: elapsed time, rounded WPM, rounded accuracy.
- Hidden textarea input.
- Visual caret.
- Empty `#words` container, populated by the DOM controller.
- Restart button.
- Progress bar based on active word and partial word progress.

When `finishedState` is set, `TypingTest` switches entirely to `ResultScreen`.

The restart behavior destroys the current controller, clears the finished state, advances to the next passage in the list, and increments `sessionVersion`.

### `ResultScreen`

`ResultScreen` displays the post-test summary:

- WPM.
- Accuracy.
- Elapsed time.
- Correct character count.
- Passage source.
- Passage title.
- Restart icon button.

It receives already-computed `TypingResult` data and does not calculate metrics itself.

### `icons.tsx`

`icons.tsx` currently exports only `RestartIcon`, an inline SVG used by the restart controls in both the live typing screen and result screen.

### `WordDisplay`

`WordDisplay.tsx` is a React-rendered word display component, but no current source file imports it. The live typing surface in `TypingTest` uses `DomTypingController` and the imperative `typing-dom/renderWords.ts` path instead.

Treat `WordDisplay` as an unused, older, or alternate rendering implementation unless it is reintroduced. It mirrors the same concepts as the DOM renderer:

- Active word class.
- Typed word class.
- Error word class.
- Correct/incorrect/extra letter classes.
- Faint display tokens.

## DOM Typing Integration

The frontend has a separate DOM integration layer under `lib/typing-dom/`. This is not the typing engine itself; it is the bridge between React and the rendered typing surface.

### `DomTypingController`

`DomTypingController` receives:

- A `Passage`.
- DOM elements for wrapper, words, hidden input, and caret.
- Callback hooks for state changes, finish, and restart shortcuts.

It is responsible for:

- Rendering the initial words into `#words`.
- Keeping the hidden textarea focused.
- Listening to `beforeinput`, `input`, `keydown`, focus, blur, wrapper click, and window resize.
- Passing insert/delete operations into the typing engine boundary.
- Re-rendering only changed words.
- Updating word classes after input changes.
- Moving the visual caret.
- Scrolling/jumping the word rows so the active line stays in view.
- Blocking paste, drop, replacement text, unsupported newlines, leading spaces, and very long extra input.
- Treating `Tab` and `Escape` as restart shortcuts.

The hidden textarea uses a sentinel leading space so the browser input/caret behavior remains stable while the app controls the actual typed input.

### `renderWords.ts`

`renderWords.ts` imperatively creates and updates the word DOM:

- `renderWords` builds the full initial word list.
- `renderChangedWords` redraws only specific word indexes.
- `renderWordLetters` renders required, faint, and extra letters.
- `setWordStatusClass` toggles active/typed/error classes.
- `getWordElement` locates a word by `data-wordindex`.

It creates custom `letter` elements rather than React spans. CSS targets these with `.letter` class selectors.

### `CaretController`

`CaretController` positions and animates the visual caret. It measures the active word and relevant letter, calculates the caret target, and moves the caret using the Web Animations API. It also pauses and resumes caret blinking during movement so the caret feels responsive while typing.

## Frontend Services

### `processInputClient.ts`

This service wraps calls to the process-input backend. It defaults to:

```txt
VITE_PROCESS_INPUT_API_URL=http://127.0.0.1:8788
```

Public exports:

- `MAX_UPLOAD_BYTES`: 10 MiB.
- `processPastedText({ title, text })`.
- `processImportFile(file)`.
- `getProcessedDocument(documentId)`.
- Data types for processed documents and summaries.

`processImportFile` handles file branching:

- `.txt` or `text/plain`: reads `file.text()` and POSTs to `/api/process/txt`.
- `.pdf` or `application/pdf`: reads `file.arrayBuffer()`, converts it to base64, and POSTs to `/api/process/pdf`.
- Other file types throw `"Choose a .txt or text-based .pdf file."`

Before upload, the client enforces the same 10 MiB limit shown in the UI.

Error handling is user-facing. If `fetch` cannot reach the backend, it throws a message that includes the expected local command. If the backend returns a JSON error, the backend message is surfaced.

### `normalizationClient.ts`

This service wraps calls to the normalization backend. It defaults to:

```txt
VITE_NORMALIZATION_API_URL=http://127.0.0.1:8789
```

Public exports:

- `NormalizationOptions`
- `CharacterMapEntry`
- `NormalizedTypingText`
- `NormalizeDocumentResponse`
- `defaultNormalizationOptions`
- `emptyNormalizedTypingText`
- `normalizeDocument({ documentId, options })`

The client POSTs to `/api/normalize` with a document ID and options. The returned payload contains:

- `originalText`
- `displayText`
- `inputText`
- `characterMap`
- `documentId`
- metadata with character and word counts

## Styling And Layout

All frontend styling is global CSS in `frontend_prev/src/styles/index.css`.

The visual language is close to Monkeytype:

- Dark gray background.
- Yellow main/caret color.
- Muted gray secondary text.
- Monospace font stack.
- Red error states.

Key layout primitives:

- `.content-grid`: a full-width CSS grid with named columns for full-width, padded full-width, breakout, and content areas.
- `.full-width`, `.full-width-padding`, `.breakout`: utility classes that place children into named grid tracks.
- `.topbar`: brand and view-switching navigation.
- `.pageTest`: vertically centers the typing interface.
- `.import-layout`: two-column import form/options layout with a full-width preview row.

Typing UI styling:

- `#wordsWrapper`: fixed-height visible typing window.
- `#words`: flex-wrapped word area.
- `.word`: individual word container.
- `.letter.correct`, `.letter.incorrect`, `.letter.incorrect.extra`, `.letter.faint`: typed character states.
- `#caret`: animated visual caret.
- `.test-progress`: progress bar below the typing surface.

Import UI styling:

- `.import-editor`, `.normalization-options`, `.normalization-preview`: panel surfaces.
- `.raw-text-input`: large transparent text area.
- `.file-import-row`: file input plus clear button.
- `.checkbox-option`: option rows.
- `.preview-text`: normalized display and required-input previews.

Responsive behavior:

- At `max-width: 720px`, page padding tightens, typing font size and wrapper height shrink, result stats reduce, and the import layout collapses to one column.

## Backend: `process_input`

`backend/process_input` ingests raw user sources and creates canonical processed documents. It does not perform typing normalization.

Package scripts:

```txt
npm run dev        -> Node smoke-test server with in-memory storage
npm run dev:worker -> Wrangler Worker dev server on port 8788
npm run build      -> TypeScript compile
npm run typecheck  -> TypeScript no-emit check
npm run start      -> run compiled Node server
npm run deploy     -> Wrangler deploy
```

Worker endpoints:

```txt
GET  /api/health
POST /api/process/text
POST /api/process/txt
POST /api/process/pdf
GET  /api/documents/:documentId
GET  /api/documents/:documentId/processed
```

The Node smoke-test server also supports legacy endpoints:

```txt
GET  /health
POST /process/text
POST /process/txt
POST /process/pdf
```

Important source files:

- `src/worker.ts`: Cloudflare Worker request handler.
- `src/routes.ts`: Node HTTP smoke-test route handler.
- `src/processAndStore.ts`: connects processing functions to storage.
- `src/storage.ts`: memory and R2 storage implementations.
- `src/types.ts`: request/response/error contracts and upload limits.
- `src/processText.ts`, `src/processTxt.ts`, `src/processPdf.ts`: source-specific processing.
- `src/textBlocks.ts`, `src/cleanPdfText.ts`, `src/hash.ts`: processing helpers.

Upload limits:

- `MAX_UPLOAD_BYTES = 10 * 1024 * 1024`
- `MAX_TEXT_BYTES = MAX_UPLOAD_BYTES`
- `MAX_PDF_BYTES = MAX_UPLOAD_BYTES`

The stored processed document version is:

```txt
process_input.v1
```

The R2 object layout is:

```txt
documents/{documentId}/source/original.txt
documents/{documentId}/source/original.pdf
documents/{documentId}/processed.json
```

The process-input Worker binding is configured in `wrangler.toml`:

```txt
TYPE_STUDY_DOCUMENTS -> type-study-documents
```

The response returned to the frontend after processing is a summary, not the full document. It includes document ID, status, title, source type, source metadata, document metadata, and storage keys.

## Backend: `normalization`

`backend/normalization` creates typing targets from processed documents. It loads `processed.json` from R2, applies options, and returns display/input text plus a character map.

Package scripts:

```txt
npm run dev       -> Wrangler Worker dev server on port 8789
npm run build     -> TypeScript compile
npm run typecheck -> TypeScript no-emit check
npm run deploy    -> Wrangler deploy
```

Worker endpoints:

```txt
GET  /api/health
POST /api/normalize
```

The route handler also accepts `POST /` for raw text normalization, though the frontend uses `/api/normalize` with a `documentId`.

Important source files:

- `worker.ts`: Cloudflare Worker entry.
- `routes/normalizeRoute.ts`: HTTP routing, request validation, CORS, errors.
- `service.ts`: service layer and response metadata builder.
- `types.ts`: normalization option and output contracts.
- `storage/r2ProcessedDocumentLoader.ts`: loads processed documents from R2.
- `normalizeText.ts`: normalization implementation.

The normalization Worker uses the same R2 binding as process-input:

```txt
TYPE_STUDY_DOCUMENTS -> type-study-documents
```

For `documentId` requests, normalization reads:

```txt
documents/{documentId}/processed.json
```

The frontend sends options shaped as:

```ts
type NormalizationOptions = {
  lowercase: boolean;
  removePunctuationFromInput: boolean;
  showPunctuationFaintly: boolean;
  collapseLineBreaks: boolean;
  preserveParagraphBreaks: boolean;
  normalizeQuotesAndDashes: boolean;
  convertNumbersToWords: boolean;
};
```

The response shape is:

```ts
type NormalizeDocumentResponse = {
  documentId: string;
  originalText: string;
  displayText: string;
  inputText: string;
  characterMap: CharacterMapEntry[];
  metadata: {
    characterCount: number;
    wordCount: number;
  };
};
```

## Shared Storage Contract

The two backend services communicate indirectly through R2:

1. `process_input` writes `documents/{documentId}/processed.json`.
2. The frontend keeps only the `documentId`.
3. `normalization` receives the `documentId`.
4. `normalization` reads the processed document from the same R2 bucket.

This means local development requires both Workers to use the same persisted Wrangler state path, and production requires both Workers to bind to the same R2 bucket.

Normalization caching is reserved but not implemented. The documented future path is:

```txt
documents/{documentId}/normalizations/{normalizationHash}.json
```

## Deployment

`DEPLOYMENT.md` describes a Cloudflare MVP deployment:

- Cloudflare Pages for the frontend.
- Two Cloudflare Workers:
  - `type-study-process-input`
  - `type-study-normalization`
- One private R2 bucket:
  - `type-study-documents`

The frontend build needs these Vite environment variables:

```txt
VITE_PROCESS_INPUT_API_URL=https://type-study-process-input.<subdomain>.workers.dev
VITE_NORMALIZATION_API_URL=https://type-study-normalization.<subdomain>.workers.dev
```

`links.txt` contains concrete deployed Worker URLs for one environment:

```txt
VITE_PROCESS_INPUT_API_URL=https://type-study-process-input.julienliang2740.workers.dev
VITE_NORMALIZATION_API_URL=https://type-study-normalization.julienliang2740.workers.dev
```

CORS is currently permissive in both Workers:

```txt
access-control-allow-origin: *
```

That is convenient for MVP testing but should be restricted before handling real private user documents.

## Known Gaps And Risks

- The checked-in frontend directory is `frontend_prev/`, but Vite and root TypeScript config refer to `frontend/`.
- No authentication exists yet.
- No database exists yet.
- R2 is the only shared persistence layer.
- PDF input is JSON/base64, not multipart.
- Scanned PDFs are unsupported because there is no OCR.
- Complex PDF layouts can extract imperfectly.
- Normalization caching is planned but not implemented.
- Both Workers currently allow any origin through CORS.
- `WordDisplay.tsx` appears unused by the active frontend rendering path.
- The root `dist/` and backend `dist/` directories are generated artifacts, not primary source.

## Quick Mental Model

Think of the app as four layers:

1. React screens and components choose what the user sees.
2. Frontend service clients call Workers and translate browser inputs into API requests.
3. Workers process, store, and normalize document data.
4. The typing screen consumes a `Passage` and delegates low-level typing interaction to the DOM typing controller.

For most frontend work, start at `App.tsx`, then follow one of two branches:

- Typing branch: `App.tsx` -> `TypingTest.tsx` -> `DomTypingController` -> `renderWords`/`CaretController` -> `ResultScreen`.
- Import branch: `App.tsx` -> `ImportTextPage.tsx` -> `processInputClient` -> `normalizationClient` -> `NormalizationOptionsPanel`/preview -> back to `TypingTest`.
