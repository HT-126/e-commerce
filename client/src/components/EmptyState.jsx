import { Link } from "react-router-dom";

// A friendly "nothing here" block with one clear next step
export default function EmptyState({ title, text, actionTo = "/", actionLabel = "Continue shopping" }) {
  return (
    <div className="rounded-lg bg-brand/50 px-6 py-12 text-center">
      <p className="text-lg font-medium">{title}</p>
      {text && <p className="mt-1 text-sm text-gray-600">{text}</p>}
      <Link
        to={actionTo}
        className="mt-5 inline-block rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
