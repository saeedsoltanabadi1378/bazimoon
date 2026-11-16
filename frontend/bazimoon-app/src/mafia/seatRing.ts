/**
 * Points at equal distances along a rounded curve around the table, the first at the top centre and
 * the rest clockwise. Equal spacing puts more seats on the long sides and never stacks the ends.
 * Used by the flat table (in pixels) and by the 3D table (in world units, y becoming depth).
 */
export function seatPoints(count: number, rx: number, ry: number): [number, number][] {
  const steps = 720;
  const power = 2 / 2.6;
  const points: [number, number][] = [];
  const lengths = [0];
  for (let k = 0; k <= steps; k++) {
    const angle = -Math.PI / 2 + (k / steps) * 2 * Math.PI;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    points.push([rx * Math.sign(c) * Math.abs(c) ** power, ry * Math.sign(s) * Math.abs(s) ** power]);
    if (k > 0) lengths.push(lengths[k - 1] + Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]));
  }
  const total = lengths[steps];
  const seats: [number, number][] = [];
  let k = 0;
  for (let i = 0; i < count; i++) {
    const target = (total / count) * i;
    while (lengths[k] < target) k++;
    seats.push(points[k]);
  }
  return seats;
}

/** The length of the seat ring, so the 3D seats can shrink when many players sit at the table. */
export function seatRingLength(rx: number, ry: number) {
  const ring = seatPoints(360, rx, ry);
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    total += Math.hypot(bx - ax, by - ay);
  }
  return total;
}
