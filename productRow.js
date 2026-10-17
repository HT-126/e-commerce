import { boolean, z } from "zod";

// Every CSV cell is TEXT. Each field below
// (1) checks the text, then (2) transforms it into a clean value.

// "4.6 out of 5 stars" -> 4.6   |   "" -> null
const ratingStars = z.string().transform((text) => {
  const match = text.match(/^(\d(?:\.\d)?) out of 5/);
  return match ? Number(match[1]) : null;
});

// "1,654 ratings" -> 1654   |   "" -> 0
const ratingCount = z.string().transform((text) => {
  const digits = text.replace(/\D/g, ""); // remove everything that is not a digit
  return digits ? Number(digits) : 0;
});

// "['https://a.jpg', 'https://b.jpg']" -> ["https://a.jpg", "https://b.jpg"]
const imageList = z
  .string()
  .transform(
    (text) =>
      [...text.matchAll(/'(https?:\/\/[^']+)'/g)]
        .map((m) => m[1])
        .filter((url) => !url.includes("play-button")), // skip video thumbnails
  )
  .refine((urls) => urls.length > 0, "product has no images");

// "Clothing, Shoes & Jewelry › Men › Jeans" -> ["Men", "Jeans"] (root is dropped)
// xử lý một chuỗi đường dẫn danh mục (breadcrumbs) thành một mảng các danh mục con, loại bỏ danh mục gốc.
const categoryPath = z.string().transform(
  (text) => text.split(" , ").map((s) => s.trim().filter(Boolean).slice(1)),
  // trim() loại bỏ khoảng trắng thừa đầu và cuối chuỗi,   slice(1) cắt arr từ vtri 1 (bỏ index 0),
);

export const productRowSchema = z
  //Xác thực và làm sạch dữ liệu đầu vào
  .object({
    asin: z.string().trim().min(1).max(20),
    title: z.string().trim().min(1).max(500),
    brand_name: z.string().trim().max(150),
    // z.coerce.number() turns the text "39.9926" into the number 39.9926
    price_value: z.coerce.number().positive("price must be greater than 0"),
    rating_stars: ratingStars,
    rating_count: ratingCount,
    product_description: z.string(),
    about_item: z.string(),
    breadcrumbs: categoryPath,
    all_images: imageList,
  })
  // Last step: rename CSV columns to the names our database uses
  .transform((row) => ({
    asin: row.asin,
    title: row.title,
    brand: row.brand_name || null,
    price: Math.round(row.price_value * 100) / 100, // 39.9926 -> 39.99
    rating: row.rating_stars,
    ratingCount: row.rating_count,
    // product_description is empty for most rows, about_item is almost always filled
    description: row.product_description || row.about_item || null,
    categoryPath: row.breadcrumbs,
    images: row.all_images,
  }));
