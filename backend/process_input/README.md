# backend/process_input

Local Node-style TypeScript service for turning pasted text, `.txt` content, or text-based PDF files into canonical processed JSON.

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
POST /process/pdf
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

## Example: PDF Content

PDF input uses JSON with base64 content for local development. Multipart upload can be added later.

```powershell
$pdfBytes = [IO.File]::ReadAllBytes("fixtures/sample-text.pdf")
$body = ConvertTo-Json -InputObject @{
  title = "PDF Test"
  fileName = "sample-text.pdf"
  mimeType = "application/pdf"
  dataBase64 = [Convert]::ToBase64String($pdfBytes)
} -Compress

Invoke-WebRequest -UseBasicParsing `
  -Method Post `
  -Uri "http://127.0.0.1:8788/process/pdf" `
  -ContentType "application/json" `
  -Body $body
```

## Output Shape

```ts
type ProcessedInputDocument = {
  id: string;
  version: "process_input.v1";
  title: string;
  sourceType: "paste" | "txt" | "pdf";
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
    pageCount?: number;
    createdAt: string;
  };
};
```

## Processing Scope

The service preserves the original text for pasted text and `.txt` input. For PDFs, `originalText` is the raw extracted text, while `canonicalText` is produced after basic PDF extraction cleanup plus the shared ingestion cleanup.

PDF cleanup is intentionally simple: repeated whitespace, repeated blank lines, common hyphenated line breaks, and awkward wrapped lines are cleaned. It does not reconstruct textbook layout.

## Known PDF Limitations

- Text-based PDFs are supported.
- Scanned/image-only PDFs are not supported because this step does not add OCR.
- Complex layouts, tables, sidebars, footnotes, and multi-column text may extract in imperfect order.
- Original PDF storage is not implemented yet.

`src/storage.ts` is a no-op boundary for future R2 persistence.
