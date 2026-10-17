// Full class names only (Tailwind must see them in the file)
function optionClass(isSelected) {
  const base =
    "rounded-md border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:line-through disabled:opacity-40";
  return isSelected
    ? `${base} border-gray-900 bg-gray-900 text-white`
    : `${base} border-gray-300 hover:border-gray-900 disabled:hover:border-gray-300`;
}

export default function VariantPicker({ variants, selected, onSelect }) {
  // Unique colors, in the order they appear in the data
  const colors = [...new Set(variants.map((v) => v.color))];
  // Sizes that exist for the chosen color only
  const sizes = variants.filter((v) => v.color === selected.color);

  function pickColor(color) {
    const ofColor = variants.filter((v) => v.color === color);
    // Same size, if this color has it in stock
    const sameSize = ofColor.find((v) => v.size === selected.size && v.in_stock);
    // Otherwise the first in-stock size (or the first one if all are sold out)
    onSelect(sameSize ?? ofColor.find((v) => v.in_stock) ?? ofColor[0]);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm text-gray-600">
          Color: <strong className="text-gray-900">{selected.color}</strong>
        </p>
        <div className="flex flex-wrap gap-2">
          {colors.map((color) => {
            // Disabled when NO variant of this color is in stock
            const soldOut = !variants.some((v) => v.color === color && v.in_stock);
            const isSelected = color === selected.color;
            return (
              <button
                key={color}
                type="button"
                className={optionClass(isSelected)}
                aria-pressed={isSelected}
                disabled={soldOut}
                onClick={() => pickColor(color)}
              >
                {color}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm text-gray-600">
          Size: <strong className="text-gray-900">{selected.size}</strong>
        </p>
        <div className="flex flex-wrap gap-2">
          {sizes.map((v) => (
            <button
              key={v.id}
              type="button"
              className={optionClass(v.id === selected.id)}
              aria-pressed={v.id === selected.id}
              disabled={!v.in_stock}
              onClick={() => onSelect(v)}
            >
              {v.size}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}