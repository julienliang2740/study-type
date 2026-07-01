# backend/normalization

Cloudflare Worker-ready TypeScript service for creating typing targets from processed documents stored by `backend/process_input`.

The Worker loads `documents/{documentId}/processed.json` from R2, applies normalization options, and returns `displayText`, `inputText`, and `characterMap` for the typing UI.

## Install

```powershell
npm install
```

## Run Locally

```powershell
npm run dev
```

The Worker listens on `http://127.0.0.1:8789` by default. The dev script persists local Wrangler storage to `../../.wrangler/state`; use the same state path for `backend/process_input`.

## R2 Binding

`wrangler.toml` expects this binding:

```txt
TYPE_STUDY_DOCUMENTS
```

It reads processed documents from:

```txt
documents/{documentId}/processed.json
```

## Endpoints

```txt
GET  /api/health
POST /api/normalize
```

## Example

```powershell
$body = ConvertTo-Json -InputObject @{
  documentId = "doc_paste_..."
  options = @{
    lowercase = $true
    removePunctuationFromInput = $true
    showPunctuationFaintly = $true
    collapseLineBreaks = $true
    preserveParagraphBreaks = $false
    normalizeQuotesAndDashes = $true
    convertNumbersToWords = $true
  }
} -Compress

Invoke-WebRequest -UseBasicParsing `
  -Method Post `
  -Uri "http://127.0.0.1:8789/api/normalize" `
  -ContentType "application/json" `
  -Body $body
```

Response shape:

```json
{
  "documentId": "doc_paste_...",
  "originalText": "The empire, however, expanded in 476.",
  "displayText": "the empire, however, expanded in 476.",
  "inputText": "the empire however expanded in four hundred seventy six",
  "characterMap": [],
  "metadata": {
    "characterCount": 56,
    "wordCount": 9
  }
}
```
