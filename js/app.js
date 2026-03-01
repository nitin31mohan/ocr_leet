// app.js — main application entry point.
// Handles: shared image loading, UI state, and discard flow.
// OCR, dot-grid processing, and LeetCode submission added in later phases.

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);

  // Show loading indicator while OpenCV WASM initialises
  const cvLoading = document.getElementById('cv-loading');
  cvLoading.hidden = false;
  await window.opencvReady;
  cvLoading.hidden = true;

  if (params.get('shared') === '1') {
    await handleSharedImage();
    // Clean the query string without reloading
    window.history.replaceState({}, '', window.location.pathname);
  }

  document.getElementById('btn-discard').addEventListener('click', handleDiscard);
  document.getElementById('btn-submit').addEventListener('click', handleSubmit);
});

async function handleSharedImage() {
  const objectUrl = await getSharedImageUrl(); // defined in share-target.js
  if (!objectUrl) {
    console.warn('app: ?shared=1 set but no image in cache');
    return;
  }

  const img = document.getElementById('shared-image');
  img.src = objectUrl;

  showSection('image-preview');
  // OCR will be triggered here in Phase 4 — placeholder for now
}

function handleDiscard() {
  clearSharedImage();
  document.getElementById('shared-image').src = '';
  showSection('placeholder');
}

function handleSubmit() {
  // LeetCode submission wired up in Phase 6
  console.log('Submit — not yet implemented');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Show one section, hide all others.
 * Sections: 'placeholder', 'image-preview', 'ocr-result', 'result-panel'
 */
function showSection(id) {
  ['placeholder', 'image-preview', 'ocr-result', 'result-panel'].forEach(sectionId => {
    const el = document.getElementById(sectionId);
    if (el) el.hidden = (sectionId !== id);
  });
}
