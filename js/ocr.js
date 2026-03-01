// ocr.js — Verbatim OCR via Tesseract.js v5
// Exposes: runOCR(imgElement, dotGrid) → Promise<string>
//
// Constraint: imgElement must be the same <img> used by detectDotGrid so that
// bbox coordinates share the same 615-space pixel space on Boox Go 10.3.

let _worker = null;

async function _ensureWorker() {
  if (_worker) return _worker;
  _worker = await Tesseract.createWorker('eng');
  await _worker.setParameters({ tessedit_pageseg_mode: '6' }); // PSM_SINGLE_BLOCK
  return _worker;
}

async function runOCR(imgElement, dotGrid) {
  const worker = await _ensureWorker();
  const { data } = await worker.recognize(imgElement);

  const lines = (data.lines || [])
    .filter(l => l.text.trim().length > 0)
    .sort((a, b) => a.bbox.y0 - b.bbox.y0);

  const codeLines = lines.map(l => {
    const indent = dotGrid ? dotGrid.indentationAt(l.bbox.x0) : '';
    return indent + l.text.trimEnd();
  });

  return codeLines.join('\n').trimEnd();
}
