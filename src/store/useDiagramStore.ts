import { create } from 'zustand';
import type {
  CanvasElement,
  DiagramProjectFile,
  DiagramSnapshot,
  ElementTemplate,
  Pin,
  RotationAngle,
  TitleBlockConfig,
  ViewportState,
  Wire,
  WirePoint,
} from '../types/diagram';
import {
  DEFAULT_TEMPLATES,
  INITIAL_ELEMENTS,
  INITIAL_WIRES,
} from '../data/defaultTemplates';
import { snapValue } from '../utils/geometry';

const STORAGE_KEY_TEMPLATES = 'electrocad_templates_v1';
const STORAGE_KEY_PROJECT = 'electrocad_project_v1';
const MAX_HISTORY = 50;

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function getTodayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}`;
}

function loadSavedTemplates(): ElementTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_TEMPLATES;
}

interface SavedProject {
  elements: CanvasElement[];
  wires: Wire[];
  titleBlock: TitleBlockConfig;
}

function loadSavedProject(): SavedProject {
  const defaultTitleBlock: TitleBlockConfig = {
    projectName: 'Tủ điều khiển PLC FX5U',
    author: 'Kỹ sư điện',
    date: getTodayDateString(),
    drawingNumber: 'EL-001',
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECT);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.elements) && Array.isArray(parsed.wires)) {
        return {
          elements: parsed.elements,
          wires: parsed.wires,
          titleBlock: { ...defaultTitleBlock, ...(parsed.titleBlock ?? {}) },
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return {
    elements: INITIAL_ELEMENTS,
    wires: INITIAL_WIRES,
    titleBlock: defaultTitleBlock,
  };
}

function persistTemplates(templates: ElementTemplate[]) {
  try {
    localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
  } catch {
    // ignore quota errors
  }
}

function persistProject(elements: CanvasElement[], wires: Wire[], titleBlock: TitleBlockConfig) {
  try {
    localStorage.setItem(
      STORAGE_KEY_PROJECT,
      JSON.stringify({ elements, wires, titleBlock })
    );
  } catch {
    // ignore quota errors
  }
}

export interface WiringAnchor {
  elementId: string;
  pinId: string;
}

interface DiagramStore {
  templates: ElementTemplate[];
  elements: CanvasElement[];
  wires: Wire[];
  titleBlock: TitleBlockConfig;

  // Selection & Interaction
  selectedElementIds: string[];
  selectedWireId: string | null;
  wiringFrom: WiringAnchor | null;
  wiringWaypoints: WirePoint[];
  defaultWireColor: string;
  clipboard: { elements: CanvasElement[]; wires: Wire[] } | null;
  pasteCount: number;

  // Canvas settings
  gridSize: 10 | 20;
  showGrid: boolean;
  snapEnabled: boolean;
  viewport: ViewportState;
  isExporting: boolean;

  // Undo / Redo
  past: DiagramSnapshot[];
  future: DiagramSnapshot[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Selection
  selectElement: (instanceId: string | null) => void;
  toggleSelectElement: (instanceId: string) => void;
  selectElements: (instanceIds: string[]) => void;
  selectAllElements: () => void;
  selectWire: (wireId: string | null) => void;
  clearSelection: () => void;

  // Templates
  addTemplate: (template: Omit<ElementTemplate, 'id'>) => ElementTemplate;
  updateTemplate: (id: string, updates: Partial<ElementTemplate>) => void;
  deleteTemplate: (id: string) => void;

  // Elements
  addElementFromTemplate: (templateId: string, x: number, y: number) => void;
  updateElement: (instanceId: string, updates: Partial<CanvasElement>, recordHistory?: boolean) => void;
  moveElementLive: (instanceId: string, x: number, y: number) => void;
  moveElementsLive: (updates: { instanceId: string; x: number; y: number }[]) => void;
  rotateElement: (instanceId: string, angle?: RotationAngle) => void;
  rotateElements: (instanceIds: string[], angle?: RotationAngle) => void;
  duplicateElement: (instanceId: string) => void;
  duplicateElements: (instanceIds: string[]) => void;
  copySelectedElements: () => void;
  pasteClipboard: () => void;
  deleteElement: (instanceId: string) => void;
  deleteElements: (instanceIds: string[]) => void;
  updateElementPins: (instanceId: string, pins: Pin[], width: number, height: number) => void;

  // Wiring
  startWiring: (elementId: string, pinId: string) => void;
  addWiringWaypoint: (point: WirePoint) => void;
  popWiringWaypoint: () => void;
  completeWiring: (toElementId: string, toPinId: string) => void;
  completeWiringToWire: (toWireId: string, junctionPoint: WirePoint) => void;
  cancelWiring: () => void;
  updateWire: (wireId: string, updates: Partial<Wire>) => void;
  updateWireWaypointsLive: (wireId: string, waypoints: WirePoint[] | undefined) => void;
  deleteWire: (wireId: string) => void;
  setDefaultWireColor: (color: string) => void;

  // Viewport & Grid
  setViewport: (viewport: Partial<ViewportState>) => void;
  setGridSize: (size: 10 | 20) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  setIsExporting: (value: boolean) => void;

  // Project & IO
  updateTitleBlock: (updates: Partial<TitleBlockConfig>) => void;
  clearCanvas: () => void;
  resetDemo: () => void;
  exportProjectData: () => DiagramProjectFile;
  importProjectData: (data: DiagramProjectFile) => void;
}

const initialProject = loadSavedProject();

function nextTagForPrefix(elements: CanvasElement[], prefix: string): string {
  const cleanPrefix = prefix.replace(/^-+/, '') || 'X';
  let maxNum = 0;
  const regex = new RegExp(`^-?${cleanPrefix}(\\d+)$`, 'i');
  for (const el of elements) {
    const match = el.tag.match(regex);
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
  }
  return `-${cleanPrefix}${maxNum + 1}`;
}

export const useDiagramStore = create<DiagramStore>((set, get) => ({
  templates: loadSavedTemplates(),
  elements: initialProject.elements,
  wires: initialProject.wires,
  titleBlock: initialProject.titleBlock,

  selectedElementIds: [],
  selectedWireId: null,
  wiringFrom: null,
  wiringWaypoints: [],
  defaultWireColor: '#dc2626',
  clipboard: null,
  pasteCount: 0,

  gridSize: 20,
  showGrid: true,
  snapEnabled: true,
  viewport: { x: 40, y: 40, zoom: 1 },
  isExporting: false,

  past: [],
  future: [],

  pushHistory: () => {
    const { elements, wires, past } = get();
    const snapshot: DiagramSnapshot = {
      elements: structuredClone(elements),
      wires: structuredClone(wires),
    };
    const nextPast = [...past, snapshot].slice(-MAX_HISTORY);
    set({ past: nextPast, future: [] });
  },

  undo: () => {
    const { past, future, elements, wires, titleBlock } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const current: DiagramSnapshot = {
      elements: structuredClone(elements),
      wires: structuredClone(wires),
    };
    set({
      elements: previous.elements,
      wires: previous.wires,
      past: past.slice(0, -1),
      future: [current, ...future].slice(0, MAX_HISTORY),
      selectedElementIds: [],
      selectedWireId: null,
      wiringFrom: null,
    });
    persistProject(previous.elements, previous.wires, titleBlock);
  },

  redo: () => {
    const { past, future, elements, wires, titleBlock } = get();
    if (future.length === 0) return;
    const next = future[0];
    const current: DiagramSnapshot = {
      elements: structuredClone(elements),
      wires: structuredClone(wires),
    };
    set({
      elements: next.elements,
      wires: next.wires,
      past: [...past, current].slice(-MAX_HISTORY),
      future: future.slice(1),
      selectedElementIds: [],
      selectedWireId: null,
      wiringFrom: null,
    });
    persistProject(next.elements, next.wires, titleBlock);
  },

  selectElement: (instanceId) =>
    set({ selectedElementIds: instanceId ? [instanceId] : [], selectedWireId: null }),

  toggleSelectElement: (instanceId) =>
    set((state) => {
      const exists = state.selectedElementIds.includes(instanceId);
      const next = exists
        ? state.selectedElementIds.filter((id) => id !== instanceId)
        : [...state.selectedElementIds, instanceId];
      return { selectedElementIds: next, selectedWireId: null };
    }),

  selectElements: (instanceIds) =>
    set({ selectedElementIds: instanceIds, selectedWireId: null }),

  selectAllElements: () =>
    set((state) => ({
      selectedElementIds: state.elements.map((e) => e.instanceId),
      selectedWireId: null,
    })),

  selectWire: (wireId) =>
    set({ selectedWireId: wireId, selectedElementIds: [] }),

  clearSelection: () =>
    set({ selectedElementIds: [], selectedWireId: null, wiringFrom: null }),

  addTemplate: (templateData) => {
    const newTemplate: ElementTemplate = {
      ...templateData,
      id: generateId('tpl'),
    };
    const nextTemplates = [...get().templates, newTemplate];
    set({ templates: nextTemplates });
    persistTemplates(nextTemplates);
    return newTemplate;
  },

  updateTemplate: (id, updates) => {
    const nextTemplates = get().templates.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    set({ templates: nextTemplates });
    persistTemplates(nextTemplates);
  },

  deleteTemplate: (id) => {
    const nextTemplates = get().templates.filter((t) => t.id !== id);
    set({ templates: nextTemplates });
    persistTemplates(nextTemplates);
  },

  addElementFromTemplate: (templateId, x, y) => {
    const { templates, elements, wires, gridSize, snapEnabled, titleBlock } = get();
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;

    get().pushHistory();
    const snappedX = snapValue(x - tpl.width / 2, gridSize, snapEnabled);
    const snappedY = snapValue(y - tpl.height / 2, gridSize, snapEnabled);

    const newElement: CanvasElement = {
      ...structuredClone(tpl),
      instanceId: generateId('el'),
      tag: nextTagForPrefix(elements, tpl.prefix),
      x: snappedX,
      y: snappedY,
      rotation: 0,
    };

    const nextElements = [...elements, newElement];
    set({
      elements: nextElements,
      selectedElementIds: [newElement.instanceId],
      selectedWireId: null,
    });
    persistProject(nextElements, wires, titleBlock);
  },

  updateElement: (instanceId, updates, recordHistory = true) => {
    if (recordHistory) get().pushHistory();
    const { elements, wires, titleBlock } = get();
    const nextElements = elements.map((el) =>
      el.instanceId === instanceId ? { ...el, ...updates } : el
    );
    set({ elements: nextElements });
    persistProject(nextElements, wires, titleBlock);
  },

  moveElementLive: (instanceId, x, y) => {
    const { elements, wires, titleBlock } = get();
    const nextElements = elements.map((el) =>
      el.instanceId === instanceId ? { ...el, x, y } : el
    );
    set({ elements: nextElements });
    persistProject(nextElements, wires, titleBlock);
  },

  moveElementsLive: (updates) => {
    const { elements, wires, titleBlock } = get();
    const map = new Map(updates.map((u) => [u.instanceId, u]));
    const nextElements = elements.map((el) => {
      const u = map.get(el.instanceId);
      return u ? { ...el, x: u.x, y: u.y } : el;
    });
    set({ elements: nextElements });
    persistProject(nextElements, wires, titleBlock);
  },

  rotateElement: (instanceId, angle) => {
    get().rotateElements([instanceId], angle);
  },

  rotateElements: (instanceIds, angle) => {
    if (instanceIds.length === 0) return;
    const { elements, wires, titleBlock } = get();
    const idSet = new Set(instanceIds);
    get().pushHistory();
    const nextElements = elements.map((el) => {
      if (!idSet.has(el.instanceId)) return el;
      const nextRotation = (
        angle !== undefined ? angle : ((el.rotation + 90) % 360)
      ) as RotationAngle;
      return { ...el, rotation: nextRotation };
    });
    set({ elements: nextElements });
    persistProject(nextElements, wires, titleBlock);
  },

  duplicateElement: (instanceId) => {
    get().duplicateElements([instanceId]);
  },

  duplicateElements: (instanceIds) => {
    if (instanceIds.length === 0) return;
    const { elements, wires, gridSize, titleBlock } = get();
    const idSet = new Set(instanceIds);
    const sources = elements.filter((el) => idSet.has(el.instanceId));
    if (sources.length === 0) return;

    get().pushHistory();
    const working = [...elements];
    const newIds: string[] = [];

    for (const source of sources) {
      const copy: CanvasElement = {
        ...structuredClone(source),
        instanceId: generateId('el'),
        tag: nextTagForPrefix(working, source.prefix),
        x: source.x + gridSize * 2,
        y: source.y + gridSize * 2,
      };
      working.push(copy);
      newIds.push(copy.instanceId);
    }

    set({
      elements: working,
      selectedElementIds: newIds,
      selectedWireId: null,
    });
    persistProject(working, wires, titleBlock);
  },

  copySelectedElements: () => {
    const { selectedElementIds, elements, wires } = get();
    if (selectedElementIds.length === 0) return;

    const idSet = new Set(selectedElementIds);
    const copiedElements = structuredClone(
      elements.filter((el) => idSet.has(el.instanceId))
    );
    const copiedWires = structuredClone(
      wires.filter((w) => idSet.has(w.fromElementId) && idSet.has(w.toElementId))
    );

    set({
      clipboard: { elements: copiedElements, wires: copiedWires },
      pasteCount: 0,
    });
  },

  pasteClipboard: () => {
    const { clipboard, pasteCount, elements, wires, gridSize, snapEnabled, titleBlock } = get();
    if (!clipboard || clipboard.elements.length === 0) return;

    get().pushHistory();
    const nextPasteCount = pasteCount + 1;
    const offset = gridSize * 2 * nextPasteCount;

    const workingElements = [...elements];
    const idMap = new Map<string, string>();
    const newIds: string[] = [];

    for (const src of clipboard.elements) {
      const newId = generateId('el');
      idMap.set(src.instanceId, newId);
      const pastedEl: CanvasElement = {
        ...structuredClone(src),
        instanceId: newId,
        tag: nextTagForPrefix(workingElements, src.prefix),
        x: snapValue(src.x + offset, gridSize, snapEnabled),
        y: snapValue(src.y + offset, gridSize, snapEnabled),
      };
      workingElements.push(pastedEl);
      newIds.push(newId);
    }

    const pastedWires: Wire[] = [];
    for (const w of clipboard.wires) {
      const newFrom = idMap.get(w.fromElementId);
      const newTo = idMap.get(w.toElementId);
      if (newFrom && newTo) {
        pastedWires.push({
          ...structuredClone(w),
          id: generateId('wire'),
          fromElementId: newFrom,
          toElementId: newTo,
        });
      }
    }

    const nextWires = [...wires, ...pastedWires];
    set({
      elements: workingElements,
      wires: nextWires,
      selectedElementIds: newIds,
      selectedWireId: null,
      pasteCount: nextPasteCount,
    });
    persistProject(workingElements, nextWires, titleBlock);
  },

  deleteElement: (instanceId) => {
    get().deleteElements([instanceId]);
  },

  deleteElements: (instanceIds) => {
    if (instanceIds.length === 0) return;
    const { elements, wires, titleBlock } = get();
    const idSet = new Set(instanceIds);
    if (!elements.some((el) => idSet.has(el.instanceId))) return;

    get().pushHistory();
    const nextElements = elements.filter((el) => !idSet.has(el.instanceId));
    const nextWires = wires.filter(
      (w) => !idSet.has(w.fromElementId) && !idSet.has(w.toElementId)
    );
    set({
      elements: nextElements,
      wires: nextWires,
      selectedElementIds: [],
      wiringFrom: null,
    });
    persistProject(nextElements, nextWires, titleBlock);
  },

  updateElementPins: (instanceId, pins, width, height) => {
    const { elements, wires, titleBlock } = get();
    get().pushHistory();
    const validPinIds = new Set(pins.map((p) => p.id));
    const nextElements = elements.map((el) =>
      el.instanceId === instanceId ? { ...el, pins, width, height } : el
    );
    const nextWires = wires.filter((w) => {
      if (w.fromElementId === instanceId && !validPinIds.has(w.fromPinId)) return false;
      if (w.toElementId === instanceId && !validPinIds.has(w.toPinId)) return false;
      return true;
    });
    set({ elements: nextElements, wires: nextWires });
    persistProject(nextElements, nextWires, titleBlock);
  },

  startWiring: (elementId, pinId) => {
    set({
      wiringFrom: { elementId, pinId },
      wiringWaypoints: [],
      selectedElementIds: [],
      selectedWireId: null,
    });
  },

  addWiringWaypoint: (point) => {
    set((state) => {
      if (!state.wiringFrom) return state;
      const last = state.wiringWaypoints[state.wiringWaypoints.length - 1];
      if (last && Math.hypot(last.x - point.x, last.y - point.y) < 1) {
        return state;
      }
      return { wiringWaypoints: [...state.wiringWaypoints, point] };
    });
  },

  popWiringWaypoint: () => {
    set((state) => {
      if (state.wiringWaypoints.length === 0) return state;
      return { wiringWaypoints: state.wiringWaypoints.slice(0, -1) };
    });
  },

  completeWiring: (toElementId, toPinId) => {
    const { wiringFrom, wiringWaypoints, wires, elements, defaultWireColor, titleBlock } = get();
    if (!wiringFrom) return;

    // Prevent self-connection to the exact same pin
    if (wiringFrom.elementId === toElementId && wiringFrom.pinId === toPinId) {
      set({ wiringFrom: null, wiringWaypoints: [] });
      return;
    }

    // Prevent duplicate identical wire
    const duplicate = wires.some(
      (w) =>
        (w.fromElementId === wiringFrom.elementId &&
          w.fromPinId === wiringFrom.pinId &&
          w.toElementId === toElementId &&
          w.toPinId === toPinId) ||
        (w.fromElementId === toElementId &&
          w.fromPinId === toPinId &&
          w.toElementId === wiringFrom.elementId &&
          w.toPinId === wiringFrom.pinId)
    );

    if (duplicate) {
      set({ wiringFrom: null, wiringWaypoints: [] });
      return;
    }

    get().pushHistory();
    const newWire: Wire = {
      id: generateId('wire'),
      fromElementId: wiringFrom.elementId,
      fromPinId: wiringFrom.pinId,
      toElementId,
      toPinId,
      color: defaultWireColor,
      strokeWidth: 2,
      lineStyle: 'solid',
      label: '',
      waypoints: wiringWaypoints.length > 0 ? structuredClone(wiringWaypoints) : undefined,
    };

    const nextWires = [...wires, newWire];
    set({
      wires: nextWires,
      wiringFrom: null,
      wiringWaypoints: [],
      selectedWireId: newWire.id,
      selectedElementIds: [],
    });
    persistProject(elements, nextWires, titleBlock);
  },

  completeWiringToWire: (toWireId, junctionPoint) => {
    const { wiringFrom, wiringWaypoints, wires, elements, defaultWireColor, titleBlock } = get();
    if (!wiringFrom) return;
    const targetWire = wires.find((w) => w.id === toWireId);
    if (!targetWire) {
      set({ wiringFrom: null, wiringWaypoints: [] });
      return;
    }

    get().pushHistory();
    const newWire: Wire = {
      id: generateId('wire'),
      fromElementId: wiringFrom.elementId,
      fromPinId: wiringFrom.pinId,
      toElementId: '',
      toPinId: '',
      toWireId,
      toPoint: { x: junctionPoint.x, y: junctionPoint.y },
      color: targetWire.color || defaultWireColor,
      strokeWidth: targetWire.strokeWidth ?? 2,
      lineStyle: targetWire.lineStyle ?? 'solid',
      label: '',
      waypoints: wiringWaypoints.length > 0 ? structuredClone(wiringWaypoints) : undefined,
    };

    const nextWires = [...wires, newWire];
    set({
      wires: nextWires,
      wiringFrom: null,
      wiringWaypoints: [],
      selectedWireId: newWire.id,
      selectedElementIds: [],
    });
    persistProject(elements, nextWires, titleBlock);
  },

  cancelWiring: () => set({ wiringFrom: null, wiringWaypoints: [] }),

  updateWire: (wireId, updates) => {
    get().pushHistory();
    const { elements, wires, titleBlock } = get();
    const nextWires = wires.map((w) => (w.id === wireId ? { ...w, ...updates } : w));
    set({ wires: nextWires });
    persistProject(elements, nextWires, titleBlock);
  },

  updateWireWaypointsLive: (wireId, waypoints) => {
    const { elements, wires, titleBlock } = get();
    const nextWires = wires.map((w) => (w.id === wireId ? { ...w, waypoints } : w));
    set({ wires: nextWires });
    persistProject(elements, nextWires, titleBlock);
  },

  deleteWire: (wireId) => {
    const { elements, wires, titleBlock } = get();
    if (!wires.some((w) => w.id === wireId)) return;

    get().pushHistory();
    // Cascade-delete any branch wires tapping into this deleted wire
    const toRemove = new Set<string>([wireId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const w of wires) {
        if (w.toWireId && toRemove.has(w.toWireId) && !toRemove.has(w.id)) {
          toRemove.add(w.id);
          changed = true;
        }
      }
    }
    const nextWires = wires.filter((w) => !toRemove.has(w.id));
    set({ wires: nextWires, selectedWireId: null });
    persistProject(elements, nextWires, titleBlock);
  },

  setDefaultWireColor: (color) => set({ defaultWireColor: color }),

  setViewport: (partial) =>
    set((state) => ({ viewport: { ...state.viewport, ...partial } })),

  setGridSize: (gridSize) => set({ gridSize }),

  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),

  setIsExporting: (isExporting) => set({ isExporting }),

  updateTitleBlock: (updates) => {
    const next = { ...get().titleBlock, ...updates };
    set({ titleBlock: next });
    persistProject(get().elements, get().wires, next);
  },

  clearCanvas: () => {
    get().pushHistory();
    const { titleBlock } = get();
    set({
      elements: [],
      wires: [],
      selectedElementIds: [],
      selectedWireId: null,
      wiringFrom: null,
    });
    persistProject([], [], titleBlock);
  },

  resetDemo: () => {
    get().pushHistory();
    const { titleBlock } = get();
    const demoEls = structuredClone(INITIAL_ELEMENTS);
    const demoWires = structuredClone(INITIAL_WIRES);
    set({
      elements: demoEls,
      wires: demoWires,
      selectedElementIds: [],
      selectedWireId: null,
      wiringFrom: null,
      viewport: { x: 40, y: 40, zoom: 1 },
    });
    persistProject(demoEls, demoWires, titleBlock);
  },

  exportProjectData: () => {
    const { titleBlock, templates, elements, wires } = get();
    return {
      version: '1.0',
      titleBlock,
      templates,
      elements,
      wires,
    };
  },

  importProjectData: (data) => {
    if (!Array.isArray(data.elements) || !Array.isArray(data.wires)) {
      throw new Error('File JSON không hợp lệ (thiếu elements hoặc wires).');
    }
    get().pushHistory();
    const nextTemplates =
      Array.isArray(data.templates) && data.templates.length > 0
        ? data.templates
        : get().templates;
    const nextTitleBlock = data.titleBlock
      ? { ...get().titleBlock, ...data.titleBlock }
      : get().titleBlock;

    set({
      templates: nextTemplates,
      elements: data.elements,
      wires: data.wires,
      titleBlock: nextTitleBlock,
      selectedElementIds: [],
      selectedWireId: null,
      wiringFrom: null,
    });
    persistTemplates(nextTemplates);
    persistProject(data.elements, data.wires, nextTitleBlock);
  },
}));
