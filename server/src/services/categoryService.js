import { pool as db } from "../config/db.js";

// The whole category tree: [{ id, name, children: [...] }]
export async function getCategoryTree() {
  const [rows] = await db.query(
    "SELECT id, name, parent_id FROM categories ORDER BY name",
  );

  // 1. Make a node for every row.
  const byId = new Map(
    rows.map((r) => [r.id, { id: r.id, name: r.name, children: [] }]),
  );

  // 2. Put each node under its parent. No parent = top level.
  const roots = [];
  for (const r of rows) {
    const node = byId.get(r.id);
    if (r.parent_id === null) roots.push(node);
    else byId.get(r.parent_id)?.children.push(node);
  }
  return roots;
}
