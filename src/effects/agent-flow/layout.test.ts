import { describe, expect, it } from 'vitest';
import { edgePath, layoutFlow, type LayoutInput } from './layout';

const box = (id: string, parents: string[] = [], width = 200, height = 60): LayoutInput => ({ id, parents, width, height });

describe('layoutFlow', () => {
  it('stacks a chain vertically on one axis', () => {
    const { nodes } = layoutFlow([box('a'), box('b', ['a']), box('c', ['b'])], { rankGap: 40 });
    expect([...nodes.values()].map((n) => n.rank)).toEqual([0, 1, 2]);
    expect(nodes.get('a')!.x).toBe(0);
    expect(nodes.get('c')!.x).toBe(0);
    expect(nodes.get('b')!.y - nodes.get('a')!.y).toBe(100); // 60 high + 40 gap
  });

  it('spreads parallel children around their parent without overlap', () => {
    const { nodes } = layoutFlow([box('plan'), box('s1', ['plan']), box('s2', ['plan']), box('s3', ['plan'])], { nodeGap: 20 });
    const xs = ['s1', 's2', 's3'].map((id) => nodes.get(id)!.x);
    expect(xs[1]! - xs[0]!).toBe(220);
    expect(xs[2]! - xs[1]!).toBe(220);
    expect((xs[0]! + xs[2]!) / 2).toBeCloseTo(nodes.get('plan')!.x);
  });

  it('places a join below the mean of its parents and ranks it after the deepest parent', () => {
    const { nodes } = layoutFlow([
      box('plan'),
      box('a', ['plan']),
      box('b', ['plan']),
      box('a2', ['a']),
      box('join', ['a2', 'b']),
    ]);
    expect(nodes.get('join')!.rank).toBe(3);
    expect(nodes.get('join')!.x).toBeCloseTo((nodes.get('a2')!.x + nodes.get('b')!.x) / 2);
  });

  it('orders a rank by parent barycentre to avoid crossings', () => {
    const { nodes } = layoutFlow([
      box('l'),
      box('r'),
      box('fromR', ['r']),
      box('fromL', ['l']),
    ]);
    expect(nodes.get('fromL')!.x).toBeLessThan(nodes.get('fromR')!.x);
  });

  it('uses the tallest node of a rank and reports the bounding box', () => {
    const result = layoutFlow([box('a', [], 100, 40), box('b', ['a'], 100, 90), box('c', ['a'], 300, 50)], { rankGap: 10, nodeGap: 10 });
    expect(result.nodes.get('b')!.y).toBe(result.nodes.get('c')!.y);
    expect(result.minY).toBe(0);
    expect(result.maxY).toBe(40 + 10 + 90);
    expect(result.maxX - result.minX).toBe(100 + 10 + 300);
  });

  it('ignores unknown and self parents and handles an empty run', () => {
    const { nodes } = layoutFlow([box('a', ['ghost', 'a'])]);
    expect(nodes.get('a')!.rank).toBe(0);
    expect(layoutFlow([]).nodes.size).toBe(0);
  });
});

describe('edgePath', () => {
  it('connects the bottom of the parent to the top of the child', () => {
    const path = edgePath({ x: 0, y: 30, rank: 0, width: 100, height: 60 }, { x: 50, y: 150, rank: 1, width: 100, height: 60 });
    expect(path.startsWith('M0 60 C')).toBe(true);
    expect(path.endsWith('50 120')).toBe(true);
  });
});
