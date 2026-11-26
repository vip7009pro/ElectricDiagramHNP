import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDiagramStore } from '../../store/useDiagramStore';
import type { CanvasElement } from '../../types/diagram';
import { type Point, snapValue } from '../../utils/geometry';
import { ElementNode } from './ElementNode';
import { WireLayer } from './WireLayer';

interface DiagramCanvasProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
}

interface MarqueeBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export const DiagramCanvas: React.FC<DiagramCanvasProps> = ({ svgRef }) => {
  const {
    elements,
    wires,
    selectedElementIds,
    selectedWireId,
    wiringFrom,
    wiringWaypoints,
    defaultWireColor,
    gridSize,
    showGrid,
    snapEnabled,
    viewport,
    isExporting,
    selectElement,
    toggleSelectElement,
    selectElements,
    selectAllElements,
    selectWire,
    clearSelection,
    pushHistory,
    moveElementsLive,
    rotateElements,
    duplicateElements,
    copySelectedElements,
    pasteClipboard,
    deleteElements,
    deleteWire,
    addElementFromTemplate,
    startWiring,
    addWiringWaypoint,
    popWiringWaypoint,
    completeWiring,
    completeWiringToWire,
    cancelWiring,
    updateWireWaypointsLive,
    setViewport,
    undo,
    redo,
  } = useDiagramStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [mouseWorldPos, setMouseWorldPos] = useState<Point | null>(null);
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);

  // Dragging one or multiple elements state
  const dragStateRef = useRef<{
    startMouseWorld: Point;
    items: { instanceId: string; origX: number; origY: number }[];
    historyPushed: boolean;
  } | null>(null);

  // Dragging wire segment state
  const wireDragRef = useRef<{
    wireId: string;
    points: Point[];
    segmentIndex: number;
    isHorizontal: boolean;
    historyPushed: boolean;
  } | null>(null);

  // Panning state
  const panStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    origViewportX: number;
    origViewportY: number;
  } | null>(null);

  const [isPanning, setIsPanning] = useState(false);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - viewport.x) / viewport.zoom,
        y: (clientY - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const isTypingInInput = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInInput(e.target)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setSpacePressed(true);
        return;
      }

      if (e.key === 'Escape') {
        if (wiringFrom) {
          cancelWiring();
        } else {
          clearSelection();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAllElements();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedElementIds.length > 0) {
          e.preventDefault();
          copySelectedElements();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteClipboard();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedElementIds.length > 0) {
          e.preventDefault();
          duplicateElements(selectedElementIds);
        }
        return;
      }

      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
        if (selectedElementIds.length > 0) {
          e.preventDefault();
          rotateElements(selectedElementIds);
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (wiringFrom && e.key === 'Backspace') {
          e.preventDefault();
          if (wiringWaypoints.length > 0) {
            popWiringWaypoint();
          } else {
            cancelWiring();
          }
          return;
        }
        if (selectedElementIds.length > 0) {
          e.preventDefault();
          deleteElements(selectedElementIds);
        } else if (selectedWireId) {
          e.preventDefault();
          deleteWire(selectedWireId);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    wiringFrom,
    wiringWaypoints.length,
    selectedElementIds,
    selectedWireId,
    cancelWiring,
    popWiringWaypoint,
    clearSelection,
    selectAllElements,
    undo,
    redo,
    duplicateElements,
    copySelectedElements,
    pasteClipboard,
    rotateElements,
    deleteElements,
    deleteWire,
  ]);

  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Middle click or Space + Left click => Pan
    if (e.button === 1 || (e.button === 0 && spacePressed)) {
      e.preventDefault();
      panStateRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        origViewportX: viewport.x,
        origViewportY: viewport.y,
      };
      setIsPanning(true);
      return;
    }

    // Left click on empty background => Place wiring waypoint OR start Marquee Selection
    if (e.button === 0) {
      if (wiringFrom) {
        const worldPt = clientToWorld(e.clientX, e.clientY);
        const snapped: Point = {
          x: snapValue(worldPt.x, gridSize, snapEnabled),
          y: snapValue(worldPt.y, gridSize, snapEnabled),
        };
        addWiringWaypoint(snapped);
        return;
      }
      if (!e.shiftKey) {
        clearSelection();
      }
      const worldPt = clientToWorld(e.clientX, e.clientY);
      setMarquee({
        startX: worldPt.x,
        startY: worldPt.y,
        currentX: worldPt.x,
        currentY: worldPt.y,
      });
    }
  };

  const handleMouseDownElement = (e: React.MouseEvent, element: CanvasElement) => {
    if (e.button === 1 || spacePressed) {
      return; // let canvas pan handle it
    }
    e.stopPropagation();
    if (wiringFrom) {
      cancelWiring();
      return;
    }

    let nextSelectedIds: string[];
    if (e.shiftKey) {
      toggleSelectElement(element.instanceId);
      const alreadyIn = selectedElementIds.includes(element.instanceId);
      nextSelectedIds = alreadyIn
        ? selectedElementIds.filter((id) => id !== element.instanceId)
        : [...selectedElementIds, element.instanceId];
    } else if (selectedElementIds.includes(element.instanceId)) {
      // Keep multi-selection intact when dragging one of the selected elements
      nextSelectedIds = selectedElementIds;
    } else {
      selectElement(element.instanceId);
      nextSelectedIds = [element.instanceId];
    }

    if (nextSelectedIds.length === 0) return;

    const worldPt = clientToWorld(e.clientX, e.clientY);
    const idSet = new Set(nextSelectedIds);
    const items = elements
      .filter((el) => idSet.has(el.instanceId))
      .map((el) => ({ instanceId: el.instanceId, origX: el.x, origY: el.y }));

    dragStateRef.current = {
      startMouseWorld: worldPt,
      items,
      historyPushed: false,
    };
  };

  const handlePinClick = (e: React.MouseEvent, elementId: string, pinId: string) => {
    e.stopPropagation();
    if (!wiringFrom) {
      startWiring(elementId, pinId);
    } else {
      completeWiring(elementId, pinId);
    }
  };

  const handleSelectWire = (e: React.MouseEvent, wireId: string) => {
    e.stopPropagation();
    if (wiringFrom) {
      return;
    }
    selectWire(wireId);
  };

  const handleMouseDownSegment = (
    e: React.MouseEvent,
    wireId: string,
    points: Point[],
    segmentIndex: number
  ) => {
    if (e.button !== 0 || spacePressed || wiringFrom) return;
    e.stopPropagation();
    selectWire(wireId);

    // Clone points and ensure start & end pins stay anchored if dragging first/last segment
    const working: Point[] = points.map((p) => ({ x: p.x, y: p.y }));
    let idx = segmentIndex;

    if (idx === 0) {
      working.unshift({ x: working[0].x, y: working[0].y });
      idx = 1;
    }
    if (idx === working.length - 2) {
      const last = working[working.length - 1];
      working.push({ x: last.x, y: last.y });
    }

    const a = working[idx];
    const b = working[idx + 1];
    const isHorizontal = Math.abs(a.y - b.y) < 0.5;

    wireDragRef.current = {
      wireId,
      points: working,
      segmentIndex: idx,
      isHorizontal,
      historyPushed: false,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    // Panning
    if (panStateRef.current) {
      const dx = e.clientX - panStateRef.current.startClientX;
      const dy = e.clientY - panStateRef.current.startClientY;
      setViewport({
        x: panStateRef.current.origViewportX + dx,
        y: panStateRef.current.origViewportY + dy,
      });
      return;
    }

    const worldPt = clientToWorld(e.clientX, e.clientY);
    const snappedMouse: Point = {
      x: snapValue(worldPt.x, gridSize, snapEnabled),
      y: snapValue(worldPt.y, gridSize, snapEnabled),
    };
    setMouseWorldPos(snappedMouse);

    // Dragging a wire segment orthogonally
    if (wireDragRef.current) {
      const drag = wireDragRef.current;
      if (!drag.historyPushed) {
        pushHistory();
        drag.historyPushed = true;
      }

      const nextPoints = drag.points.map((p) => ({ x: p.x, y: p.y }));
      if (drag.isHorizontal) {
        nextPoints[drag.segmentIndex].y = snappedMouse.y;
        nextPoints[drag.segmentIndex + 1].y = snappedMouse.y;
      } else {
        nextPoints[drag.segmentIndex].x = snappedMouse.x;
        nextPoints[drag.segmentIndex + 1].x = snappedMouse.x;
      }
      drag.points = nextPoints;

      // Save interior waypoints (excluding startPin and endPin)
      const interior = nextPoints.slice(1, -1);
      updateWireWaypointsLive(drag.wireId, interior);
      return;
    }

    // Marquee box selection update
    if (marquee) {
      setMarquee((prev) =>
        prev ? { ...prev, currentX: worldPt.x, currentY: worldPt.y } : null
      );
      return;
    }

    // Dragging element(s)
    if (dragStateRef.current) {
      const drag = dragStateRef.current;
      const rawDx = worldPt.x - drag.startMouseWorld.x;
      const rawDy = worldPt.y - drag.startMouseWorld.y;

      if (!drag.historyPushed && (Math.abs(rawDx) > 2 || Math.abs(rawDy) > 2)) {
        pushHistory();
        drag.historyPushed = true;
      }

      const snappedDx = snapValue(rawDx, gridSize, snapEnabled);
      const snappedDy = snapValue(rawDy, gridSize, snapEnabled);

      moveElementsLive(
        drag.items.map((item) => ({
          instanceId: item.instanceId,
          x: snapValue(item.origX + snappedDx, gridSize, snapEnabled),
          y: snapValue(item.origY + snappedDy, gridSize, snapEnabled),
        }))
      );
    }
  };

  const handleMouseUp = () => {
    // Finalize marquee selection
    if (marquee) {
      const minX = Math.min(marquee.startX, marquee.currentX);
      const maxX = Math.max(marquee.startX, marquee.currentX);
      const minY = Math.min(marquee.startY, marquee.currentY);
      const maxY = Math.max(marquee.startY, marquee.currentY);

      if (maxX - minX > 5 || maxY - minY > 5) {
        const hitIds = elements
          .filter((el) => {
            const elMinX = el.x;
            const elMinY = el.y;
            const elMaxX = el.x + el.width;
            const elMaxY = el.y + el.height;
            return elMaxX >= minX && elMinX <= maxX && elMaxY >= minY && elMinY <= maxY;
          })
          .map((el) => el.instanceId);

        if (hitIds.length > 0) {
          selectElements(hitIds);
        }
      }
      setMarquee(null);
    }

    dragStateRef.current = null;
    wireDragRef.current = null;
    if (panStateRef.current) {
      panStateRef.current = null;
      setIsPanning(false);
    }
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = Math.min(3, Math.max(0.25, Number((viewport.zoom * factor).toFixed(3))));
    const scaleRatio = nextZoom / viewport.zoom;

    setViewport({
      zoom: nextZoom,
      x: cursorX - (cursorX - viewport.x) * scaleRatio,
      y: cursorY - (cursorY - viewport.y) * scaleRatio,
    });
  };

  // Drag & Drop from LibrarySidebar
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const templateId = e.dataTransfer.getData('application/x-electrocad-template');
    if (!templateId) return;
    const worldPt = clientToWorld(e.clientX, e.clientY);
    addElementFromTemplate(templateId, worldPt.x, worldPt.y);
  };

  const majorGridSize = gridSize * 5;
  const selectedSet = new Set(selectedElementIds);

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative flex-1 h-full bg-white overflow-hidden"
    >
      <svg
        ref={svgRef}
        id="electrocad-svg-canvas"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full block ${
          isPanning
            ? 'cursor-grabbing'
            : spacePressed
              ? 'cursor-grab'
              : wiringFrom
                ? 'cursor-crosshair'
                : 'cursor-default'
        }`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => {
          if (wiringFrom) {
            e.preventDefault();
            cancelWiring();
          }
        }}
      >
        <defs>
          <pattern
            id="cad-minor-grid"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={0.75}
            />
          </pattern>
          <pattern
            id="cad-major-grid"
            width={majorGridSize}
            height={majorGridSize}
            patternUnits="userSpaceOnUse"
          >
            <rect width={majorGridSize} height={majorGridSize} fill="url(#cad-minor-grid)" />
            <path
              d={`M ${majorGridSize} 0 L 0 0 0 ${majorGridSize}`}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={1.1}
            />
          </pattern>
        </defs>

        {/* White paper background */}
        <rect x={0} y={0} width="100%" height="100%" fill="#ffffff" />

        {/* Transformed CAD World */}
        <g id="cad-world-group" transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
          {/* Infinite-feeling Grid Layer (hidden on export) */}
          {showGrid && !isExporting && (
            <rect
              x={-10000}
              y={-10000}
              width={20000}
              height={20000}
              fill="url(#cad-major-grid)"
              pointerEvents="none"
            />
          )}

          {/* Origin crosshairs (hidden on export) */}
          {showGrid && !isExporting && (
            <g pointerEvents="none" opacity={0.45}>
              <line x1={-20} y1={0} x2={20} y2={0} stroke="#64748b" strokeWidth={1.5} />
              <line x1={0} y1={-20} x2={0} y2={20} stroke="#64748b" strokeWidth={1.5} />
            </g>
          )}

          {/* Obstacle-avoiding Wires rendered cleanly behind pin hit-targets so multi-wiring on same pin works effortlessly */}
          <WireLayer
            elements={elements}
            wires={wires}
            selectedWireId={selectedWireId}
            isExporting={isExporting}
            wiringFrom={wiringFrom}
            wiringWaypoints={wiringWaypoints}
            mouseWorldPos={mouseWorldPos}
            defaultWireColor={defaultWireColor}
            onSelectWire={handleSelectWire}
            onMouseDownSegment={handleMouseDownSegment}
            onTapWire={(_e, wireId, junctionPoint) => {
              completeWiringToWire(wireId, junctionPoint);
            }}
          />

          {/* Electrical Elements */}
          {elements.map((el) => (
            <ElementNode
              key={el.instanceId}
              element={el}
              isSelected={selectedSet.has(el.instanceId)}
              isExporting={isExporting}
              wiringFrom={wiringFrom}
              onMouseDownElement={handleMouseDownElement}
              onPinClick={handlePinClick}
            />
          ))}

          {/* Marquee Selection Box */}
          {marquee && !isExporting && (
            <rect
              x={Math.min(marquee.startX, marquee.currentX)}
              y={Math.min(marquee.startY, marquee.currentY)}
              width={Math.abs(marquee.currentX - marquee.startX)}
              height={Math.abs(marquee.currentY - marquee.startY)}
              fill="rgba(37, 99, 235, 0.1)"
              stroke="#2563eb"
              strokeWidth={1.2 / viewport.zoom}
              strokeDasharray={`${5 / viewport.zoom} ${3 / viewport.zoom}`}
              pointerEvents="none"
            />
          )}
        </g>
      </svg>

      {/* Floating CAD Status HUD */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs text-slate-200 shadow-lg backdrop-blur">
        <span className="font-mono text-slate-300">
          X: {mouseWorldPos ? Math.round(mouseWorldPos.x) : 0} | Y:{' '}
          {mouseWorldPos ? Math.round(mouseWorldPos.y) : 0}
        </span>
        <span className="h-3 w-px bg-slate-700" />
        <span className="font-mono text-sky-400">{Math.round(viewport.zoom * 100)}%</span>
        {selectedElementIds.length > 1 && (
          <>
            <span className="h-3 w-px bg-slate-700" />
            <span className="font-semibold text-emerald-400">
              Đang chọn {selectedElementIds.length} linh kiện
            </span>
          </>
        )}
        <span className="h-3 w-px bg-slate-700" />
        <span className="text-slate-400">
          {wiringFrom
            ? 'Đang đi dây: Click nền để bẻ góc • Click chân đích hoặc click lên dây khác để nối nhánh • Backspace lùi • ESC hủy'
            : spacePressed
              ? 'Chế độ Pan: Kéo chuột để di chuyển khung nhìn'
              : 'Kéo đoạn dây để chỉnh đường đi • Kéo vùng trống để chọn nhiều • Space+Kéo để Pan'}
        </span>
      </div>
    </div>
  );
};
