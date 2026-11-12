/**
 * Layered (Sugiyama-style, simplified) layout for agent runs: a DAG that grows downwards.
 *
 * - rank = 1 + the highest parent rank (roots are rank 0); unknown parents are ignored;
 * - nodes within a rank are ordered by the barycentre of their parents, then by insertion;
 * - each node is pulled towards the mean x of its parents, then overlaps are resolved while
 *   keeping the rank centred on the pull. Pure and deterministic, so it is easy to test.
 */

export interface LayoutInput {
  id: string;
  parents: readonly string[];
  width: number;
  height: number;
}

export interface LayoutNode {
  /** Centre of the node. */
  x: number;
  y: number;
  rank: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  nodes: Map<string, LayoutNode>;
  /** Bounding box of all nodes. */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface LayoutOptions {
  /** Vertical space between ranks. */
  rankGap?: number;
  /** Horizontal space between neighbours in a rank. */
  nodeGap?: number;
}

export function layoutFlow(inputs: readonly LayoutInput[], options: LayoutOptions = {}): LayoutResult {
  const rankGap = options.rankGap ?? 56;
  const nodeGap = options.nodeGap ?? 24;
  const byId = new Map(inputs.map((n, i) => [n.id, { ...n, index: i }]));

  // 1. Ranks (inputs arrive in topological order in practice; iterate until stable to be safe).
  const rank = new Map<string, number>();
  for (let pass = 0; pass < inputs.length + 1; pass++) {
    let changed = false;
    for (const node of inputs) {
      let r = 0;
      for (const p of node.parents) {
        if (p !== node.id && byId.has(p)) r = Math.max(r, (rank.get(p) ?? 0) + 1);
      }
      if (rank.get(node.id) !== r) {
        rank.set(node.id, r);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // 2. Order within ranks by parent barycentre.
  const ranks: string[][] = [];
  for (const node of inputs) (ranks[rank.get(node.id)!] ??= []).push(node.id);
  const position = new Map<string, number>();
  ranks.forEach((ids, r) => {
    if (r > 0) {
      const bary = (id: string): number => {
        const ps = byId.get(id)!.parents.filter((p) => position.has(p));
        return ps.length ? ps.reduce((s, p) => s + position.get(p)!, 0) / ps.length : Number.MAX_SAFE_INTEGER;
      };
      ids.sort((a, b) => bary(a) - bary(b) || byId.get(a)!.index - byId.get(b)!.index);
    }
    ids.forEach((id, i) => position.set(id, i));
  });

  // 3. Coordinates.
  const nodes = new Map<string, LayoutNode>();
  let top = 0;
  ranks.forEach((ids, r) => {
    if (!ids) return;
    const height = Math.max(...ids.map((id) => byId.get(id)!.height));
    const y = top + height / 2;
    const widths = ids.map((id) => byId.get(id)!.width);
    // Desired x: the mean of the parents (roots and orphans start centred on 0).
    const desired = ids.map((id) => {
      const ps = byId.get(id)!.parents.map((p) => nodes.get(p)).filter((p): p is LayoutNode => Boolean(p));
      return ps.length ? ps.reduce((s, p) => s + p.x, 0) / ps.length : 0;
    });
    // Siblings that want the same spot are spread around it.
    const xs = desired.slice();
    for (let i = 1; i < xs.length; i++) {
      const min = xs[i - 1]! + (widths[i - 1]! + widths[i]!) / 2 + nodeGap;
      if (xs[i]! < min) xs[i] = min;
    }
    // Re-centre the rank on the mean of what it wanted, keeping the separation.
    const shift = desired.reduce((s, d) => s + d, 0) / xs.length - xs.reduce((s, x) => s + x, 0) / xs.length;
    ids.forEach((id, i) => {
      const n = byId.get(id)!;
      nodes.set(id, { x: xs[i]! + shift, y, rank: r, width: n.width, height: n.height });
    });
    top += height + rankGap;
  });

  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  let first = true;
  for (const n of nodes.values()) {
    const l = n.x - n.width / 2;
    const r = n.x + n.width / 2;
    const t = n.y - n.height / 2;
    const b = n.y + n.height / 2;
    if (first) {
      [minX, maxX, minY, maxY] = [l, r, t, b];
      first = false;
    } else {
      minX = Math.min(minX, l);
      maxX = Math.max(maxX, r);
      minY = Math.min(minY, t);
      maxY = Math.max(maxY, b);
    }
  }
  return { nodes, minX, maxX, minY, maxY };
}

/** Cubic edge from the bottom centre of `a` to the top centre of `b`. */
export function edgePath(a: LayoutNode, b: LayoutNode): string {
  const x1 = a.x;
  const y1 = a.y + a.height / 2;
  const x2 = b.x;
  const y2 = b.y - b.height / 2;
  const dy = Math.max(24, (y2 - y1) * 0.55);
  const r = (v: number): number => Math.round(v * 10) / 10;
  return `M${r(x1)} ${r(y1)} C${r(x1)} ${r(y1 + dy)}, ${r(x2)} ${r(y2 - dy)}, ${r(x2)} ${r(y2)}`;
}
