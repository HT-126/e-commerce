import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCategories } from "../api.js";

export default function CategoryBar() {
  const [tree, setTree] = useState([]); // the 6 top-level categories, each with children

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
    <nav aria-label="Categories" className="flex flex-wrap gap-x-1 px-4 pb-1 text-sm">
      {tree.map((node) => (
        // "group": the dropdown inside can react to hover on this element
        <div key={node.id} className="group relative">
          <Link
            to={`/?category=${node.id}`}
            className="block rounded px-3 py-1.5 font-medium hover:bg-gray-100"
          >
            {node.name}
          </Link>

          {/* Only the NEXT level. Hidden until hover or keyboard focus.
              No margin between link and panel (top-full), so the mouse does not "fall" between them. */}
          {node.children.length > 0 && (
            <ul className="absolute left-0 top-full z-20 hidden min-w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg group-focus-within:block group-hover:block">
              {node.children.map((child) => (
                <li key={child.id}>
                  <Link
                    to={`/?category=${child.id}`}
                    className="block whitespace-nowrap rounded px-3 py-1.5 hover:bg-gray-100"
                  >
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  );
}