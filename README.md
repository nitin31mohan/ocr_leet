# ocr_leet

> **Status: Dropped.** This is a documented exploration, not a working product. The failure mode is interesting and worth reading.

---

## What I was trying to build

I practice DSA problems by writing solutions by hand on a Boox Go 10.3 e-ink tablet. The feedback loop was broken: I'd write a solution, then have to type it out to submit to LeetCode — defeating the point of writing by hand in the first place. The goal was to close that loop: share a photo from Boox Notes, get verbatim OCR'd code, submit, and see the result — without touching a keyboard.

Key constraint: **verbatim OCR only, no correction.** If I wrote something wrong, that's what gets submitted. The learning value is in owning mistakes, not in having tooling paper over them.

---

## Architecture decisions

### PWA first

The initial approach was a PWA hosted on GitHub Pages. Rationale:
- No platform lock-in, no build toolchain, reusable on iPad later
- Web Share Target API handles the image handoff from Boox Notes natively
- All processing in-browser via WebAssembly (zero server cost)

This shipped Phases 1–3 cleanly: scaffold with Service Worker, Web Share Target, and a dot-grid detection pipeline using OpenCV.js that maps pixel x-positions to Python indentation levels geometrically. The dot-grid detection was precise enough — it found ~585 dots in each Boox Notes export, computed xPitch/yPitch reliably, and produced correct indentation mappings.

Phase 4 (OCR) is where it fell apart.

### OCR attempt 1: Tesseract.js

Tesseract.js v5 with PSM_SINGLE_BLOCK, 2× upscaling, dot-masking (painting white circles over detected dot centroids to eliminate grid noise), and binarization. Results on actual handwriting:

```
"return"     → "nelom"
"for"        → "Jar"
"hashset"    → "hast set"
```

This isn't a tuning problem. Tesseract's English model is trained on printed text. Handwriting OCR is a fundamentally different task and Tesseract does not support it. No amount of preprocessing fixes a model that wasn't trained for this.

### OCR attempt 2: Google Vision API

Google Cloud Vision's `DOCUMENT_TEXT_DETECTION` is explicitly trained for handwriting and is the obvious next candidate. The architecture would have been: PWA POSTs the image to a Cloudflare Worker, Worker calls Vision API, returns structured lines with bounding boxes.

I rejected this.

The PWA is a public GitHub repo. The Cloudflare Worker URL is in the client-side JS. Any API key or shared secret embedded in the source is not actually a secret — it's publicly readable by anyone who clones the repo. "Restrict the key to Vision API only" and "set quota caps" are workarounds, not security. The threat model isn't sophisticated attackers; it's anyone who finds the repo and runs the code as-is. That's a reasonable threat for a public repo.

The correct solution would be to not have a publicly accessible server endpoint at all. Which pointed to native Android.

### Pivot to native Android

Native Android eliminates both problems at once:
- ML Kit Text Recognition v2 runs entirely on-device — no API keys, no server, no security surface
- Direct HTTPS to LeetCode's GraphQL endpoint — no CORS, no Cloudflare Worker needed

The dot-grid detection algorithm (not the JS code — the algorithm) is portable: `inRange [130, 253]` threshold for isolating the light-gray dots, contour area `[3, 600]`, circularity `> 0.4`, pitch computation via histogram binning. Phases 1–2 of the Android rewrite shipped cleanly: Kotlin/Gradle scaffold verified on-device, Share Intent receiver handling image URIs with in-memory-only bitmap loading (no disk copy — no storage accumulation on the tablet).

### OCR attempt 3: ML Kit bundled model

ML Kit's bundled text-recognition is better than Tesseract. It gets words. It does not get code.

The output on the same handwritten page:

```
"containsDuplicate"    → "contains Duplicate"   (split)
":"                    → absent
"->"                   → absent
"List[int]"            → garbled
```

Code OCR requires near-perfect character accuracy. A missing colon is a syntax error. A split identifier is a NameError. The gap between "mostly readable natural language" and "syntactically valid Python" is not a gap that post-processing can bridge when the underlying recognition is already lossy.

---

## Why I dropped it

I could have called Google Vision API directly from the Android app — the API key would live in the app's private SharedPreferences, never in source code, never on a server. That's a legitimate security posture.

I didn't, for two reasons:

1. **The economics of the dependency.** Vision API is free up to 1,000 requests/month on the free tier. That's a real constraint on something I'd use daily. Every submission becomes a conscious resource decision. That's friction that doesn't exist with on-device processing.

2. **The principle of the thing.** The whole point was a simple, self-contained tool. Adding a cloud API call, a Google Cloud project, an API key to manage, and a monthly quota to watch is the wrong direction for what should be a personal productivity script.

The real answer is that reliable handwriting OCR for code doesn't exist as a free, on-device capability today. The models that can do it (Google Vision, GPT-4V, Claude) all require cloud calls. That's not a solvable problem within my constraints.

---

## What I'd do differently

Nothing, really. The sequencing was correct: validate the hard constraint (OCR accuracy) as early as possible, with the cheapest possible implementation. I spent effort on the dot-grid detection pipeline and the Android infrastructure, but those were reasonable bets — the OCR was the unknown risk, and I kept it isolated until I could test it directly. That's the right way to explore something with a binary viability condition.

If the OCR landscape changes — better on-device models, or a personal API key with acceptable economics — the rest of the architecture is sound and the implementation work is documented here.

---

## Technical artefacts

- **PWA (archived in git history):** Service Worker with cache-first strategy, Web Share Target, OpenCV.js dot-grid detection pipeline
- **Android app:** Kotlin, Gradle 8.9, AGP 8.7.3, Share Intent receiver, ML Kit bundled OCR
- **Dot-grid algorithm:** `inRange [130, 253]`, area filter `[3, 600]`, circularity `> 0.4`, dominant pitch via histogram binning over inter-dot distances
