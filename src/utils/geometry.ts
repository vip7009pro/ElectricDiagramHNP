import type { CanvasElement, Pin, PinSide, RotationAngle } from '../types/diagram';

export interface Point {
  x: number;
  y: number;
}

export interface PinWorldPosition {
  x: number;
  y: number;
  dx: number; // outward unit vector x
  dy: number; // outward unit vector y
  worldSide: PinSide;
}

export const PIN_STUB_LENGTH = 14;

export function snapValue(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled || gridSize <= 0) return Math.round(value);
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Returns pin coordinates in the element's local (unrotated) coordinate space,
 * positioned at the tip of the pin stub outside the element border.
 */
export function getPinLocalPosition(
  width: number,
  height: number,
  pin: Pin,
  includeStub = true
): { x: number; y: number; dx: number; dy: number } {
  const stub = includeStub ? PIN_STUB_LENGTH : 0;
  switch (pin.side) {
    case 'top':
      return { x: pin.offset, y: -stub, dx: 0, dy: -1 };
    case 'bottom':
      return { x: pin.offset, y: height + stub, dx: 0, dy: 1 };
    case 'left':
      return { x: -stub, y: pin.offset, dx: -1, dy: 0 };
    case 'right':
      return { x: width + stub, y: pin.offset, dx: 1, dy: 0 };
  }
}

function rotatePointAround(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angle: RotationAngle
): Point {
  const rx = px - cx;
  const ry = py - cy;
  switch (angle) {
    case 90:
      return { x: cx - ry, y: cy + rx };
    case 180:
      return { x: cx - rx, y: cy - ry };
    case 270:
      return { x: cx + ry, y: cy - rx };
    case 0:
    default:
      return { x: px, y: py };
  }
}

function rotateVector(dx: number, dy: number, angle: RotationAngle): { dx: number; dy: number } {
  switch (angle) {
    case 90:
      return { dx: -dy, dy: dx };
    case 180:
      return { dx: -dx, dy: -dy };
    case 270:
      return { dx: dy, dy: -dx };
    case 0:
    default:
      return { dx, dy };
  }
}

function vectorToSide(dx: number, dy: number): PinSide {
  if (dy < 0) return 'top';
  if (dy > 0) return 'bottom';
  if (dx < 0) return 'left';
  return 'right';
}

/**
 * Computes the exact world (SVG canvas) position and outward direction of a pin,
 * accounting for element (x, y) and rotation around the element center.
 */
export function getPinWorldPosition(element: CanvasElement, pin: Pin): PinWorldPosition {
  const local = getPinLocalPosition(element.width, element.height, pin, true);
  const cx = element.width / 2;
  const cy = element.height / 2;
  const rotated = rotatePointAround(local.x, local.y, cx, cy, element.rotation);
  const dir = rotateVector(local.dx, local.dy, element.rotation);

  return {
    x: element.x + rotated.x,
    y: element.y + rotated.y,
    dx: dir.dx,
    dy: dir.dy,
    worldSide: vectorToSide(dir.dx, dir.dy),
  };
}

/**
 * Generates clean 90-degree orthogonal waypoints between two points with outward directions.
 */
export function computeOrthogonalPoints(
  start: Point,
  startDir: { dx: number; dy: number },
  end: Point,
  endDir: { dx: number; dy: number },
  lead = 24
): Point[] {
  const p0 = start;
  const p1: Point = { x: start.x + startDir.dx * lead, y: start.y + startDir.dy * lead };
  const pEnd = end;
  const pPrev: Point = { x: end.x + endDir.dx * lead, y: end.y + endDir.dy * lead };

  const startHorizontal = startDir.dx !== 0;
  const endHorizontal = endDir.dx !== 0;

  const pts: Point[] = [p0, p1];

  if (startHorizontal && endHorizontal) {
    // Both horizontal exits
    const movingTowardEnd =
      (startDir.dx > 0 && pPrev.x >= p1.x) || (startDir.dx < 0 && pPrev.x <= p1.x);
    if (movingTowardEnd) {
      const midX = (p1.x + pPrev.x) / 2;
      pts.push({ x: midX, y: p1.y }, { x: midX, y: pPrev.y });
    } else {
      // Need to route around vertically
      const midY = (p1.y + pPrev.y) / 2;
      const offsetY = Math.abs(p1.y - pPrev.y) < 40 ? p1.y - 50 : midY;
      pts.push(
        { x: p1.x, y: offsetY },
        { x: pPrev.x, y: offsetY }
      );
    }
  } else if (!startHorizontal && !endHorizontal) {
    // Both vertical exits
    const movingTowardEnd =
      (startDir.dy > 0 && pPrev.y >= p1.y) || (startDir.dy < 0 && pPrev.y <= p1.y);
    if (movingTowardEnd) {
      const midY = (p1.y + pPrev.y) / 2;
      pts.push({ x: p1.x, y: midY }, { x: pPrev.x, y: midY });
    } else {
      const midX = (p1.x + pPrev.x) / 2;
      const offsetX = Math.abs(p1.x - pPrev.x) < 40 ? p1.x + 60 : midX;
      pts.push(
        { x: offsetX, y: p1.y },
        { x: offsetX, y: pPrev.y }
      );
    }
  } else if (startHorizontal && !endHorizontal) {
    // Horizontal start -> Vertical end: L-shape or Z-shape
    const canSimpleL =
      ((startDir.dx > 0 && pPrev.x >= p1.x) || (startDir.dx < 0 && pPrev.x <= p1.x)) &&
      ((endDir.dy > 0 && p1.y >= pPrev.y) || (endDir.dy < 0 && p1.y <= pPrev.y));

    if (canSimpleL) {
      pts.push({ x: pPrev.x, y: p1.y });
    } else {
      const midX = (p1.x + pPrev.x) / 2;
      pts.push({ x: midX, y: p1.y }, { x: midX, y: pPrev.y });
    }
  } else {
    // Vertical start -> Horizontal end
    const canSimpleL =
      ((startDir.dy > 0 && pPrev.y >= p1.y) || (startDir.dy < 0 && pPrev.y <= p1.y)) &&
      ((endDir.dx > 0 && p1.x >= pPrev.x) || (endDir.dx < 0 && p1.x <= pPrev.x));

    if (canSimpleL) {
      pts.push({ x: p1.x, y: pPrev.y });
    } else {
      const midY = (p1.y + pPrev.y) / 2;
      pts.push({ x: p1.x, y: midY }, { x: pPrev.x, y: midY });
    }
  }

  pts.push(pPrev, pEnd);
  return simplifyOrthogonalPoints(pts);
}

/**
 * Removes redundant collinear or duplicate consecutive points.
 */
function simplifyOrthogonalPoints(points: Point[]): Point[] {
  const deduped: Point[] = [];
  for (const pt of points) {
    const last = deduped[deduped.length - 1];
    if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > 0.5) {
      deduped.push(pt);
    }
  }

  if (deduped.length <= 2) return deduped;

  const result: Point[] = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = deduped[i];
    const next = deduped[i + 1];

    const collinearX = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5;
    const collinearY = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5;
    if (!collinearX && !collinearY) {
      result.push(curr);
    }
  }
  result.push(deduped[deduped.length - 1]);
  return result;
}

export function pointsToSvgPath(points: Point[]): string {
  if (points.length === 0) return '';
  return points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`)
    .join(' ');
}

/**
 * Finds the midpoint of the longest segment in an orthogonal wire, ideal for placing wire labels.
 */
export function getWireLabelPosition(points: Point[]): Point {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };

  let bestLen = -1;
  let bestMid: Point = {
    x: (points[0].x + points[points.length - 1].x) / 2,
    y: (points[0].y + points[points.length - 1].y) / 2,
  };

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len > bestLen) {
      bestLen = len;
      bestMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }
  return bestMid;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function getDiagramBounds(elements: CanvasElement[], padding = 60): BoundingBox {
  if (elements.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const halfW = el.rotation === 90 || el.rotation === 270 ? el.height / 2 : el.width / 2;
    const halfH = el.rotation === 90 || el.rotation === 270 ? el.width / 2 : el.height / 2;

    minX = Math.min(minX, cx - halfW - PIN_STUB_LENGTH - 24);
    minY = Math.min(minY, cy - halfH - PIN_STUB_LENGTH - 24);
    maxX = Math.max(maxX, cx + halfW + PIN_STUB_LENGTH + 24);
    maxY = Math.max(maxY, cy + halfH + PIN_STUB_LENGTH + 24);
  }

  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(200, maxX - minX),
    height: Math.max(200, maxY - minY),
  };
}
