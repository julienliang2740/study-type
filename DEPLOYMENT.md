# Deployment

This guide takes `type-study-app` from local development to a deployed Cloudflare MVP:

- Frontend: Cloudflare Pages, deployed from GitHub.
- Backends: two Cloudflare Workers.
- Storage: one Cloudflare R2 bucket shared by both Workers.

Official references:

- Cloudflare Pages Git/Vite deployment: https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/
- Wrangler deploy commands: https://developers.cloudflare.com/workers/wrangler/commands/
- R2 bucket creation: https://developers.cloudflare.com/r2/buckets/create-buckets/
- Wrangler R2 bucket bindings: https://developers.cloudflare.com/workers/wrangler/configuration/#r2-buckets

## Current Project Shape

```txt
type-study-app/
  frontend/                         React + Vite frontend source
  dist/                             production build output
  backend/
    process_input/                  Worker for paste/TXT/PDF ingestion
      wrangler.toml
    normalization/                  Worker for typing-target normalization
      wrangler.toml
```

The frontend calls:

```txt
VITE_PROCESS_INPUT_API_URL
VITE_NORMALIZATION_API_URL
```

The Workers share this R2 binding:

```txt
TYPE_STUDY_DOCUMENTS
```

The production bucket name currently configured in both Worker `wrangler.toml` files is:

```txt
type-study-documents
```

## Deployment Order

1. Push the repo to GitHub.
2. Create the R2 bucket in Cloudflare.
3. Deploy `backend/process_input`.
4. Deploy `backend/normalization`.
5. Add the Worker URLs to the Cloudflare Pages environment variables.
6. Deploy the frontend with Cloudflare Pages from GitHub.
7. Smoke-test the deployed flow.

## Prerequisites

- A Cloudflare account.
- A GitHub repository containing this project.
- Node.js installed locally.
- Access to run Wrangler against your Cloudflare account.

Install dependencies before deploying:

```powershell
cd type-study-app
npm install

cd backend/process_input
npm install

cd ../normalization
npm install
```

Authenticate Wrangler:

```powershell
npx wrangler login
```

## R2 Setup

### Dashboard Setup

1. Open the Cloudflare dashboard.
2. Go to `R2 Object Storage`.
3. Select `Create bucket`.
4. Name the bucket:

```txt
type-study-documents
```

5. Keep the bucket private. The app accesses it only through Workers.

### CLI Alternative

From either Worker package folder:

```powershell
npx wrangler r2 bucket create type-study-documents
```

### R2 Object Layout

The app writes objects under:

```txt
documents/{documentId}/source/original.txt
documents/{documentId}/source/original.pdf
documents/{documentId}/processed.json
documents/{documentId}/normalizations/{normalizationHash}.json
```

Normalization caching is not implemented yet, so `normalizations/{normalizationHash}.json` is reserved.

### Upload Limit

The backend upload limit is controlled here:

```txt
backend/process_input/src/types.ts
```

Change this constant if needed:

```ts
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
```

## Worker Deployment

There are two Workers:

```txt
type-study-process-input
type-study-normalization
```

Both use the same R2 binding:

```toml
[[r2_buckets]]
binding = "TYPE_STUDY_DOCUMENTS"
bucket_name = "type-study-documents"
preview_bucket_name = "type-study-documents-dev"
```

The `preview_bucket_name` is for local Wrangler preview/dev behavior. Production deploys use `bucket_name`.

### Deploy `process_input`

```powershell
cd type-study-app/backend/process_input
npm run typecheck
npm run build
npm run deploy
```

Expected Worker:

```txt
type-study-process-input
```

Expected routes:

```txt
GET  /api/health
POST /api/process/text
POST /api/process/txt
POST /api/process/pdf
GET  /api/documents/:documentId
GET  /api/documents/:documentId/processed
```

Record the deployed URL. It will usually look like:

```txt
https://type-study-process-input.<your-workers-subdomain>.workers.dev
```

### Deploy `normalization`

```powershell
cd type-study-app/backend/normalization
npm run typecheck
npm run build
npm run deploy
```

Expected Worker:

```txt
type-study-normalization
```

Expected routes:

```txt
GET  /api/health
POST /api/normalize
```

Record the deployed URL. It will usually look like:

```txt
https://type-study-normalization.<your-workers-subdomain>.workers.dev
```

### Dashboard Checks For Workers

In the Cloudflare dashboard:

1. Go to `Workers & Pages`.
2. Open `type-study-process-input`.
3. Confirm the R2 binding exists:

```txt
TYPE_STUDY_DOCUMENTS -> type-study-documents
```

4. Open `type-study-normalization`.
5. Confirm the same R2 binding exists.
6. Confirm each Worker has a public route:
   - `workers.dev` enabled, or
   - a custom domain/route configured.

If you use custom domains, use those custom URLs for the frontend environment variables.

## Frontend Deployment On Cloudflare Pages

### GitHub Setup

1. Push the current project to GitHub.
2. In the Cloudflare dashboard, go to `Workers & Pages`.
3. Select `Create application`.
4. Select `Pages`.
5. Select `Connect to Git`.
6. Choose the GitHub repository.

### Build Settings

If the GitHub repository root is `type-study-app`, use:

```txt
Build command: npm run build
Build output directory: dist
Root directory: /
```

If the GitHub repository root is the parent folder that contains `type-study-app`, use:

```txt
Build command: npm run build
Build output directory: dist
Root directory: type-study-app
```

The Vite config builds from `frontend/` and writes output to:

```txt
type-study-app/dist
```

### Pages Environment Variables

Before the first production deploy, add these Cloudflare Pages environment variables:

```txt
VITE_PROCESS_INPUT_API_URL=https://type-study-process-input.<your-workers-subdomain>.workers.dev
VITE_NORMALIZATION_API_URL=https://type-study-normalization.<your-workers-subdomain>.workers.dev
```

Set them for:

- Production.
- Preview, if you want preview deployments to call deployed Workers.

Then select `Save and Deploy`.

Cloudflare Pages will rebuild on future pushed commits to the configured branch.

## Deployed Smoke Tests

Replace the URLs below with your actual deployed Worker URLs.

### Health

```powershell
$processInput = "https://type-study-process-input.<your-workers-subdomain>.workers.dev"
$normalization = "https://type-study-normalization.<your-workers-subdomain>.workers.dev"

Invoke-WebRequest -UseBasicParsing "$processInput/api/health"
Invoke-WebRequest -UseBasicParsing "$normalization/api/health"
```

### Process Text

```powershell
$body = ConvertTo-Json -InputObject @{
  title = "Deploy Test"
  text = "The empire, however, expanded in 476."
} -Compress

$processed = Invoke-RestMethod `
  -Method Post `
  -Uri "$processInput/api/process/text" `
  -ContentType "application/json" `
  -Body $body

$processed
```

Expected shape:

```json
{
  "documentId": "doc_paste_...",
  "status": "processed",
  "title": "Deploy Test",
  "sourceType": "paste",
  "metadata": {},
  "storage": {
    "originalKey": "documents/doc_paste_.../source/original.txt",
    "processedKey": "documents/doc_paste_.../processed.json"
  }
}
```

### Fetch Processed JSON

```powershell
Invoke-RestMethod "$processInput/api/documents/$($processed.documentId)/processed"
```

### Normalize The Stored Document

```powershell
$normalizeBody = ConvertTo-Json -InputObject @{
  documentId = $processed.documentId
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

Invoke-RestMethod `
  -Method Post `
  -Uri "$normalization/api/normalize" `
  -ContentType "application/json" `
  -Body $normalizeBody
```

Expected important fields:

```json
{
  "documentId": "doc_paste_...",
  "displayText": "the empire, however, expanded in 476.",
  "inputText": "the empire however expanded in four hundred seventy six",
  "characterMap": []
}
```

### Frontend Flow

1. Open the Cloudflare Pages URL.
2. Go to `import`.
3. Paste text or upload a `.txt` or text-based `.pdf`.
4. Click `process/import`.
5. Confirm the processed document id appears.
6. Confirm the preview populates.
7. Click `start typing`.

## Custom Domains

Recommended production shape:

```txt
https://type-study.example.com
https://process-input.example.com
https://normalization.example.com
```

Dashboard setup:

1. For Pages, open the Pages project.
2. Go to `Custom domains`.
3. Add the frontend domain.
4. For each Worker, open the Worker.
5. Go to `Settings` or `Triggers`.
6. Add a custom domain or route.
7. Update Pages environment variables to use the custom Worker URLs.
8. Redeploy Pages so the Vite build embeds the updated API URLs.

## CORS

The Workers currently return permissive CORS headers:

```txt
access-control-allow-origin: *
```

That is acceptable for early MVP testing. Before production with real user documents, restrict this to the deployed Pages domain.

## Production Checklist

- R2 bucket `type-study-documents` exists.
- `type-study-process-input` deployed.
- `type-study-normalization` deployed.
- Both Workers have `TYPE_STUDY_DOCUMENTS` bound to `type-study-documents`.
- Both Worker health endpoints return `200`.
- Cloudflare Pages environment variables point to deployed Worker URLs.
- Pages build command is `npm run build`.
- Pages output directory is `dist`.
- Pages deploy completes successfully.
- Paste text processing works.
- TXT upload processing works.
- Text-based PDF processing works.
- Normalization returns `displayText`, `inputText`, and `characterMap`.
- Typing UI starts from the normalized payload.

## Known Deployment Gaps

- No auth yet.
- No database yet.
- No OCR for scanned PDFs.
- PDF upload is currently JSON/base64, not multipart.
- R2 objects are private and only accessible through Workers.
- Normalization caching is reserved but not implemented.
