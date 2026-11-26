import { jsPDF } from 'jspdf';
import type { CanvasElement, TitleBlockConfig } from '../types/diagram';
import { getDiagramBounds } from './geometry';

export interface PdfExportOptions {
  format: 'a4' | 'a3';
  orientation: 'landscape' | 'portrait';
  includeTitleBlock: boolean;
  titleBlock: TitleBlockConfig;
}

/**
 * Serializes the pure SVG schematic (tightly cropped to all elements, white background,
 * no grid/selection) directly to a high-resolution PNG Data URL via SVG Blob -> Image -> Canvas.
 */
export async function renderCleanDiagramToPng(
  svgElement: SVGSVGElement,
  elements: CanvasElement[],
  scale: 2 | 3 = 2
): Promise<{ dataUrl: string; width: number; height: number }> {
  const bounds = getDiagramBounds(elements, 50);
  const outWidth = Math.ceil(bounds.width);
  const outHeight = Math.ceil(bounds.height);

  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clonedSvg.removeAttribute('class');
  clonedSvg.removeAttribute('style');
  clonedSvg.setAttribute('width', String(outWidth));
  clonedSvg.setAttribute('height', String(outHeight));
  clonedSvg.setAttribute(
    'viewBox',
    `${bounds.minX} ${bounds.minY} ${outWidth} ${outHeight}`
  );

  // Update background rect to cover the exact cropped viewBox
  const bgRect = clonedSvg.querySelector(':scope > rect');
  if (bgRect) {
    bgRect.setAttribute('x', String(bounds.minX));
    bgRect.setAttribute('y', String(bounds.minY));
    bgRect.setAttribute('width', String(outWidth));
    bgRect.setAttribute('height', String(outHeight));
    bgRect.setAttribute('fill', '#ffffff');
  }

  // Reset viewport pan/zoom transform on the cloned world group
  const worldGroup = clonedSvg.querySelector('#cad-world-group');
  if (worldGroup) {
    worldGroup.setAttribute('transform', 'translate(0, 0) scale(1)');
  }

  // Inline default sans-serif font on SVG root so standalone rendering matches browser
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = `
    text { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
  `;
  clonedSvg.insertBefore(styleEl, clonedSvg.firstChild);

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clonedSvg);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Không thể render SVG sang ảnh.'));
      image.src = blobUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = outWidth * scale;
    canvas.height = outHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Không thể khởi tạo Canvas 2D context.');
    }

    // Crisp white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw SVG vector at target high-DPI resolution
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/png', 1.0);
    return { dataUrl, width: outWidth, height: outHeight };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Renders a crisp ISO-style Title Block with full Vietnamese Unicode support
 * onto an offscreen canvas so jsPDF displays diacritics cleanly.
 */
function renderTitleBlockImage(titleBlock: TitleBlockConfig): {
  dataUrl: string;
  aspectRatio: number;
} {
  const w = 960;
  const h = 240;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: '', aspectRatio: w / h };

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);

  // Grid dividers
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 120);
  ctx.lineTo(w, 120);
  ctx.moveTo(420, 120);
  ctx.lineTo(420, h);
  ctx.moveTo(700, 120);
  ctx.lineTo(700, h);
  ctx.moveTo(700, 0);
  ctx.lineTo(700, 120);
  ctx.stroke();

  // Labels
  ctx.fillStyle = '#64748b';
  ctx.font = '600 20px Inter, Segoe UI, Arial, sans-serif';
  ctx.fillText('TÊN DỰ ÁN / PROJECT', 20, 34);
  ctx.fillText('MÃ BẢN VẼ / DWG NO.', 720, 34);
  ctx.fillText('NGƯỜI VẼ / DRAWN BY', 20, 154);
  ctx.fillText('NGÀY VẼ / DATE', 440, 154);
  ctx.fillText('PHẦN MỀM / TOOL', 720, 154);

  // Values
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 32px Inter, Segoe UI, Arial, sans-serif';
  ctx.fillText(titleBlock.projectName || 'Sơ đồ điện kỹ thuật', 20, 90, 660);

  ctx.font = '700 30px Consolas, monospace';
  ctx.fillText(titleBlock.drawingNumber || 'EL-001', 720, 90, 220);

  ctx.font = '600 26px Inter, Segoe UI, Arial, sans-serif';
  ctx.fillText(titleBlock.author || 'Kỹ sư điện', 20, 206, 380);
  ctx.fillText(titleBlock.date || '', 440, 206, 240);

  ctx.fillStyle = '#0284c7';
  ctx.font = '700 24px Inter, Segoe UI, Arial, sans-serif';
  ctx.fillText('ElectroCAD Studio', 720, 206, 220);

  return { dataUrl: canvas.toDataURL('image/png'), aspectRatio: w / h };
}

export async function exportDiagramToPdf(
  svgElement: SVGSVGElement,
  elements: CanvasElement[],
  options: PdfExportOptions
): Promise<void> {
  const { dataUrl, width, height } = await renderCleanDiagramToPng(svgElement, elements, 3);

  const pdf = new jsPDF({
    orientation: options.orientation,
    unit: 'mm',
    format: options.format,
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;

  // Outer engineering border
  pdf.setDrawColor(15, 23, 42);
  pdf.setLineWidth(0.5);
  pdf.rect(margin, margin, pageW - margin * 2, pageH - margin * 2);

  // Inner content area
  const innerPad = 6;
  const contentX = margin + innerPad;
  const contentY = margin + innerPad;
  const contentW = pageW - (margin + innerPad) * 2;
  const titleBlockH = options.includeTitleBlock ? 28 : 0;
  const contentH =
    pageH - (margin + innerPad) * 2 - (options.includeTitleBlock ? titleBlockH + 4 : 0);

  // Fit-to-page scaling preserving aspect ratio
  const imgAspect = width / height;
  const boxAspect = contentW / contentH;

  let drawW = contentW;
  let drawH = contentH;
  if (imgAspect > boxAspect) {
    drawW = contentW;
    drawH = contentW / imgAspect;
  } else {
    drawH = contentH;
    drawW = contentH * imgAspect;
  }

  const offsetX = contentX + (contentW - drawW) / 2;
  const offsetY = contentY + (contentH - drawH) / 2;

  pdf.addImage(dataUrl, 'PNG', offsetX, offsetY, drawW, drawH, undefined, 'FAST');

  // Optional Title Block in bottom-right corner
  if (options.includeTitleBlock) {
    const tb = renderTitleBlockImage(options.titleBlock);
    const tbH = 26;
    const tbW = tbH * tb.aspectRatio;
    const tbX = pageW - margin - tbW;
    const tbY = pageH - margin - tbH;
    pdf.addImage(tb.dataUrl, 'PNG', tbX, tbY, tbW, tbH, undefined, 'FAST');
  }

  const safeName = (options.titleBlock.projectName || 'so-do-dien')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
  pdf.save(`${safeName || 'so-do-dien'}-${options.format}.pdf`);
}
