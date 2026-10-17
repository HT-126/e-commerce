import { z } from "zod";

export const listProductsSchema = z.object({
  query: z.object({
    // Query values are strings, so coerce is needed
    page: z.coerce.number().int().min(1).default(1),
    // max(50): the user cannot ask for a huge page
    limit: z.coerce.number().int().min(1).max(50).default(12),
    // No min(1): an empty search just means "no search"
    search: z.string().trim().max(100).optional(),
    category: z.coerce.number().int().positive().optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    sort: z
      .enum(["price_asc", "price_desc", "rating_desc"])
      .default("rating_desc"),
  }),
});
