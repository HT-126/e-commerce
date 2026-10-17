import { z } from "zod";

// One variant = one sellable item (for example "Red, size M")
const variantSchema = z.object({
  // min(1) rejects empty strings. A null SKU fails because it is not a string.
  sku: z.string().min(1),
  price_usd: z.number().positive(),
  //compare_at_price_usd: z.number().positive().nullable(),
  // The file uses 0 for "no discount". We turn 0 into null (our meaning of "no discount").
  compare_at_price_usd: z
    .number()
    .nonnegative()
    .nullable()
    .transform((v) => (v ? v : null)),
  in_stock: z.boolean(),
  options: z.object({
    Color: z.string().min(1),
    Size: z.string().min(1),
  }),
});

const imageSchema = z.object({
  url: z.string().url(),
  alt: z.string(),
});

export const productSchema = z.object({
  handle: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.object({ full_path: z.string().min(1) }),
  // At least 1 image and 1 variant
  images: z.array(imageSchema).min(1),
  variants: z.array(variantSchema).min(1),
  // rating can be missing for 91 products, so make it nullable
  reviews: z.object({
    rating: z.number().min(0).max(5).nullable(),
    // The file uses null when no rating. I store 0 (the DB column is NOT NULL DEFAULT 0).
    count: z
      .number()
      .int()
      .min(0)
      .nullable()
      .transform((v) => v ?? 0), // ?? reacts only NULL, undefined, if null, undefined return 0
  }),
});
