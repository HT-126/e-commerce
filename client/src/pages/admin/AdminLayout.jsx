import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "orders", label: "Orders" },
  { to: "income", label: "Income" },
  { to: "products", label: "Products" },
  { to: "reviews", label: "Reviews" },
];

export default function AdminLayout() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Admin</h1>
      <nav className="mb-6 flex gap-4 border-b">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            // NavLink gives isActive, so the current tab looks different
            className={({ isActive }) =>
              isActive
                ? "border-b-2 border-black px-1 pb-2 font-semibold"
                : "px-1 pb-2 text-gray-500 hover:text-black"
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet /> {/* the selected tab appears here */}
    </div>
  );
}