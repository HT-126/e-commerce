import { useNavigate, useSearchParams } from "react-router-dom";

export default function SearchBox() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const current = params.get("search") ?? "";

  function handleSubmit(e) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q").trim();

    // Keep the other filters (category, sort...), change only the search. Go back to page 1.
    const next = new URLSearchParams(params);
    if (q) next.set("search", q);
    else next.delete("search");
    next.delete("page");

    navigate({ pathname: "/", search: next.toString() });
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="flex-1">
      {/* key: when the URL search changes (Back button), the input shows the new value */}
      <input
        key={current}
        name="q"
        type="search"
        defaultValue={current}
        maxLength={100} // same limit as the Zod schema on the server
        placeholder="Search products..."
        className="w-full rounded-full border border-transparent bg-white px-4 py-1.5 text-sm focus:border-accent focus:outline-none"
      />
    </form>
  );
}