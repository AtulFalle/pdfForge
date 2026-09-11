import type { BBox } from '../api/models';

export interface CssBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type PointMapper = (x: number, y: number) => Point;

export function bboxToCss(bbox: BBox, toViewport: PointMapper): CssBox {
  const corners = [
    toViewport(bbox.x, bbox.y),
    toViewport(bbox.x + bbox.width, bbox.y),
    toViewport(bbox.x, bbox.y + bbox.height),
    toViewport(bbox.x + bbox.width, bbox.y + bbox.height),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    left,
    top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
  };
}
