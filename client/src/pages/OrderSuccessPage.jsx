import { Link, Navigate, useLocation } from "react-router-dom";

export default function OrderSuccessPage() {
  const { state } = useLocation(); // the values we passed from the cart page

  // Someone typed this URL by hand: there is no order to show
  if (!state?.orderId) return <Navigate to="/" replace />;

  return (
    <main className="mx-auto max-w-md space-y-3 p-4 text-center">
      <h1 className="text-2xl font-bold">Thank you!</h1>
      <p>Your order #{state.orderId} is placed.</p>
      <p className="font-semibold">Total: ${Number(state.total).toFixed(2)}</p>
      <p>
        <Link to={`/orders/${state.orderId}`} className="underline">
          View this order
        </Link>
      </p>
      <Link
        to="/"
        className="inline-block rounded-md bg-accent px-6 py-2 text-white hover:bg-accent-hover"
      >
        Continue shopping
      </Link>
    </main>
  );
}
