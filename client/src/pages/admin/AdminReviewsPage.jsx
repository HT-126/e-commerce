import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAdminReviews, deleteAdminReview } from "../../api";

const ROW =
  "grid grid-cols-[200px_190px_100px_1fr_130px_170px] items-center gap-3 px-5 py-3.5 border-b border-gray-100";
const BTN =
  "min-h-11 border border-gray-300 bg-white px-4 hover:bg-gray-100 disabled:opacity-40";

// rating 4 -> ★★★★☆
const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

export default function AdminReviewsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0); // change it to reload the list
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const [confirmId, setConfirmId] = useState(null); // the row that asks "sure?"
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let ignore = false; // ignore an old answer if page changed again
    getAdminReviews(page)
      .then((d) => {
        if (ignore) return;
        setData(d);
        setError(""); // a good answer clears an old error
      })
      .catch((e) => {
        if (ignore) return;
        // The 1-hour token expired: log in again, then come back
        if (e.status === 401) navigate("/login", { state: { from: "/admin/reviews" } });
        else setError(e.message);
      });
    return () => {
      ignore = true;
    };
  }, [page, reloadKey, navigate]);

  async function handleDelete(id) {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAdminReview(id);
      setConfirmId(null);
      // We deleted the last row of this page -> that page will be empty, so go back one
      if (data.items.length === 1 && page > 1) setPage(page - 1);
      else setReloadKey((k) => k + 1); // otherwise load the fresh list
    } catch (e) {
      setDeleteError(e.message); // for example 404: another admin deleted it first
    } finally {
      setDeleting(false);
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p>Loading...</p>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Newest reviews</h2>
        <span className="text-sm text-gray-500">
          {data.total} reviews in total
        </span>
      </div>

      {deleteError && (
        <p
          role="alert"
          className="mb-3 bg-red-50 p-3 text-sm text-red-700"
        >
          {deleteError}
        </p>
      )}

      <div className="overflow-x-auto border border-gray-200 bg-white">
        <div className="min-w-[860px] text-sm">
          <div className={`${ROW} border-gray-200 font-semibold text-gray-500`}>
            <div>Product</div>
            <div>Customer</div>
            <div>Rating</div>
            <div>Comment</div>
            <div>Date</div>
            <div />
          </div>

          {data.items.length === 0 && (
            <p className="p-5 text-gray-500">No reviews yet.</p>
          )}

          {data.items.map((r) => {
            const asking = confirmId === r.id;
            return (
              <div key={r.id} className={`${ROW} ${asking ? "bg-red-50" : ""}`}>
                <Link
                  to={`/products/${r.handle}`}
                  className="font-semibold hover:underline"
                >
                  {r.productTitle}
                </Link>
                <div className="break-all">{r.email}</div>
                <div
                  aria-label={`${r.rating} out of 5`}
                  className="whitespace-nowrap text-amber-700"
                >
                  {stars(r.rating)}
                </div>

                {/* React escapes the text, so a comment like <script> is shown as text */}
                {asking ? (
                  <div className="text-red-900">
                    Delete this review? The product rating will be recalculated.
                  </div>
                ) : (
                  <div className="text-gray-700">{r.comment ?? "—"}</div>
                )}

                <div className="text-gray-600">
                  {new Date(r.createdAt).toLocaleDateString()}
                </div>

                <div className="flex justify-end gap-2">
                  {asking ? (
                    <>
                      <button
                        disabled={deleting}
                        onClick={() => handleDelete(r.id)}
                        className="min-h-11 bg-red-700 px-3.5 text-white hover:bg-red-800 disabled:opacity-40"
                      >
                        {deleting ? "Deleting..." : "Delete"}
                      </button>
                      <button
                        disabled={deleting}
                        onClick={() => setConfirmId(null)}
                        className={BTN}
                      >
                        Keep
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setDeleteError("");
                        setConfirmId(r.id);
                      }}
                      className="min-h-11 border border-red-300 bg-white px-4 text-red-800 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className={BTN}
        >
          Prev
        </button>
        <span className="text-gray-600">
          Page {data.page} / {data.totalPages}
        </span>
        <button
          disabled={page >= data.totalPages}
          onClick={() => setPage(page + 1)}
          className={BTN}
        >
          Next
        </button>
      </div>
    </div>
  );
}
