export type PinSide = 'top' | 'bottom' | 'left' | 'right';

export type RotationAngle = 0 | 90 | 180 | 270;

export type WireLineStyle = 'solid' | 'dashed';

export interface Pin {
  id: string;
  name: string;       // VD: "X0", "24V", "COM"
  side: PinSide;
  offset: number;     // Vị trí dọc theo cạnh (px)
}

export interface ElementTemplate {
  id: string;
  name: string;       // VD: "Mitsubishi FX5U"
  prefix: string;     // VD: "PLC", "K", "M"
  width: number;
  height: number;
  borderColor?: string;
  fillColor?: string;
  pins: Pin[];
}

export interface CanvasElement extends ElementTemplate {
  instanceId: string;
  tag: string;        // VD: "-PLC1"
  x: number;
  y: number;
  rotation: RotationAngle;
}

export interface WirePoint {
  x: number;
  y: number;
}

export interface Wire {
  id: string;
  fromElementId: string;
  fromPinId: string;
  toElementId: string;
  toPinId: string;
  /** Optional target wire ID when tapping/splicing this wire onto another wire */
  toWireId?: string;
  /** Exact snapped junction point on the target wire */
  toPoint?: WirePoint;
  color: string;
  strokeWidth?: number;
  lineStyle?: WireLineStyle;
  label?: string;
  waypoints?: WirePoint[];
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface TitleBlockConfig {
  projectName: string;
  author: string;
  date: string;
  drawingNumber: string;
}

export interface DiagramSnapshot {
  elements: CanvasElement[];
  wires: Wire[];
}

export interface DiagramProjectFile {
  version: string;
  titleBlock: TitleBlockConfig;
  templates: ElementTemplate[];
  elements: CanvasElement[];
  wires: Wire[];
}

export interface WirePreset {
  name: string;
  color: string;
  description: string;
}
