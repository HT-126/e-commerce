import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getOrders } from "../api.js";
import { ListSkeleton } from "../components/Skeleton.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function OrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null); // { items, page, totalPages } from the server
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const orders = data?.items ?? null;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await getOrders(data.page + 1);
      setData({ ...next, items: [...data.items, ...next.items] }); // add to the end
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    getOrders()
      .then((d) => !ignore && setData(d))
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
      {!orders && !error && <ListSkeleton />}

      {orders && orders.length === 0 && (
        <EmptyState
          title="No orders yet"
          text="When you place an order it will show up here."
          actionLabel="Start shopping"
        />
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
      {data && data.page < data.totalPages && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-4 rounded-md border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
        >
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}
    </main>
  );
}