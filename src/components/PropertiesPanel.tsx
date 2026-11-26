import React from 'react';
import {
  Copy,
  FileText,
  RotateCw,
  Sliders,
  Trash2,
  Wrench,
  Cable,
  Box,
} from 'lucide-react';
import { useDiagramStore } from '../store/useDiagramStore';
import type { CanvasElement, RotationAngle } from '../types/diagram';
import { WIRE_PRESETS } from '../data/defaultTemplates';

interface PropertiesPanelProps {
  onEditInstancePins: (element: CanvasElement) => void;
}

const ROTATIONS: RotationAngle[] = [0, 90, 180, 270];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ onEditInstancePins }) => {
  const {
    elements,
    wires,
    selectedElementIds,
    selectedWireId,
    titleBlock,
    updateElement,
    rotateElement,
    rotateElements,
    duplicateElement,
    duplicateElements,
    deleteElement,
    deleteElements,
    updateWire,
    deleteWire,
    updateTitleBlock,
  } = useDiagramStore();

  const isMultiSelect = selectedElementIds.length > 1;
  const selectedElement =
    selectedElementIds.length === 1
      ? (elements.find((e) => e.instanceId === selectedElementIds[0]) ?? null)
      : null;
  const selectedWire = wires.find((w) => w.id === selectedWireId) ?? null;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-slate-800 bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-3.5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Sliders className="h-4 w-4 text-sky-400" />
        <span>
          {isMultiSelect
            ? `Nhóm ${selectedElementIds.length} linh kiện`
            : selectedElement
              ? 'Thuộc tính linh kiện'
              : selectedWire
                ? 'Thuộc tính dây dẫn'
                : 'Thông tin bản vẽ'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* MULTI-ELEMENT INSPECTOR */}
        {isMultiSelect && (
          <div className="space-y-3">
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-xs">
              <div className="font-semibold text-sky-300">
                Đang chọn {selectedElementIds.length} linh kiện
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Kéo bất kỳ linh kiện nào trong nhóm để di chuyển tất cả cùng lúc.
              </p>
            </div>

            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/50 p-2">
              {elements
                .filter((el) => selectedElementIds.includes(el.instanceId))
                .map((el) => (
                  <div
                    key={el.instanceId}
                    className="flex items-center justify-between rounded px-2 py-1 text-xs bg-slate-900/70"
                  >
                    <span className="font-mono font-semibold text-sky-400">{el.tag}</span>
                    <span className="truncate ml-2 text-[11px] text-slate-400">{el.name}</span>
                  </div>
                ))}
            </div>

            <div className="grid grid-cols-3 gap-1.5 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => rotateElements(selectedElementIds)}
                className="flex items-center justify-center gap-1 rounded-md bg-slate-800 px-2 py-2 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer"
                title="Xoay tất cả 90° (R)"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Xoay
              </button>
              <button
                type="button"
                onClick={() => duplicateElements(selectedElementIds)}
                className="flex items-center justify-center gap-1 rounded-md bg-slate-800 px-2 py-2 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer"
                title="Nhân bản nhóm (Ctrl+D)"
              >
                <Copy className="h-3.5 w-3.5" />
                Nhân bản
              </button>
              <button
                type="button"
                onClick={() => deleteElements(selectedElementIds)}
                className="flex items-center justify-center gap-1 rounded-md bg-rose-500/15 px-2 py-2 text-xs text-rose-400 hover:bg-rose-500/25 cursor-pointer"
                title="Xóa nhóm (Delete)"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Xóa
              </button>
            </div>
          </div>
        )}
        {/* ELEMENT INSPECTOR */}
        {selectedElement && (
          <>
            <div className="flex items-center gap-2 rounded-lg bg-slate-800/60 p-2.5 border border-slate-700/60">
              <Box className="h-4 w-4 text-sky-400 shrink-0" />
              <div className="min-w-0">
                <div className="truncate font-mono text-xs font-bold text-white">
                  {selectedElement.tag}
                </div>
                <div className="truncate text-[11px] text-slate-400">
                  {selectedElement.pins.length} chân • {selectedElement.width}×
                  {selectedElement.height}px
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  Nhãn thiết bị (Tag)
                </label>
                <input
                  type="text"
                  value={selectedElement.tag}
                  onChange={(e) =>
                    updateElement(selectedElement.instanceId, { tag: e.target.value }, false)
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  Tên hiển thị
                </label>
                <input
                  type="text"
                  value={selectedElement.name}
                  onChange={(e) =>
                    updateElement(selectedElement.instanceId, { name: e.target.value }, false)
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Tọa độ X
                  </label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.x)}
                    onChange={(e) =>
                      updateElement(selectedElement.instanceId, {
                        x: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Tọa độ Y
                  </label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.y)}
                    onChange={(e) =>
                      updateElement(selectedElement.instanceId, {
                        y: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Rotation */}
              <div>
                <label className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-400">
                  <span>Góc xoay</span>
                  <span className="font-mono text-sky-400">{selectedElement.rotation}°</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {ROTATIONS.map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => rotateElement(selectedElement.instanceId, deg)}
                      className={`rounded-md py-1.5 text-xs font-mono transition cursor-pointer ${
                        selectedElement.rotation === deg
                          ? 'bg-sky-600 text-white font-semibold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Màu viền
                  </label>
                  <div className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
                    <input
                      type="color"
                      value={selectedElement.borderColor || '#0f172a'}
                      onChange={(e) =>
                        updateElement(selectedElement.instanceId, {
                          borderColor: e.target.value,
                        })
                      }
                      className="h-5 w-6 cursor-pointer border-0 bg-transparent"
                    />
                    <span className="font-mono text-[11px] text-slate-300">
                      {selectedElement.borderColor || '#0f172a'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Màu nền
                  </label>
                  <div className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
                    <input
                      type="color"
                      value={selectedElement.fillColor || '#f8fafc'}
                      onChange={(e) =>
                        updateElement(selectedElement.instanceId, {
                          fillColor: e.target.value,
                        })
                      }
                      className="h-5 w-6 cursor-pointer border-0 bg-transparent"
                    />
                    <span className="font-mono text-[11px] text-slate-300">
                      {selectedElement.fillColor || '#f8fafc'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => onEditInstancePins(selectedElement)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/25 cursor-pointer"
              >
                <Wrench className="h-3.5 w-3.5" />
                Chỉnh sửa chân (Pins)
              </button>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => rotateElement(selectedElement.instanceId)}
                  className="flex items-center justify-center gap-1 rounded-md bg-slate-800 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer"
                  title="Xoay 90° (R)"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Xoay
                </button>
                <button
                  type="button"
                  onClick={() => duplicateElement(selectedElement.instanceId)}
                  className="flex items-center justify-center gap-1 rounded-md bg-slate-800 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer"
                  title="Nhân bản (Ctrl+D)"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Nhân bản
                </button>
                <button
                  type="button"
                  onClick={() => deleteElement(selectedElement.instanceId)}
                  className="flex items-center justify-center gap-1 rounded-md bg-rose-500/15 px-2 py-1.5 text-xs text-rose-400 hover:bg-rose-500/25 cursor-pointer"
                  title="Xóa (Delete)"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa
                </button>
              </div>
            </div>
          </>
        )}

        {/* WIRE INSPECTOR */}
        {selectedWire && (() => {
          const fromEl = elements.find((e) => e.instanceId === selectedWire.fromElementId);
          const toEl = elements.find((e) => e.instanceId === selectedWire.toElementId);
          const fromPin = fromEl?.pins.find((p) => p.id === selectedWire.fromPinId);
          const toPin = toEl?.pins.find((p) => p.id === selectedWire.toPinId);
          const targetWire = selectedWire.toWireId
            ? wires.find((w) => w.id === selectedWire.toWireId)
            : null;

          return (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-slate-800/60 p-2.5 border border-slate-700/60">
                <Cable className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="min-w-0 text-xs">
                  <div className="font-semibold text-white">
                    {selectedWire.toWireId ? 'Dây nối nhánh (Junction)' : 'Kết nối dây điện'}
                  </div>
                  <div className="truncate font-mono text-[11px] text-slate-400">
                    {fromEl?.tag}:{fromPin?.name} →{' '}
                    {selectedWire.toWireId
                      ? `Nhánh dây${targetWire?.label ? ` (${targetWire.label})` : ''}`
                      : `${toEl?.tag}:${toPin?.name}`}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Nhãn dây (Wire Label)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: +24V, 0V, X0, Y1..."
                    value={selectedWire.label ?? ''}
                    onChange={(e) => updateWire(selectedWire.id, { label: e.target.value })}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>

                {/* Wire Color Presets */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-slate-400">
                    Màu dây tiêu chuẩn
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {WIRE_PRESETS.map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => updateWire(selectedWire.id, { color: preset.color })}
                        className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition cursor-pointer ${
                          selectedWire.color === preset.color
                            ? 'border-sky-400 bg-sky-500/15 text-white'
                            : 'border-slate-700/80 bg-slate-800/50 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full border border-white/20"
                          style={{ backgroundColor: preset.color }}
                        />
                        <span className="truncate">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
                    <input
                      type="color"
                      value={selectedWire.color}
                      onChange={(e) => updateWire(selectedWire.id, { color: e.target.value })}
                      className="h-5 w-7 cursor-pointer border-0 bg-transparent"
                    />
                    <span className="font-mono text-xs text-slate-300">{selectedWire.color}</span>
                  </div>
                </div>

                {/* Stroke Width */}
                <div>
                  <label className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-400">
                    <span>Độ dày dây</span>
                    <span className="font-mono text-sky-400">
                      {selectedWire.strokeWidth ?? 2}px
                    </span>
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1.5, 2, 3, 4].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => updateWire(selectedWire.id, { strokeWidth: w })}
                        className={`rounded-md py-1.5 font-mono text-xs transition cursor-pointer ${
                          (selectedWire.strokeWidth ?? 2) === w
                            ? 'bg-sky-600 text-white font-semibold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {w}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* Line Style */}
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-slate-400">
                    Kiểu nét
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateWire(selectedWire.id, { lineStyle: 'solid' })}
                      className={`rounded-md py-1.5 text-xs transition cursor-pointer ${
                        (selectedWire.lineStyle ?? 'solid') === 'solid'
                          ? 'bg-sky-600 text-white font-semibold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Nét liền (──)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateWire(selectedWire.id, { lineStyle: 'dashed' })}
                      className={`rounded-md py-1.5 text-xs transition cursor-pointer ${
                        selectedWire.lineStyle === 'dashed'
                          ? 'bg-sky-600 text-white font-semibold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Nét đứt (- - -)
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-800 pt-3">
                {selectedWire.waypoints && selectedWire.waypoints.length > 0 && (
                  <button
                    type="button"
                    onClick={() => updateWire(selectedWire.id, { waypoints: undefined })}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/25 cursor-pointer"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Tự động định tuyến lại (Auto-route)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteWire(selectedWire.id)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/25 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa dây dẫn
                </button>
              </div>
            </>
          );
        })()}

        {/* PROJECT OVERVIEW (when nothing selected) */}
        {!isMultiSelect && !selectedElement && !selectedWire && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-center">
                <div className="font-mono text-lg font-bold text-sky-400">{elements.length}</div>
                <div className="text-[11px] text-slate-400">Linh kiện</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-center">
                <div className="font-mono text-lg font-bold text-amber-400">{wires.length}</div>
                <div className="text-[11px] text-slate-400">Dây nối</div>
              </div>
            </div>

            <div className="space-y-2.5 border-t border-slate-800 pt-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <FileText className="h-3.5 w-3.5 text-sky-400" />
                <span>Khung tên bản vẽ (Title Block)</span>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Tên dự án</label>
                <input
                  type="text"
                  value={titleBlock.projectName}
                  onChange={(e) => updateTitleBlock({ projectName: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Người vẽ</label>
                <input
                  type="text"
                  value={titleBlock.author}
                  onChange={(e) => updateTitleBlock({ author: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">Ngày vẽ</label>
                  <input
                    type="text"
                    value={titleBlock.date}
                    onChange={(e) => updateTitleBlock({ date: e.target.value })}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">Mã bản vẽ</label>
                  <input
                    type="text"
                    value={titleBlock.drawingNumber}
                    onChange={(e) => updateTitleBlock({ drawingNumber: e.target.value })}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Shortcuts Cheat Sheet */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-[11px] text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-300 mb-1">Phím tắt nhanh</div>
              <div className="flex justify-between">
                <span>Pan bản vẽ</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">
                  Space + Kéo
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Xoay linh kiện</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">R</kbd>
              </div>
              <div className="flex justify-between">
                <span>Sao chép / Dán</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">
                  Ctrl + C / V
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Nhân bản nhanh</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">
                  Ctrl + D
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Hoàn tác / Làm lại</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">
                  Ctrl + Z / Y
                </kbd>
              </div>
              <div className="flex justify-between">
                <span>Xóa đối tượng</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">
                  Delete
                </kbd>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
