const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status; // 401, 429, ...
    err.details = data?.detail; // [{ field, message }] from Zod, used by forms
    throw err;
  }
  return data;
}

export function getProducts(params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
  );
  return request(`/api/products?${new URLSearchParams(clean)}`);
}

export const getProduct = (handle) =>
  request(`/api/products/${encodeURIComponent(handle)}`);

export const register = (email, password) =>
  request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const login = (email, password) =>
  request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const logout = () => request("/api/auth/logout", { method: "POST" });

export const getMe = () => request("/api/auth/me");

export const getCategories = () => request("/api/categories");

//cart
export const getCart = () => request("/api/cart");

export const addToCart = (variantId, quantity = 1) =>
  request("/api/cart", {
    method: "POST",
    body: JSON.stringify({ variantId, quantity }),
  });

export const updateCartItem = (variantId, quantity) =>
  request(`/api/cart/${variantId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });

export const removeCartItem = (variantId) =>
  request(`/api/cart/${variantId}`, { method: "DELETE" }); // 204: request() returns null

export const checkout = () => request("/api/checkout", { method: "POST" });

export const getOrders = () => request("/api/orders");
export const getOrder = (id) =>
  request(`/api/orders/${encodeURIComponent(id)}`);

export const getReviews = (handle, page = 1) =>
  request(`/api/products/${encodeURIComponent(handle)}/reviews?page=${page}`);

export const createReview = (handle, rating, comment) =>
  request(`/api/products/${encodeURIComponent(handle)}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating, comment }), // rating must be a NUMBER (Zod rejects "4")
  });

export const getAdminOrders = (page = 1) =>
  request(`/api/admin/orders?page=${page}`);
export const getAdminStats = (days = 30) =>
  request(`/api/admin/stats?days=${days}`);

export const getAdminVariants = (page = 1, search = "") =>
  request(
    `/api/admin/variants?page=${page}&search=${encodeURIComponent(search)}`,
  );

export const updateVariant = (id, body) =>
  request(`/api/admin/variants/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const getAdminReviews = (page = 1) =>
  request(`/api/admin/reviews?page=${page}`);

export const deleteAdminReview = (id) =>
  request(`/api/admin/reviews/${id}`, { method: "DELETE" });
// The server answers 200 with { rating, ratingCount }, so your helper needs no special case.
