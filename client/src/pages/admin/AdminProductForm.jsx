import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAdminProduct, getCategories } from "../../api";
import { useFetch } from "../../hooks/useFetch";

const INPUT = "min-h-11 w-full border border-gray-300 px-2";
const BTN = "min-h-11 border border-gray-300 bg-white px-4 hover:bg-gray-100 disabled:opacity-40";

const emptyVariant = () => ({ sku: "", color: "", size: "", price: "", compare: "", stock: "0" });

// The category tree as a flat list: "Clothing > Dresses"
function flatten(nodes, path = []) {
  return nodes.flatMap((n) => {
    const here = [...path, n.name];
    return [{ id: n.id, label: here.join(" > ") }, ...flatten(n.children, here)];
  });
}

// "" -> null, otherwise a number (the server checks that it is valid)
const numberOrNull = (text) => (text.trim() === "" ? null : Number(text));

export default function AdminProductForm({ onCreated, onCancel }) {
  const navigate = useNavigate();
  const { data: tree } = useFetch(() => getCategories(), "categories");
  const categories = tree ? flatten(tree) : [];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [variants, setVariants] = useState([emptyVariant()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setVariant = (index, changes) =>
    setVariants((list) => list.map((v, i) => (i === index ? { ...v, ...changes } : v)));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createAdminProduct({
        title,
        description,
        categoryId: Number(categoryId),
        ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
        variants: variants.map((v) => ({
          sku: v.sku,
          color: v.color.trim() || null,
          size: v.size.trim() || null,
          price: Number(v.price),
          compareAtPrice: numberOrNull(v.compare),
          stockQuantity: Number(v.stock),
        })),
      });
      onCreated();
    } catch (err) {
      if (err.status === 401) {
        navigate("/login", { state: { from: "/admin/products" } });
        return;
      }
      // Zod (400) sends a list of { field, message }
      setError(
        err.details?.length
          ? err.details.map((d) => `${d.field}: ${d.message}`).join(" · ")
          : err.message,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-4 border border-gray-200 bg-white p-5 text-sm">
      <h3 className="text-base font-semibold">Add product</h3>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1 font-medium">
          Title
          <input required maxLength={255} value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
        </label>
        <label className="grid gap-1 font-medium">
          Category
          <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={INPUT}>
            <option value="">Choose a category...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 font-medium md:col-span-2">
          Image URL (optional)
          <input
            type="url"
            maxLength={500}
            placeholder="https://..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="grid gap-1 font-medium md:col-span-2">
          Description
          <textarea
            rows={3}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 px-2 py-2"
          />
        </label>
      </div>

      <div>
        <p className="mb-2 font-medium">Variants (what customers can buy)</p>
        <div className="space-y-2 overflow-x-auto">
          {variants.map((v, i) => (
            <div key={i} className="grid min-w-175 grid-cols-[1.2fr_1fr_0.7fr_0.8fr_0.8fr_0.7fr_auto] items-center gap-2">
              <input required aria-label="SKU" placeholder="SKU" maxLength={100} value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} className={INPUT} />
              <input aria-label="Color" placeholder="Color" maxLength={100} value={v.color} onChange={(e) => setVariant(i, { color: e.target.value })} className={INPUT} />
              <input aria-label="Size" placeholder="Size" maxLength={50} value={v.size} onChange={(e) => setVariant(i, { size: e.target.value })} className={INPUT} />
              <input required aria-label="Price" placeholder="Price" inputMode="decimal" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} className={`${INPUT} text-right`} />
              <input aria-label="Compare at price" placeholder="Compare at" inputMode="decimal" value={v.compare} onChange={(e) => setVariant(i, { compare: e.target.value })} className={`${INPUT} text-right`} />
              <input required aria-label="Stock" placeholder="Stock" inputMode="numeric" value={v.stock} onChange={(e) => setVariant(i, { stock: e.target.value })} className={`${INPUT} text-right`} />
              <button
                type="button"
                aria-label="Remove variant"
                disabled={variants.length === 1}
                onClick={() => setVariants((list) => list.filter((_, j) => j !== i))}
                className={BTN}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setVariants((list) => [...list, emptyVariant()])} className={`${BTN} mt-2`}>
          + Add variant
        </button>
      </div>

      {error && (
        <p role="alert" className="bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button disabled={saving} className="min-h-11 bg-black px-5 text-white hover:bg-gray-800 disabled:opacity-40">
          {saving ? "Saving..." : "Create product"}
        </button>
        <button type="button" disabled={saving} onClick={onCancel} className={BTN}>
          Cancel
        </button>
      </div>
    </form>
  );
}
