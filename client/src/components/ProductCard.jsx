import { useState } from "react";
import { Link } from "react-router-dom";
import { PLACEHOLDER } from "../placeholder.js";

// Shopify images can fail, so we keep our own placeholder

export default function ProductCard({ product }) {
  const [broken, setBroken] = useState(false);
  const src = !product.image_url || broken ? PLACEHOLDER : product.image_url;

  return (
    <Link to={`/products/${product.handle}`} className="group block">
      {/* Fixed 3:4 box: every photo is cut to the same shape, so all cards line up */}
      <div className="aspect-[3/4] overflow-hidden rounded-lg bg-gray-100">
        <img
          src={src}
          alt={product.title}
          loading="lazy"
          onError={() => setBroken(true)} // image failed -> show placeholder
          className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
            product.in_stock ? "" : "opacity-60"
          }`}
        />
      </div>
      {/* h-10 = exactly 2 lines, so titles of 1 or 2 lines do not change the card height */}
      <h2 className="mt-2 line-clamp-2 h-10 text-sm font-medium leading-5">{product.title}</h2>
      <p className="text-sm text-gray-700">From ${product.price_min.toFixed(2)}</p>
      {product.rating !== null && (
        <p className="text-xs text-gray-500">
          ★ {product.rating.toFixed(1)} ({product.rating_count})
        </p>
      )}
      {!product.in_stock && <p className="text-xs font-medium text-red-700">Sold out</p>}
    </Link>
  );
}