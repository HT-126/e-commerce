import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getOrder } from "../api.js";
import { PLACEHOLDER } from "../placeholder.js";

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    setOrder(null);
    setError("");
    getOrder(id)
      .then((data) => !ignore && setOrder(data))
      .catch((e) => {
        if (ignore) return;
        if (e.status === 401) navigate("/login", { state: { from: location.pathname } });
        else setError(e.message); // 404 -> "Order not found"
      });
    return () => {
      ignore = true;
    };
  }, [id, navigate, location.pathname]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>
        <Link to="/orders" className="text-sm underline">Back to my orders</Link>
      </main>
    );
  }
  if (!order) return <main className="mx-auto max-w-3xl p-4"><p>Loading...</p></main>;

  return (
    <main className="mx-auto max-w-3xl p-4">
      <Link to="/orders" className="text-sm text-gray-600 hover:underline">← My orders</Link>
      <h1 className="mt-2 text-2xl font-bold">Order #{order.id}</h1>
      <p className="mb-4 text-sm text-gray-500">{new Date(order.createdAt).toLocaleString()}</p>

      <ul className="divide-y divide-gray-200 border-y border-gray-200">
        {order.items.map((item) => (
          <li key={item.variantId} className="flex gap-4 py-4">
            <Link to={`/products/${item.handle}`} className="shrink-0">
              <img
                src={item.imageUrl ?? PLACEHOLDER}
                alt={item.name}
                onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                className="size-20 rounded-md bg-gray-100 object-cover"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <Link to={`/products/${item.handle}`} className="line-clamp-2 text-sm font-medium hover:underline">
                {item.name}
              </Link>
              <p className="text-sm text-gray-500">{item.color} · {item.size}</p>
              {/* unitPrice = the price paid at checkout, not today's price */}
              <p className="text-sm text-gray-700">
                ${item.unitPrice.toFixed(2)} × {item.quantity}
              </p>
            </div>
            <p className="text-sm font-semibold">${item.lineTotal.toFixed(2)}</p>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex justify-end gap-6 text-lg font-semibold">
        <span>Total</span>
        <span>${order.total.toFixed(2)}</span>
      </p>
    </main>
  );
}