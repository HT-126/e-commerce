import { useState } from "react";
import { ProductDetailSkeleton } from "../components/Skeleton.jsx";
import { useToast } from "../context/useToast.js";
import { useCart } from "../context/useCart.js";
import { useFetch } from "../hooks/useFetch.js";
import ImageGallery from "../components/ImageGallery.jsx";
import VariantPicker from "../components/VariantPicker.jsx";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import { getProduct, addToCart } from "../api.js";
import { useAuth } from "../context/useAuth.js";
import ReviewsSection from "../components/ReviewsSection.jsx";

export default function ProductDetailPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const { refreshCart } = useCart();

  const { handle } = useParams();
  const { data: fetched, error: fetchError, loading } = useFetch(
    () => getProduct(handle),
    handle,
  );
  const error = fetchError?.message ?? "";

  // The chosen color + size, stored as an id with the handle it belongs to,
  // so a choice made on another product is ignored.
  const [choice, setChoice] = useState({ handle: null, id: null });
  // New rating numbers from the review form, with the handle they belong to
  const [rated, setRated] = useState({ handle: null, rating: null, ratingCount: 0 });

  const product =
    fetched && rated.handle === handle
      ? { ...fetched, rating: rated.rating, rating_count: rated.ratingCount }
      : fetched;
  // Start on the first variant in stock (the first one if all are sold out)
  const variant = product
    ? (product.variants.find((v) => choice.handle === handle && v.id === choice.id) ??
      product.variants.find((v) => v.in_stock) ??
      product.variants[0])
    : undefined;

  if (loading) return <ProductDetailSkeleton />;

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

  // A product with no variants cannot be bought (and has no price to show)
  if (!product || !variant) {
    return (
      <main className="mx-auto max-w-6xl p-4">
        <p className="mb-2 text-sm">This product is not available.</p>
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
    try {
      const res = await addToCart(variant.id, 1);
      toast(
        res.capped
          ? `Cart limit reached: you have ${res.quantity} of this item`
          : "Added to cart",
      );
      refreshCart(); // update the number on the cart icon
    } catch (err) {
      if (err.status === 401) {
        // The 1-hour token expired: send the user to log in again
        navigate("/login", { state: { from: location.pathname } });
        return;
      }
      toast(err.message, "error"); // for example "Sold out"
    } finally {
      setAdding(false);
    }
  }
  // The review section tells us the new numbers (they come in the POST response)
  function handleRated(rating, ratingCount) {
    setRated({ handle, rating, ratingCount });
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
            onSelect={(v) => setChoice({ handle, id: v.id })}
          />

          <button
            type="button"
            onClick={handleAdd}
            disabled={!variant.in_stock || adding}
            className="w-full rounded-md bg-accent py-3 font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto sm:px-10"
          >
            {!variant.in_stock
              ? "Sold out"
              : adding
                ? "Adding..."
                : "Add to cart"}
          </button>

          <p className="leading-relaxed text-gray-700">{product.description}</p>
        </div>
      </div>
      {/* key: a new product starts with a fresh review list and form */}
      <ReviewsSection key={handle} handle={handle} onRated={handleRated} />
    </main>
  );
}
