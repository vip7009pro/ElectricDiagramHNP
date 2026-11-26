import React, { useState } from 'react';
import { Copy, Cpu, Pencil, Plus, Search, Trash2, Cable } from 'lucide-react';
import { useDiagramStore } from '../store/useDiagramStore';
import type { ElementTemplate } from '../types/diagram';
import { WIRE_PRESETS } from '../data/defaultTemplates';

interface LibrarySidebarProps {
  onOpenCreateElement: () => void;
  onOpenEditTemplate: (template: ElementTemplate) => void;
  onOpenDuplicateTemplate: (template: ElementTemplate) => void;
}

const TemplateMiniPreview: React.FC<{ template: ElementTemplate }> = ({ template }) => {
  const pad = 16;
  const vbW = template.width + pad * 2;
  const vbH = template.height + pad * 2;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${vbW} ${vbH}`}
      className="h-12 w-16 shrink-0 rounded bg-white border border-slate-700/60"
    >
      <rect
        x={0}
        y={0}
        width={template.width}
        height={template.height}
        rx={4}
        fill={template.fillColor || '#f8fafc'}
        stroke={template.borderColor || '#0f172a'}
        strokeWidth={Math.max(2, vbW / 60)}
      />
      {template.pins.map((pin) => {
        const stub = 10;
        let x1 = 0,
          y1 = 0,
          x2 = 0,
          y2 = 0;
        if (pin.side === 'top') {
          x1 = pin.offset;
          y1 = 0;
          x2 = pin.offset;
          y2 = -stub;
        } else if (pin.side === 'bottom') {
          x1 = pin.offset;
          y1 = template.height;
          x2 = pin.offset;
          y2 = template.height + stub;
        } else if (pin.side === 'left') {
          x1 = 0;
          y1 = pin.offset;
          x2 = -stub;
          y2 = pin.offset;
        } else {
          x1 = template.width;
          y1 = pin.offset;
          x2 = template.width + stub;
          y2 = pin.offset;
        }
        return (
          <line
            key={pin.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={template.borderColor || '#0f172a'}
            strokeWidth={Math.max(2, vbW / 70)}
          />
        );
      })}
    </svg>
  );
};

export const LibrarySidebar: React.FC<LibrarySidebarProps> = ({
  onOpenCreateElement,
  onOpenEditTemplate,
  onOpenDuplicateTemplate,
}) => {
  const {
    templates,
    deleteTemplate,
    addElementFromTemplate,
    viewport,
    defaultWireColor,
    setDefaultWireColor,
  } = useDiagramStore();

  const [query, setQuery] = useState('');

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.prefix.toLowerCase().includes(query.toLowerCase())
  );

  const handleDragStart = (e: React.DragEvent, templateId: string) => {
    e.dataTransfer.setData('application/x-electrocad-template', templateId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleQuickAdd = (templateId: string) => {
    const centerX = (-viewport.x + 420) / viewport.zoom;
    const centerY = (-viewport.y + 280) / viewport.zoom;
    addElementFromTemplate(templateId, centerX, centerY);
  };

  return (
    <aside className="flex h-full w-68 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 p-3">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Cpu className="h-4 w-4 text-sky-400" />
            <span>Thư viện linh kiện</span>
          </div>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-400">
            {templates.length}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenCreateElement}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-500 active:scale-[0.99] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Tạo Element mới
        </button>

        {/* Search */}
        <div className="relative mt-2.5">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm linh kiện..."
            className="w-full rounded-md border border-slate-700/80 bg-slate-950/70 py-1.5 pl-8 pr-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Template List */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
        <p className="px-1 text-[11px] text-slate-500">
          Kéo thả vào bản vẽ hoặc nhấn nút + để thêm nhanh.
        </p>

        {filtered.map((tpl) => (
          <div
            key={tpl.id}
            draggable
            onDragStart={(e) => handleDragStart(e, tpl.id)}
            className="group flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-800/40 p-2 transition hover:border-sky-500/50 hover:bg-slate-800/80 cursor-grab active:cursor-grabbing"
          >
            <TemplateMiniPreview template={tpl} />

            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-100">{tpl.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-sky-400">
                  -{tpl.prefix}
                </span>
                <span>{tpl.pins.length} chân</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1 opacity-85 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => handleQuickAdd(tpl.id)}
                  title="Thêm vào bản vẽ"
                  className="rounded bg-sky-600/20 px-1.5 py-0.5 text-[10px] font-medium text-sky-300 hover:bg-sky-600 hover:text-white cursor-pointer"
                >
                  + Thêm
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDuplicateTemplate(tpl)}
                  title="Nhân bản để tạo linh kiện tương tự"
                  className="rounded p-1 text-slate-400 hover:bg-sky-500/20 hover:text-sky-300 cursor-pointer"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenEditTemplate(tpl)}
                  title="Chỉnh sửa mẫu"
                  className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-100 cursor-pointer"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteTemplate(tpl.id)}
                  title="Xóa khỏi thư viện"
                  className="rounded p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-500">
            Không tìm thấy linh kiện phù hợp.
          </div>
        )}
      </div>

      {/* Default Wire Color Palette */}
      <div className="border-t border-slate-800 bg-slate-950/50 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <Cable className="h-3.5 w-3.5 text-amber-400" />
          <span>Màu dây vẽ mới</span>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {WIRE_PRESETS.map((preset) => (
            <button
              key={preset.color}
              type="button"
              title={`${preset.name} — ${preset.description}`}
              onClick={() => setDefaultWireColor(preset.color)}
              className={`h-6 w-full rounded border transition cursor-pointer ${
                defaultWireColor === preset.color
                  ? 'scale-105 border-white ring-2 ring-sky-400'
                  : 'border-slate-700 hover:scale-105'
              }`}
              style={{ backgroundColor: preset.color }}
            />
          ))}
        </div>
      </div>
    </aside>
  );
};
