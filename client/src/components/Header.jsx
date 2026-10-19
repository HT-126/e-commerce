import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";
import { useCart } from "../context/useCart.js";
import CategoryNav from "./CategoryNav.jsx";
import SearchBox from "./SearchBox.jsx";
import {
  AdminIcon,
  CartIcon,
  LoginIcon,
  LogoutIcon,
  OrdersIcon,
  RegisterIcon,
} from "./Icons.jsx";

// An icon button: the label is read by screen readers and shown as a tooltip
const iconClass =
  "flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5";

function IconLink({ to, label, children }) {
  return (
    <Link to={to} aria-label={label} title={label} className={iconClass}>
      {children}
    </Link>
  );
}

export default function Header() {
  const { user, loading, logout } = useAuth();
  const { count } = useCart();

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-black/10 bg-brand px-4 py-3">
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

      {/* Search sits next to the account icons, on the right */}
      <div className="ml-auto flex min-w-40 flex-1 items-center justify-end gap-2 sm:flex-none">
        <div className="w-full sm:w-64">
          <SearchBox />
        </div>

        {/* Always visible. A visitor who is not logged in is sent to /login by RequireAuth. */}
        <IconLink to="/orders" label="Orders">
          <OrdersIcon />
        </IconLink>
        <IconLink
          to="/cart"
          label={count > 0 ? `Cart (${count} items)` : "Cart"}
        >
          <span className="relative">
            <CartIcon />
            {count > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white"
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </span>
        </IconLink>

        {loading ? null : user ? (
          <>
            {user?.role === "admin" && (
              <IconLink to="/admin" label="Admin">
                <AdminIcon />
              </IconLink>
            )}
            <button
              type="button"
              onClick={logout}
              aria-label="Log out"
              title={`Log out (${user.email})`}
              className={iconClass}
            >
              <LogoutIcon />
            </button>
          </>
        ) : (
          <>
            <IconLink to="/login" label="Log in">
              <LoginIcon />
            </IconLink>
            <IconLink to="/register" label="Register">
              <RegisterIcon />
            </IconLink>
          </>
        )}
      </div>
    </header>
  );
}
