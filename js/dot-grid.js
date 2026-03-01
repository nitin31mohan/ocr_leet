// dot-grid.js — Dot-grid detection and indentation coordinate mapper.
// Requires OpenCV.js to be loaded and window.opencvReady to have resolved.

// ── DotGrid ───────────────────────────────────────────────────────────────────

class DotGrid {
  /**
   * @param {object} params
   * @param {number} params.xPitch       — horizontal pixels between dot columns
   * @param {number} params.yPitch       — vertical pixels between dot rows
   * @param {number} params.xOrigin      — x pixel of leftmost detected dot column
   * @param {number} params.yOrigin      — y pixel of topmost detected dot row
   * @param {number} params.dotCount     — total source dots found (for diagnostics)
   * @param {number} [params.dotsPerIndent=4] — dot columns per Python indent level
   */
  constructor({ xPitch, yPitch, xOrigin, yOrigin, dotCount, dotsPerIndent = 4 }) {
    this.xPitch = xPitch;
    this.yPitch = yPitch;
    this.xOrigin = xOrigin;
    this.yOrigin = yOrigin;
    this.dotCount = dotCount;
    this.dotsPerIndent = dotsPerIndent;
  }

  /** Returns the 0-based dot column index for a given pixel x-position. */
  pixelToColumn(x) {
    return Math.max(0, Math.round((x - this.xOrigin) / this.xPitch));
  }

  /** Returns the number of spaces for a given dot column index. */
  columnToSpaces(col) {
    return col * this.dotsPerIndent;
  }

  /** Returns the Python indentation string for a given pixel x-position. */
  indentationAt(x) {
    return ' '.repeat(this.columnToSpaces(this.pixelToColumn(x)));
  }
}

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Internal: run the dot-finding pipeline on imgElement.
 * Returns { dots: [{x,y}[]], naturalWidth, naturalHeight } without cleanup side-effects.
 * All OpenCV Mats are cleaned up in a finally block.
 *
 * @param {HTMLImageElement} imgElement
 * @returns {{ dots: {x:number, y:number}[], naturalWidth: number, naturalHeight: number }}
 */
async function _findDots(imgElement) {
  const naturalWidth = imgElement.naturalWidth;
  const naturalHeight = imgElement.naturalHeight;

  const _canvas = document.createElement('canvas');
  _canvas.width = naturalWidth;
  _canvas.height = naturalHeight;
  const _ctx = _canvas.getContext('2d');
  _ctx.drawImage(imgElement, 0, 0);
  const src = cv.matFromImageData(
    _ctx.getImageData(0, 0, naturalWidth, naturalHeight)
  );

  let mat = src;
  let scaleFactor = 1;
  let gray = null;
  let dotMask = null;
  let contours = null;
  let hierarchy = null;
  let lowerMat = null;
  let upperMat = null;

  try {
    // Downsample only if truly enormous (Boox Go exports are ~1860×2480 — keep full res)
    const maxDim = Math.max(src.rows, src.cols);
    if (maxDim > 3000) {
      scaleFactor = 3000 / maxDim;
      const newWidth = Math.round(src.cols * scaleFactor);
      const newHeight = Math.round(src.rows * scaleFactor);
      mat = new cv.Mat();
      cv.resize(src, mat, new cv.Size(newWidth, newHeight), 0, 0, cv.INTER_AREA);
    }

    gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    const _sR = [0.25, 0.5, 0.75].map(f => Math.floor(gray.rows * f));
    const _sC = [0.25, 0.5, 0.75].map(f => Math.floor(gray.cols * f));
    const _samplePx = _sR.flatMap(r => _sC.map(c => gray.ucharPtr(r, c)[0]));

    // Boox dots: light gray ~150–245 on white paper. Ink is dark (0–100).
    dotMask = new cv.Mat();
    lowerMat = new cv.Mat(gray.rows, gray.cols, gray.type(), new cv.Scalar(130));
    upperMat = new cv.Mat(gray.rows, gray.cols, gray.type(), new cv.Scalar(253));
    cv.inRange(gray, lowerMat, upperMat, dotMask);

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(dotMask, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const dots = [];
    let _dArea = 0, _dCirc = 0;
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area < 3 || area > 600) { contour.delete(); continue; }
      _dArea++;
      const perimeter = cv.arcLength(contour, true);
      if (perimeter === 0) { contour.delete(); continue; }
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      if (circularity < 0.4) { contour.delete(); continue; }
      _dCirc++;
      const M = cv.moments(contour);
      if (M.m00 === 0) { contour.delete(); continue; }
      dots.push({ x: (M.m10 / M.m00) / scaleFactor, y: (M.m01 / M.m00) / scaleFactor });
      contour.delete();
    }

    window._dotGridDiag = {
      size: src.cols + 'x' + src.rows,
      totalContours: contours.size(),
      afterArea: _dArea,
      afterCirc: _dCirc,
      px: _samplePx,
    };

    return { dots, naturalWidth, naturalHeight };

  } finally {
    if (mat !== src) mat.delete();
    src.delete();
    if (gray) gray.delete();
    if (dotMask) dotMask.delete();
    if (lowerMat) lowerMat.delete();
    if (upperMat) upperMat.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
  }
}

/**
 * Detect the dot-grid in a Boox Notes export image.
 *
 * @param {HTMLImageElement} imgElement
 * @returns {Promise<DotGrid|null>} DotGrid on success, null if detection fails.
 */
async function detectDotGrid(imgElement) {
  const { dots } = await _findDots(imgElement);
  if (dots.length < 20) {
    console.warn('dot-grid: insufficient dots detected:', dots.length);
    return null;
  }
  return computeGridParameters(dots);
}

/**
 * Detect the dot-grid and produce a canvas with all dots painted white.
 * Pass the returned canvas to Tesseract instead of the raw image so that
 * dot-grid noise does not appear as OCR characters.
 *
 * Both the DotGrid and the canvas use the same naturalWidth×naturalHeight
 * coordinate space, so DotGrid.indentationAt(bbox.x0) remains valid.
 *
 * @param {HTMLImageElement} imgElement
 * @returns {Promise<{ grid: DotGrid|null, canvas: HTMLCanvasElement }>}
 */
async function detectDotGridAndMask(imgElement) {
  const { dots, naturalWidth, naturalHeight } = await _findDots(imgElement);

  const grid = (dots.length >= 20) ? computeGridParameters(dots) : null;
  if (dots.length < 20) {
    console.warn('dot-grid: insufficient dots detected:', dots.length);
  }

  // Draw image to canvas, then paint white circles over every detected dot
  const canvas = document.createElement('canvas');
  canvas.width = naturalWidth;
  canvas.height = naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgElement, 0, 0);

  if (dots.length > 0) {
    // Radius: cover the dot (~2–3px) plus a 2px margin; use xPitch/4 if grid known
    const radius = grid ? Math.ceil(grid.xPitch / 4) : 5;
    ctx.fillStyle = '#ffffff';
    for (const { x, y } of dots) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  return { grid, canvas };
}

// ── Grid parameter computation ─────────────────────────────────────────────────

/**
 * Compute xPitch, yPitch, xOrigin, yOrigin from an array of dot centroids.
 *
 * @param {{ x: number, y: number }[]} dots
 * @returns {DotGrid|null}
 */
function computeGridParameters(dots) {
  const xPitch = dominantPitch(dots.map(d => d.x));
  const yPitch = dominantPitch(dots.map(d => d.y));

  if (xPitch === null || yPitch === null) {
    console.warn('dot-grid: could not determine grid pitch', { xPitch, yPitch });
    return null;
  }

  const xOrigin = Math.min(...dots.map(d => d.x));
  const yOrigin = Math.min(...dots.map(d => d.y));

  return new DotGrid({ xPitch, yPitch, xOrigin, yOrigin, dotCount: dots.length });
}

/**
 * Given a list of 1D coordinates, compute the dominant inter-dot pitch.
 *
 * @param {number[]} coords
 * @returns {number|null} pitch in pixels, or null if not determinable
 */
function dominantPitch(coords) {
  const sorted = [...coords].sort((a, b) => a - b);

  const diffs = [];
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i] - sorted[i - 1];
    if (d > 1) diffs.push(d);
  }

  if (diffs.length === 0) return null;

  const BUCKET = 5;
  const MIN_PITCH = 8;
  const MAX_PITCH = 120;
  const bins = {};

  for (const d of diffs) {
    if (d < MIN_PITCH || d > MAX_PITCH) continue;
    const key = Math.round(d / BUCKET) * BUCKET;
    bins[key] = (bins[key] || 0) + 1;
  }

  if (Object.keys(bins).length === 0) return null;

  const best = Object.entries(bins).sort((a, b) => b[1] - a[1])[0];
  return Number(best[0]);
}
