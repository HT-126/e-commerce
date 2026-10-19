import { useCallback, useEffect, useState } from "react";
import { getCart } from "../api.js";
import { useAuth } from "./useAuth.js";
import { CartContext } from "./useCart.js";

// Knows how many items are in the cart, for the badge in the header.
// The server is the only place that knows the real cart, so this only holds a number.
export function CartProvider({ children }) {
  const { user } = useAuth();
  const [stored, setStored] = useState(0);

  // Only lines that can be bought count (sold-out lines are not in the total either)
  const setCartCount = useCallback((cart) => {
    setStored(
      cart.items.reduce((sum, i) => sum + (i.soldOut ? 0 : i.quantity), 0),
    );
  }, []);

  // The badge is optional: if the request fails, keep the old number
  const refreshCart = useCallback(
    () =>
      getCart()
        .then(setCartCount)
        .catch(() => {}),
    [setCartCount],
  );

  // Load the number once per logged-in user (setState happens in the answer, not here)
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let ignore = false;
    getCart()
      .then((cart) => !ignore && setCartCount(cart))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [userId, setCartCount]);

  // Logged out: always 0, without storing anything
  const count = user ? stored : 0;

  return (
    <CartContext.Provider value={{ count, refreshCart, setCartCount }}>
      {children}
    </CartContext.Provider>
  );
}
