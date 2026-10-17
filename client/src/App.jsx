import { Routes, Route, Navigate } from "react-router-dom";
import ProductListPage from "./pages/ProductListPage.jsx";
import ProductDetailPage from "./pages/ProductDetailPage.jsx";
import Header from "./components/Header.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import CartPage from "./pages/CartPage.jsx";
import OrderSuccessPage from "./pages/OrderSuccessPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import OrderDetailPage from "./pages/OrderDetailPage.jsx";
import RequireAdmin from "./components/RequireAdmin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage";
import AdminIncomePage from "./pages/admin/AdminIncomePage";
import AdminProductsPage from "./pages/admin/AdminProductsPage";
import AdminReviewsPage from "./pages/admin/AdminReviewsPage";

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<ProductListPage />} />
        <Route path="/products/:handle" element={<ProductDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/cart"
          element={
            <RequireAuth>
              <CartPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<p className="container">Page not found</p>} />
        <Route
          path="/order-success"
          element={
            <RequireAuth>
              <OrderSuccessPage />
            </RequireAuth>
          }
        />
        <Route
          path="/orders"
          element={
            <RequireAuth>
              <OrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <RequireAuth>
              <OrderDetailPage />
            </RequireAuth>
          }
        />
        <Route path="/admin" element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="orders" replace />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="income" element={<AdminIncomePage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
