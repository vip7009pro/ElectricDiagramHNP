import type { CanvasElement, Wire } from '../types/diagram';
import {
  type Point,
  computeOrthogonalPoints,
  getPinWorldPosition,
} from './geometry';

interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const ROUTING_STEP = 10; // 10px routing grid for crisp wire spacing
const OBSTACLE_MARGIN = 14; // keep wires cleanly outside element borders

function getElementObstacleRect(el: CanvasElement, margin = OBSTACLE_MARGIN): Rect {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const isRotated = el.rotation === 90 || el.rotation === 270;
  const halfW = (isRotated ? el.height : el.width) / 2;
  const halfH = (isRotated ? el.width : el.height) / 2;

  return {
    minX: cx - halfW - margin,
    minY: cy - halfH - margin,
    maxX: cx + halfW + margin,
    maxY: cy + halfH + margin,
  };
}

function pointInRect(x: number, y: number, r: Rect): boolean {
  return x > r.minX && x < r.maxX && y > r.minY && y < r.maxY;
}

function simplifyPoints(points: Point[]): Point[] {
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
    const colX = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5;
    const colY = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5;
    if (!colX && !colY) {
      result.push(curr);
    }
  }
  result.push(deduped[deduped.length - 1]);
  return result;
}

class MinHeap<T> {
  private items: { priority: number; value: T }[] = [];

  get size() {
    return this.items.length;
  }

  push(value: T, priority: number) {
    this.items.push({ priority, value });
    this.bubbleUp(this.items.length - 1);
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0].value;
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(idx: number) {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.items[idx].priority >= this.items[parent].priority) break;
      [this.items[idx], this.items[parent]] = [this.items[parent], this.items[idx]];
      idx = parent;
    }
  }

  private sinkDown(idx: number) {
    const len = this.items.length;
    while (true) {
      let smallest = idx;
      const left = idx * 2 + 1;
      const right = idx * 2 + 2;
      if (left < len && this.items[left].priority < this.items[smallest].priority) {
        smallest = left;
      }
      if (right < len && this.items[right].priority < this.items[smallest].priority) {
        smallest = right;
      }
      if (smallest === idx) break;
      [this.items[idx], this.items[smallest]] = [this.items[smallest], this.items[idx]];
      idx = smallest;
    }
  }
}

// Directions: 0=right, 1=left, 2=down, 3=up
const DIRS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
] as const;

function edgeKey(ax: number, ay: number, bx: number, by: number): string {
  if (ax < bx || (ax === bx && ay < by)) {
    return `${ax},${ay}-${bx},${by}`;
  }
  return `${bx},${by}-${ax},${ay}`;
}

function snapToGridCoord(v: number, step: number): number {
  return Math.round(v / step);
}

/**
 * Finds the nearest grid cell outside all obstacle rects, starting from the pin exit point.
 */
function findExitGridCell(
  pinPos: Point,
  dir: { dx: number; dy: number },
  obstacles: Rect[],
  step: number
): { gx: number; gy: number } {
  // Start 1 step outward from pin tip
  for (let dist = step; dist <= step * 6; dist += step) {
    const px = pinPos.x + dir.dx * dist;
    const py = pinPos.y + dir.dy * dist;
    const gx = snapToGridCoord(px, step);
    const gy = snapToGridCoord(py, step);
    const wx = gx * step;
    const wy = gy * step;
    if (!obstacles.some((r) => pointInRect(wx, wy, r))) {
      return { gx, gy };
    }
  }
  return {
    gx: snapToGridCoord(pinPos.x + dir.dx * step * 2, step),
    gy: snapToGridCoord(pinPos.y + dir.dy * step * 2, step),
  };
}

interface SearchBounds {
  minGx: number;
  maxGx: number;
  minGy: number;
  maxGy: number;
}

function routeSingleWireAStar(
  startPin: Point,
  startDir: { dx: number; dy: number },
  endPin: Point,
  endDir: { dx: number; dy: number },
  obstacles: Rect[],
  usedEdges: Set<string>,
  usedNodes: Map<string, number>,
  bounds: SearchBounds,
  step: number
): { points: Point[]; gridPath: { gx: number; gy: number }[] } {
  const startCell = findExitGridCell(startPin, startDir, obstacles, step);
  const endCell = findExitGridCell(endPin, endDir, obstacles, step);

  const startDirIdx =
    startDir.dx > 0 ? 0 : startDir.dx < 0 ? 1 : startDir.dy > 0 ? 2 : 3;

  const isBlocked = (gx: number, gy: number): boolean => {
    if (gx === startCell.gx && gy === startCell.gy) return false;
    if (gx === endCell.gx && gy === endCell.gy) return false;
    const wx = gx * step;
    const wy = gy * step;
    for (let i = 0; i < obstacles.length; i++) {
      if (pointInRect(wx, wy, obstacles[i])) return true;
    }
    return false;
  };

  // State key encodes (gx, gy, incomingDir)
  const encode = (gx: number, gy: number, dir: number) => `${gx},${gy},${dir}`;

  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, { gx: number; gy: number; dir: number }>();
  const open = new MinHeap<{ gx: number; gy: number; dir: number }>();

  const startKey = encode(startCell.gx, startCell.gy, startDirIdx);
  gScore.set(startKey, 0);
  const h0 = Math.abs(endCell.gx - startCell.gx) + Math.abs(endCell.gy - startCell.gy);
  open.push({ gx: startCell.gx, gy: startCell.gy, dir: startDirIdx }, h0 * 10);

  let goalState: { gx: number; gy: number; dir: number } | null = null;
  let iterations = 0;
  const MAX_ITERATIONS = 6500;

  while (open.size > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const curr = open.pop()!;
    const currKey = encode(curr.gx, curr.gy, curr.dir);

    if (curr.gx === endCell.gx && curr.gy === endCell.gy) {
      goalState = curr;
      break;
    }

    const currG = gScore.get(currKey) ?? Infinity;

    for (let d = 0; d < 4; d++) {
      // Prevent immediate 180-degree reversal
      if (
        (curr.dir === 0 && d === 1) ||
        (curr.dir === 1 && d === 0) ||
        (curr.dir === 2 && d === 3) ||
        (curr.dir === 3 && d === 2)
      ) {
        continue;
      }

      const nx = curr.gx + DIRS[d].dx;
      const ny = curr.gy + DIRS[d].dy;

      if (
        nx < bounds.minGx ||
        nx > bounds.maxGx ||
        ny < bounds.minGy ||
        ny > bounds.maxGy
      ) {
        continue;
      }

      if (isBlocked(nx, ny)) continue;

      let stepCost = 10;

      // Turn penalty for clean CAD straight lines
      if (d !== curr.dir) {
        stepCost += 18;
      }

      // Strong penalty for overlapping an existing wire segment (forces parallel lane separation)
      const eKey = edgeKey(curr.gx, curr.gy, nx, ny);
      if (usedEdges.has(eKey)) {
        stepCost += 420;
      }

      // Mild penalty for crossing another wire node or hugging right next to another wire
      const nKey = `${nx},${ny}`;
      const nodeUsage = usedNodes.get(nKey) ?? 0;
      if (nodeUsage > 0) {
        stepCost += 25 * nodeUsage;
      }

      const tentativeG = currG + stepCost;
      const nextKey = encode(nx, ny, d);

      if (tentativeG < (gScore.get(nextKey) ?? Infinity)) {
        gScore.set(nextKey, tentativeG);
        cameFrom.set(nextKey, curr);
        const h = (Math.abs(endCell.gx - nx) + Math.abs(endCell.gy - ny)) * 10;
        open.push({ gx: nx, gy: ny, dir: d }, tentativeG + h);
      }
    }
  }

  if (!goalState) {
    // Graceful fallback if completely boxed in
    const fallback = computeOrthogonalPoints(startPin, startDir, endPin, endDir, 24);
    return { points: fallback, gridPath: [] };
  }

  // Reconstruct grid path
  const gridPath: { gx: number; gy: number }[] = [];
  let trace: { gx: number; gy: number; dir: number } | undefined = goalState;
  while (trace) {
    gridPath.push({ gx: trace.gx, gy: trace.gy });
    const prev = cameFrom.get(encode(trace.gx, trace.gy, trace.dir));
    trace = prev;
  }
  gridPath.reverse();

  // Convert grid path to world points and attach exact pin start/end perpendicularly
  const worldPts: Point[] = [startPin];

  if (gridPath.length > 0) {
    const firstWorld = { x: gridPath[0].gx * step, y: gridPath[0].gy * step };
    // Ensure clean 90-degree connection from startPin to firstWorld
    if (startDir.dx !== 0) {
      worldPts.push({ x: firstWorld.x, y: startPin.y });
    } else {
      worldPts.push({ x: startPin.x, y: firstWorld.y });
    }

    for (const cell of gridPath) {
      worldPts.push({ x: cell.gx * step, y: cell.gy * step });
    }

    const lastWorld = {
      x: gridPath[gridPath.length - 1].gx * step,
      y: gridPath[gridPath.length - 1].gy * step,
    };
    if (endDir.dx !== 0) {
      worldPts.push({ x: lastWorld.x, y: endPin.y });
    } else {
      worldPts.push({ x: endPin.x, y: lastWorld.y });
    }
  }

  worldPts.push(endPin);
  return { points: simplifyPoints(worldPts), gridPath };
}

export interface RoutedWireResult {
  wire: Wire;
  points: Point[];
  startPos: Point;
  endPos: Point;
  hasEndJunction?: boolean;
}

/**
 * Projects a point onto the closest position along an orthogonal polyline,
 * and returns the perpendicular direction pointing toward `referencePt`.
 */
export function projectPointOntoPolyline(
  target: Point,
  polyline: Point[],
  referencePt?: Point
): { point: Point; approachDir: { dx: number; dy: number } } {
  if (polyline.length === 0) {
    return { point: target, approachDir: { dx: 0, dy: -1 } };
  }
  if (polyline.length === 1) {
    return { point: polyline[0], approachDir: { dx: 0, dy: -1 } };
  }

  let bestDist = Infinity;
  let bestPoint: Point = polyline[0];
  let bestSegHoriz = true;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const isHoriz = Math.abs(a.y - b.y) < 0.5;
    let proj: Point;

    if (isHoriz) {
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      proj = { x: Math.max(minX, Math.min(maxX, target.x)), y: a.y };
    } else {
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      proj = { x: a.x, y: Math.max(minY, Math.min(maxY, target.y)) };
    }

    const dist = Math.hypot(proj.x - target.x, proj.y - target.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestPoint = proj;
      bestSegHoriz = isHoriz;
    }
  }

  const ref = referencePt ?? target;
  const approachDir = bestSegHoriz
    ? { dx: 0, dy: ref.y < bestPoint.y ? -1 : 1 }
    : { dx: ref.x < bestPoint.x ? -1 : 1, dy: 0 };

  return { point: bestPoint, approachDir };
}

/**
 * Connects two points orthogonally, choosing horizontal-first or vertical-first.
 */
function connectOrthogonalPair(a: Point, b: Point, horizontalFirst: boolean): Point[] {
  if (Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5) {
    return [b];
  }
  const bend: Point = horizontalFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  return [bend, b];
}

/**
 * Builds a clean 90-degree orthogonal polyline passing through user-defined waypoints,
 * anchored cleanly to the start and end pin positions.
 */
export function buildManualWirePoints(
  startPin: Point,
  startDir: { dx: number; dy: number },
  endPin: Point,
  endDir: { dx: number; dy: number },
  waypoints: Point[]
): Point[] {
  if (waypoints.length === 0) {
    return computeOrthogonalPoints(startPin, startDir, endPin, endDir);
  }

  const pts: Point[] = [startPin];
  // First leg respects start pin outward direction
  const startHoriz = startDir.dx !== 0;
  pts.push(...connectOrthogonalPair(startPin, waypoints[0], startHoriz));

  // Intermediate manual waypoints
  for (let i = 1; i < waypoints.length; i++) {
    const prev = pts[pts.length - 1];
    const prevPrev = pts.length >= 2 ? pts[pts.length - 2] : startPin;
    const prevWasHoriz = Math.abs(prev.y - prevPrev.y) < 0.5 && Math.abs(prev.x - prevPrev.x) > 0.5;
    pts.push(...connectOrthogonalPair(prev, waypoints[i], !prevWasHoriz));
  }

  // Final leg respects end pin outward direction (entering endPin along endDir)
  const lastWp = pts[pts.length - 1];
  const endHoriz = endDir.dx !== 0;
  // To enter endPin horizontally, approach vertically first (endPin.y), then horizontally to endPin
  pts.push(...connectOrthogonalPair(lastWp, endPin, !endHoriz));

  return simplifyPoints(pts);
}

/**
 * Builds the live orthogonal preview path during step-by-step wiring on the canvas.
 */
export function buildStepWiringPreview(
  startPin: Point,
  startDir: { dx: number; dy: number },
  waypoints: Point[],
  cursorPos: Point
): Point[] {
  const pts: Point[] = [startPin];
  const startHoriz = startDir.dx !== 0;

  if (waypoints.length === 0) {
    pts.push(...connectOrthogonalPair(startPin, cursorPos, startHoriz));
    return simplifyPoints(pts);
  }

  pts.push(...connectOrthogonalPair(startPin, waypoints[0], startHoriz));
  for (let i = 1; i < waypoints.length; i++) {
    const prev = pts[pts.length - 1];
    const prevPrev = pts.length >= 2 ? pts[pts.length - 2] : startPin;
    const prevWasHoriz = Math.abs(prev.y - prevPrev.y) < 0.5 && Math.abs(prev.x - prevPrev.x) > 0.5;
    pts.push(...connectOrthogonalPair(prev, waypoints[i], !prevWasHoriz));
  }

  const last = pts[pts.length - 1];
  const lastPrev = pts.length >= 2 ? pts[pts.length - 2] : startPin;
  const lastWasHoriz = Math.abs(last.y - lastPrev.y) < 0.5 && Math.abs(last.x - lastPrev.x) > 0.5;
  pts.push(...connectOrthogonalPair(last, cursorPos, !lastWasHoriz));

  return simplifyPoints(pts);
}

function registerPointsOnGrid(
  points: Point[],
  step: number,
  usedEdges: Set<string>,
  usedNodes: Map<string, number>
) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const gx1 = Math.round(a.x / step);
    const gy1 = Math.round(a.y / step);
    const gx2 = Math.round(b.x / step);
    const gy2 = Math.round(b.y / step);

    if (gx1 === gx2) {
      const dir = gy2 >= gy1 ? 1 : -1;
      for (let y = gy1; y !== gy2; y += dir) {
        usedEdges.add(edgeKey(gx1, y, gx1, y + dir));
        const nk = `${gx1},${y}`;
        usedNodes.set(nk, (usedNodes.get(nk) ?? 0) + 1);
      }
    } else if (gy1 === gy2) {
      const dir = gx2 >= gx1 ? 1 : -1;
      for (let x = gx1; x !== gx2; x += dir) {
        usedEdges.add(edgeKey(x, gy1, x + dir, gy1));
        const nk = `${x},${gy1}`;
        usedNodes.set(nk, (usedNodes.get(nk) ?? 0) + 1);
      }
    }
  }
}

/**
 * Routes all wires in the diagram:
 * - Wires with manual `waypoints` follow their exact orthogonal path and reserve their lanes.
 * - Wires without `waypoints` use orthogonal A* obstacle avoidance and lane separation.
 */
export function routeAllWires(
  elements: CanvasElement[],
  wires: Wire[]
): RoutedWireResult[] {
  if (wires.length === 0) return [];

  const elementMap = new Map<string, CanvasElement>();
  for (const el of elements) {
    elementMap.set(el.instanceId, el);
  }

  const obstacles: Rect[] = elements.map((el) => getElementObstacleRect(el, OBSTACLE_MARGIN));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const r of obstacles) {
    minX = Math.min(minX, r.minX);
    minY = Math.min(minY, r.minY);
    maxX = Math.max(maxX, r.maxX);
    maxY = Math.max(maxY, r.maxY);
  }

  if (!Number.isFinite(minX)) {
    minX = -400;
    minY = -400;
    maxX = 1200;
    maxY = 800;
  }

  const span = Math.max(maxX - minX, maxY - minY);
  const step = span > 2600 ? 20 : ROUTING_STEP;
  const channelPad = 140;

  const bounds: SearchBounds = {
    minGx: Math.floor((minX - channelPad) / step),
    maxGx: Math.ceil((maxX + channelPad) / step),
    minGy: Math.floor((minY - channelPad) / step),
    maxGy: Math.ceil((maxY + channelPad) / step),
  };

  const usedEdges = new Set<string>();
  const usedNodes = new Map<string, number>();
  const resultById = new Map<string, RoutedWireResult>();

  // Pass 1: Manual-waypoint pin-to-pin wires (reserve their paths first)
  for (const wire of wires) {
    if (wire.toWireId) continue;
    if (!wire.waypoints || wire.waypoints.length === 0) continue;
    const fromEl = elementMap.get(wire.fromElementId);
    const toEl = elementMap.get(wire.toElementId);
    const fromPin = fromEl?.pins.find((p) => p.id === wire.fromPinId);
    const toPin = toEl?.pins.find((p) => p.id === wire.toPinId);
    if (!fromEl || !toEl || !fromPin || !toPin) continue;

    const startPos = getPinWorldPosition(fromEl, fromPin);
    const endPos = getPinWorldPosition(toEl, toPin);
    const points = buildManualWirePoints(
      { x: startPos.x, y: startPos.y },
      { dx: startPos.dx, dy: startPos.dy },
      { x: endPos.x, y: endPos.y },
      { dx: endPos.dx, dy: endPos.dy },
      wire.waypoints
    );
    registerPointsOnGrid(points, step, usedEdges, usedNodes);
    resultById.set(wire.id, {
      wire,
      points,
      startPos: { x: startPos.x, y: startPos.y },
      endPos: { x: endPos.x, y: endPos.y },
    });
  }

  // Pass 2: Auto-routed pin-to-pin wires via A*
  for (const wire of wires) {
    if (wire.toWireId || resultById.has(wire.id)) continue;
    const fromEl = elementMap.get(wire.fromElementId);
    const toEl = elementMap.get(wire.toElementId);
    const fromPin = fromEl?.pins.find((p) => p.id === wire.fromPinId);
    const toPin = toEl?.pins.find((p) => p.id === wire.toPinId);
    if (!fromEl || !toEl || !fromPin || !toPin) continue;

    const startPos = getPinWorldPosition(fromEl, fromPin);
    const endPos = getPinWorldPosition(toEl, toPin);

    const { points, gridPath } = routeSingleWireAStar(
      { x: startPos.x, y: startPos.y },
      { dx: startPos.dx, dy: startPos.dy },
      { x: endPos.x, y: endPos.y },
      { dx: endPos.dx, dy: endPos.dy },
      obstacles,
      usedEdges,
      usedNodes,
      bounds,
      step
    );

    for (let i = 0; i < gridPath.length; i++) {
      const nKey = `${gridPath[i].gx},${gridPath[i].gy}`;
      usedNodes.set(nKey, (usedNodes.get(nKey) ?? 0) + 1);
      if (i > 0) {
        usedEdges.add(
          edgeKey(gridPath[i - 1].gx, gridPath[i - 1].gy, gridPath[i].gx, gridPath[i].gy)
        );
      }
    }

    resultById.set(wire.id, {
      wire,
      points,
      startPos: { x: startPos.x, y: startPos.y },
      endPos: { x: endPos.x, y: endPos.y },
    });
  }

  // Pass 3: Wire-to-wire junction (T-splice) wires (multi-pass for chained branches)
  let remaining = wires.filter((w) => w.toWireId && !resultById.has(w.id));
  let maxDepth = 5;
  while (remaining.length > 0 && maxDepth > 0) {
    maxDepth--;
    const nextRemaining: Wire[] = [];
    for (const wire of remaining) {
      const targetRouted = wire.toWireId ? resultById.get(wire.toWireId) : undefined;
      if (!targetRouted) {
        nextRemaining.push(wire);
        continue;
      }

      const fromEl = elementMap.get(wire.fromElementId);
      const fromPin = fromEl?.pins.find((p) => p.id === wire.fromPinId);
      if (!fromEl || !fromPin) continue;

      const startPos = getPinWorldPosition(fromEl, fromPin);
      const lastRef =
        wire.waypoints && wire.waypoints.length > 0
          ? wire.waypoints[wire.waypoints.length - 1]
          : { x: startPos.x, y: startPos.y };

      const rawTarget = wire.toPoint ?? targetRouted.points[0];
      const { point: junctionPos, approachDir } = projectPointOntoPolyline(
        rawTarget,
        targetRouted.points,
        lastRef
      );

      let points: Point[];
      if (wire.waypoints && wire.waypoints.length > 0) {
        points = buildManualWirePoints(
          { x: startPos.x, y: startPos.y },
          { dx: startPos.dx, dy: startPos.dy },
          junctionPos,
          approachDir,
          wire.waypoints
        );
        registerPointsOnGrid(points, step, usedEdges, usedNodes);
      } else {
        const routed = routeSingleWireAStar(
          { x: startPos.x, y: startPos.y },
          { dx: startPos.dx, dy: startPos.dy },
          junctionPos,
          approachDir,
          obstacles,
          usedEdges,
          usedNodes,
          bounds,
          step
        );
        points = routed.points;
        for (let i = 0; i < routed.gridPath.length; i++) {
          const nKey = `${routed.gridPath[i].gx},${routed.gridPath[i].gy}`;
          usedNodes.set(nKey, (usedNodes.get(nKey) ?? 0) + 1);
          if (i > 0) {
            usedEdges.add(
              edgeKey(
                routed.gridPath[i - 1].gx,
                routed.gridPath[i - 1].gy,
                routed.gridPath[i].gx,
                routed.gridPath[i].gy
              )
            );
          }
        }
      }

      resultById.set(wire.id, {
        wire,
        points,
        startPos: { x: startPos.x, y: startPos.y },
        endPos: junctionPos,
        hasEndJunction: true,
      });
    }
    if (nextRemaining.length === remaining.length) break;
    remaining = nextRemaining;
  }

  const ordered: RoutedWireResult[] = [];
  for (const wire of wires) {
    const res = resultById.get(wire.id);
    if (res) ordered.push(res);
  }
  return ordered;
}
