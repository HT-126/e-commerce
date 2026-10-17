import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getOrders } from "../api.js";

export default function OrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false; 
    getOrders()
      .then((data) => !ignore && setOrders(data))
      .catch((e) => {
        if (ignore) return;
        // The 1-hour token expired: log in again, then come back here
        if (e.status === 401) navigate("/login", { state: { from: location.pathname } });
        else setError(e.message);
      });
    return () => {
      ignore = true;
    };
  }, [navigate, location.pathname]);

  return (
    <main className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-2xl font-bold">My orders</h1>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!orders && !error && <p>Loading...</p>}

      {orders && orders.length === 0 && (
        <p>
          You have no orders yet. <Link to="/" className="underline">Start shopping</Link>
        </p>
      )}

      {orders && orders.length > 0 && (
        <ul className="divide-y divide-gray-200 border-y border-gray-200">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                to={`/orders/${o.id}`}
                className="flex items-center justify-between gap-4 py-4 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">Order #{o.id}</p>
                  {/* The server sends one fixed time format; the browser shows it in the user's time zone */}
                  <p className="text-sm text-gray-500">{new Date(o.createdAt).toLocaleString()}</p>
                </div>
                <p className="text-sm text-gray-600">
                  {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
                </p>
                <p className="font-semibold">${o.total.toFixed(2)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}