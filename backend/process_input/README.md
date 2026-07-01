# backend/process_input

Local Node-style TypeScript service for turning pasted text or `.txt` content into canonical processed JSON.

This module does not apply typing normalization options. Lowercasing, punctuation handling, faded punctuation, and number-to-word conversion belong in `backend/normalization`.

## Install

```powershell
npm install
```

## Run Locally

```powershell
npm run dev
```

The service listens on `http://127.0.0.1:8788` by default. Override with `PORT` if needed.

## Endpoints

```txt
GET  /health
POST /process/text
POST /process/txt
```

## Example: Health

```powershell
curl.exe http://127.0.0.1:8788/health
```

## Example: Pasted Text

```powershell
$body = ConvertTo-Json -InputObject @{
  title = "Paste Test"
  text = "First paragraph.`n`nSecond paragraph."
} -Compress

Invoke-WebRequest -UseBasicParsing `
  -Method Post `
  -Uri "http://127.0.0.1:8788/process/text" `
  -ContentType "application/json" `
  -Body $body
```

## Example: TXT Content

```powershell
$body = ConvertTo-Json -InputObject @{
  fileName = "example.txt"
  mimeType = "text/plain"
  text = "Chapter 1`n`nThe text starts here."
} -Compress

Invoke-WebRequest -UseBasicParsing `
  -Method Post `
  -Uri "http://127.0.0.1:8788/process/txt" `
  -ContentType "application/json" `
  -Body $body
```

The same API works with `curl` in shells where JSON quoting is not rewritten:

```bash
curl -X POST http://127.0.0.1:8788/process/text \
  -H "content-type: application/json" \
  --data-raw '{"title":"Paste Test","text":"First paragraph.\n\nSecond paragraph."}'
```

## Output Shape

```ts
type ProcessedInputDocument = {
  id: string;
  version: "process_input.v1";
  title: string;
  sourceType: "paste" | "txt";
  source: {
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    sha256?: string;
  };
  originalText: string;
  canonicalText: string;
  blocks: ProcessedTextBlock[];
  metadata: {
    characterCount: number;
    wordCount: number;
    paragraphCount: number;
    createdAt: string;
  };
};
```

## Processing Scope

The service preserves the original text, creates a canonical text version with basic ingestion cleanup, splits paragraph-like blocks, and returns metadata. It intentionally does not store files or documents yet.

`src/storage.ts` is a no-op boundary for future R2 persistence.
