import React, { useState } from 'react';
import type { CanvasElement, Pin } from '../../types/diagram';
import { PIN_STUB_LENGTH } from '../../utils/geometry';

interface ElementNodeProps {
  element: CanvasElement;
  isSelected: boolean;
  isExporting: boolean;
  wiringFrom: { elementId: string; pinId: string } | null;
  onMouseDownElement: (e: React.MouseEvent, element: CanvasElement) => void;
  onPinClick: (e: React.MouseEvent, elementId: string, pinId: string) => void;
}

function getPinGeometry(width: number, height: number, pin: Pin) {
  switch (pin.side) {
    case 'top':
      return {
        x1: pin.offset,
        y1: 0,
        x2: pin.offset,
        y2: -PIN_STUB_LENGTH,
        labelX: pin.offset,
        labelY: 13,
        textAnchor: 'middle' as const,
        baseline: 'middle' as const,
      };
    case 'bottom':
      return {
        x1: pin.offset,
        y1: height,
        x2: pin.offset,
        y2: height + PIN_STUB_LENGTH,
        labelX: pin.offset,
        labelY: height - 11,
        textAnchor: 'middle' as const,
        baseline: 'middle' as const,
      };
    case 'left':
      return {
        x1: 0,
        y1: pin.offset,
        x2: -PIN_STUB_LENGTH,
        y2: pin.offset,
        labelX: 8,
        labelY: pin.offset,
        textAnchor: 'start' as const,
        baseline: 'middle' as const,
      };
    case 'right':
      return {
        x1: width,
        y1: pin.offset,
        x2: width + PIN_STUB_LENGTH,
        y2: pin.offset,
        labelX: width - 8,
        labelY: pin.offset,
        textAnchor: 'end' as const,
        baseline: 'middle' as const,
      };
  }
}

export const ElementNode: React.FC<ElementNodeProps> = ({
  element,
  isSelected,
  isExporting,
  wiringFrom,
  onMouseDownElement,
  onPinClick,
}) => {
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);

  const cx = element.width / 2;
  const cy = element.height / 2;
  const borderColor = element.borderColor || '#0f172a';
  const fillColor = element.fillColor || '#f8fafc';

  return (
    <g
      transform={`translate(${element.x}, ${element.y}) rotate(${element.rotation}, ${cx}, ${cy})`}
      className="cursor-move"
    >
      {/* Selection highlight (hidden on export) */}
      {isSelected && !isExporting && (
        <rect
          x={-6}
          y={-6}
          width={element.width + 12}
          height={element.height + 12}
          rx={6}
          fill="rgba(59, 130, 246, 0.08)"
          stroke="#2563eb"
          strokeWidth={1.5}
          strokeDasharray="5 3"
          pointerEvents="none"
        />
      )}

      {/* Element Body */}
      <rect
        x={0}
        y={0}
        width={element.width}
        height={element.height}
        rx={4}
        fill={fillColor}
        stroke={borderColor}
        strokeWidth={2}
        onMouseDown={(e) => onMouseDownElement(e, element)}
      />

      {/* Inner technical border accent */}
      <rect
        x={3}
        y={3}
        width={Math.max(0, element.width - 6)}
        height={Math.max(0, element.height - 6)}
        rx={2}
        fill="none"
        stroke={borderColor}
        strokeOpacity={0.18}
        strokeWidth={1}
        pointerEvents="none"
      />

      {/* Device Tag & Name */}
      <g pointerEvents="none">
        <text
          x={cx}
          y={cy - 7}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={13}
          fontWeight={700}
          fill={borderColor}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          {element.tag}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10.5}
          fontWeight={500}
          fill="#475569"
        >
          {element.name}
        </text>
      </g>

      {/* Pins / Terminals */}
      {element.pins.map((pin) => {
        const g = getPinGeometry(element.width, element.height, pin);
        const isSourcePin =
          wiringFrom?.elementId === element.instanceId && wiringFrom?.pinId === pin.id;
        const isHovered = hoveredPinId === pin.id;
        const isTargetCandidate = Boolean(wiringFrom && !isSourcePin);

        return (
          <g key={pin.id}>
            {/* Stub line */}
            <line
              x1={g.x1}
              y1={g.y1}
              x2={g.x2}
              y2={g.y2}
              stroke={isSourcePin ? '#ea580c' : borderColor}
              strokeWidth={2}
              pointerEvents="none"
            />

            {/* Pin name inside box */}
            <text
              x={g.labelX}
              y={g.labelY}
              textAnchor={g.textAnchor}
              dominantBaseline={g.baseline}
              fontSize={9}
              fontWeight={600}
              fill="#334155"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              pointerEvents="none"
            >
              {pin.name}
            </text>

            {/* Active / hover halo (hidden during export) */}
            {!isExporting && (isHovered || isSourcePin) && (
              <circle
                cx={g.x2}
                cy={g.y2}
                r={8}
                fill={
                  isSourcePin
                    ? 'rgba(234, 88, 12, 0.25)'
                    : isTargetCandidate
                      ? 'rgba(22, 163, 74, 0.25)'
                      : 'rgba(37, 99, 235, 0.22)'
                }
                stroke={
                  isSourcePin ? '#ea580c' : isTargetCandidate ? '#16a34a' : '#2563eb'
                }
                strokeWidth={1.5}
                pointerEvents="none"
              />
            )}

            {/* Terminal dot */}
            <circle
              cx={g.x2}
              cy={g.y2}
              r={3.5}
              fill={isSourcePin ? '#ea580c' : isHovered ? '#2563eb' : '#ffffff'}
              stroke={isSourcePin ? '#ea580c' : borderColor}
              strokeWidth={1.8}
              pointerEvents="none"
            />

            {/* Invisible hit area for easy clicking */}
            <circle
              cx={g.x2}
              cy={g.y2}
              r={10}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setHoveredPinId(pin.id)}
              onMouseLeave={() => setHoveredPinId(null)}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => onPinClick(e, element.instanceId, pin.id)}
            />
          </g>
        );
      })}
    </g>
  );
};
