# ocr-leet

## What This Is

A PWA that receives a photo of handwritten code from a Boox e-ink tablet, uses in-browser OCR and dot-grid image processing to extract the problem number and reconstruct the Python 3 solution verbatim — no interpretation, correction, or completion — then submits it as-is to LeetCode via a Cloudflare Worker proxy and displays the result.

## Core Value

A developer can practice DSA problems by writing solutions by hand and get immediate feedback without touching a keyboard, allowing learning-by-writing instead of intuitive rote-learning while typing from kicking in and hindering learning.

## Current State

| Attribute | Value |
|-----------|-------|
| Version | 0.1.0-dev |
| Status | Prototype |
| Last Updated | 2026-03-01 |

## Requirements

### Validated (Shipped)
- [x] Receive image via Web Share Target (from Boox Notes share sheet) — Phase 1
- [x] PWA deployed on GitHub Pages with HTTPS, service worker, installable — Phase 1

### Active (In Progress)
- None yet

### Planned (Next)
- [ ] Detect dot-grid in image to establish spatial coordinate system
- [ ] Detect circled problem number via contour detection
- [ ] OCR handwritten text verbatim via Tesseract.js
- [ ] Map OCR'd line positions to indentation levels using dot-grid coordinates
- [ ] Display side-by-side: original image + parsed code + problem number
- [ ] Submit parsed code to LeetCode via Cloudflare Worker proxy
- [ ] Display pass/fail result with runtime %, memory %, failing test cases

### Out of Scope
- Auto-correction or interpretation of OCR'd code — what is written is what is submitted
- AI-assisted code reconstruction or intent inference
- Native Android APK
- iOS / iPad support (deferred — no Apple Pencil yet)
- Multiple programming languages (Python 3 only)
- Local test case execution (submit directly to LeetCode)

## Target Users

**Primary:** The project owner — a single developer preparing for FAANG DSA interview rounds
- Uses a Boox Go 10.3 e-ink tablet as the writing surface
- Wants to retain solutions through writing, not typing
- Accepts mistakes as part of the learning process — no guardrails

## Context

**Technical Context:**
- Boox Go 10.3 runs Android; the PWA runs in its browser
- Web Share Target API used for image handoff from Boox Notes
- LeetCode has no official API; the GraphQL endpoint is used with a session cookie
- All OCR and image processing runs in-browser (WebAssembly) — no backend compute
- Cloudflare Worker exists solely to resolve CORS on LeetCode API calls

## Constraints

### Technical Constraints
- Must run entirely in the Boox browser with no Mac dependency
- OCR must be verbatim — no model inference or code correction permitted
- Indentation must be derived geometrically from dot-grid, not inferred
- Cloudflare Worker free tier only (100k req/day limit is not a concern)
- No paid APIs or subscriptions

### Business Constraints
- Total cost must be $0
- Must work when travelling (no local network / Mac required)

## Key Decisions

| Decision | Rationale | Date | Status |
|----------|-----------|------|--------|
| PWA over native Android APK | Lower dev complexity; same PWA works on iPad later | 2026-03-01 | Active |
| Tesseract.js over ML Kit | Avoids APK; runs in browser via WASM | 2026-03-01 | Active |
| Cloudflare Worker as CORS proxy | Free, serverless, zero maintenance, no domain needed | 2026-03-01 | Active |
| Dot-grid for indentation | Deterministic geometric mapping; no inference | 2026-03-01 | Active |
| No code correction of any kind | Preserves learning value of making and owning mistakes | 2026-03-01 | Active |
| Show OCR result before submission | Lets user detect OCR failures (not their own errors) before firing | 2026-03-01 | Active |
| LeetCode session cookie in localStorage | User-controlled; re-entered when expired; never stored server-side | 2026-03-01 | Active |
| SW uses self.registration.scope as BASE URL | Path-agnostic — works at any GitHub Pages subdirectory without hardcoding | 2026-03-01 | Active |
| Navigation requests served from cached BASE (ignore query params) | ?shared=1 must serve index.html from cache, not 404 | 2026-03-01 | Active |

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Indentation accuracy | Correct Python indentation on dot-grid-written code | - | Not started |
| OCR character accuracy | Legible handwriting produces runnable code | - | Not started |
| End-to-end flow | Write → share → review → submit → result in < 60s | - | Not started |

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | PWA — HTML + vanilla JS | Served from GitHub Pages or Cloudflare Pages |
| OCR | Tesseract.js | WebAssembly, runs in-browser, no API cost |
| Image processing | OpenCV.js | WebAssembly, dot-grid detection + circle detection |
| CORS proxy | Cloudflare Worker (JS) | workers.dev subdomain, free tier |
| LeetCode API | GraphQL (unofficial) | Session cookie auth |
| Hosting | GitHub Pages / Cloudflare Pages | Free, HTTPS included |

---
*PROJECT.md — Updated when requirements or context change*
*Last updated: 2026-03-01 after Phase 1*
