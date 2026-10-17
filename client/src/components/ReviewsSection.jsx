import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getReviews, createReview } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Stars from "./Stars.jsx";

export default function ReviewsSection({ handle, onRated }) {
  const { user } = useAuth();
  const location = useLocation();

  // The list
  const [data, setData] = useState(null); // { items, total, page, totalPages }
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  // The form
  const [rating, setRating] = useState(0); // 0 = nothing chosen yet
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [thanks, setThanks] = useState(false);

  // Load page 1 when the product changes (same "ignore" guard as before)
  useEffect(() => {
    let ignore = false;
    setData(null);
    setError("");
    setThanks(false);
    setRating(0);
    getReviews(handle, 1)
      .then((d) => !ignore && setData(d))
      .catch((e) => !ignore && setError(e.message));
    return () => {
      ignore = true;
    };
  }, [handle]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await getReviews(handle, data.page + 1);
      setData({ ...next, items: [...data.items, ...next.items] }); // add to the end
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const comment = new FormData(e.currentTarget).get("comment"); // read BEFORE any await
    if (rating === 0) {
      setFormError("Please choose a rating from 1 to 5.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const result = await createReview(handle, rating, comment);
      onRated(result.rating, result.ratingCount); // tell the page the new numbers
      setThanks(true);
      getReviews(handle, 1).then(setData).catch(() => {}); // show the new review in the list
    } catch (err) {
      // 400: first Zod message. 403 / 409 / 401: the server's own message.
      setFormError(err.details?.[0]?.message ?? err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-10 border-t border-gray-200 pt-6">
      <h2 className="mb-4 text-xl font-bold">
        Reviews {data && <span className="text-base font-normal text-gray-500">({data.total})</span>}
      </h2>

      {/* The form area */}
      {!user ? (
        <p className="mb-6 text-sm">
          <Link to="/login" state={{ from: location.pathname }} className="underline">
            Log in
          </Link>{" "}
          to write a review.
        </p>
      ) : thanks ? (
        <p className="mb-6 text-sm text-green-700">Thank you for your review!</p>
      ) : (
        <form onSubmit={handleSubmit} className="mb-6 space-y-3">
          <div className="flex items-center gap-1" role="group" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Rate ${n} out of 5`}
                aria-pressed={n === rating}
                onClick={() => setRating(n)}
                className={`text-2xl ${n <= rating ? "text-amber-500" : "text-gray-300"}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            name="comment"
            rows={3}
            maxLength={1000} // same limit as the server
            placeholder="Write a comment (optional)"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
          {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
          <button
            disabled={submitting}
            className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:bg-gray-400"
          >
            {submitting ? "Sending..." : "Submit review"}
          </button>
        </form>
      )}

      {/* The list */}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="text-sm">Loading...</p>}
      {data && data.items.length === 0 && (
        <p className="text-sm text-gray-500">No reviews yet.</p>
      )}
      {data && data.items.length > 0 && (
        <>
          <ul className="divide-y divide-gray-200">
            {data.items.map((r) => (
              <li key={r.id} className="space-y-1 py-4">
                <div className="flex items-center gap-2 text-sm">
                  <Stars value={r.rating} />
                  <span className="font-medium">{r.author}</span>
                  <span className="text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                {/* React escapes this text, so a comment like <script> is shown as plain text */}
                {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
              </li>
            ))}
          </ul>
          {data.page < data.totalPages && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </>
      )}
    </section>
  );
}