import { useEffect, useState } from "react";
import { getAdminOrders } from "../../api";

export default function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false; // ignore an old answer if page changed again
    getAdminOrders(page)
      .then((d) => !ignore && setData(d))
      .catch((e) => !ignore && setError(e.message));
    return () => {
      ignore = true;
    };
  }, [page]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p>Loading...</p>;

  return (
    <div>
      <table className="w-full text-left text-sm">
        <thead className="border-b text-gray-500">
          <tr>
            <th className="py-2">Order</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Total</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((o) => (
            <tr key={o.id} className="border-b">
              <td className="py-2">#{o.id}</td>
              <td>{o.email}</td>
              <td>{o.itemCount}</td>
              <td>${o.total.toFixed(2)}</td>
              <td>{new Date(o.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center gap-4">
        <button
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="border px-3 py-1 disabled:opacity-40"
        >
          Prev
        </button>
        <span>
          Page {data.page} / {data.totalPages}
        </span>
        <button
          disabled={page >= data.totalPages}
          onClick={() => setPage(page + 1)}
          className="border px-3 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}