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
  // DEBUG: remove before Phase 4
  document.getElementById('btn-test-grid').addEventListener('click', handleTestGrid);
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

// DEBUG: remove before Phase 4
async function handleTestGrid() {
  const out = document.getElementById('debug-grid-output');
  out.textContent = 'Running…';
  const img = document.getElementById('shared-image');
  try {
    const grid = await detectDotGrid(img);
    if (!grid) {
      out.textContent = 'FAIL: grid is null (too few dots detected)';
      return;
    }
    out.textContent = [
      'xPitch: ' + grid.xPitch,
      'yPitch: ' + grid.yPitch,
      'dotCount: ' + grid.dotCount,
      'xOrigin: ' + grid.xOrigin.toFixed(1),
      'yOrigin: ' + grid.yOrigin.toFixed(1),
      'indentAt(origin): "' + grid.indentationAt(grid.xOrigin) + '"',
      'indentAt(origin+4col): "' + grid.indentationAt(grid.xOrigin + grid.xPitch * 4) + '"',
    ].join('\n');
  } catch (err) {
    out.textContent = 'ERROR: ' + err.message;
  }
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
