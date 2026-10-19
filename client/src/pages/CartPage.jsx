import { useCallback, useEffect, useState } from "react";
import { ListSkeleton } from "../components/Skeleton.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { useCart } from "../context/useCart.js";
import { useToast } from "../context/useToast.js";
import { Link, useNavigate } from "react-router-dom";
import { PLACEHOLDER } from "../placeholder.js";
import { getCart, updateCartItem, removeCartItem, checkout } from "../api.js";

export default function CartPage() {
  const navigate = useNavigate();
  const { setCartCount, refreshCart } = useCart();
  const toast = useToast();
  const [cart, setCart] = useState(null); // { items, total } from the server
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null); // the variantId we are changing now
  const [checkingOut, setCheckingOut] = useState(false);

  const handleError = useCallback(
    (e) => {
      if (e.status === 401) {
        // The 1-hour token expired: log in again, then come back here
        navigate("/login", { state: { from: "/cart" } });
        return;
      }
      setError(e.message);
    },
    [navigate],
  );

  // First load (with the "ignore" guard, same as other pages)
  useEffect(() => {
    let ignore = false;
    getCart()
      .then((data) => {
        if (ignore) return;
        setCart(data);
        setCartCount(data); // keep the number on the cart icon right
      })
      .catch((e) => !ignore && handleError(e))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [handleError, setCartCount]);

  // Ask the server for the real cart again
  async function refresh() {
    const data = await getCart();
    setCart(data);
    setCartCount(data);
  }

  // Run one change (PATCH or DELETE), then reload the cart
  async function run(item, action) {
    setBusyId(item.variantId);
    setError("");
    try {
      await action();
    } catch (e) {
      handleError(e); // for example 409 "Sold out"
    }
    try {
      await refresh(); // always reload, so the screen shows the real state
    } catch (e) {
      handleError(e);
    } finally {
      setBusyId(null);
    }
  }

  const changeQty = (item, quantity) =>
    run(item, () => updateCartItem(item.variantId, quantity));
  const remove = (item) =>
    run(item, async () => {
      await removeCartItem(item.variantId);
      toast("Removed from cart");
    });

  async function handleCheckout() {
    setCheckingOut(true);
    setError("");
    try {
      const order = await checkout(); // { orderId, total } from the server
      refreshCart(); // the icon badge: bought lines are gone
      navigate("/order-success", {
        state: { orderId: order.orderId, total: order.total },
      });
    } catch (e) {
      handleError(e); // 409 -> "Not enough stock: <name>", 401 -> login
      try {
        await refresh(); // show the real cart, so the user sees what changed
      } catch (err) {
        handleError(err);
      }
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading)
    return (
      <main className="mx-auto max-w-4xl p-4">
        <h1 className="mb-4 text-2xl font-bold">Your cart</h1>
        <ListSkeleton />
      </main>
    );

  const items = cart?.items ?? [];
  const hasSoldOut = items.some((i) => i.soldOut);
  const hasAvailable = items.some((i) => !i.soldOut);

  return (
    <main className="mx-auto max-w-4xl p-4">
      <h1 className="mb-4 text-2xl font-bold">Your cart</h1>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState title="Your cart is empty" text="Add something you like and it will show up here." />
      ) : (
        <>
          <ul className="divide-y divide-gray-200 border-y border-gray-200">
            {items.map((item) => {
              const busy = busyId === item.variantId;
              return (
                <li key={item.variantId} className="flex gap-4 py-4">
                  <Link to={`/products/${item.handle}`} className="shrink-0">
                    <img
                      src={item.imageUrl ?? PLACEHOLDER}
                      alt={item.name}
                      // if the image fails, show our placeholder
                      onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                      className={`size-24 rounded-md bg-gray-100 object-cover ${
                        item.soldOut ? "opacity-50" : ""
                      }`}
                    />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link
                      to={`/products/${item.handle}`}
                      className="line-clamp-2 text-sm font-medium hover:underline"
                    >
                      {item.name}
                    </Link>
                    <p className="text-sm text-gray-500">
                      {item.color} · {item.size}
                    </p>
                    <p className="text-sm text-gray-700">
                      ${item.price.toFixed(2)} each
                    </p>

                    <div className="mt-auto flex flex-wrap items-center gap-3">
                      {item.soldOut ? (
                        // Sold out: no quantity buttons, only Remove
                        <span className="text-sm font-medium text-red-700">
                          Sold out
                        </span>
                      ) : (
                        <div className="flex items-center rounded-md border border-gray-300">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            disabled={busy || item.quantity <= 1}
                            onClick={() => changeQty(item, item.quantity - 1)}
                            className="px-3 py-1 disabled:opacity-40"
                          >
                            −
                          </button>
                          <span className="min-w-8 text-center text-sm">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            disabled={busy || item.quantity >= 10}
                            onClick={() => changeQty(item, item.quantity + 1)}
                            className="px-3 py-1 disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => remove(item)}
                        className="text-sm text-gray-600 underline disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {!item.soldOut && (
                    <p className="text-sm font-semibold">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-6 ml-auto max-w-xs space-y-2">
            <p className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>${cart.total.toFixed(2)}</span>
            </p>
            {hasSoldOut && (
              <p className="text-xs text-red-700">
                Remove the sold-out items to continue. They are not in the
                total.
              </p>
            )}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={!hasAvailable || hasSoldOut || checkingOut}
              className="w-full rounded-md bg-accent py-3 font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {checkingOut ? "Placing order..." : "Checkout"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
