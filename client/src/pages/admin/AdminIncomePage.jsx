import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAdminStats } from "../../api";

const money = (n) => `$${Number(n).toFixed(2)}`;

function Tile({ label, value }) {
  return (
    <div className="border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function AdminIncomePage() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false; // ignore an old answer if days changed again
    getAdminStats(days)
      .then((s) => {
        if (ignore) return;
        setStats(s);
        setError(""); // a good answer clears an old error
      })
      .catch((e) => {
        if (ignore) return;
        // The 1-hour token expired: log in again, then come back
        if (e.status === 401) navigate("/login", { state: { from: "/admin/income" } });
        else setError(e.message);
      });
    return () => {
      ignore = true;
    };
  }, [days, navigate]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!stats) return <p>Loading...</p>;

  return (
    <div className="space-y-8">
      {/* All time */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile label="Revenue (all time)" value={money(stats.allTime.revenue)} />
        <Tile label="Orders (all time)" value={stats.allTime.orders} />
        <Tile label="Items sold" value={stats.allTime.itemsSold} />
        <Tile label="Average order" value={money(stats.allTime.averageOrder)} />
      </div>

      {/* Period */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Last {days} days: {money(stats.period.revenue)} · {stats.period.orders} orders
          </h2>
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={
                  d === days
                    ? "bg-black px-3 py-1 text-white"
                    : "border px-3 py-1 hover:bg-gray-100"
                }
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {stats.daily.length === 0 ? (
          <p className="text-gray-500">No orders in this period.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b text-gray-500">
              <tr>
                <th className="py-2">Day</th>
                <th>Orders</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {stats.daily.map((d) => (
                <tr key={d.day} className="border-b">
                  <td className="py-2">{d.day}</td>
                  <td>{d.orders}</td>
                  <td>{money(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Top products */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">Top products (all time)</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b text-gray-500">
            <tr>
              <th className="py-2">Product</th>
              <th>Units</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {stats.topProducts.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="py-2">
                  <Link to={`/products/${p.handle}`} className="hover:underline">
                    {p.title}
                  </Link>
                </td>
                <td>{p.units}</td>
                <td>{money(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}