import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteAdminProduct, getAdminVariants, updateVariant } from "../../api";
import AdminProductForm from "./AdminProductForm";

// One grid for the header and every row, so the columns line up
const ROW = "grid grid-cols-[1fr_110px_100px_100px_90px_260px] items-center gap-3 px-5 py-3 border-b border-gray-100";
const BTN = "min-h-11 border border-gray-300 bg-white px-4 hover:bg-gray-100 disabled:opacity-40";
const INPUT = "min-h-11 w-full border border-gray-300 px-2 text-right";

const money = (n) => `$${n.toFixed(2)}`;

// Gray = normal, amber = low, red = sold out
function stockClass(n) {
  if (n === 0) return "bg-red-100 text-red-800";
  if (n < 5) return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-700";
}

export default function AdminProductsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [text, setText] = useState(""); // what the admin is typing
  const [query, setQuery] = useState(""); // the search that is applied
  const [reloadKey, setReloadKey] = useState(0); // change it to reload the list
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null); // only one row at a time
  const [form, setForm] = useState({ price: "", compare: "", stock: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [adding, setAdding] = useState(false); // the "Add product" form is open
  const [notice, setNotice] = useState(""); // "Product created" / "Deleted ..."

  useEffect(() => {
    let ignore = false; // ignore an old answer if page or query changed again
    getAdminVariants(page, query)
      .then((d) => {
        if (ignore) return;
        setData(d);
        setError(""); // a good answer clears an old error
      })
      .catch((e) => {
        if (ignore) return;
        // The 1-hour token expired: log in again, then come back
        if (e.status === 401) navigate("/login", { state: { from: "/admin/products" } });
        else setError(e.message);
      });
    return () => {
      ignore = true;
    };
  }, [page, query, reloadKey, navigate]);

  function handleSearch(e) {
    e.preventDefault(); // do not reload the whole page
    setEditingId(null);
    setPage(1); // a new search starts at page 1
    setQuery(text.trim());
  }

  function startEdit(v) {
    setSaveError("");
    setEditingId(v.id);
    // inputs hold STRINGS; compare "" means "no discount"
    setForm({
      price: String(v.price),
      compare: v.compareAtPrice === null ? "" : String(v.compareAtPrice),
      stock: String(v.stockQuantity),
    });
  }

  async function handleSave(id) {
    setSaving(true);
    setSaveError("");
    try {
      await updateVariant(id, {
        price: Number(form.price),
        // empty box -> null (remove the discount)
        compareAtPrice: form.compare.trim() === "" ? null : Number(form.compare),
        stockQuantity: Number(form.stock),
      });
      setEditingId(null);
      setReloadKey((k) => k + 1); // load the fresh data from the server
    } catch (e) {
      setSaveError(e.message); // the server (Zod / 400) decides what is valid
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(v) {
    const ok = window.confirm(
      `Delete the whole product "${v.title}" with all its variants? This cannot be undone.`,
    );
    if (!ok) return;
    setSaveError("");
    setNotice("");
    try {
      await deleteAdminProduct(v.productId);
      setNotice(`Deleted "${v.title}".`);
      setEditingId(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setSaveError(e.message); // for example "This product has been ordered..."
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p>Loading...</p>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Variants, price and stock</h2>
        <button
          type="button"
          onClick={() => {
            setAdding((a) => !a);
            setNotice("");
          }}
          className="min-h-11 bg-black px-4 text-white hover:bg-gray-800"
        >
          {adding ? "Close" : "+ Add product"}
        </button>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="search"
            aria-label="Search by title or SKU"
            placeholder="Search title or SKU"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-11 w-70 max-w-full border border-gray-300 px-3"
          />
          <button className="min-h-11 bg-black px-4 text-white hover:bg-gray-800">
            Search
          </button>
        </form>
      </div>

      {adding && (
        <AdminProductForm
          onCancel={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            setNotice("Product created.");
            setPage(1);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {notice && (
        <p role="status" className="mb-3 bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </p>
      )}

      {saveError && (
        <p role="alert" className="mb-3 bg-red-50 p-3 text-sm text-red-700">
          {saveError}
        </p>
      )}

      <div className="overflow-x-auto border border-gray-200 bg-white">
        <div className="min-w-215 text-sm">
          <div className={`${ROW} border-gray-200 py-3.5 font-semibold text-gray-500`}>
            <div>Product</div>
            <div>SKU</div>
            <div className="text-right">Price</div>
            <div className="text-right">Compare at</div>
            <div className="text-right">Stock</div>
            <div />
          </div>

          {data.items.length === 0 && (
            <p className="p-5 text-gray-500">No variants found.</p>
          )}

          {data.items.map((v) =>
            editingId === v.id ? (
              // EDIT MODE
              <div key={v.id} className={`${ROW} bg-gray-50`}>
                <div>
                  <div className="font-semibold">{v.title}</div>
                  <div className="text-xs text-gray-500">{[v.color, v.size].filter(Boolean).join(" / ")}</div>
                </div>
                <div className="text-xs text-gray-600">{v.sku}</div>
                <input
                  aria-label="Price"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className={`${INPUT} border-2 border-black`}
                />
                <input
                  aria-label="Compare at price"
                  inputMode="decimal"
                  placeholder="none"
                  value={form.compare}
                  onChange={(e) => setForm({ ...form, compare: e.target.value })}
                  className={INPUT}
                />
                <input
                  aria-label="Stock quantity"
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className={INPUT}
                />
                <div className="flex justify-end gap-2">
                  <button
                    disabled={saving}
                    onClick={() => handleSave(v.id)}
                    className="min-h-11 bg-black px-3 text-white hover:bg-gray-800 disabled:opacity-40"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button disabled={saving} onClick={() => setEditingId(null)} className={BTN}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // NORMAL MODE
              <div key={v.id} className={ROW}>
                <div>
                  <div className="font-semibold">{v.title}</div>
                  <div className="text-xs text-gray-500">{[v.color, v.size].filter(Boolean).join(" / ")}</div>
                </div>
                <div className="text-xs text-gray-600">{v.sku}</div>
                <div className="text-right tabular-nums">{money(v.price)}</div>
                <div className="text-right tabular-nums text-gray-500">
                  {v.compareAtPrice === null ? "—" : money(v.compareAtPrice)}
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2.5 py-0.5 text-xs tabular-nums ${stockClass(v.stockQuantity)}`}>
                    {v.stockQuantity}
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => startEdit(v)} className={BTN}>
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(v)}
                    className="min-h-11 border border-red-300 bg-white px-4 text-red-800 hover:bg-red-50"
                  >
                    Delete product
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Changing a price also updates the product's "From" price. Old orders keep the price they were bought at.
      </p>

      <div className="mt-5 flex items-center gap-4">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={BTN}>
          Prev
        </button>
        <span className="text-gray-600">
          Page {data.page} / {data.totalPages}
        </span>
        <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className={BTN}>
          Next
        </button>
      </div>
    </div>
  );
}