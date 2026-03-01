# Roadmap: ocr-leet

## Overview

From zero to a working PWA on the Boox tablet: image capture via Web Share Target, in-browser dot-grid processing and verbatim OCR, LeetCode submission via Cloudflare Worker, and a clean result display — all at $0 cost and with no Mac dependency.

## Current Milestone

**v0.1 Initial Release** (v0.1.0)
Status: In progress
Phases: 2 of 7 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Project scaffold & hosting | 1 | ✅ Complete | 2026-03-01 |
| 2 | Image capture & Web Share Target | 0 | ✅ Complete (absorbed into Phase 1) | 2026-03-01 |
| 3 | Dot-grid detection & indentation mapping | TBD | Not started | - |
| 4 | Verbatim OCR & code assembly | TBD | Not started | - |
| 5 | Review UI | TBD | Not started | - |
| 6 | Cloudflare Worker & LeetCode submission | TBD | Not started | - |
| 7 | Result display & session management | TBD | Not started | - |

## Phase Details

Phases will be fully detailed during `/paul:plan`.

### Phase 1: Project scaffold & hosting ✅
**Goal:** Deployable PWA skeleton on GitHub Pages with HTTPS, service worker, and Web Share Target manifest registered
**Completed:** 2026-03-01 — 1 plan, Boox checkpoint verified
**Note:** Also delivered Phase 2 scope (share sheet + image display) within same plan

### Phase 2: Image capture & Web Share Target ✅
**Goal:** App appears in Boox share sheet; receives PNG from Boox Notes and displays it
**Completed:** 2026-03-01 — Absorbed into Phase 1 (Boox checkpoint confirmed both goals)

### Phase 3: Dot-grid detection & indentation mapping
**Goal:** OpenCV.js reliably detects the dot-grid in a Boox Notes export image and maps pixel positions to indentation levels
**Depends on:** Phase 2 (image available in app)
**Research:** Likely (OpenCV.js WASM in browser — needs calibration against real Boox exports)
**Research topics:** OpenCV.js blob/grid detection performance on tablet hardware; dot spacing in Boox dot-grid template

### Phase 4: Verbatim OCR & code assembly
**Goal:** Tesseract.js reads all handwritten text; line positions are mapped to indentation via Phase 3 coordinate system; valid Python 3 structure is assembled verbatim
**Depends on:** Phase 3 (dot-grid coordinate system)
**Research:** Likely (Tesseract.js handwriting accuracy for code characters; special char handling)
**Research topics:** Tesseract.js language models for handwriting; known failure characters (`:`, `_`, `!=`, `**`)

### Phase 5: Review UI
**Goal:** Side-by-side display of original image and OCR'd code; problem number prominently shown; Submit / Discard actions only — no editing
**Depends on:** Phase 4 (parsed code available)
**Research:** Unlikely (UI layout, no novel technology)

### Phase 6: Cloudflare Worker & LeetCode submission
**Goal:** Worker deployed on workers.dev proxies LeetCode GraphQL submission; PWA sends code + problem slug; Worker polls for result and returns it
**Depends on:** Phase 5 (submission triggered from UI)
**Research:** Likely (LeetCode unofficial GraphQL API — submission flow, polling mechanism, auth)
**Research topics:** LeetCode GraphQL submission mutation; result polling; LEETCODE_SESSION cookie lifetime

### Phase 7: Result display & session management
**Goal:** Pass/fail, runtime %, memory %, failing test cases displayed in browser; LeetCode session cookie entry/update flow in settings screen
**Depends on:** Phase 6 (result payload available)
**Research:** Unlikely (display logic, localStorage for session)

---
*Roadmap created: 2026-03-01*
*Last updated: 2026-03-01 — Phase 1 complete, Phase 2 absorbed*
