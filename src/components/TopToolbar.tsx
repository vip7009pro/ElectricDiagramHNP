import React, { useRef } from 'react';
import {
  ClipboardPaste,
  Copy,
  CopyPlus,
  Download,
  FileImage,
  FileText,
  Grid,
  Magnet,
  Maximize2,
  Redo2,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
  Upload,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useDiagramStore } from '../store/useDiagramStore';
import { getDiagramBounds } from '../utils/geometry';
import { triggerDownload } from '../utils/exportUtils';

interface TopToolbarProps {
  onOpenExport: (tab: 'png' | 'pdf') => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({ onOpenExport }) => {
  const {
    elements,
    titleBlock,
    selectedElementIds,
    selectedWireId,
    clipboard,
    gridSize,
    showGrid,
    snapEnabled,
    viewport,
    past,
    future,
    undo,
    redo,
    toggleGrid,
    setGridSize,
    toggleSnap,
    setViewport,
    rotateElements,
    duplicateElements,
    copySelectedElements,
    pasteClipboard,
    deleteElements,
    deleteWire,
    resetDemo,
    exportProjectData,
    importProjectData,
  } = useDiagramStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleZoom = (delta: number) => {
    const nextZoom = Math.min(3, Math.max(0.25, Number((viewport.zoom + delta).toFixed(2))));
    setViewport({ zoom: nextZoom });
  };

  const handleFitView = () => {
    const bounds = getDiagramBounds(elements, 60);
    const canvasW = Math.max(400, window.innerWidth - 560);
    const canvasH = Math.max(300, window.innerHeight - 60);
    const zoom = Math.min(1.5, Math.max(0.3, Math.min(canvasW / bounds.width, canvasH / bounds.height)));
    const x = (canvasW - bounds.width * zoom) / 2 - bounds.minX * zoom;
    const y = (canvasH - bounds.height * zoom) / 2 - bounds.minY * zoom;
    setViewport({ x, y, zoom: Number(zoom.toFixed(2)) });
  };

  const handleExportJson = () => {
    const data = exportProjectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const safeName = (titleBlock.projectName || 'electrocad-project')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '');
    triggerDownload(url, `${safeName || 'electrocad-project'}.json`);
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        importProjectData(parsed);
      } catch (err) {
        alert(`Không thể đọc file JSON: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-3 text-slate-200">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-white shadow">
          <Zap className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="text-xs font-bold tracking-tight text-white">ElectroCAD Studio</div>
          <div className="max-w-44 truncate text-[10px] text-slate-400">
            {titleBlock.projectName}
          </div>
        </div>
      </div>

      {/* Center CAD Tools */}
      <div className="flex items-center gap-1">
        {/* Undo / Redo */}
        <div className="flex items-center rounded-md bg-slate-950/70 p-0.5 border border-slate-800">
          <button
            type="button"
            onClick={undo}
            disabled={past.length === 0}
            title="Hoàn tác (Ctrl+Z)"
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            title="Làm lại (Ctrl+Y)"
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Grid & Snap */}
        <div className="flex items-center gap-0.5 rounded-md bg-slate-950/70 p-0.5 border border-slate-800">
          <button
            type="button"
            onClick={toggleGrid}
            title="Bật/Tắt lưới tọa độ"
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium cursor-pointer ${
              showGrid ? 'bg-sky-600/25 text-sky-300' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
            Lưới
          </button>
          <button
            type="button"
            onClick={() => setGridSize(gridSize === 20 ? 10 : 20)}
            title="Chuyển kích thước lưới 10px / 20px"
            className="rounded px-1.5 py-1 font-mono text-[11px] text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            {gridSize}px
          </button>
          <button
            type="button"
            onClick={toggleSnap}
            title="Bật/Tắt bắt dính lưới (Snap-to-grid)"
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium cursor-pointer ${
              snapEnabled ? 'bg-emerald-600/25 text-emerald-300' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Magnet className="h-3.5 w-3.5" />
            Snap
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5 rounded-md bg-slate-950/70 p-0.5 border border-slate-800">
          <button
            type="button"
            onClick={() => handleZoom(-0.15)}
            title="Thu nhỏ"
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-11 text-center font-mono text-[11px] text-slate-300">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => handleZoom(0.15)}
            title="Phóng to"
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleFitView}
            title="Căn vừa bản vẽ (Fit to View)"
            className="rounded p-1.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Quick Object Actions */}
        {(selectedElementIds.length > 0 || selectedWireId || (clipboard && clipboard.elements.length > 0)) && (
          <div className="flex items-center gap-0.5 rounded-md bg-slate-950/70 p-0.5 border border-slate-800">
            {selectedElementIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={copySelectedElements}
                  title="Sao chép (Ctrl+C)"
                  className="rounded p-1.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            {clipboard && clipboard.elements.length > 0 && (
              <button
                type="button"
                onClick={pasteClipboard}
                title={`Dán ${clipboard.elements.length} linh kiện (Ctrl+V)`}
                className="flex items-center gap-1 rounded px-1.5 py-1 text-sky-300 hover:bg-slate-800 cursor-pointer"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                {clipboard.elements.length > 1 && (
                  <span className="font-mono text-[10px]">{clipboard.elements.length}</span>
                )}
              </button>
            )}
            {selectedElementIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => rotateElements(selectedElementIds)}
                  title="Xoay 90° (R)"
                  className="rounded p-1.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => duplicateElements(selectedElementIds)}
                  title="Nhân bản nhanh (Ctrl+D)"
                  className="rounded p-1.5 text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  <CopyPlus className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            {(selectedElementIds.length > 0 || selectedWireId) && (
              <button
                type="button"
                onClick={() => {
                  if (selectedElementIds.length > 0) deleteElements(selectedElementIds);
                  else if (selectedWireId) deleteWire(selectedWireId);
                }}
                title="Xóa đối tượng đang chọn (Delete)"
                className="rounded p-1.5 text-rose-400 hover:bg-rose-500/20 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right File & Export Actions */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={resetDemo}
          title="Khôi phục mạch mẫu"
          className="rounded-md border border-slate-800 bg-slate-950/60 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportJson}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Mở file dự án .json"
          className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
        >
          <Upload className="h-3.5 w-3.5" />
          JSON
        </button>
        <button
          type="button"
          onClick={handleExportJson}
          title="Lưu dự án ra file .json"
          className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          Lưu
        </button>

        <div className="h-5 w-px bg-slate-800 mx-0.5" />

        <button
          type="button"
          onClick={() => onOpenExport('png')}
          className="flex items-center gap-1 rounded-md bg-emerald-600/90 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 cursor-pointer"
        >
          <FileImage className="h-3.5 w-3.5" />
          PNG
        </button>
        <button
          type="button"
          onClick={() => onOpenExport('pdf')}
          className="flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5" />
          PDF
        </button>
      </div>
    </header>
  );
};
