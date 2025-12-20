# Excel CSV AI Extractor – MVP

This document describes the **product and technical specification** for an MVP web app that helps users extract structured information from CSV (Excel-exported) data using AI.

The README is intended to be **fed directly into another AI or development agent**.

---

## 1. Product Overview

### Purpose
Build an SEO-friendly web app that allows users to upload a CSV file (or paste rows) and extract specific information from a selected column using predefined AI prompts.

### Primary Goals
- Capture long-tail Excel-related search traffic
- Validate real user demand
- Ship a working MVP as fast as possible

### Out of Scope (MVP)
- User accounts / authentication
- Payments
- File history
- XLSX support (CSV only)
- Non-English language support

---

## 2. Tech Stack

### Frontend
- Next.js (App Router)
- React
- Client-side CSV parsing (PapaParse)
- Tailwind CSS or minimal CSS

### Backend
- Cloudflare Workers
- Cloudflare Workers AI (free tier)
- REST API (no GraphQL)

### Hosting
- Frontend: Vercel or Cloudflare Pages
- Backend: Cloudflare Workers

---

## 3. App Structure (SEO-First)

### Routes

```
/
/extract-state-from-address-excel
/extract-city-from-address-excel
/extract-numbers-from-text-excel
/extract-text-from-cell-excel
/custom-extract-excel
```

Each route must be:
- Indexable by search engines
- Self-contained
- Mapped to a single extraction intent

---

## 4. Home Page (`/`)

### Purpose
- Entry point
- Route users to predefined SEO pages
- Allow custom extraction use case

### SEO Requirements
- `<title>`: AI Excel Data Extractor – Extract Data from CSV Instantly
- `<meta description>` explaining CSV → column extraction
- H1 describing the tool
- Short explanation paragraph (100–150 words)

### UI Components
- Section: **Choose a Use Case**
  - 4 cards linking to predefined routes:
    1. Extract State from Address
    2. Extract City from Address
    3. Extract Numbers from Text
    4. Extract Text from Cell
- Section: **Custom Extraction**
  - Button linking to `/custom-extract-excel`

---

## 5. Predefined Use Case Pages

Example route:
```
/extract-state-from-address-excel
```

### SEO Requirements
- Static route
- Unique metadata per page
- Crawlable without JS execution

#### Example Metadata
```
Title: Extract State from Address in Excel (CSV Upload Tool)
Description: Upload a CSV file and automatically extract US states from address columns using AI.
```

### Page Layout
1. H1: Extract State from Address in Excel
2. Short explanation of the problem
3. Tool UI (shared component)
4. FAQ section (2–3 questions)
5. Limits and privacy note

---

## 6. Tool UI (Shared Component)

### Input Methods
User chooses ONE:
- Upload CSV file
- Paste up to 10 rows (newline-separated)

### CSV Upload Rules
- Max file size: 2 MB
- CSV only
- Max rows processed: 1,000
- Max columns: 20

### Column Selection
- Parse CSV client-side
- Allow user to select the source column
- Preview first 10 rows

---

## 7. Preview Mode (Critical)

### Behavior
- Process only the first 10 rows
- Display a preview table:
  - Original value
  - Extracted value

### UI Text
> Preview only. Download will process up to 1,000 rows.

---

## 8. Prompt System

### Predefined Prompts (Per Page)

Each predefined page uses a **fixed prompt template**.

Example (Extract State from Address):
```
From the following address text, extract the US state as a two-letter abbreviation.
If no state is found, return null.
```

### Prompt Placeholder Model (Custom Page)
```
extract {TARGET} from {SOURCE}
```

User inputs:
- TARGET (required)
- SOURCE (required)

The app converts this into:
```
From the following {SOURCE} text, extract {TARGET}.
If not found, return null.
```

### Prompt Editing Rules
- Users cannot modify the system prompt
- Users cannot add free-form instructions
- Only placeholders are editable

---

## 9. Backend API

### Endpoint
```
POST /api/process
```

### Request Payload
```json
{
  "rows": ["string", "string"],
  "promptType": "predefined | custom",
  "promptTemplate": "string"
}
```

### Response Payload
```json
{
  "results": [
    { "input": "original text", "output": "extracted value or null" }
  ]
}
```

### LLM Rules
- Use Cloudflare Workers AI (e.g. Llama 3 8B)
- Enforce JSON-only responses
- Retry once on invalid JSON
- Process rows in small batches (5–10)

---

## 10. Large File Handling (MVP)

- Frontend slices rows to hard limits
- Backend processes sequentially
- No streaming
- No background jobs

---

## 11. Custom Extraction Page (`/custom-extract-excel`)

### Purpose
- Capture long-tail extraction intent not covered by predefined pages
- Validate demand for new use cases

### SEO
- Indexable
- Generic title and description

### UI
- Two text inputs:
  - Extract ___
  - From ___
- Same CSV upload and paste workflow
- Same preview table

---

## 12. Privacy & Trust

Visible text on all tool pages:
- Files are processed in memory and auto-deleted
- We do not store or train on your data
- Preview mode processes sample rows only

---

## 13. Performance & Limits

### Hard Limits (MVP)
- Max 1 request per second per IP
- Max 1,000 rows per job
- Preview limited to 10 rows

---

## 14. Explicitly Not Building (MVP)

- Authentication
- File storage
- User dashboards
- XLSX parsing
- Payments
- Advanced analytics

---

## 15. MVP Success Criteria

- Pages indexed by Google
- Google Search Console shows impressions within 2–4 weeks
- Users upload CSV files
- Preview functionality is used
- App remains stable under light traffic

---

## 16. Post-MVP Expansion (Not Implemented)

- XLSX support
- Google Sheets integration
- Saved prompts
- Paid tier
- Background batch processing

---

**End of README**

