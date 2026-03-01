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
 * Detect the dot-grid in a Boox Notes export image.
 *
 * @param {HTMLImageElement} imgElement
 * @returns {Promise<DotGrid|null>} DotGrid on success, null if detection fails.
 */
async function detectDotGrid(imgElement) {
  const src = cv.imread(imgElement);
  let mat = src;
  let scaleFactor = 1;

  let gray = null;
  let dotMask = null;
  let contours = null;
  let hierarchy = null;
  let lowerMat = null;
  let upperMat = null;

  try {
    // 1. Downsample if very large (Boox Go exports are ~1860×2480; keep those at full res
    //    so small dots (~3–4px dia) survive the area filter. Only scale truly huge images.)
    const maxDim = Math.max(src.rows, src.cols);
    if (maxDim > 3000) {
      scaleFactor = 3000 / maxDim;
      const newWidth = Math.round(src.cols * scaleFactor);
      const newHeight = Math.round(src.rows * scaleFactor);
      mat = new cv.Mat();
      cv.resize(src, mat, new cv.Size(newWidth, newHeight), 0, 0, cv.INTER_AREA);
    }

    // 2. Convert to grayscale
    gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    // 3. Isolate dots: Boox dots are light gray (~150–230) on white paper.
    //    Ink is dark (0–100). Threshold [130, 235] captures dots and excludes both.
    dotMask = new cv.Mat();
    lowerMat = new cv.Mat(gray.rows, gray.cols, gray.type(), new cv.Scalar(130));
    upperMat = new cv.Mat(gray.rows, gray.cols, gray.type(), new cv.Scalar(235));
    cv.inRange(gray, lowerMat, upperMat, dotMask);

    // 4. Find contours on the dot mask
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(dotMask, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    // 5. Filter contours to identify dots
    const dots = [];
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);

      // Too small = noise; too large = ink bleed or artefact
      if (area < 3 || area > 600) {
        contour.delete();
        continue;
      }

      const perimeter = cv.arcLength(contour, true);
      if (perimeter === 0) {
        contour.delete();
        continue;
      }

      // Circularity: 1.0 = perfect circle, <0.4 = likely a handwriting stroke
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
      if (circularity < 0.4) {
        contour.delete();
        continue;
      }

      // Centroid via image moments
      const M = cv.moments(contour);
      if (M.m00 === 0) {
        contour.delete();
        continue;
      }
      const cx = (M.m10 / M.m00) / scaleFactor;
      const cy = (M.m01 / M.m00) / scaleFactor;
      dots.push({ x: cx, y: cy });
      contour.delete();
    }

    // 6. Check minimum dot count
    if (dots.length < 20) {
      console.warn('dot-grid: insufficient dots detected:', dots.length);
      return null;
    }

    // 7. Compute grid parameters
    return computeGridParameters(dots);

  } finally {
    // Explicit cleanup — OpenCV.js does not GC Mats automatically
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

// ── Grid parameter computation ─────────────────────────────────────────────────

/**
 * Compute xPitch, yPitch, xOrigin, yOrigin from an array of dot centroids.
 *
 * Algorithm: sort coordinates, compute pairwise adjacent differences, bin into
 * 5px buckets, pick the dominant bucket in the valid pitch range [8, 120].
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

  // Pairwise adjacent differences
  const diffs = [];
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i] - sorted[i - 1];
    if (d > 1) diffs.push(d); // skip sub-pixel duplicates
  }

  if (diffs.length === 0) return null;

  // Bin into 5px buckets
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

  // Return the centre of the most populated bucket
  const best = Object.entries(bins).sort((a, b) => b[1] - a[1])[0];
  return Number(best[0]);
}
