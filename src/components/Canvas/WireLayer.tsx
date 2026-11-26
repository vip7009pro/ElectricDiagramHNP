import React, { useMemo, useState } from 'react';
import type { CanvasElement, Wire, WirePoint } from '../../types/diagram';
import {
  type Point,
  getPinWorldPosition,
  getWireLabelPosition,
  pointsToSvgPath,
} from '../../utils/geometry';
import {
  buildStepWiringPreview,
  projectPointOntoPolyline,
  routeAllWires,
} from '../../utils/routing';

interface WireLayerProps {
  elements: CanvasElement[];
  wires: Wire[];
  selectedWireId: string | null;
  isExporting: boolean;
  wiringFrom: { elementId: string; pinId: string } | null;
  wiringWaypoints: WirePoint[];
  mouseWorldPos: Point | null;
  defaultWireColor: string;
  onSelectWire: (e: React.MouseEvent, wireId: string) => void;
  onMouseDownSegment: (
    e: React.MouseEvent,
    wireId: string,
    points: Point[],
    segmentIndex: number
  ) => void;
  onTapWire: (e: React.MouseEvent, wireId: string, junctionPoint: Point) => void;
}

export const WireLayer: React.FC<WireLayerProps> = ({
  elements,
  wires,
  selectedWireId,
  isExporting,
  wiringFrom,
  wiringWaypoints,
  mouseWorldPos,
  defaultWireColor,
  onSelectWire,
  onMouseDownSegment,
  onTapWire,
}) => {
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);

  // Compute obstacle-avoiding, manual, and junction orthogonal routes for all wires
  const routedWires = useMemo(() => routeAllWires(elements, wires), [elements, wires]);

  // If hovering a wire while wiring, compute the exact projected tap point on that wire
  const tapPreview = useMemo(() => {
    if (!wiringFrom || !hoveredWireId || !mouseWorldPos || isExporting) return null;
    const target = routedWires.find((r) => r.wire.id === hoveredWireId);
    if (!target) return null;
    const { point } = projectPointOntoPolyline(mouseWorldPos, target.points);
    return { wireId: target.wire.id, point, color: target.wire.color };
  }, [wiringFrom, hoveredWireId, mouseWorldPos, isExporting, routedWires]);

  // Step-by-step orthogonal preview wire while actively wiring
  let previewPath = '';
  const previewTargetPos = tapPreview ? tapPreview.point : mouseWorldPos;
  if (wiringFrom && previewTargetPos && !isExporting) {
    const startEl = elements.find((el) => el.instanceId === wiringFrom.elementId);
    const startPin = startEl?.pins.find((p) => p.id === wiringFrom.pinId);
    if (startEl && startPin) {
      const startPos = getPinWorldPosition(startEl, startPin);
      const pts = buildStepWiringPreview(
        { x: startPos.x, y: startPos.y },
        { dx: startPos.dx, dy: startPos.dy },
        wiringWaypoints,
        previewTargetPos
      );
      previewPath = pointsToSvgPath(pts);
    }
  }

  return (
    <g>
      {routedWires.map(({ wire, points, startPos, endPos, hasEndJunction }) => {
        const d = pointsToSvgPath(points);
        const labelPos = getWireLabelPosition(points);
        const isSelected = selectedWireId === wire.id;
        const strokeWidth = wire.strokeWidth ?? 2;
        const dashArray = wire.lineStyle === 'dashed' ? '7 4' : undefined;

        return (
          <g key={wire.id}>
            {/* Selection glow */}
            {isSelected && !isExporting && (
              <path
                d={d}
                fill="none"
                stroke="#3b82f6"
                strokeOpacity={0.35}
                strokeWidth={strokeWidth + 6}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            )}

            {/* White halo outline so crossing wires remain visually distinct */}
            <path
              d={d}
              fill="none"
              stroke="#ffffff"
              strokeWidth={strokeWidth + 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />

            {/* Actual electrical wire */}
            <path
              d={d}
              fill="none"
              stroke={wire.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />

            {/* Per-segment interactive drag, select, and tap-to-junction hit targets */}
            {!isExporting &&
              points.slice(0, -1).map((a, idx) => {
                const b = points[idx + 1];
                const len = Math.hypot(b.x - a.x, b.y - a.y);
                if (len < 2) return null;

                const isHorizontal = Math.abs(a.y - b.y) < 0.5;
                const midX = (a.x + b.x) / 2;
                const midY = (a.y + b.y) / 2;

                return (
                  <g key={idx}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="transparent"
                      strokeWidth={14}
                      className={
                        wiringFrom
                          ? 'cursor-crosshair'
                          : isHorizontal
                            ? 'cursor-ns-resize'
                            : 'cursor-ew-resize'
                      }
                      onMouseEnter={() => {
                        if (wiringFrom) setHoveredWireId(wire.id);
                      }}
                      onMouseLeave={() => {
                        if (hoveredWireId === wire.id) setHoveredWireId(null);
                      }}
                      onMouseDown={(e) => {
                        if (wiringFrom) {
                          e.stopPropagation();
                          const targetPt = mouseWorldPos
                            ? projectPointOntoPolyline(mouseWorldPos, points).point
                            : { x: midX, y: midY };
                          setHoveredWireId(null);
                          onTapWire(e, wire.id, targetPt);
                          return;
                        }
                        onMouseDownSegment(e, wire.id, points, idx);
                      }}
                      onClick={(e) => {
                        if (wiringFrom) {
                          e.stopPropagation();
                          return;
                        }
                        onSelectWire(e, wire.id);
                      }}
                    />

                    {/* Visible drag handle pill on selected wire segments */}
                    {isSelected && len >= 18 && (
                      <rect
                        x={midX - (isHorizontal ? 7 : 3)}
                        y={midY - (isHorizontal ? 3 : 7)}
                        width={isHorizontal ? 14 : 6}
                        height={isHorizontal ? 6 : 14}
                        rx={3}
                        fill="#ffffff"
                        stroke="#2563eb"
                        strokeWidth={1.5}
                        pointerEvents="none"
                      />
                    )}
                  </g>
                );
              })}

            {/* Pin terminal dots */}
            <circle
              cx={startPos.x}
              cy={startPos.y}
              r={3}
              fill={wire.color}
              pointerEvents="none"
            />
            {!hasEndJunction && (
              <circle
                cx={endPos.x}
                cy={endPos.y}
                r={3}
                fill={wire.color}
                pointerEvents="none"
              />
            )}

            {/* Wire Label Badge */}
            {wire.label && wire.label.trim().length > 0 && (
              <g
                transform={`translate(${labelPos.x}, ${labelPos.y})`}
                className="cursor-pointer"
                onClick={(e) => onSelectWire(e, wire.id)}
              >
                <rect
                  x={-(wire.label.length * 3.6 + 6)}
                  y={-9}
                  width={wire.label.length * 7.2 + 12}
                  height={18}
                  rx={3}
                  fill="#ffffff"
                  stroke={isSelected && !isExporting ? '#2563eb' : wire.color}
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9.5}
                  fontWeight={700}
                  fill={wire.color}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                >
                  {wire.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Prominent Electrical Junction Dots (rendered above all wire strokes/halos) */}
      <g pointerEvents="none">
        {routedWires.map(({ wire, endPos, hasEndJunction }) => {
          if (!hasEndJunction) return null;
          return (
            <g key={`junc-${wire.id}`}>
              <circle
                cx={endPos.x}
                cy={endPos.y}
                r={6.5}
                fill="#ffffff"
              />
              <circle
                cx={endPos.x}
                cy={endPos.y}
                r={5.2}
                fill={wire.color}
              />
            </g>
          );
        })}
      </g>

      {/* Live Step-by-Step Preview Wire, Waypoint Dots & Tap-Junction Preview */}
      {previewPath && (
        <g pointerEvents="none">
          <path
            d={previewPath}
            fill="none"
            stroke={tapPreview ? tapPreview.color : defaultWireColor}
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
          {wiringWaypoints.map((wp, idx) => (
            <circle
              key={idx}
              cx={wp.x}
              cy={wp.y}
              r={4}
              fill="#ffffff"
              stroke={defaultWireColor}
              strokeWidth={2}
            />
          ))}
          {tapPreview && (
            <g>
              <circle
                cx={tapPreview.point.x}
                cy={tapPreview.point.y}
                r={9.5}
                fill="rgba(22, 163, 74, 0.25)"
                stroke="#16a34a"
                strokeWidth={1.5}
              />
              <circle
                cx={tapPreview.point.x}
                cy={tapPreview.point.y}
                r={5.2}
                fill={tapPreview.color}
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            </g>
          )}
        </g>
      )}
    </g>
  );
};
