import { bboxToCss, type PointMapper } from './bbox';

describe('bboxToCss', () => {
  const identity: PointMapper = (x, y) => ({ x, y });

  it('maps a PDF box whose origin is already top-left', () => {
    const box = bboxToCss({ x: 10, y: 20, width: 30, height: 40 }, identity);

    expect(box).toEqual({ left: 10, top: 20, width: 30, height: 40 });
  });

  it('uses axis-aligned bounds when the mapper flips Y', () => {
    const flip: PointMapper = (x, y) => ({ x, y: 100 - y });
    const box = bboxToCss({ x: 10, y: 20, width: 30, height: 40 }, flip);

    expect(box.left).toBe(10);
    expect(box.width).toBe(30);
    expect(box.top).toBe(40);
    expect(box.height).toBe(40);
  });
});
