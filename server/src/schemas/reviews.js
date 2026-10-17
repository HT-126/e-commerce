import { z } from "zod";

// Same rule as the product detail route
const handle = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(100);

export const listReviewsSchema = z.object({
  params: z.object({ handle }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1), // query strings are text, so coerce
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export const createReviewSchema = z.object({
  params: z.object({ handle }),
  body: z.object({
    // JSON keeps numbers as numbers, so "4" (text) is rejected on purpose
    rating: z.number().int().min(1).max(5),
    // Missing or empty comment -> null (the column allows NULL)
    comment: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => v || null),
  }),
});
