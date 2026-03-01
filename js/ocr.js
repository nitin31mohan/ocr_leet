// ocr.js — Verbatim OCR via Tesseract.js v5
// Exposes: runOCR(maskedCanvas, dotGrid) → Promise<string>
//
// maskedCanvas must be the dot-masked canvas from detectDotGridAndMask(),
// in the same 615-space pixel coordinate system as the DotGrid.

// Upscale factor applied before Tesseract.
// Native images are ~75 DPI; 2× puts us at ~150 DPI, closer to Tesseract's
// optimal range. bbox.x0 is divided by this factor for indentation lookup.
const OCR_SCALE = 2;

let _worker = null;

async function _ensureWorker() {
  if (_worker) return _worker;
  _worker = await Tesseract.createWorker('eng');
  await _worker.setParameters({
    tessedit_pageseg_mode: '6',  // PSM_SINGLE_BLOCK
    user_defined_dpi: '150',     // honest DPI after 2× upscale
  });
  return _worker;
}

/**
 * Binarize a canvas in-place: pixels darker than threshold → black, rest → white.
 * Removes gray residue and sharpens ink edges for better Tesseract accuracy.
 */
function _binarize(canvas, threshold = 128) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = lum < threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
}

async function runOCR(maskedCanvas, dotGrid) {
  const worker = await _ensureWorker();

  // 1. Binarize: clean ink/background separation after dot masking
  const binaryCanvas = document.createElement('canvas');
  binaryCanvas.width = maskedCanvas.width;
  binaryCanvas.height = maskedCanvas.height;
  binaryCanvas.getContext('2d').drawImage(maskedCanvas, 0, 0);
  _binarize(binaryCanvas);

  // 2. Upscale: larger characters improve Tesseract accuracy
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = binaryCanvas.width * OCR_SCALE;
  scaledCanvas.height = binaryCanvas.height * OCR_SCALE;
  scaledCanvas.getContext('2d').drawImage(
    binaryCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height
  );

  const { data } = await worker.recognize(scaledCanvas);

  const lines = (data.lines || [])
    .filter(l => l.text.trim().length > 0)
    .sort((a, b) => a.bbox.y0 - b.bbox.y0);

  const codeLines = lines.map(l => {
    // Scale bbox back to original 615-space before DotGrid indentation lookup
    const indent = dotGrid ? dotGrid.indentationAt(l.bbox.x0 / OCR_SCALE) : '';
    return indent + l.text.trimEnd();
  });

  return codeLines.join('\n').trimEnd();
}
