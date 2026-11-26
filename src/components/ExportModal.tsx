import React, { useState } from 'react';
import { Download, FileImage, FileText, Loader2, X } from 'lucide-react';
import { useDiagramStore } from '../store/useDiagramStore';
import {
  exportDiagramToPdf,
  renderCleanDiagramToPng,
  triggerDownload,
} from '../utils/exportUtils';

interface ExportModalProps {
  initialTab: 'png' | 'pdf';
  svgRef: React.RefObject<SVGSVGElement | null>;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ initialTab, svgRef, onClose }) => {
  const { elements, titleBlock, updateTitleBlock, setIsExporting } = useDiagramStore();
  const [tab, setTab] = useState<'png' | 'pdf'>(initialTab);
  const [pngScale, setPngScale] = useState<2 | 3>(2);
  const [pdfFormat, setPdfFormat] = useState<'a4' | 'a3'>('a4');
  const [pdfOrientation, setPdfOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [includeTitleBlock, setIncludeTitleBlock] = useState(true);
  const [busy, setBusy] = useState(false);

  const waitNextFrame = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  const handleExportPng = async () => {
    if (!svgRef.current) return;
    setBusy(true);
    setIsExporting(true);
    try {
      await waitNextFrame();
      const { dataUrl } = await renderCleanDiagramToPng(svgRef.current, elements, pngScale);
      const safeName = (titleBlock.projectName || 'so-do-dien')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '');
      triggerDownload(dataUrl, `${safeName || 'so-do-dien'}-${pngScale}x.png`);
      onClose();
    } catch (err) {
      alert(`Xuất PNG thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
      setBusy(false);
    }
  };

  const handleExportPdf = async () => {
    if (!svgRef.current) return;
    setBusy(true);
    setIsExporting(true);
    try {
      await waitNextFrame();
      await exportDiagramToPdf(svgRef.current, elements, {
        format: pdfFormat,
        orientation: pdfOrientation,
        includeTitleBlock,
        titleBlock,
      });
      onClose();
    } catch (err) {
      alert(`Xuất PDF thất bại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <h2 className="text-sm font-bold text-white">Kết xuất bản vẽ (Export)</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950/60 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setTab('png')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
              tab === 'png'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <FileImage className="h-4 w-4" />
            Xuất ảnh PNG
          </button>
          <button
            type="button"
            onClick={() => setTab('pdf')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition cursor-pointer ${
              tab === 'pdf'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            Xuất PDF kỹ thuật
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {tab === 'png' ? (
            <>
              <p className="text-xs text-slate-400">
                Hệ thống sẽ tự động ẩn lưới (Grid) và khung chọn, căn vừa toàn bộ sơ đồ trên nền trắng độ phân giải cao.
              </p>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Độ phân giải (Scale)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPngScale(2)}
                    className={`rounded-lg border py-2.5 text-xs font-semibold transition cursor-pointer ${
                      pngScale === 2
                        ? 'border-sky-500 bg-sky-500/15 text-sky-300'
                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    2x (HD Sắc nét)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPngScale(3)}
                    className={`rounded-lg border py-2.5 text-xs font-semibold transition cursor-pointer ${
                      pngScale === 3
                        ? 'border-sky-500 bg-sky-500/15 text-sky-300'
                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    3x (Ultra HD / In ấn)
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleExportPng}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60 cursor-pointer"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Tải xuống PNG ({pngScale}x)
              </button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Khổ giấy
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['a4', 'a3'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setPdfFormat(fmt)}
                        className={`rounded-md py-1.5 text-xs font-semibold uppercase cursor-pointer ${
                          pdfFormat === fmt
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">
                    Hướng giấy
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPdfOrientation('landscape')}
                      className={`rounded-md py-1.5 text-xs font-medium cursor-pointer ${
                        pdfOrientation === 'landscape'
                          ? 'bg-sky-600 text-white font-semibold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Ngang
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfOrientation('portrait')}
                      className={`rounded-md py-1.5 text-xs font-medium cursor-pointer ${
                        pdfOrientation === 'portrait'
                          ? 'bg-sky-600 text-white font-semibold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Dọc
                    </button>
                  </div>
                </div>
              </div>

              {/* Title block toggle */}
              <label className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTitleBlock}
                  onChange={(e) => setIncludeTitleBlock(e.target.checked)}
                  className="h-4 w-4 rounded accent-sky-500"
                />
                <span className="text-xs font-medium text-slate-200">
                  Kèm khung tên bản vẽ (Title Block) góc dưới phải
                </span>
              </label>

              {includeTitleBlock && (
                <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-[11px] text-slate-400">Tên dự án</label>
                    <input
                      type="text"
                      value={titleBlock.projectName}
                      onChange={(e) => updateTitleBlock({ projectName: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Người vẽ</label>
                    <input
                      type="text"
                      value={titleBlock.author}
                      onChange={(e) => updateTitleBlock({ author: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Ngày vẽ</label>
                    <input
                      type="text"
                      value={titleBlock.date}
                      onChange={(e) => updateTitleBlock({ date: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={handleExportPdf}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60 cursor-pointer"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Xuất file PDF ({pdfFormat.toUpperCase()} —{' '}
                {pdfOrientation === 'landscape' ? 'Ngang' : 'Dọc'})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
