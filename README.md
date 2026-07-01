# type-study-app

Try it out:
https://study-type.pages.dev/

Local Monkeytype-style typing app with separate process-input and normalization backends.

## Local MVP Flow

Run three terminals:

```powershell
cd type-study-app/backend/process_input
npm install
npm run dev:worker
```

```powershell
cd type-study-app/backend/normalization
npm install
npm run dev
```

```powershell
cd type-study-app
npm install
npm run dev
```

Frontend defaults:

```txt
VITE_PROCESS_INPUT_API_URL=http://127.0.0.1:8788
VITE_NORMALIZATION_API_URL=http://127.0.0.1:8789
```

## R2 Layout

Both Workers use the `TYPE_STUDY_DOCUMENTS` R2 binding.

```txt
documents/{documentId}/source/original.txt
documents/{documentId}/source/original.pdf
documents/{documentId}/processed.json
documents/{documentId}/normalizations/{normalizationHash}.json
```

Normalization caching is not implemented yet, so `normalizations/{normalizationHash}.json` is reserved for later.

## Current Frontend Flow

1. Open the import page.
2. Paste/type text or choose a `.txt` or text-based `.pdf` file.
3. Click `process/import`.
4. Pick normalization options.
5. Wait for the preview to populate from `backend/normalization`.
6. Click `start typing`.

Uploads are limited to 10 MiB by `backend/process_input/src/types.ts`.
