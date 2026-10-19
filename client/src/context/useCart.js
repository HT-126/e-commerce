import { createContext, useContext } from "react";

// { count, refreshCart, setCartCount }. Kept apart from CartProvider (fast refresh).
export const CartContext = createContext({
  count: 0,
  refreshCart: async () => {},
  setCartCount: () => {},
});

export const useCart = () => useContext(CartContext);
