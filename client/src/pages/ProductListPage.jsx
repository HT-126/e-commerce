import { useSearchParams } from "react-router-dom";
import { getProducts } from "../api.js";
import { useFetch } from "../hooks/useFetch.js";
import ProductCard from "../components/ProductCard.jsx";
import { ProductGridSkeleton } from "../components/Skeleton.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Number first, then || 1: page 0, "abc" (NaN) or missing all become 1
  // Whole numbers from 1 up. "1.5", "-2", "abc" and missing all become 1.
  const rawPage = Number(searchParams.get("page"));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const sort = searchParams.get("sort") || "rating_desc";
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || ""; // NEW: it was missing

  // keepPrevious: the old cards stay on screen (dimmed) while the next page loads.
  // getProducts removes empty values, so category "" is not sent.
  const { data, error, loading } = useFetch(
    () => getProducts({ page, sort, search, category, limit: 12 }),
    `${page}|${sort}|${search}|${category}`,
    { keepPrevious: true },
  );

  // Change some URL params. undefined or "" removes the param.
  function update(changes) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  }

  return (
    <main className="mx-auto max-w-6xl p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Products</h1>
        <select
          value={sort}
          onChange={(e) => update({ sort: e.target.value, page: undefined })}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="rating_desc">Best rated</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-700">{error.message}</p>}
      {!data && loading && <ProductGridSkeleton />}

      {data && (
        <>
          <p className="mb-3 text-sm text-gray-600">{data.total} products</p>
          {data.items.length === 0 && data.total === 0 && (
            <EmptyState
              title="No products found"
              text="Try a different search or category."
              actionLabel="Show all products"
            />
          )}
          {/* The page number in the URL is past the last page */}
          {data.items.length === 0 && data.total > 0 && (
            <p>
              There is nothing on page {page}.{" "}
              <button
                type="button"
                onClick={() => update({ page: data.totalPages })}
                className="underline"
              >
                Go to the last page
              </button>
            </p>
          )}
          {/* Keep the old cards on screen (dimmed) while the next page loads */}
          <div
            className={`grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 ${
              loading ? "opacity-50" : ""
            }`}
          >
            {data.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <div className="mt-6 flex items-center justify-center gap-4 text-sm">
            <button
              disabled={page <= 1}
              onClick={() => update({ page: page - 1 })}
              className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {page} of {data.totalPages}
            </span>
            <button
              disabled={page >= data.totalPages}
              onClick={() => update({ page: page + 1 })}
              className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}