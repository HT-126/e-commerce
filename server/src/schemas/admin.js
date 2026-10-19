import { z } from "zod";

export const adminOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1), // query strings are text
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});
export const adminStatsSchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
  }),
});

export const adminVariantsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    search: z.string().trim().max(100).optional(),
  }),
});

// Money: at most 2 decimals (like DECIMAL(10,2)), and a sane maximum
const money = z.number().positive().max(100000).multipleOf(0.01);

export const updateVariantSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z
    .object({
      price: money.optional(),
      compareAtPrice: money.nullable().optional(), // null = remove the discount
      stockQuantity: z.number().int().min(0).max(100000).optional(),
    })
    // z.object removes unknown fields, so this also catches a body with only wrong names
    .refine((b) => Object.keys(b).length > 0, {
      message: "Send at least one field",
    }),
});

//
export const adminReviewsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const deleteReviewSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

const variantInput = z
  .object({
    sku: z.string().trim().min(1).max(100),
    color: z.string().trim().max(100).optional().nullable(),
    size: z.string().trim().max(50).optional().nullable(),
    price: money,
    compareAtPrice: money.nullable().optional(),
    stockQuantity: z.number().int().min(0).max(100000),
  })
  .refine((v) => v.compareAtPrice == null || v.compareAtPrice > v.price, {
    message: "compareAtPrice must be higher than price (or empty for no discount)",
    path: ["compareAtPrice"],
  });

export const createProductSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(5000).default(""),
    categoryId: z.number().int().positive(),
    imageUrl: z.string().trim().url().max(500).optional(),
    variants: z.array(variantInput).min(1).max(50),
  }),
});

export const deleteProductSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});
