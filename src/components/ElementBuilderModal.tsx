import React, { useRef, useState } from 'react';
import { Layers, Plus, Save, Trash2, X } from 'lucide-react';
import type { CanvasElement, ElementTemplate, Pin, PinSide } from '../types/diagram';
import { PIN_STUB_LENGTH } from '../utils/geometry';

export type BuilderMode =
  | { type: 'create' }
  | { type: 'duplicate-template'; template: ElementTemplate }
  | { type: 'edit-template'; template: ElementTemplate }
  | { type: 'edit-instance'; element: CanvasElement };

interface ElementBuilderModalProps {
  mode: BuilderMode;
  onClose: () => void;
  onSaveTemplate: (data: Omit<ElementTemplate, 'id'>, editId?: string) => void;
  onSaveInstancePins: (instanceId: string, pins: Pin[], width: number, height: number) => void;
}

const SIDES: { value: PinSide; label: string }[] = [
  { value: 'top', label: 'Trên (Top)' },
  { value: 'bottom', label: 'Dưới (Bottom)' },
  { value: 'left', label: 'Trái (Left)' },
  { value: 'right', label: 'Phải (Right)' },
];

export const ElementBuilderModal: React.FC<ElementBuilderModalProps> = ({
  mode,
  onClose,
  onSaveTemplate,
  onSaveInstancePins,
}) => {
  const initialSource =
    mode.type === 'edit-template' || mode.type === 'duplicate-template'
      ? mode.template
      : mode.type === 'edit-instance'
        ? mode.element
        : null;

  const [name, setName] = useState(
    mode.type === 'duplicate-template'
      ? `${mode.template.name} (Copy)`
      : (initialSource?.name ?? 'PLC Module 8-CH')
  );
  const [prefix, setPrefix] = useState(initialSource?.prefix ?? 'A');
  const [widthStr, setWidthStr] = useState(String(initialSource?.width ?? 220));
  const [heightStr, setHeightStr] = useState(String(initialSource?.height ?? 140));
  const [borderColor, setBorderColor] = useState(initialSource?.borderColor ?? '#0f172a');
  const [fillColor, setFillColor] = useState(initialSource?.fillColor ?? '#f8fafc');

  const clampDim = (val: number, fallback: number) =>
    Number.isFinite(val) && val > 0 ? Math.min(1200, Math.max(20, Math.round(val))) : fallback;

  const width = clampDim(Number(widthStr), 220);
  const height = clampDim(Number(heightStr), 140);
  const [pins, setPins] = useState<Pin[]>(() => {
    if (!initialSource) return [];
    const cloned = structuredClone(initialSource.pins);
    if (mode.type === 'duplicate-template') {
      return cloned.map((p, idx) => ({
        ...p,
        id: `pin-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      }));
    }
    return cloned;
  });

  // Batch generator state (stored as strings so typing never jumps)
  const [batchCountStr, setBatchCountStr] = useState('8');
  const [batchPrefix, setBatchPrefix] = useState('X');
  const [batchStartIndexStr, setBatchStartIndexStr] = useState('0');
  const [batchSide, setBatchSide] = useState<PinSide>('top');
  const [batchStartOffsetStr, setBatchStartOffsetStr] = useState('20');
  const [batchSpacingStr, setBatchSpacingStr] = useState('25');

  const batchCount = Math.max(1, Math.min(64, Number(batchCountStr) || 1));
  const batchStartIndex = Number.isFinite(Number(batchStartIndexStr))
    ? Number(batchStartIndexStr)
    : 0;
  const batchStartOffset = Math.max(0, Number(batchStartOffsetStr) || 0);
  const batchSpacing = Math.max(5, Number(batchSpacingStr) || 20);

  // Interactive pin dragging in preview
  const previewSvgRef = useRef<SVGSVGElement>(null);
  const [draggingPinId, setDraggingPinId] = useState<string | null>(null);

  const handleGenerateBatch = () => {
    const count = Math.max(1, Math.min(64, batchCount));
    const maxEdge = batchSide === 'top' || batchSide === 'bottom' ? width : height;
    const generated: Pin[] = [];

    for (let i = 0; i < count; i++) {
      const rawOffset = batchStartOffset + i * batchSpacing;
      generated.push({
        id: `pin-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 5)}`,
        name: `${batchPrefix}${batchStartIndex + i}`,
        side: batchSide,
        offset: Math.min(maxEdge - 10, Math.max(10, rawOffset)),
      });
    }

    // Auto-expand block edge if needed so pins fit nicely
    const requiredEdge = batchStartOffset + (count - 1) * batchSpacing + 20;
    if ((batchSide === 'top' || batchSide === 'bottom') && requiredEdge > width) {
      setWidthStr(String(Math.ceil(requiredEdge / 20) * 20));
      generated.forEach((p, idx) => {
        p.offset = batchStartOffset + idx * batchSpacing;
      });
    } else if ((batchSide === 'left' || batchSide === 'right') && requiredEdge > height) {
      setHeightStr(String(Math.ceil(requiredEdge / 20) * 20));
      generated.forEach((p, idx) => {
        p.offset = batchStartOffset + idx * batchSpacing;
      });
    }

    setPins((prev) => [...prev, ...generated]);
  };

  const handleAddSinglePin = () => {
    const idx = pins.length + 1;
    setPins((prev) => [
      ...prev,
      {
        id: `pin-${Date.now().toString(36)}-${idx}`,
        name: `P${idx}`,
        side: 'bottom',
        offset: Math.min(width - 20, 20 + ((idx - 1) % 6) * 30),
      },
    ]);
  };

  const updatePin = (id: string, updates: Partial<Pin>) => {
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const removePin = (id: string) => {
    setPins((prev) => prev.filter((p) => p.id !== id));
  };

  const handlePreviewMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingPinId || !previewSvgRef.current) return;
    const pin = pins.find((p) => p.id === draggingPinId);
    if (!pin) return;

    const svg = previewSvgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const localPt = pt.matrixTransform(ctm.inverse());

    const isHorizontalEdge = pin.side === 'top' || pin.side === 'bottom';
    const rawCoord = isHorizontalEdge ? localPt.x : localPt.y;
    const maxLen = isHorizontalEdge ? width : height;
    const snapped = Math.round(rawCoord / 5) * 5;
    const clamped = Math.max(10, Math.min(maxLen - 10, snapped));

    updatePin(pin.id, { offset: clamped });
  };

  const handleSave = () => {
    if (mode.type === 'edit-instance') {
      onSaveInstancePins(mode.element.instanceId, pins, width, height);
    } else {
      onSaveTemplate(
        {
          name: name.trim() || 'Linh kiện mới',
          prefix: prefix.trim().replace(/^-+/, '') || 'X',
          width: Math.max(20, width),
          height: Math.max(20, height),
          borderColor,
          fillColor,
          pins,
        },
        mode.type === 'edit-template' ? mode.template.id : undefined
      );
    }
    onClose();
  };

  const pad = 50;
  const vbWidth = width + pad * 2;
  const vbHeight = height + pad * 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-white">
              {mode.type === 'create'
                ? 'Trình tạo linh kiện mới (Element Builder)'
                : mode.type === 'duplicate-template'
                  ? `Tạo bản sao từ: ${mode.template.name}`
                  : mode.type === 'edit-template'
                    ? `Chỉnh sửa mẫu: ${mode.template.name}`
                    : `Chỉnh sửa chân thiết bị: ${mode.element.tag}`}
            </h2>
            <p className="text-xs text-slate-400">
              Thiết kế khung linh kiện, sinh chân hàng loạt và kéo thả chân trực tiếp trên bản xem trước.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body: Left Controls + Right Live Preview */}
        <div className="grid flex-1 grid-cols-12 overflow-hidden">
          {/* Left Form Column */}
          <div className="col-span-6 flex flex-col overflow-y-auto border-r border-slate-800 p-4 space-y-4">
            {/* Block Config */}
            <div className="space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                1. Cấu hình khung khối
              </div>
              {mode.type !== 'edit-instance' && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="mb-1 block text-[11px] text-slate-400">Tên linh kiện</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="VD: PLC FX5U-32MT"
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-slate-400">Ký hiệu (-)</label>
                    <input
                      type="text"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      placeholder="A, K, PLC"
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">Rộng (px)</label>
                  <input
                    type="number"
                    step={10}
                    min={20}
                    max={1200}
                    value={widthStr}
                    onChange={(e) => setWidthStr(e.target.value)}
                    onBlur={() => setWidthStr(String(width))}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">Cao (px)</label>
                  <input
                    type="number"
                    step={10}
                    min={20}
                    max={1200}
                    value={heightStr}
                    onChange={(e) => setHeightStr(e.target.value)}
                    onBlur={() => setHeightStr(String(height))}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs outline-none focus:border-sky-500"
                  />
                </div>
                {mode.type !== 'edit-instance' && (
                  <>
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">Viền</label>
                      <input
                        type="color"
                        value={borderColor}
                        onChange={(e) => setBorderColor(e.target.value)}
                        className="h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-950 p-0.5"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-slate-400">Nền</label>
                      <input
                        type="color"
                        value={fillColor}
                        onChange={(e) => setFillColor(e.target.value)}
                        className="h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-950 p-0.5"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Batch Pin Generator */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <Layers className="h-3.5 w-3.5" />
                <span>2. Thêm chân hàng loạt (Batch Generator)</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] text-slate-400">Số lượng chân</label>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={batchCountStr}
                    onChange={(e) => setBatchCountStr(e.target.value)}
                    onBlur={() => setBatchCountStr(String(batchCount))}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-slate-400">Tiền tố (VD: X, Y)</label>
                  <input
                    type="text"
                    value={batchPrefix}
                    onChange={(e) => setBatchPrefix(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-slate-400">Bắt đầu từ số</label>
                  <input
                    type="number"
                    value={batchStartIndexStr}
                    onChange={(e) => setBatchStartIndexStr(e.target.value)}
                    onBlur={() => setBatchStartIndexStr(String(batchStartIndex))}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] text-slate-400">Cạnh đặt chân</label>
                  <select
                    value={batchSide}
                    onChange={(e) => setBatchSide(e.target.value as PinSide)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                  >
                    {SIDES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-slate-400">Vị trí đầu (px)</label>
                  <input
                    type="number"
                    step={5}
                    value={batchStartOffsetStr}
                    onChange={(e) => setBatchStartOffsetStr(e.target.value)}
                    onBlur={() => setBatchStartOffsetStr(String(batchStartOffset))}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-slate-400">Khoảng cách (px)</label>
                  <input
                    type="number"
                    step={5}
                    min={5}
                    value={batchSpacingStr}
                    onChange={(e) => setBatchSpacingStr(e.target.value)}
                    onBlur={() => setBatchSpacingStr(String(batchSpacing))}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateBatch}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-amber-600/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Tự sinh {batchCount} chân ({batchPrefix}
                {batchStartIndex}..{batchPrefix}
                {batchStartIndex + Math.max(1, batchCount) - 1})
              </button>
            </div>

            {/* Individual Pins List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                  3. Danh sách chân ({pins.length})
                </span>
                <div className="flex items-center gap-1.5">
                  {pins.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPins([])}
                      className="rounded px-2 py-1 text-[11px] text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                    >
                      Xóa hết
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddSinglePin}
                    className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Thêm 1 chân
                  </button>
                </div>
              </div>

              <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                {pins.map((pin) => (
                  <div
                    key={pin.id}
                    className="grid grid-cols-12 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1.5"
                  >
                    <input
                      type="text"
                      value={pin.name}
                      onChange={(e) => updatePin(pin.id, { name: e.target.value })}
                      className="col-span-4 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 font-mono text-xs"
                    />
                    <select
                      value={pin.side}
                      onChange={(e) => updatePin(pin.id, { side: e.target.value as PinSide })}
                      className="col-span-4 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-xs"
                    >
                      {SIDES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step={5}
                      value={pin.offset}
                      onChange={(e) =>
                        updatePin(pin.id, { offset: Math.max(0, Number(e.target.value) || 0) })
                      }
                      title="Vị trí dọc theo cạnh (px)"
                      className="col-span-3 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => removePin(pin.id)}
                      className="col-span-1 flex justify-center text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {pins.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-800 py-5 text-center text-xs text-slate-500">
                    Chưa có chân nào. Dùng trình sinh hàng loạt hoặc bấm &quot;Thêm 1 chân&quot;.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Live Interactive SVG Preview */}
          <div className="col-span-6 flex flex-col bg-slate-950 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Xem trước trực quan (Kéo thả đầu chân để chỉnh vị trí)
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                {width} × {height} px
              </span>
            </div>

            <div className="flex flex-1 items-center justify-center rounded-lg border border-slate-800 bg-white overflow-hidden">
              <svg
                ref={previewSvgRef}
                viewBox={`${-pad} ${-pad} ${vbWidth} ${vbHeight}`}
                className="h-full w-full max-h-[520px] select-none"
                onMouseMove={handlePreviewMouseMove}
                onMouseUp={() => setDraggingPinId(null)}
                onMouseLeave={() => setDraggingPinId(null)}
              >
                <defs>
                  <pattern
                    id="builder-grid"
                    width={20}
                    height={20}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 20 0 L 0 0 0 20"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth={0.8}
                    />
                  </pattern>
                </defs>
                <rect
                  x={-pad}
                  y={-pad}
                  width={vbWidth}
                  height={vbHeight}
                  fill="url(#builder-grid)"
                />

                {/* Element Body */}
                <rect
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  rx={4}
                  fill={fillColor}
                  stroke={borderColor}
                  strokeWidth={2}
                />

                <text
                  x={width / 2}
                  y={height / 2 - 7}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill={borderColor}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  -{prefix || 'X'}1
                </text>
                <text
                  x={width / 2}
                  y={height / 2 + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10.5}
                  fill="#475569"
                >
                  {name}
                </text>

                {/* Draggable Pins */}
                {pins.map((pin) => {
                  let x1 = 0,
                    y1 = 0,
                    x2 = 0,
                    y2 = 0,
                    lx = 0,
                    ly = 0;
                  let anchor: 'start' | 'middle' | 'end' = 'middle';

                  if (pin.side === 'top') {
                    x1 = pin.offset;
                    y1 = 0;
                    x2 = pin.offset;
                    y2 = -PIN_STUB_LENGTH;
                    lx = pin.offset;
                    ly = 13;
                    anchor = 'middle';
                  } else if (pin.side === 'bottom') {
                    x1 = pin.offset;
                    y1 = height;
                    x2 = pin.offset;
                    y2 = height + PIN_STUB_LENGTH;
                    lx = pin.offset;
                    ly = height - 11;
                    anchor = 'middle';
                  } else if (pin.side === 'left') {
                    x1 = 0;
                    y1 = pin.offset;
                    x2 = -PIN_STUB_LENGTH;
                    y2 = pin.offset;
                    lx = 8;
                    ly = pin.offset;
                    anchor = 'start';
                  } else {
                    x1 = width;
                    y1 = pin.offset;
                    x2 = width + PIN_STUB_LENGTH;
                    y2 = pin.offset;
                    lx = width - 8;
                    ly = pin.offset;
                    anchor = 'end';
                  }

                  const isDragging = draggingPinId === pin.id;

                  return (
                    <g key={pin.id}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={isDragging ? '#2563eb' : borderColor}
                        strokeWidth={2}
                      />
                      <text
                        x={lx}
                        y={ly}
                        textAnchor={anchor}
                        dominantBaseline="middle"
                        fontSize={9}
                        fontWeight={600}
                        fill="#334155"
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                        pointerEvents="none"
                      >
                        {pin.name}
                      </text>
                      <circle
                        cx={x2}
                        cy={y2}
                        r={isDragging ? 6 : 4.5}
                        fill={isDragging ? '#2563eb' : '#ffffff'}
                        stroke={isDragging ? '#2563eb' : borderColor}
                        strokeWidth={2}
                        className={
                          pin.side === 'top' || pin.side === 'bottom'
                            ? 'cursor-ew-resize'
                            : 'cursor-ns-resize'
                        }
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDraggingPinId(pin.id);
                        }}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            {mode.type === 'create'
              ? 'Lưu vào thư viện'
              : mode.type === 'duplicate-template'
                ? 'Lưu thành mẫu mới'
                : mode.type === 'edit-template'
                  ? 'Cập nhật mẫu'
                  : 'Lưu thay đổi chân'}
          </button>
        </div>
      </div>
    </div>
  );
};
