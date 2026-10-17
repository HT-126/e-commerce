import { useEffect, useState } from "react";
import ImageGallery from "../components/ImageGallery.jsx";
import VariantPicker from "../components/VariantPicker.jsx";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import { getProduct, addToCart } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import ReviewsSection from "../components/ReviewsSection.jsx";

export default function ProductDetailPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState(null); // { ok: true/false, text }

  const { handle } = useParams();
  const [product, setProduct] = useState(null);
  const [variant, setVariant] = useState(null); // the chosen color + size
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");
    setProduct(null);
    getProduct(handle)
      .then((p) => {
        if (ignore) return;
        setProduct(p);
        // Start on the first variant in stock (the first one if all are sold out)
        setVariant(p.variants.find((v) => v.in_stock) ?? p.variants[0]);
      })
      .catch((e) => !ignore && setError(e.message))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [handle]);

  if (loading)
    return (
      <main className="mx-auto max-w-6xl p-4">
        <p>Loading...</p>
      </main>
    );

  if (error) {
    return (
      <main className="mx-auto max-w-6xl p-4">
        <p className="mb-2 text-sm text-red-700">{error}</p>
        <Link to="/" className="text-sm underline">
          Back to products
        </Link>
      </main>
    );
  }

  // compare_at_price is null when there is no discount (the import made sure of it)
  const onSale =
    variant.compare_at_price !== null &&
    variant.compare_at_price > variant.price;
  const percentOff = onSale
    ? Math.round((1 - variant.price / variant.compare_at_price) * 100)
    : 0;

  async function handleAdd() {
    // This check is only for comfort. The server checks the cookie anyway (401).
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    setAdding(true);
    setMessage(null);
    try {
      await addToCart(variant.id, 1);
      setMessage({ ok: true, text: "Added to cart" });
    } catch (err) {
      if (err.status === 401) {
        // The 1-hour token expired: send the user to log in again
        navigate("/login", { state: { from: location.pathname } });
        return;
      }
      setMessage({ ok: false, text: err.message }); // for example "Sold out"
    } finally {
      setAdding(false);
    }
  }
  // The review section tells us the new numbers (they come in the POST response)
  function handleRated(rating, ratingCount) {
    setProduct((p) => ({ ...p, rating, rating_count: ratingCount }));
  }

  return (
    <main className="mx-auto max-w-6xl p-4">
      <Link to="/" className="text-sm text-gray-600 hover:underline">
        ← Back to products
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <ImageGallery images={product.images} title={product.title} />

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">{product.category.name}</p>
            <h1 className="text-2xl font-bold">{product.title}</h1>
            {product.rating !== null && (
              <p className="mt-1 text-sm text-gray-600">
                ★ {product.rating.toFixed(1)} ({product.rating_count} ratings)
              </p>
            )}
          </div>

          <p className="flex items-center gap-2 text-2xl font-semibold">
            ${variant.price.toFixed(2)}
            {onSale && (
              <>
                <s className="text-base font-normal text-gray-500">
                  ${variant.compare_at_price.toFixed(2)}
                </s>
                <span className="rounded bg-red-100 px-2 py-0.5 text-sm font-medium text-red-700">
                  -{percentOff}%
                </span>
              </>
            )}
          </p>

          <VariantPicker
            variants={product.variants}
            selected={variant}
            onSelect={setVariant}
          />

          <button
            type="button"
            onClick={handleAdd}
            disabled={!variant.in_stock || adding}
            className="w-full rounded-md bg-gray-900 py-3 font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto sm:px-10"
          >
            {!variant.in_stock
              ? "Sold out"
              : adding
                ? "Adding..."
                : "Add to cart"}
          </button>
          {message && (
            <p
              role="status"
              className={
                message.ok ? "text-sm text-green-700" : "text-sm text-red-700"
              }
            >
              {message.text}
            </p>
          )}

          <p className="leading-relaxed text-gray-700">{product.description}</p>
        </div>
      </div>
      <ReviewsSection handle={handle} onRated={handleRated} />
    </main>
  );
}
