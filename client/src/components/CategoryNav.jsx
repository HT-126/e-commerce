import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCategories } from "../api.js";

// One category. Hovering (or keyboard focus) opens its children; a child that has its own
// children opens the next panel to the right, and so on. No click is needed.
function CategoryItem({ node, depth }) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <li
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        // Close only when focus leaves this whole item (not when it moves to a child)
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <Link
        to={`/?category=${node.id}`}
        onClick={() => setOpen(false)} // go to the category and close the menu
        className={
          depth === 0
            ? "block rounded px-3 py-1.5 hover:bg-black/5"
            : "flex items-center justify-between gap-3 whitespace-nowrap rounded px-3 py-1.5 hover:bg-gray-100"
        }
      >
        {node.name}
        {depth > 0 && hasChildren && (
          <span aria-hidden="true" className="text-gray-400">
            ›
          </span>
        )}
      </Link>

      {/* No gap between the link and the panel, so the mouse does not "fall" between them.
          Level 1 opens below the bar, deeper levels open to the right. */}
      {open && hasChildren && (
        <ul
          className={`absolute z-20 min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg ${
            depth === 0 ? "left-0 top-full" : "-top-1 left-full"
          }`}
        >
          {node.children.map((child) => (
            <CategoryItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function CategoryBar() {
  const [tree, setTree] = useState([]); // the top-level categories, each with children

  useEffect(() => {
    let ignore = false;
    getCategories()
      .then((data) => !ignore && setTree(data))
      .catch(() => {}); // optional UI: if it fails, the site still works
    return () => {
      ignore = true;
    };
  }, []);

  if (tree.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-x-1 px-4 pb-1 text-sm font-light">
      {tree.map((node) => (
        <CategoryItem key={node.id} node={node} depth={0} />
      ))}
    </ul>
  );
}
