# backend/process_input

Cloudflare Worker-ready TypeScript service for ingesting pasted text, `.txt` content, and text-based PDFs into canonical processed document JSON.

This service does not apply typing normalization. It stores the original source object and `processed.json`; `backend/normalization` loads that JSON later and builds the typing target.

## Upload Limit

Uploads are limited to 10 MiB by `MAX_UPLOAD_BYTES` in `src/types.ts`.

## Install

```powershell
npm install
```

## Run Locally

Node smoke-test server, in-memory storage only:

```powershell
npm run dev
```

Worker/R2 MVP path:

```powershell
npm run dev:worker
```

The Worker listens on `http://127.0.0.1:8788` by default. The script persists local Wrangler storage to `../../.wrangler/state` so `backend/normalization` can read the same local R2 objects.

## R2 Binding

`wrangler.toml` expects this binding:

```txt
TYPE_STUDY_DOCUMENTS
```

Object layout:

```txt
documents/{documentId}/source/original.txt
documents/{documentId}/source/original.pdf
documents/{documentId}/processed.json
```

Create the production bucket before deploy:

```powershell
npx wrangler r2 bucket create type-study-documents
```

## Endpoints

```txt
GET  /api/health
POST /api/process/text
POST /api/process/txt
POST /api/process/pdf
GET  /api/documents/:documentId
GET  /api/documents/:documentId/processed
```

Legacy Node smoke-test endpoints still exist:

```txt
GET  /health
POST /process/text
POST /process/txt
POST /process/pdf
```

## Example: Process Pasted Text

```powershell
$body = ConvertTo-Json -InputObject @{
  title = "Paste Test"
  text = "First paragraph.`n`nSecond paragraph."
} -Compress

Invoke-WebRequest -UseBasicParsing `
  -Method Post `
  -Uri "http://127.0.0.1:8788/api/process/text" `
  -ContentType "application/json" `
  -Body $body
```

Response shape:

```json
{
  "documentId": "doc_paste_...",
  "status": "processed",
  "title": "Paste Test",
  "sourceType": "paste",
  "metadata": {
    "characterCount": 35,
    "wordCount": 4,
    "paragraphCount": 2,
    "createdAt": "..."
  },
  "storage": {
    "originalKey": "documents/doc_paste_.../source/original.txt",
    "processedKey": "documents/doc_paste_.../processed.json"
  }
}
```

## Example: Process TXT

```powershell
$body = ConvertTo-Json -InputObject @{
  fileName = "example.txt"
  mimeType = "text/plain"
  text = "Chapter 1`n`nThe text starts here."
} -Compress

Invoke-WebRequest -UseBasicParsing `
  -Method Post `
  -Uri "http://127.0.0.1:8788/api/process/txt" `
  -ContentType "application/json" `
  -Body $body
```

## Example: Process PDF

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
  -Uri "http://127.0.0.1:8788/api/process/pdf" `
  -ContentType "application/json" `
  -Body $body
```

## Fetch Processed JSON

```powershell
Invoke-WebRequest -UseBasicParsing `
  -Uri "http://127.0.0.1:8788/api/documents/{documentId}/processed"
```

## Known PDF Limitations

- Text-based PDFs are supported.
- Scanned/image-only PDFs are not supported because OCR is out of scope.
- Complex layouts, tables, sidebars, footnotes, and multi-column text may extract imperfectly.
