# Frontend Rewrite

## Stack Choice

The new frontend lives in `frontend/` and keeps the repository's existing React 19 + Vite + TypeScript setup. Monkeytype was inspected as the product and behavior reference, but its code is GPL-3.0, so Type Study implements original frontend code instead of copying Monkeytype or `frontend_prev/`.

React owns screens, navigation, import state, and result display. The typing surface uses an imperative DOM controller inside React because the important Monkeytype behaviors depend on precise input, letter, caret, and row measurements after each keystroke.

## Folder Structure

```txt
frontend/
  index.html
  src/
    App.tsx
    main.tsx
    data/
    lib/
      typing/
      typing-dom/
    screens/
      ImportScreen/
      TypingScreen/
    services/
    styles/
    types/
```

## Backend Integration

The import screen calls the existing Workers through service clients:

- `VITE_PROCESS_INPUT_API_URL` or `http://127.0.0.1:8788`
- `VITE_NORMALIZATION_API_URL` or `http://127.0.0.1:8789`

Supported process-input requests are pasted text, `.txt`, and text-based `.pdf`. PDF upload remains JSON/base64 because that is the current Worker contract. File size is checked at 10 MiB before request submission.

After a document is processed, normalization runs automatically and re-runs when options change. Source edits clear processed and normalized state so stale typing targets cannot be started.

## UI Notes

The visual system uses Monkeytype-like CSS variables: dark gray background, muted gray untyped text, yellow accent/caret, red errors, and a monospace font. The first screen is the typing experience, not a landing page. The import view is a working tool for creating a normalized typing target.

## Known Limitations

- IME composition support is basic compared with Monkeytype.
- There is no account saving, result chart, pace caret, sound, or custom theme editor.
- Faint punctuation placement is heuristic when the normalization map has no direct input character near a display-only character.
- Scanned PDFs still require OCR, which is intentionally out of scope.

## Manual QA Checklist

- Built-in sample starts on first valid typed character.
- Restart works during a live test and from the result screen.
- Clicking the typing area focuses the hidden textarea.
- Paste and drop are blocked in the typing surface.
- Correct, incorrect, extra, missed, active, typed, and faint characters render.
- Caret follows the active input and remains aligned through row jumps.
- Import handles empty source, invalid file type, too-large file, unreachable backend, processing failure, normalization failure, empty normalized text, and successful paste-to-typing flow.