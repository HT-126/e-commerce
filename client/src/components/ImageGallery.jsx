import { useState } from "react";
import { PLACEHOLDER } from "../placeholder.js";

export default function ImageGallery({ images, title }) {
  const [index, setIndex] = useState(0); // which image is big
  const [broken, setBroken] = useState({}); // { 2: true } = image 2 failed

  const srcOf = (i) => (broken[i] ? PLACEHOLDER : images[i].url);
  const markBroken = (i) => setBroken((b) => ({ ...b, [i]: true }));

  return (
    // min-w-0: lets this grid column shrink, so a long thumbnail row cannot push the page wider
    <div className="min-w-0 space-y-3">
      {/* One big image in a fixed box. object-contain shows the WHOLE photo (no crop). */}
      <div className="aspect-[3/4] max-h-[75vh] w-full overflow-hidden rounded-lg bg-gray-100">
        <img
          src={srcOf(index)}
          alt={images[index].alt || title}
          onError={() => markBroken(index)}
          className="h-full w-full object-contain"
        />
      </div>

      {/* A row of small thumbnails, scrolls sideways if there are many */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {images.map((img, i) => (
          <button
            key={img.url}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show image ${i + 1}`}
            className={`size-16 shrink-0 overflow-hidden rounded-md border-2 bg-gray-100 ${
              i === index ? "border-gray-900" : "border-transparent hover:border-gray-400"
            }`}
          >
            <img
              src={srcOf(i)}
              alt=""
              onError={() => markBroken(i)}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}