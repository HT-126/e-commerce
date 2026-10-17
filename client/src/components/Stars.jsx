// Shows value (1 to 5) as filled stars. Full class names only (Tailwind must see them).
export default function Stars({ value }) {
  const filled = Math.round(value);
  return (
    <span role="img" aria-label={`${value} out of 5 stars`} className="text-amber-500">
      {"★".repeat(filled)}
      <span className="text-gray-300">{"★".repeat(5 - filled)}</span>
    </span>
  );
}