import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCategories } from "../api.js";

export default function CategoryNav() {
  const [tree, setTree] = useState([]); // the 6 top-level categories, each with children

  useEffect(() => {
    let ignore = false;
    getCategories()
      .then((data) => !ignore && setTree(data))
      .catch(() => {}); // the menu is optional: if it fails, the site still works
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <ul className="flex items-center gap-1">
      {tree.map((node) => (
        // "group": the child <ul> below reacts when the mouse is over THIS item
        <li key={node.id} className="group relative">
          <Link
            to={`/?category=${node.id}`}
            className="block whitespace-nowrap rounded px-3 py-1 text-sm font-medium hover:bg-gray-100"
          >
            {node.name}
          </Link>

          {/* Only the NEXT level. Hidden by default, shown on hover (or keyboard focus) on wide screens. */}
          {node.children.length > 0 && (
            <ul className="absolute left-0 top-full z-20 hidden max-h-96 min-w-48 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 text-sm shadow-lg lg:group-focus-within:block lg:group-hover:block">
              {node.children.map((child) => (
                <li key={child.id}>
                  <Link
                    to={`/?category=${child.id}`}
                    className="block whitespace-nowrap rounded px-2 py-1 hover:bg-gray-100"
                  >
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}