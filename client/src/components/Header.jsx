import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import CategoryNav from "./CategoryNav.jsx";
import SearchBox from "./SearchBox.jsx";

export default function Header() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200 px-4 py-3">
      <Link to="/" className="text-lg font-bold">
        Shop
      </Link>

      {/* Phone: its own row below, scrolls sideways. Wide screen: same row, dropdown can show. */}
      <nav
        aria-label="Categories"
        className="order-last w-full overflow-x-auto lg:order-none lg:w-auto lg:overflow-visible"
      >
        <CategoryNav />
      </nav>

      <div className="min-w-40 flex-1 lg:max-w-sm">
        <SearchBox />
      </div>

      <div className="ml-auto flex items-center gap-3 text-sm">
        {loading ? null : user ? (
          <>
            <Link to="/orders" className="hover:underline">
              Orders
            </Link>
            <Link to="/cart" className="hover:underline">
              Cart
            </Link>
            {user?.role === "admin" && (
              <Link to="/admin" className="hover:underline">
                Admin
              </Link>
            )}
            <span className="hidden text-gray-600 sm:inline">{user.email}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded bg-gray-900 px-3 py-1 text-white hover:bg-gray-700"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="whitespace-nowrap hover:underline">
              Log in
            </Link>
            <Link to="/register" className="whitespace-nowrap hover:underline">
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
